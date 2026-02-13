import { wrap } from "../engine/math.js";

export class Bullet {
  constructor(x, y, vx, vy, life = 1.2, color = "white", styleLevel = 1) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 2;
    this.life = life; // secondes
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
    const profile = {
      bodyLen: 6.4,
      bodyWid: 2.4,
      trailLen: 12,
      glowBlur: 12,
      coreRadius: 1.5,
    };

    if (this.styleLevel === 2) {
      profile.bodyLen *= 1.25;
      profile.bodyWid *= 0.85;
      profile.trailLen *= 1.2;
    } else if (this.styleLevel === 3) {
      profile.glowBlur *= 1.1;
    } else if (this.styleLevel >= 4) {
      profile.bodyLen *= 0.8;
      profile.bodyWid *= 0.85;
      profile.trailLen *= 0.85;
      profile.glowBlur *= 0.85;
      profile.coreRadius *= 0.9;
    }

    const backX = Math.cos(this.angle + Math.PI);
    const backY = Math.sin(this.angle + Math.PI);

    ctx.save();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x + backX * 1.5, this.y + backY * 1.5);
    ctx.lineTo(this.x + backX * profile.trailLen, this.y + backY * profile.trailLen);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = profile.glowBlur;
    ctx.beginPath();
    ctx.ellipse(0, 0, profile.bodyLen, profile.bodyWid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, profile.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
