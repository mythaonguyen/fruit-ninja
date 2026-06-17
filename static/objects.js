/**
 * Spawnable game objects — fruits, food, coffee, chili.
 */

const OBJECT_TYPES = {
  avocado: { category: "fruit", score: 1, weight: 22 },
  cherry: { category: "fruit", score: 1, weight: 22 },
  grape: { category: "fruit", score: 1, weight: 22 },
  onigiri: { category: "food", score: 3, weight: 14 },
  sushi: { category: "food", score: 3, weight: 14 },
  coffee: { category: "coffee", score: 0, weight: 10 },
  chili: { category: "chili", score: 0, weight: 8 },
};

const SPAWN_WEIGHT_TOTAL = Object.values(OBJECT_TYPES).reduce((s, t) => s + t.weight, 0);

function pickRandomType() {
  let roll = Math.random() * SPAWN_WEIGHT_TOTAL;
  for (const [name, cfg] of Object.entries(OBJECT_TYPES)) {
    roll -= cfg.weight;
    if (roll <= 0) return name;
  }
  return "avocado";
}

/** Random spawn point off-screen + velocity guaranteed to cross the play area. */
const SpawnGenerator = {
  MARGIN: 45,
  GRAVITY: 0.18,
  MAX_ATTEMPTS: 16,
  MIN_VISIBLE_FRAMES: 24,

  randomInRange(min, max) {
    return min + Math.random() * (max - min);
  },

  playBounds() {
    const pad = width * 0.08;
    return {
      left: pad,
      right: width - pad,
      top: pad,
      bottom: height - pad,
    };
  },

  isInsidePlayArea(x, y, bounds) {
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  },

  /** Pair an off-screen entry with an in-screen target on the opposite side. */
  randomEntryAndTarget() {
    const m = this.MARGIN;
    const b = this.playBounds();
    const side = Math.floor(Math.random() * 4);

    switch (side) {
      case 0: // bottom → fly upward
        return {
          entry: { x: this.randomInRange(b.left, b.right), y: height + m },
          target: {
            x: this.randomInRange(b.left, b.right),
            y: this.randomInRange(b.top, height * 0.55),
          },
        };
      case 1: // top → fly downward
        return {
          entry: { x: this.randomInRange(b.left, b.right), y: -m },
          target: {
            x: this.randomInRange(b.left, b.right),
            y: this.randomInRange(height * 0.45, b.bottom),
          },
        };
      case 2: // left → fly right
        return {
          entry: { x: -m, y: this.randomInRange(b.top, b.bottom) },
          target: {
            x: this.randomInRange(width * 0.35, b.right),
            y: this.randomInRange(b.top, b.bottom),
          },
        };
      case 3: // right → fly left
        return {
          entry: { x: width + m, y: this.randomInRange(b.top, b.bottom) },
          target: {
            x: this.randomInRange(b.left, width * 0.65),
            y: this.randomInRange(b.top, b.bottom),
          },
        };
      default:
        return {
          entry: { x: width * 0.5, y: height + m },
          target: { x: width * 0.5, y: height * 0.4 },
        };
    }
  },

  velocityToward(entry, target, speed) {
    const dx = target.x - entry.x;
    const dy = target.y - entry.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const perpX = -ny;
    const perpY = nx;
    const magnitude = speed * this.randomInRange(1.0, 1.35);
    const wobble = this.randomInRange(-0.35, 0.35);
    return {
      vx: nx * magnitude + perpX * wobble,
      vy: ny * magnitude + perpY * wobble,
    };
  },

  /** Simulate physics and confirm the object spends time inside the play area. */
  simulatesIntoView(x, y, vx, vy) {
    const bounds = this.playBounds();
    let px = x;
    let py = y;
    let pvx = vx;
    let pvy = vy;
    let visibleFrames = 0;

    for (let i = 0; i < 180; i++) {
      px += pvx;
      py += pvy;
      pvy += this.GRAVITY;
      if (this.isInsidePlayArea(px, py, bounds)) {
        visibleFrames++;
      }
    }

    return visibleFrames >= this.MIN_VISIBLE_FRAMES;
  },

  fallback(speed) {
    const b = this.playBounds();
    const x = this.randomInRange(b.left, b.right);
    const y = height + this.MARGIN;
    const target = { x: this.randomInRange(b.left, b.right), y: this.randomInRange(b.top, height * 0.5) };
    const { vx, vy } = this.velocityToward({ x, y }, target, speed);
    return { x, y, vx, vy };
  },

  generate(speed) {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const { entry, target } = this.randomEntryAndTarget();
      const { vx, vy } = this.velocityToward(entry, target, speed);
      if (this.simulatesIntoView(entry.x, entry.y, vx, vy)) {
        return { x: entry.x, y: entry.y, vx, vy };
      }
    }
    return this.fallback(speed);
  },
};

class GameObject {
  constructor(type, x, y, img, vx, vy) {
    this.type = type;
    this.config = OBJECT_TYPES[type];
    this.x = x;
    this.y = y;
    this.img = img;
    this.size = 80;
    this.vx = vx;
    this.vy = vy;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.08;
    this.alive = true;
    this.eaten = false;
    this.eatAnim = 0;
  }

  update() {
    if (this.eaten) {
      this.eatAnim += 0.12;
      this.size *= 0.88;
      return this.eatAnim < 1;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vy += SpawnGenerator.GRAVITY;
    this.rotation += this.rotSpeed;
    if (
      this.y > height + this.size ||
      this.y < -this.size ||
      this.x < -this.size ||
      this.x > width + this.size
    ) {
      this.alive = false;
    }
    return this.alive;
  }

  getHitbox() {
    const s = this.size * 0.7;
    return { x: this.x - s / 2, y: this.y - s / 2, w: s, h: s };
  }

  markEaten() {
    this.eaten = true;
  }

  draw() {
    if (!this.img) return;
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    imageMode(CENTER);
    const alpha = this.eaten ? map(this.eatAnim, 0, 1, 255, 0) : 255;
    tint(255, alpha);
    image(this.img, 0, 0, this.size, this.size);
    noTint();
    pop();
  }
}

function spawnObject(images, speed) {
  const type = pickRandomType();
  const img = images[type];
  const { x, y, vx, vy } = SpawnGenerator.generate(speed);
  return new GameObject(type, x, y, img, vx, vy);
}

function hitboxesOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
