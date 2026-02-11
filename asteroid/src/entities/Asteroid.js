import { wrap, rand } from "../engine/math.js";

export class Asteroid {
  constructor(x, y, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;            // 3=grand, 2=moyen, 1=petit
    this.radius = size * 18 + 14; // feeling arcade
    const speed = rand(30, 90) / size;
    const a = rand(0, Math.PI * 2);
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.dead = false;

    // forme un peu “rock”
    this.points = this.#makeShape();
    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-1.2, 1.2);
  }

  #makeShape() {
    const pts = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const jitter = rand(0.75, 1.25);
      pts.push({ ang, r: jitter });
    }
    return pts;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "white";
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    ctx.beginPath();
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const rr = this.radius * p.r;
      const px = Math.cos(p.ang) * rr;
      const py = Math.sin(p.ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
