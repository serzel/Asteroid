export function resizeCanvasToDisplaySize(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;

  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  const w = Math.floor(cssW * dpr);
  const h = Math.floor(cssH * dpr);

  const changed = canvas.width !== w || canvas.height !== h;
  if (changed) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { changed, cssW, cssH, dpr };
}

export function drawText(ctx, text, x, y, size = 18) {
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
  ctx.restore();
}

