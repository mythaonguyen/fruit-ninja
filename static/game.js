/**
 * Main p5.js game loop and state machine.
 *
 * States: LOADING → CALIBRATING → SPLASH → PLAYING → GAME_OVER | HEART_ATTACK
 */

const GameConfig = {
  MAX_SPEED_LEVEL: 6,
  BASE_SPAWN_MS: 1800,
  MIN_SPAWN_MS: 450,
};

const GameState = {
  LOADING: "loading",
  CALIBRATING: "calibrating",
  SPLASH: "splash",
  PLAYING: "playing",
  GAME_OVER: "game_over",
  HEART_ATTACK: "heart_attack",
};

let gameState = GameState.LOADING;
let images = {};
let objects = [];
let spawnTimer = 0;
let biteFlash = 0;
let initError = null;
let faceInitStarted = false;
let capture = null;

function startFaceInit(videoEl) {
  if (faceInitStarted) return;
  faceInitStarted = true;
  FaceTracker.init(videoEl).catch((err) => {
    initError = err?.message || "Failed to start camera or face tracking";
    console.error(err);
  });
}

function drawWebcam() {
  if (!capture || capture.width === 0) return false;
  push();
  translate(width, 0);
  scale(-1, 1);
  image(capture, 0, 0, width, height);
  pop();
  return true;
}

const ASSET_NAMES = ["avocado", "cherry", "grape", "onigiri", "sushi", "coffee", "chili"];

function getSpawnInterval() {
  const level = HUD.speedLevel;
  const ms = GameConfig.BASE_SPAWN_MS / (0.6 + level * 0.35);
  return Math.max(GameConfig.MIN_SPAWN_MS, ms);
}

function getObjectSpeed() {
  return 3 + HUD.speedLevel * 0.9;
}

function mirrorMouthBox(box, vw, vh) {
  return {
    x: vw - box.x - box.w,
    y: box.y,
    w: box.w,
    h: box.h,
  };
}

function scaleMouthBox(box, vw, vh) {
  const sx = width / vw;
  const sy = height / vh;
  return {
    x: box.x * sx,
    y: box.y * sy,
    w: box.w * sx,
    h: box.h * sy,
  };
}

function startGame() {
  HUD.reset();
  objects = [];
  spawnTimer = 0;
  gameState = GameState.PLAYING;
  FaceTracker.resetOpenReady();
}

function endGame(reason) {
  if (reason === "heart_attack") {
    gameState = GameState.HEART_ATTACK;
  } else {
    gameState = GameState.GAME_OVER;
  }
}

function checkHeartAttack() {
  if (HUD.speedLevel >= GameConfig.MAX_SPEED_LEVEL) {
    endGame("heart_attack");
    return true;
  }
  return false;
}

function handleBite(mouthBox) {
  for (const obj of objects) {
    if (!obj.alive || obj.eaten) continue;
    if (hitboxesOverlap(mouthBox, obj.getHitbox())) {
      obj.markEaten();
      biteFlash = 8;
      applyObjectEffect(obj);
      break;
    }
  }
}

function applyObjectEffect(obj) {
  const cat = obj.config.category;
  if (cat === "fruit") {
    HUD.score += 1;
  } else if (cat === "food") {
    HUD.score += 3;
  } else if (cat === "coffee") {
    HUD.speedLevel += 1;
    checkHeartAttack();
  } else if (cat === "chili") {
    HUD.hearts -= 1;
    if (HUD.hearts <= 0) {
      endGame("no_hearts");
    }
  }
}

function assetPath(relativePath) {
  return new URL(relativePath, document.baseURI).href;
}

function preload() {
  for (const name of ASSET_NAMES) {
    images[name] = loadImage(assetPath(`static/assets/${name}.png`));
  }
}

function setup() {
  const canvas = createCanvas(640, 480);
  canvas.parent("game-container");

  capture = createCapture(
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    () => {
      capture.size(width, height);
      capture.hide();
      startFaceInit(capture.elt);
    }
  );
}

function draw() {
  if (initError) {
    background(26, 26, 46);
    fill(255, 100, 100);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(`Could not start: ${initError}`, width / 2, height / 2);
    return;
  }

  FaceTracker.update();

  if (!drawWebcam()) {
    background(26, 26, 46);
  }

  updateStateMachine();

  if (gameState === GameState.PLAYING) {
    updateGameplay();
    HUD.draw();
  }

  if (biteFlash > 0) {
    biteFlash--;
    fill(255, 255, 200, biteFlash * 20);
    noStroke();
    rect(0, 0, width, height);
  }

  drawMouthIndicator();
}

function updateStateMachine() {
  if (!FaceTracker.isReady()) {
    gameState = GameState.LOADING;
    Screens.drawLoading(FaceTracker.getLoadingStatus());
    return;
  }

  if (FaceTracker.isCalibrating()) {
    gameState = GameState.CALIBRATING;
    Screens.drawCalibrating(FaceTracker.getCalibrationProgress());
    return;
  }

  if (gameState === GameState.LOADING || gameState === GameState.CALIBRATING) {
    gameState = GameState.SPLASH;
  }

  if (gameState === GameState.SPLASH) {
    Screens.drawSplash();
    if (FaceTracker.isOpenReady()) {
      startGame();
    }
    return;
  }

  if (gameState === GameState.GAME_OVER) {
    Screens.drawGameOver(HUD.score, "You ran out of hearts!");
    return;
  }

  if (gameState === GameState.HEART_ATTACK) {
    Screens.drawHeartAttack(HUD.score);
    return;
  }
}

function updateGameplay() {
  spawnTimer += deltaTime;
  const interval = getSpawnInterval();
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    objects.push(spawnObject(images, getObjectSpeed()));
  }

  objects = objects.filter((obj) => obj.update());

  for (const obj of objects) {
    obj.draw();
  }

  if (FaceTracker.wasBite()) {
    const box = getScaledMouthBox();
    if (box) handleBite(box);
  }
}

function getScaledMouthBox() {
  const video = FaceTracker.getVideo();
  if (!video) return null;
  const raw = FaceTracker.getMouthBox();
  const mirrored = mirrorMouthBox(raw, video.videoWidth, video.videoHeight);
  return scaleMouthBox(mirrored, video.videoWidth, video.videoHeight);
}

function drawMouthIndicator() {
  if (gameState !== GameState.PLAYING && gameState !== GameState.SPLASH) return;
  const box = getScaledMouthBox();
  if (!box) return;
  const highlight = FaceTracker.wasBite() || biteFlash > 0;
  Screens.drawMouthBox(box, highlight);
}