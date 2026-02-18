import { wrap } from "../engine/math.js";
import { colorLock, drawCircularGlow, drawOutlineGlow } from "../rendering/GlowRenderer.js";

const BULLET_FX = {
  bodyLength: 6.4,
  bodyWidth: 2.4,
  trailLength: 12,
  coreRadius: 1.5,
  trailAlpha: 0.2,
  trailLineWidth: 2,
  trailStartOffset: 1.5,
  style: {
    level2: { bodyLengthMul: 1.25, bodyWidthMul: 0.85, trailLengthMul: 1.2 },
    level3: { glowIntensityMul: 1.08 },
    level4Plus: { bodyLengthMul: 0.8, bodyWidthMul: 0.85, trailLengthMul: 0.85, glowIntensityMul: 0.82, coreRadiusMul: 0.9 },
  },
};

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
    this.color = colorLock(`${color}`);
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

  #computeStyle() {
    let bodyLen = BULLET_FX.bodyLength;
    let bodyWid = BULLET_FX.bodyWidth;
    let trailLen = BULLET_FX.trailLength;
    let coreRadius = BULLET_FX.coreRadius;
    let glowIntensity = 0.28;

    if (this.styleLevel === 2) {
      bodyLen *= BULLET_FX.style.level2.bodyLengthMul;
      bodyWid *= BULLET_FX.style.level2.bodyWidthMul;
      trailLen *= BULLET_FX.style.level2.trailLengthMul;
    } else if (this.styleLevel === 3) {
      glowIntensity *= BULLET_FX.style.level3.glowIntensityMul;
    } else if (this.styleLevel >= 4) {
      bodyLen *= BULLET_FX.style.level4Plus.bodyLengthMul;
      bodyWid *= BULLET_FX.style.level4Plus.bodyWidthMul;
      trailLen *= BULLET_FX.style.level4Plus.trailLengthMul;
      glowIntensity *= BULLET_FX.style.level4Plus.glowIntensityMul;
      coreRadius *= BULLET_FX.style.level4Plus.coreRadiusMul;
    }

    return { bodyLen, bodyWid, trailLen, coreRadius, glowIntensity };
  }

  drawBase(ctx) {
    const { bodyLen, bodyWid, trailLen, coreRadius } = this.#computeStyle();
    const backX = -Math.cos(this.angle);
    const backY = -Math.sin(this.angle);

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = BULLET_FX.trailAlpha;
    ctx.lineWidth = BULLET_FX.trailLineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x + backX * BULLET_FX.trailStartOffset, this.y + backY * BULLET_FX.trailStartOffset);
    ctx.lineTo(this.x + backX * trailLen, this.y + backY * trailLen);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGlow(ctx) {
    const { bodyLen, bodyWid, glowIntensity } = this.#computeStyle();
    drawCircularGlow(ctx, this.x, this.y, Math.max(bodyLen, bodyWid) * 1.28, this.color, glowIntensity);
    drawOutlineGlow(ctx, (c) => {
      c.beginPath();
      c.ellipse(this.x, this.y, bodyLen, bodyWid, this.angle, 0, Math.PI * 2);
    }, this.color, 1.0, glowIntensity);
  }

  draw(ctx) {
    this.drawBase(ctx);
    this.drawGlow(ctx);
  }
}
