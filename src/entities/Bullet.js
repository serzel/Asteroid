import { wrap } from "../engine/math.js";
import { drawCircularGlow, drawOutlineGlow } from "../rendering/GlowRenderer.js";

const BULLET_FX = {
  bodyLength: 6.4,
  bodyWidth: 2.4,
  trailLength: 12,
  coreRadius: 1.5,
  trailAlpha: 0.2,
  trailLineWidth: 2,
  trailStartOffset: 1.5,
  baseGlowIntensity: 0.26,
  style: {
    level2: { bodyLengthMul: 1.25, bodyWidthMul: 0.85, trailLengthMul: 1.2 },
    level3: { glowIntensityMul: 1.08 },
    level4Plus: { bodyLengthMul: 0.8, bodyWidthMul: 0.85, trailLengthMul: 0.85, glowIntensityMul: 0.82, coreRadiusMul: 0.9 },
  },
};

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function parseColorInput(color) {
  if (color && typeof color === "object") {
    return {
      r: clamp(Number.isFinite(color.r) ? color.r : 255, 0, 255),
      g: clamp(Number.isFinite(color.g) ? color.g : 255, 0, 255),
      b: clamp(Number.isFinite(color.b) ? color.b : 255, 0, 255),
      a: clamp(Number.isFinite(color.a) ? color.a : 1, 0, 1),
    };
  }

  const raw = `${color ?? "rgba(255,255,255,1)"}`;
  const match = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (match) {
    const channels = match[1].split(",");
    return {
      r: clamp(Number.parseFloat(channels[0]) || 255, 0, 255),
      g: clamp(Number.parseFloat(channels[1]) || 255, 0, 255),
      b: clamp(Number.parseFloat(channels[2]) || 255, 0, 255),
      a: clamp(channels[3] == null ? 1 : Number.parseFloat(channels[3]) || 0, 0, 1),
    };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

function cloneColor(color) {
  return { r: color.r, g: color.g, b: color.b, a: color.a };
}

function colorToCss(color, alphaMul = 1) {
  return `rgba(${color.r},${color.g},${color.b},${clamp(color.a * alphaMul, 0, 1)})`;
}

export class Bullet {
  constructor(x = 0, y = 0, vx = 0, vy = 0, life = 1.2, color = "white", styleLevel = 1) {
    this.radius = 2;
    this.reset(x, y, vx, vy, life, color, styleLevel);
  }

  reset(x, y, vx, vy, life = 1.2, color = "white", styleLevel = 1) {
    const parsedColor = parseColorInput(color);

    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.vx = Number.isFinite(vx) ? vx : 0;
    this.vy = Number.isFinite(vy) ? vy : 0;

    this.maxLife = Number.isFinite(life) ? Math.max(0.01, life) : 1.2;
    this.life = this.maxLife;
    this.age = 0;
    this.dead = false;

    this.color = cloneColor(parsedColor);
    this.colorCss = colorToCss(this.color);
    this.alpha = 1;

    this.styleLevel = Number.isFinite(styleLevel) ? styleLevel : 1;
    this.glowTier = "low";
    this.intensity = BULLET_FX.baseGlowIntensity;
    this.spawnBoost = 1;
    this.animationProgress = 0;
    this.tempFlag = false;

    this.angle = Math.atan2(this.vy, this.vx);
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);
    this.life -= dt;
    this.age += dt;
    this.animationProgress = this.maxLife > 0 ? clamp(this.age / this.maxLife, 0, 1) : 1;
    if (this.life <= 0) this.dead = true;
  }

  #computeStyle() {
    let bodyLen = BULLET_FX.bodyLength;
    let bodyWid = BULLET_FX.bodyWidth;
    let trailLen = BULLET_FX.trailLength;
    let coreRadius = BULLET_FX.coreRadius;
    let glowIntensity = this.intensity;

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
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this.colorCss;
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
    ctx.fillStyle = this.colorCss;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.colorCss;
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGlow(ctx) {
    const { bodyLen, bodyWid, glowIntensity } = this.#computeStyle();
    const isolatedColor = cloneColor(this.color);

    drawCircularGlow(ctx, this.x, this.y, Math.max(bodyLen, bodyWid) * 0.96, isolatedColor, glowIntensity, this.glowTier);
    drawOutlineGlow(ctx, (c) => {
      c.beginPath();
      c.ellipse(this.x, this.y, bodyLen, bodyWid, this.angle, 0, Math.PI * 2);
    }, isolatedColor, 0.9, glowIntensity, this.glowTier);
  }

  draw(ctx) {
    this.drawBase(ctx);
    this.drawGlow(ctx);
  }
}
