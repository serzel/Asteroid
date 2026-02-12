export class Explosion {
  constructor(x, y, duration = 0.35, maxRadius = 38) {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.duration = duration;
    this.maxRadius = maxRadius;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.duration) this.dead = true;
  }

  draw(ctx) {
    const p = Math.min(1, this.t / this.duration);
    const r = this.maxRadius * p;

    ctx.save();
    // anneau + fade out
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // petite seconde couronne pour un feeling “pop”
    ctx.globalAlpha = (1 - p) * 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
