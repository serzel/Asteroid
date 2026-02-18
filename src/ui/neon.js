function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function withIsolatedContext(ctx, draw) {
  ctx.save();
  try {
    draw();
  } finally {
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function resetGlowState(ctx) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
}

function neonColorWithAlpha(color, alpha) {
  if (typeof color !== 'string') return `rgba(255,86,223,${alpha})`;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const to255 = (v) => Number.parseInt(v, 16);
    if (hex.length === 3) {
      const r = to255(hex[0] + hex[0]);
      const g = to255(hex[1] + hex[1]);
      const b = to255(hex[2] + hex[2]);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    if (hex.length === 6) {
      const r = to255(hex.slice(0, 2));
      const g = to255(hex.slice(2, 4));
      const b = to255(hex.slice(4, 6));
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return color;
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
    color = '#ff56df',
    width = 3,
    intensity = 1,
    coreWidth = Math.max(1.2, width * 0.82),
    mediumBlur = 10,
    largeBlur = 24,
    mediumAlpha = 0.36,
    largeAlpha = 0.14,
    coreAlpha = 1,
    coreColor = 'rgba(255,255,255,1)',
    highlight = true,
  } = opts;

  const t = clamp(intensity, 0, 1);

  // A) large halo
  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    drawPath();
    ctx.globalAlpha = clamp(largeAlpha * (0.76 + t * 0.24), 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.15;
    ctx.shadowColor = color;
    ctx.shadowBlur = largeBlur * (0.82 + t * 0.25);
    ctx.stroke();
  });

  // B) medium halo
  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    drawPath();
    ctx.globalAlpha = clamp(mediumAlpha * (0.72 + t * 0.28), 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 2.05;
    ctx.shadowColor = color;
    ctx.shadowBlur = mediumBlur * (0.82 + t * 0.25);
    ctx.stroke();
  });

  // C) colored tube
  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    drawPath();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
  });

  // D) white core (must be visible and last)
  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    drawPath();
    ctx.globalAlpha = clamp(coreAlpha, 0, 1);
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = coreWidth;
    ctx.shadowColor = 'rgba(255,255,255,1)';
    ctx.shadowBlur = 1;
    ctx.stroke();
  });

  // E) optional subtle highlight
  if (highlight) {
    withIsolatedContext(ctx, () => {
      resetGlowState(ctx);
      drawPath();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(0.8, coreWidth * 0.48);
      ctx.shadowBlur = 0;
      ctx.stroke();
    });
  }
}

export function neonLine(ctx, x1, y1, x2, y2, opts = {}) {
  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  };
  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tubeStroke(ctx, drawPath, opts);
  });
}

export function neonPanel(ctx, rect, opts = {}) {
  const {
    x, y, w, h,
  } = rect;
  const {
    color = '#ff56df',
    fillTop = 'rgba(24, 8, 52, 0.56)',
    fillBottom = 'rgba(4, 10, 30, 0.78)',
    width = 3,
    radius = 12,
    skew = 0,
    intensity = 1,
  } = opts;

  const drawPath = () => {
    if (skew) {
      skewPanelPath(ctx, x, y, w, h, skew);
      return;
    }
    roundRectPath(ctx, x, y, w, h, radius);
  };

  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, fillTop);
    g.addColorStop(1, fillBottom);
    drawPath();
    ctx.fillStyle = g;
    ctx.fill();

    const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.3, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    drawPath();
    ctx.fillStyle = sheen;
    ctx.fill();

    withIsolatedContext(ctx, () => {
      resetGlowState(ctx);
      const innerGlow = ctx.createLinearGradient(x, y, x, y + h);
      innerGlow.addColorStop(0, neonColorWithAlpha(color, 0.14));
      innerGlow.addColorStop(0.45, neonColorWithAlpha(color, 0.1));
      innerGlow.addColorStop(1, neonColorWithAlpha(color, 0.04));
      drawPath();
      ctx.fillStyle = innerGlow;
      ctx.globalAlpha = 0.72;
      ctx.shadowColor = neonColorWithAlpha(color, 0.6);
      ctx.shadowBlur = 8;
      ctx.fill();
    });

    tubeStroke(ctx, drawPath, {
      color,
      width,
      intensity,
      coreWidth: Math.max(1.4, width * 0.84),
      mediumBlur: 12,
      largeBlur: 28,
      mediumAlpha: 0.4,
      largeAlpha: 0.16,
    });
  });
}

export function neonText(ctx, text, x, y, opts = {}) {
  const {
    color = '#91edff',
    font = "700 32px 'Audiowide', system-ui, sans-serif",
    align = 'left',
    baseline = 'middle',
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
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  };

  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    tubeStroke(ctx, drawPath, {
      color,
      width,
      coreWidth,
      intensity,
      mediumBlur: 9,
      largeBlur: 22,
      mediumAlpha: 0.34,
      largeAlpha: 0.12,
      coreAlpha: 1,
    });
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.94;
    ctx.fillText(text, x, y);
  });
}

export function neonBar(ctx, rect, value01, opts = {}) {
  const {
    x, y, w, h,
  } = rect;
  const {
    trackColor = 'rgba(111, 82, 186, 0.35)',
    fillColor = '#53d8ff',
    fillColor2 = '#ff56df',
    radius = 7,
    intensity = 1,
  } = opts;
  const v = clamp(value01, 0, 1);

  withIsolatedContext(ctx, () => {
    resetGlowState(ctx);
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    tubeStroke(ctx, () => roundRectPath(ctx, x, y, w, h, radius), {
      color: 'rgba(191, 126, 255, 0.9)',
      width: 2,
      intensity: clamp(intensity * 0.7, 0, 1),
      coreWidth: 1,
      mediumBlur: 6,
      largeBlur: 14,
      highlight: false,
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
        color: fillColor2,
        width: 2.2,
        intensity: clamp(intensity, 0, 1),
        coreWidth: 1.2,
        mediumBlur: 8,
        largeBlur: 16,
        highlight: false,
      });
    }
  });
}
