import { wrap, rand } from "../../engine/math.js";

export class Particle {
  constructor(x, y, vx, vy, life, radius) {
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

  draw(ctx) {
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


  static burst(x, y, count, speedMin, speedMax, lifeMin, lifeMax, rMin, rMax) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speedMin, speedMax);
      out.push(new Particle(
        x, y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(lifeMin, lifeMax),
        rand(rMin, rMax)
      ));
    }
    return out;
  }
}
