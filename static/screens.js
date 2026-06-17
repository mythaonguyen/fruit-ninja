/**
 * Overlay screens — loading, calibration, splash, game over, heart attack.
 */

const Screens = {
  drawLoading(status) {
    drawOverlay();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Loading camera & face tracking…", width / 2, height / 2 - 16);
    if (status) {
      textSize(14);
      fill(180);
      text(status, width / 2, height / 2 + 20);
    }
  },

  drawCalibrating(progress) {
    drawOverlay(180);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(26);
    text("Keep your mouth closed", width / 2, height / 2 - 30);
    textSize(16);
    fill(200);
    const hint = FaceTracker.hasFaceSamples()
      ? "Calibrating bite detection"
      : "Position your face in the frame";
    text(hint, width / 2, height / 2 + 10);

    const barW = 200;
    const barX = width / 2 - barW / 2;
    const barY = height / 2 + 50;
    noStroke();
    fill(60, 60, 80);
    rect(barX, barY, barW, 10, 5);
    fill(100, 180, 255);
    rect(barX, barY, barW * progress, 10, 5);
  },

  drawSplash() {
    drawOverlay(120);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("Face Ninja", width / 2, height / 2 - 60);
    textSize(20);
    fill(180, 220, 255);
    text("Open your mouth to start!", width / 2, height / 2);
    textSize(14);
    fill(160);
    text("Close your mouth to bite food", width / 2, height / 2 + 36);
  },

  drawGameOver(score, reason) {
    drawOverlay(200);
    fill(255, 100, 100);
    textAlign(CENTER, CENTER);
    textSize(40);
    text("Game Over", width / 2, height / 2 - 50);
    fill(255);
    textSize(20);
    text(reason, width / 2, height / 2);
    textSize(28);
    text(`Final score: ${score}`, width / 2, height / 2 + 50);
    textSize(16);
    fill(180);
    text("Refresh to play again", width / 2, height / 2 + 90);
  },

  drawHeartAttack(score) {
    drawOverlay(200);
    fill(255, 50, 50);
    textAlign(CENTER, CENTER);
    textSize(40);
    text("Heart Attack!", width / 2, height / 2 - 50);
    fill(255);
    textSize(18);
    text("Too much coffee — spawn speed maxed out", width / 2, height / 2);
    textSize(28);
    text(`Final score: ${score}`, width / 2, height / 2 + 50);
    textSize(16);
    fill(180);
    text("Refresh to play again", width / 2, height / 2 + 90);
  },

  drawMouthBox(box, highlight) {
    if (!box || box.w <= 0) return;
    noFill();
    strokeWeight(2);
    if (highlight) {
      stroke(100, 255, 150, 200);
    } else {
      stroke(255, 255, 255, 100);
    }
    rect(box.x, box.y, box.w, box.h, 6);
    noStroke();
  },
};

function drawOverlay(alpha = 140) {
  fill(0, alpha);
  noStroke();
  rect(0, 0, width, height);
}
