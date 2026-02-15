const WEAPON_HUD_STYLES = {
  1: {
    color: "rgba(0, 200, 255, 0.90)",
    solid: "rgb(0, 200, 255)",
    label: "L1",
  },
  2: {
    color: "rgba(0, 255, 120, 0.95)",
    solid: "rgb(0, 255, 120)",
    label: "L2 SNIPER",
  },
  3: {
    color: "rgba(180, 0, 255, 0.95)",
    solid: "rgb(180, 0, 255)",
    label: "L3 DOUBLE",
  },
  4: {
    color: "rgba(255, 60, 0, 0.95)",
    solid: "rgb(255, 60, 0)",
    label: "L4 SHOTGUN",
  },
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function getWeaponHUDStyle(level) {
  return WEAPON_HUD_STYLES[level] ?? WEAPON_HUD_STYLES[1];
}

export function drawOutlinedText(ctx, text, x, y, options = {}) {
  const {
    font = "24px system-ui, sans-serif",
    fillStyle = "white",
    strokeStyle = "rgba(0,0,0,0.7)",
    lineWidth = 4,
    textAlign = "left",
    textBaseline = "top",
  } = options;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawPill(ctx, x, y, w, h, radius = 8, fill = "rgba(0,0,0,0.35)") {
  const r = Math.min(radius, h * 0.5, w * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function drawXWingIcon(ctx, x, y, size, color = "white") {
  const half = size * 0.5;
  const wing = size * 0.42;
  const body = size * 0.13;

  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-wing, -half);
  ctx.lineTo(-body, -body);
  ctx.moveTo(wing, -half);
  ctx.lineTo(body, -body);
  ctx.moveTo(-wing, half);
  ctx.lineTo(-body, body);
  ctx.moveTo(wing, half);
  ctx.lineTo(body, body);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-wing, -half);
  ctx.lineTo(-body, -body);
  ctx.moveTo(wing, -half);
  ctx.lineTo(body, -body);
  ctx.moveTo(-wing, half);
  ctx.lineTo(-body, body);
  ctx.moveTo(wing, half);
  ctx.lineTo(body, body);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWeaponIcon(ctx, x, y, level, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  const drawShape = () => {
    ctx.beginPath();
    if (level === 1) {
      ctx.moveTo(-12, 0);
      ctx.lineTo(10, 0);
    } else if (level === 2) {
      ctx.moveTo(-12, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(3, -5);
      ctx.lineTo(10, 0);
      ctx.lineTo(3, 5);
    } else if (level === 3) {
      ctx.moveTo(-11, -4);
      ctx.lineTo(11, -4);
      ctx.moveTo(-11, 4);
      ctx.lineTo(11, 4);
    } else {
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(-8, -7);
      ctx.lineTo(8, 7);
      ctx.moveTo(-8, 7);
      ctx.lineTo(8, -7);
    }
    ctx.stroke();
  };

  drawShape();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  drawShape();

  ctx.restore();
}

export function drawHUD(ctx, game) {
  if (!game?.ship) return;

  const { world } = game;
  const level = game.ship.weaponLevel ?? 1;
  const style = getWeaponHUDStyle(level);

  const scoreY = world.h - 60;
  const comboX = world.w - 20;
  const comboY = world.h * 0.5 - 30;

  const comboWindow = typeof game.getComboWindow === "function"
    ? game.getComboWindow()
    : (typeof game.getCurrentComboWindow === "function" ? game.getCurrentComboWindow() : 1);
  const ratio = clamp(game.comboTimer / comboWindow, 0, 1);

  drawPill(ctx, 12, 8, 220, 34, 10);
  drawWeaponIcon(ctx, 30, 25, level, style.solid);
  drawOutlinedText(ctx, style.label, 48, 18, {
    font: "700 18px system-ui, sans-serif",
    fillStyle: style.color,
  });

  drawPill(ctx, world.w * 0.5 - 78, 8, 156, 34, 10);
  drawOutlinedText(ctx, `Vague: ${game.level}`, world.w * 0.5, 18, {
    font: "700 20px system-ui, sans-serif",
    fillStyle: "rgba(255,255,255,0.95)",
    textAlign: "center",
  });

  const livesBaseX = 20;
  const livesY = world.h - 30;
  for (let i = 0; i < game.lives; i++) {
    drawXWingIcon(ctx, livesBaseX + i * 28 + 12, livesY, 24, "rgba(255,255,255,0.95)");
  }

  drawOutlinedText(ctx, `${Math.floor(game.score)}`, world.w * 0.5, scoreY, {
    font: "700 40px 'Audiowide', system-ui, sans-serif",
    fillStyle: "rgba(255,255,255,0.98)",
    lineWidth: 6,
    textAlign: "center",
  });

  drawPill(ctx, comboX - 220, comboY - 12, 210, 52, 12);
  drawOutlinedText(ctx, `COMBO x${game.combo.toFixed(2)}`, comboX, comboY, {
    font: "700 32px 'Audiowide', system-ui, sans-serif",
    fillStyle: style.color,
    textAlign: "right",
  });

  const barW = 180;
  const barH = 12;
  const barX = comboX - barW;
  const barY = comboY + 42;

  drawPill(ctx, barX - 6, barY - 4, barW + 12, barH + 8, 8, "rgba(0,0,0,0.35)");
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = style.solid;
  ctx.shadowColor = style.solid;
  ctx.shadowBlur = ratio < 0.25 ? 16 : 8;
  ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.restore();
}
