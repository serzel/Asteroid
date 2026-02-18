import { drawCircularGlow, drawOutlineGlow } from "../rendering/GlowRenderer.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function roundRectPath(ctx, x, y, w, h, r = 10) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function skewPanelPath(ctx, x, y, w, h, skew = 0) {
  const s = Math.max(0, Math.min(Math.abs(skew), w * 0.3));
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - s, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function tubeStroke(ctx, drawPath, opts = {}) {
  const {
    color = "#ff56df",
    width = 3,
    intensity = 1,
    coreWidth = Math.max(1.2, width * 0.82),
    coreColor = "rgba(255,255,255,1)",
    highlight = true,
  } = opts;

  drawOutlineGlow(ctx, drawPath, color, Math.max(0.7, width * 0.68), intensity * 0.42);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.9, width * 0.86);
  drawPath(ctx);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = Math.max(0.9, coreWidth * 0.92);
  drawPath(ctx);
  ctx.stroke();
  ctx.restore();

  if (highlight) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(0.8, coreWidth * 0.48);
    drawPath(ctx);
    ctx.stroke();
    ctx.restore();
  }
}

export function neonLine(ctx, x1, y1, x2, y2, opts = {}) {
  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  tubeStroke(ctx, drawPath, opts);
  ctx.restore();
}

export function neonPanel(ctx, rect, opts = {}) {
  const { x, y, w, h } = rect;
  const {
    color = "#ff56df",
    fillTop = "rgba(24, 8, 52, 0.56)",
    fillBottom = "rgba(4, 10, 30, 0.78)",
    width = 3,
    radius = 12,
    skew = 0,
    intensity = 1,
  } = opts;

  const drawPath = () => {
    if (skew) skewPanelPath(ctx, x, y, w, h, skew);
    else roundRectPath(ctx, x, y, w, h, radius);
  };

  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, fillTop);
  g.addColorStop(1, fillBottom);
  drawPath();
  ctx.fillStyle = g;
  ctx.fill();

  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.06)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  drawPath();
  ctx.fillStyle = sheen;
  ctx.fill();

  drawCircularGlow(ctx, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.2, color, intensity * 0.24);
  tubeStroke(ctx, drawPath, { color, width, intensity, coreWidth: Math.max(1.4, width * 0.84) });
  ctx.restore();
}

export function neonText(ctx, text, x, y, opts = {}) {
  const {
    color = "#91edff",
    font = "700 32px 'Audiowide', system-ui, sans-serif",
    align = "left",
    baseline = "middle",
    intensity = 1,
  } = opts;

  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  const px = m ? Number(m[1]) : 24;
  const width = Math.max(1.8, px * 0.082);
  const coreWidth = Math.max(1.3, width * 0.88);

  const drawPath = () => {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  };

  ctx.save();
  tubeStroke(ctx, drawPath, { color, width, coreWidth, intensity });
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.86;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function neonBar(ctx, rect, value01, opts = {}) {
  const { x, y, w, h } = rect;
  const {
    trackColor = "rgba(111, 82, 186, 0.35)",
    fillColor = "#53d8ff",
    fillColor2 = "#ff56df",
    radius = 7,
    intensity = 1,
  } = opts;
  const v = clamp(value01, 0, 1);

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = trackColor;
  ctx.fill();
  tubeStroke(ctx, () => roundRectPath(ctx, x, y, w, h, radius), {
    color: "rgba(191, 126, 255, 0.9)", width: 2, intensity: intensity * 0.7, coreWidth: 1, highlight: false,
  });

  const fw = w * v;
  if (fw > 1) {
    const grad = ctx.createLinearGradient(x, y, x + fw, y);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, fillColor2);
    roundRectPath(ctx, x + 1, y + 1, Math.max(1, fw - 2), Math.max(1, h - 2), Math.max(2, radius - 1));
    ctx.fillStyle = grad;
    ctx.fill();
    tubeStroke(ctx, () => roundRectPath(ctx, x + 1, y + 1, Math.max(1, fw - 2), Math.max(1, h - 2), Math.max(2, radius - 1)), {
      color: fillColor2, width: 2.2, intensity, coreWidth: 1.2, highlight: false,
    });
  }
  ctx.restore();
}
