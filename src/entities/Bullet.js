import { wrap } from "../engine/math.js";


const BULLET_FX = {
  bodyLength: 6.4,
  bodyWidth: 2.4,
  trailLength: 12,
  glowBlur: 12,
  coreRadius: 1.5,
  trailAlpha: 0.2,
  trailLineWidth: 2,
  trailStartOffset: 1.5,
  style: {
    level2: { bodyLengthMul: 1.25, bodyWidthMul: 0.85, trailLengthMul: 1.2 },
    level3: { glowBlurMul: 1.1 },
    level4Plus: { bodyLengthMul: 0.8, bodyWidthMul: 0.85, trailLengthMul: 0.85, glowBlurMul: 0.85, coreRadiusMul: 0.9 },
  },
};

export class Bullet {
  static nextDebugId = 1;

  constructor(x = 0, y = 0, vx = 0, vy = 0, life = 1.2, color = "white", styleLevel = 1) {
    this.radius = 2;
    this.debugId = Bullet.nextDebugId++;
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
    // Rendu déterministe par projectile: éviter toute dépendance à un état canvas
    // laissé par un renderer précédent (composite/alpha/shadow/filter/line styles).
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.filter = "none";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";

    let bodyLen = BULLET_FX.bodyLength;
    let bodyWid = BULLET_FX.bodyWidth;
    let trailLen = BULLET_FX.trailLength;
    let glowBlur = BULLET_FX.glowBlur;
    let coreRadius = BULLET_FX.coreRadius;

    if (this.styleLevel === 2) {
      bodyLen *= BULLET_FX.style.level2.bodyLengthMul;
      bodyWid *= BULLET_FX.style.level2.bodyWidthMul;
      trailLen *= BULLET_FX.style.level2.trailLengthMul;
    } else if (this.styleLevel === 3) {
      glowBlur *= BULLET_FX.style.level3.glowBlurMul;
    } else if (this.styleLevel >= 4) {
      bodyLen *= BULLET_FX.style.level4Plus.bodyLengthMul;
      bodyWid *= BULLET_FX.style.level4Plus.bodyWidthMul;
      trailLen *= BULLET_FX.style.level4Plus.trailLengthMul;
      glowBlur *= BULLET_FX.style.level4Plus.glowBlurMul;
      coreRadius *= BULLET_FX.style.level4Plus.coreRadiusMul;
    }

    const backX = -Math.cos(this.angle);
    const backY = -Math.sin(this.angle);

    ctx.save();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = BULLET_FX.trailAlpha;
    ctx.lineWidth = BULLET_FX.trailLineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x + backX * BULLET_FX.trailStartOffset, this.y + backY * BULLET_FX.trailStartOffset);
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

  getRenderDebugState() {
    return {
      id: this.debugId,
      x: this.x,
      y: this.y,
      angle: this.angle,
      color: this.color,
      styleLevel: this.styleLevel,
      life: this.life,
      radius: this.radius,
    };
  }
}
