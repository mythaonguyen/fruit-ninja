/**
 * MediaPipe Face Landmarker + Mouth Aspect Ratio (MAR) tracking.
 */
const FaceTracker = (() => {
  const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

  const UPPER_LIP = 13;
  const LOWER_LIP = 14;
  const LEFT_MOUTH = 61;
  const RIGHT_MOUTH = 291;
  const CALIBRATION_MS = 2000;
  const OPEN_HOLD_MS = 400;

  let landmarker = null;
  let video = null;
  let ready = false;
  let cameraReady = false;
  let calibrating = false;
  let calibrated = false;
  let calibrationStart = 0;
  let calibrationDone = false;
  const closedSamples = [];

  let mar = 0;
  let threshold = 0.35;
  let mouthOpen = false;
  let biteEdge = false;
  let openHoldStart = 0;
  let openReady = false;
  let mouthBox = { x: 0, y: 0, w: 0, h: 0 };
  let loadingStatus = "Waiting for camera…";
  let visionModule = null;

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  }

  async function waitForVideoFrames() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Camera failed to deliver video frames");
  }

  async function loadVisionModule() {
    if (visionModule) return visionModule;
    loadingStatus = "Loading MediaPipe library…";
    const loader = window.__mpVisionPromise;
    if (!loader) {
      throw new Error("MediaPipe module did not load — refresh the page");
    }
    visionModule = await withTimeout(loader, 60000, "MediaPipe library");
    return visionModule;
  }

  async function createLandmarker(delegate) {
    const { FaceLandmarker, FilesetResolver } = await loadVisionModule();
    loadingStatus = `Loading face model (${delegate})…`;
    const fileset = await withTimeout(
      FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`),
      60000,
      "MediaPipe WASM"
    );
    return withTimeout(
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      }),
      60000,
      `Face model (${delegate})`
    );
  }

  async function initLandmarker() {
    loadingStatus = "Initializing face tracking…";
    try {
      landmarker = await createLandmarker("CPU");
    } catch (cpuErr) {
      console.warn("CPU delegate failed, trying GPU…", cpuErr);
      loadingStatus = "Retrying face tracking (GPU)…";
      landmarker = await createLandmarker("GPU");
    }
  }

  async function init(videoEl) {
    if (!videoEl) {
      throw new Error("No camera video element provided");
    }

    video = videoEl;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");

    loadingStatus = "Starting camera…";
    try {
      if (video.paused) {
        await withTimeout(video.play(), 5000, "Camera play");
      }
    } catch (err) {
      console.warn("video.play() failed, waiting for frames anyway", err);
    }

    await waitForVideoFrames();
    cameraReady = true;
    loadingStatus = "Camera ready — loading face tracking…";

    await initLandmarker();
    ready = true;
    loadingStatus = "Ready";
    startCalibration();
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function computeMAR(landmarks) {
    const upper = landmarks[UPPER_LIP];
    const lower = landmarks[LOWER_LIP];
    const left = landmarks[LEFT_MOUTH];
    const right = landmarks[RIGHT_MOUTH];
    const vertical = dist(upper, lower);
    const horizontal = dist(left, right);
    if (horizontal < 1e-6) return 0;
    return vertical / horizontal;
  }

  function computeMouthBox(landmarks, vw, vh) {
    const indices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61];
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const i of indices) {
      const lm = landmarks[i];
      minX = Math.min(minX, lm.x);
      minY = Math.min(minY, lm.y);
      maxX = Math.max(maxX, lm.x);
      maxY = Math.max(maxY, lm.y);
    }
    const pad = 0.04;
    return {
      x: Math.max(0, minX - pad) * vw,
      y: Math.max(0, minY - pad) * vh,
      w: (Math.min(1, maxX + pad) - Math.max(0, minX - pad)) * vw,
      h: (Math.min(1, maxY + pad) - Math.max(0, minY - pad)) * vh,
    };
  }

  function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stddev(arr, avg) {
    const v = arr.reduce((s, x) => s + (x - avg) ** 2, 0) / arr.length;
    return Math.sqrt(v);
  }

  function startCalibration() {
    calibrating = true;
    calibrated = false;
    calibrationDone = false;
    closedSamples.length = 0;
    calibrationStart = performance.now();
  }

  function finishCalibration() {
    if (calibrationDone) return;
    calibrationDone = true;
    if (closedSamples.length >= 5) {
      const avg = mean(closedSamples);
      const sd = stddev(closedSamples, avg);
      threshold = avg + Math.max(sd * 2.5, 0.08);
    }
    calibrating = false;
    calibrated = true;
  }

  function update() {
    biteEdge = false;
    if (!ready || !landmarker || !video || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const now = performance.now();
    let results;
    try {
      results = landmarker.detectForVideo(video, now);
    } catch (err) {
      console.error("Face detection error:", err);
      return;
    }

    if (!results.faceLandmarks?.length) {
      mouthOpen = false;
      if (calibrating && now - calibrationStart >= CALIBRATION_MS) {
        finishCalibration();
      }
      return;
    }

    const landmarks = results.faceLandmarks[0];
    mar = computeMAR(landmarks);
    mouthBox = computeMouthBox(landmarks, vw, vh);

    if (calibrating) {
      closedSamples.push(mar);
      if (now - calibrationStart >= CALIBRATION_MS) {
        finishCalibration();
      }
      return;
    }

    if (!calibrated) return;

    const wasOpen = mouthOpen;
    mouthOpen = mar > threshold;
    if (wasOpen && !mouthOpen) biteEdge = true;

    if (mouthOpen) {
      if (!openHoldStart) openHoldStart = now;
      if (now - openHoldStart >= OPEN_HOLD_MS) openReady = true;
    } else {
      openHoldStart = 0;
      openReady = false;
    }
  }

  return {
    init,
    update,
    isReady: () => ready,
    isCameraReady: () => cameraReady,
    isCalibrating: () => calibrating,
    isCalibrated: () => calibrated,
    hasFaceSamples: () => closedSamples.length > 0,
    getMAR: () => mar,
    getThreshold: () => threshold,
    getCalibrationProgress: () =>
      calibrating ? Math.min(1, (performance.now() - calibrationStart) / CALIBRATION_MS) : 1,
    isMouthOpen: () => mouthOpen,
    isOpenReady: () => openReady,
    wasBite: () => biteEdge,
    getMouthBox: () => mouthBox,
    getVideo: () => video,
    getLoadingStatus: () => loadingStatus,
    resetOpenReady: () => {
      openReady = false;
      openHoldStart = 0;
    },
    recalibrate: startCalibration,
  };
})();
