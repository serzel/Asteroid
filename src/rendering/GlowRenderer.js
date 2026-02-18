const MIN_INTENSITY = 0;
const MAX_INTENSITY = 2.5;
const MIN_RADIUS = 0.5;
const MIN_WIDTH = 0.5;
const TWO_PI = Math.PI * 2;

const OUTLINE_WIDTH_MUL_0 = 3.2;
const OUTLINE_WIDTH_MUL_1 = 2.1;
const OUTLINE_WIDTH_MUL_2 = 1.35;

const colorCache = new Map();

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function clampIntensity(intensity) {
  return clamp(Number.isFinite(intensity) ? intensity : 0, MIN_INTENSITY, MAX_INTENSITY);
}

function parseColorToRgb(color) {
  if (typeof color !== "string") return "255,255,255";

  const cached = colorCache.get(color);
  if (cached) return cached;

  let rgb = "255,255,255";

  if (color[0] === "#") {
    const raw = color.slice(1);
    if (/^[0-9a-f]{3}$/i.test(raw)) {
      const r = Number.parseInt(raw[0] + raw[0], 16);
      const g = Number.parseInt(raw[1] + raw[1], 16);
      const b = Number.parseInt(raw[2] + raw[2], 16);
      rgb = `${r},${g},${b}`;
    } else if (/^[0-9a-f]{6}$/i.test(raw)) {
      const r = Number.parseInt(raw.slice(0, 2), 16);
      const g = Number.parseInt(raw.slice(2, 4), 16);
      const b = Number.parseInt(raw.slice(4, 6), 16);
      rgb = `${r},${g},${b}`;
    }
  } else {
    const match = color.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const channels = match[1].split(",");
      const r = clamp(Number.parseFloat(channels[0]) || 255, 0, 255);
      const g = clamp(Number.parseFloat(channels[1]) || 255, 0, 255);
      const b = clamp(Number.parseFloat(channels[2]) || 255, 0, 255);
      rgb = `${r},${g},${b}`;
    }
  }

  colorCache.set(color, rgb);
  return rgb;
}

function rgbaFromRgb(rgb, alpha) {
  return `rgba(${rgb},${clamp(alpha, 0, 1)})`;
}

export function drawCircularGlow(ctx, x, y, radius, color, intensity = 1) {
  const glowIntensity = clampIntensity(intensity);
  const r = Math.max(MIN_RADIUS, Number.isFinite(radius) ? radius : 1);
  const outerRadius = r * (1.8 + glowIntensity * 1.4);
  const rgb = parseColorToRgb(color);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(x, y, 0, x, y, outerRadius);
  grad.addColorStop(0, rgbaFromRgb(rgb, 0.3 + glowIntensity * 0.25));
  grad.addColorStop(0.35, rgbaFromRgb(rgb, 0.16 + glowIntensity * 0.16));
  grad.addColorStop(1, rgbaFromRgb(rgb, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, 0, TWO_PI);
  ctx.fill();

  ctx.restore();
}

export function drawOutlineGlow(ctx, pathFn, color, width = 2, intensity = 1) {
  const glowIntensity = clampIntensity(intensity);
  const w = Math.max(MIN_WIDTH, Number.isFinite(width) ? width : 1);
  const rgb = parseColorToRgb(color);

  const alpha0 = 0.08 + glowIntensity * 0.08;
  const alpha1 = 0.12 + glowIntensity * 0.1;
  const alpha2 = 0.18 + glowIntensity * 0.11;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = rgbaFromRgb(rgb, alpha0);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_0;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = rgbaFromRgb(rgb, alpha1);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_1;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = rgbaFromRgb(rgb, alpha2);
  ctx.lineWidth = w * OUTLINE_WIDTH_MUL_2;
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = rgbaFromRgb(rgb, 0.85);
  ctx.lineWidth = w;
  pathFn(ctx);
  ctx.stroke();

  ctx.restore();
}
