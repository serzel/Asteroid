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

export function debugLog(enabled, category, ...args) {
  if (!enabled) return;
  const prefix = category ? `[DEBUG:${category}]` : "[DEBUG]";
  console.log(prefix, ...args);
}

export function computeAlphaBBox(img) {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (!width || !height) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      w: 1,
      h: 1,
      cx: 0.5,
      cy: 0.5,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
      w: width,
      h: height,
      cx: width * 0.5,
      cy: height * 0.5,
    };
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: minX + w * 0.5,
    cy: minY + h * 0.5,
  };
}

