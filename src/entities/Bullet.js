import { wrap } from "../engine/math.js";

export class Bullet {
  constructor(x = 0, y = 0, vx = 0, vy = 0, life = 1.2, color = "white", styleLevel = 1) {
    this.radius = 2;
    this.reset(x, y, vx, vy, life, color, styleLevel);
  }

  reset(x, y, vx, vy, life = 1.2, color = "white", styleLevel = 1) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.dead = false;
    this.color = `${color}`;
    this.styleLevel = styleLevel;
    this.angle = Math.atan2(vy, vx);
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
    let bodyLen = 6.4;
    let bodyWid = 2.4;
    let trailLen = 12;
    let glowBlur = 12;
    let coreRadius = 1.5;

    if (this.styleLevel === 2) {
      bodyLen *= 1.25;
      bodyWid *= 0.85;
      trailLen *= 1.2;
    } else if (this.styleLevel === 3) {
      glowBlur *= 1.1;
    } else if (this.styleLevel >= 4) {
      bodyLen *= 0.8;
      bodyWid *= 0.85;
      trailLen *= 0.85;
      glowBlur *= 0.85;
      coreRadius *= 0.9;
    }

    const backX = -Math.cos(this.angle);
    const backY = -Math.sin(this.angle);

    ctx.save();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x + backX * 1.5, this.y + backY * 1.5);
    ctx.lineTo(this.x + backX * trailLen, this.y + backY * trailLen);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = glowBlur;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
