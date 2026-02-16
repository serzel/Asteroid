import { wrap, rand } from "../../engine/math.js";

export class DebrisParticle {
  constructor(x = 0, y = 0, vx = 0, vy = 0, life = 0.2, size = 1, color = "white") {
    this.reset(x, y, vx, vy, life, size, color);
  }

  reset(x, y, vx, vy, life, size, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.dead = false;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    const damp = Math.pow(0.18, dt);
    this.vx *= damp;
    this.vy *= damp;

    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    const dx = this.vx * 0.012;
    const dy = this.vy * 0.012;

    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.size;
    ctx.lineCap = "round";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(this.x - dx, this.y - dy);
    ctx.lineTo(this.x + dx, this.y + dy);
    ctx.stroke();
    ctx.restore();
  }

  static spray(x, y, count, color, speedMin = 45, speedMax = 170, acquire = null) {
    const out = [];
    const make = acquire ?? ((px, py, pvx, pvy, life, size, particleColor) => new DebrisParticle(px, py, pvx, pvy, life, size, particleColor));

    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speedMin, speedMax);
      out.push(make(
        x + rand(-2, 2),
        y + rand(-2, 2),
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.25, 0.6),
        rand(1, 2),
        color
      ));
    }
    return out;
  }
}
