import { wrap, rand } from "../../engine/math.js";
import { drawCircularGlow } from "../../rendering/GlowRenderer.js";

export class Particle {
  constructor(x = 0, y = 0, vx = 0, vy = 0, life = 0.2, radius = 1) {
    this.reset(x, y, vx, vy, life, radius);
  }

  reset(x, y, vx, vy, life, radius) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.radius = radius;
    this.dead = false;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    // petit frein pour un rendu “explosion”
    const damp = Math.pow(0.25, dt);
    this.vx *= damp;
    this.vy *= damp;

    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  drawBase(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    const rr = this.radius * (0.6 + 0.4 * t);

    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.x, this.y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGlow(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    const rr = this.radius * (0.8 + 0.8 * t);
    drawCircularGlow(ctx, this.x, this.y, rr, "rgba(220,240,255,0.95)", t);
  }

  draw(ctx) {
    this.drawBase(ctx);
    this.drawGlow(ctx);
  }


  static burst(x, y, count, speedMin, speedMax, lifeMin, lifeMax, rMin, rMax, acquire = null, maxToSpawn = count) {
    const out = [];
    const make = acquire ?? ((px, py, pvx, pvy, life, radius) => new Particle(px, py, pvx, pvy, life, radius));
    const target = Math.max(0, Math.min(count, Math.floor(maxToSpawn)));

    for (let i = 0; i < target; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speedMin, speedMax);
      out.push(make(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(lifeMin, lifeMax),
        rand(rMin, rMax)
      ));
    }
    return out;
  }
}
