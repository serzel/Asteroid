import { wrap } from "../engine/math.js";

export class Bullet {
  constructor(x, y, vx, vy, life = 1.2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 2;
    this.life = life; // secondes
    this.dead = false;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
