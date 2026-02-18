const MIN_INTENSITY = 0;
const MAX_INTENSITY = 0.6;
const MIN_RADIUS = 0.5;
const MIN_WIDTH = 0.5;
const TWO_PI = Math.PI * 2;

const OUTLINE_WIDTH_MUL_0 = 2.2;
const OUTLINE_WIDTH_MUL_1 = 1.55;
const OUTLINE_WIDTH_MUL_2 = 1.1;

const HALO_ALPHA_CAP = 0.13;
const CORE_ALPHA_CAP = 0.17;
const MAX_GLOW_BRIGHTNESS_GAIN = 0.28;

const colorCache = new Map();

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function clampIntensity(intensity) {
  return clamp(Number.isFinite(intensity) ? intensity : 0, MIN_INTENSITY, MAX_INTENSITY);
}

function parseColor(color) {
  if (typeof color !== "string") {
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  const cached = colorCache.get(color);
  if (cached) return cached;

  let parsed = { r: 255, g: 255, b: 255, a: 1 };

  if (color[0] === "#") {
    const raw = color.slice(1);
    if (/^[0-9a-f]{3}$/i.test(raw)) {
      parsed = {
        r: Number.parseInt(raw[0] + raw[0], 16),
        g: Number.parseInt(raw[1] + raw[1], 16),
        b: Number.parseInt(raw[2] + raw[2], 16),
        a: 1,
      };
    } else if (/^[0-9a-f]{6}$/i.test(raw)) {
      parsed = {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
        a: 1,
      };
    }
  } else {
    const match = color.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const channels = match[1].split(",");
      parsed = {
        r: clamp(Number.parseFloat(channels[0]) || 255, 0, 255),
        g: clamp(Number.parseFloat(channels[1]) || 255, 0, 255),
        b: clamp(Number.parseFloat(channels[2]) || 255, 0, 255),
        a: clamp(channels[3] == null ? 1 : Number.parseFloat(channels[3]) || 0, 0, 1),
      };
    }
  }

  colorCache.set(color, parsed);
  return parsed;
}

function getSafeAlphaCap(parsed, requestedCap = 1) {
  const luminance = ((0.2126 * parsed.r) + (0.7152 * parsed.g) + (0.0722 * parsed.b)) / 255;
  const overflowCap = luminance > 0 ? MAX_GLOW_BRIGHTNESS_GAIN / luminance : requestedCap;
  return clamp(Math.min(requestedCap, overflowCap), 0, 1);
}

export function colorLock(color, alpha = 1, alphaCap = 1) {
  const parsed = parseColor(color);
  const safeCap = getSafeAlphaCap(parsed, alphaCap);
  const lockedAlpha = clamp(parsed.a * alpha, 0, safeCap);
  return `rgba(${parsed.r},${parsed.g},${parsed.b},${lockedAlpha})`;
}

export function drawCircularGlow(ctx, x, y, radius, color, intensity = 1) {
  const glowIntensity = clampIntensity(intensity);
  const r = Math.max(MIN_RADIUS, Number.isFinite(radius) ? radius : 1);
  const outerRadius = r * (0.98 + glowIntensity * 0.44);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, outerRadius);
  grad.addColorStop(0, colorLock(color, 0.11 + glowIntensity * 0.09, HALO_ALPHA_CAP));
  grad.addColorStop(0.32, colorLock(color, 0.075 + glowIntensity * 0.07, HALO_ALPHA_CAP));
  grad.addColorStop(0.66, colorLock(color, 0.042 + glowIntensity * 0.045, HALO_ALPHA_CAP));
  grad.addColorStop(1, colorLock(color, 0, HALO_ALPHA_CAP));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, 0, TWO_PI);
  ctx.fill();

  if (glowIntensity > 0.05) {
    const coreRadius = r * (0.24 + glowIntensity * 0.16);
    const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
    coreGrad.addColorStop(0, colorLock(color, 0.14 + glowIntensity * 0.09, CORE_ALPHA_CAP));
    coreGrad.addColorStop(1, colorLock(color, 0, CORE_ALPHA_CAP));

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, TWO_PI);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

export function drawOutlineGlow(ctx, pathFn, color, width = 2, intensity = 1) {
  const glowIntensity = clampIntensity(intensity);
  const w = Math.max(MIN_WIDTH, Number.isFinite(width) ? width : 1);

  const alpha0 = 0.045 + glowIntensity * 0.06;
  const alpha1 = 0.06 + glowIntensity * 0.065;
  const alpha2 = 0.075 + glowIntensity * 0.075;
  const coreAlpha = 0.11 + glowIntensity * 0.09;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = colorLock(color, alpha0, HALO_ALPHA_CAP);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_0;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = colorLock(color, alpha1, HALO_ALPHA_CAP);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_1;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = colorLock(color, alpha2, HALO_ALPHA_CAP);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_2;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = colorLock(color, coreAlpha, CORE_ALPHA_CAP);
  ctx.lineWidth = w;
  pathFn(ctx);
  ctx.stroke();

  ctx.restore();
}
