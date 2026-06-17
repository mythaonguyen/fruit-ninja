/**
 * In-game HUD — hearts, score, speed level.
 */

const HUD = {
  hearts: 3,
  score: 0,
  speedLevel: 1,

  reset() {
    this.hearts = 3;
    this.score = 0;
    this.speedLevel = 1;
  },

  draw() {
    push();
    noStroke();

    for (let i = 0; i < 3; i++) {
      const x = 24 + i * 36;
      const y = 28;
      if (i < this.hearts) {
        fill(255, 70, 90);
      } else {
        fill(80, 80, 100);
      }
      textSize(28);
      textAlign(LEFT, TOP);
      text("♥", x, y);
    }

    fill(255);
    textSize(22);
    textAlign(RIGHT, TOP);
    text(`Score: ${this.score}`, width - 24, 24);

    const barW = 120;
    const barX = width / 2 - barW / 2;
    const barY = 20;
    fill(40, 40, 60);
    rect(barX, barY, barW, 14, 7);
    const maxLevel = GameConfig.MAX_SPEED_LEVEL;
    const fillW = map(this.speedLevel, 1, maxLevel, barW * 0.15, barW);
    const t = this.speedLevel / maxLevel;
    fill(lerpColor(color(100, 200, 120), color(255, 60, 60), t));
    rect(barX, barY, fillW, 14, 7);
    fill(200);
    textSize(12);
    textAlign(CENTER, TOP);
    text(`Speed ${this.speedLevel}`, width / 2, 38);

    pop();
  },
};
