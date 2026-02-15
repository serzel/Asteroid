const BG_LAYER_CONFIG = [
  { density: 0.00022, speedMul: 0.18, alphaMin: 0.18, alphaMax: 0.45, radiusMin: 0.7, radiusMax: 1.5 },
  { density: 0.00016, speedMul: 0.42, alphaMin: 0.26, alphaMax: 0.62, radiusMin: 1.0, radiusMax: 2.2 },
  { density: 0.00009, speedMul: 0.8, alphaMin: 0.4, alphaMax: 0.92, radiusMin: 1.4, radiusMax: 3.1 },
];

const BG_DRIFT_X = 9;
const BG_DRIFT_Y = 5;

export class Background {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.time = 0;
    this.ambienceFactor = 0;
    this.layers = [];
    this.resize(width, height);
  }

  #buildLayer(config) {
    const area = this.w * this.h;
    const count = Math.max(35, Math.floor(area * config.density));
    const stars = [];

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin),
        a: config.alphaMin + Math.random() * (config.alphaMax - config.alphaMin),
        speedMul: config.speedMul * (0.65 + Math.random() * 0.7),
      });
    }

    return { ...config, stars };
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.layers = BG_LAYER_CONFIG.map((config) => this.#buildLayer(config));
  }

  setAmbienceFactor(value) {
    this.ambienceFactor = Math.max(0, Math.min(1, value));
  }

  update(dt) {
    this.time += dt;

    for (const layer of this.layers) {
      const dx = BG_DRIFT_X * layer.speedMul * dt;
      const dy = BG_DRIFT_Y * layer.speedMul * dt;
      for (const star of layer.stars) {
        star.x += dx * star.speedMul;
        star.y += dy * star.speedMul;

        if (star.x < 0) star.x += this.w;
        if (star.x > this.w) star.x -= this.w;
        if (star.y < 0) star.y += this.h;
        if (star.y > this.h) star.y -= this.h;
      }
    }
  }

  draw(ctx) {
    const bg = ctx.createLinearGradient(0, 0, this.w, this.h);
    bg.addColorStop(0, "hsl(224, 62%, 14%)");
    bg.addColorStop(0.45, "hsl(238, 65%, 10%)");
    bg.addColorStop(1, "hsl(256, 70%, 8%)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const glow = 1 + this.ambienceFactor * 0.35;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      for (const star of layer.stars) {
        const twinkle = 0.8 + 0.2 * Math.sin(this.time * (1.2 + i * 0.5) + (star.x + star.y) * 0.01);
        ctx.globalAlpha = Math.min(1, star.a * twinkle * glow);
        ctx.fillStyle = i === 2 ? "rgba(200,230,255,1)" : "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  render(ctx) {
    this.draw(ctx);
  }
}
