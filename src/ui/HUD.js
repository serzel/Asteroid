const WEAPON_HUD_STYLES = {
  1: {
    color: "rgba(0, 200, 255, 0.90)",
    solid: "rgb(0, 200, 255)",
    label: "BLASTER",
  },
  2: {
    color: "rgba(0, 255, 120, 0.95)",
    solid: "rgb(0, 255, 120)",
    label: "SNIPER",
  },
  3: {
    color: "rgba(180, 0, 255, 0.95)",
    solid: "rgb(180, 0, 255)",
    label: "DOUBLE",
  },
  4: {
    color: "rgba(255, 60, 0, 0.95)",
    solid: "rgb(255, 60, 0)",
    label: "SHOTGUN",
  },
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function getWeaponHUDStyle(level) {
  return WEAPON_HUD_STYLES[level] ?? WEAPON_HUD_STYLES[1];
}

function drawOutlinedText(ctx, text, x, y, options = {}) {
  const {
    font = "20px system-ui, sans-serif",
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

function drawPill(ctx, x, y, w, h, alpha = 0.25) {
  const r = Math.min(12, h * 0.5, w * 0.5);

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
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fill();
  ctx.restore();
}

function drawXWingIcon(ctx, x, y, size, isActive) {
  const half = size * 0.5;
  const wing = size * 0.42;
  const body = size * 0.12;
  const tint = isActive ? "rgba(255,255,255,0.95)" : "rgba(105,105,105,0.34)";

  ctx.save();
  ctx.translate(x, y);

  ctx.strokeStyle = isActive ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)";
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

  ctx.strokeStyle = tint;
  ctx.lineWidth = isActive ? 2.4 : 2.1;
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

  ctx.fillStyle = isActive ? "rgba(255,255,255,0.95)" : "rgba(70,70,70,0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.11, 0, Math.PI * 2);
  ctx.fill();

  if (!isActive) {
    ctx.strokeStyle = "rgba(145,145,145,0.32)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWeaponIcon(ctx, x, y, level, color) {
  ctx.save();
  ctx.translate(x, y);

  const drawShape = () => {
    ctx.beginPath();
    if (level === 1) {
      ctx.moveTo(-11, 0);
      ctx.lineTo(10, 0);
    } else if (level === 2) {
      ctx.moveTo(-11, 0);
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

  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  drawShape();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  drawShape();

  ctx.restore();
}

export function drawHUD(ctx, game) {
  if (!game?.ship) return;

  const M = 24;
  const { w, h } = game.world;

  const level = game.ship.weaponLevel ?? 1;
  const style = getWeaponHUDStyle(level);

  const comboWindow = typeof game.getComboWindow === "function" ? game.getComboWindow() : 1;
  const ratio = clamp(game.comboTimer / Math.max(comboWindow, 0.001), 0, 1);
  const weaponFx = clamp((game.hudFx?.weaponFlashT ?? 0) / 0.2, 0, 1);
  const comboFx = clamp((game.hudFx?.comboPulseT ?? 0) / 0.12, 0, 1);
  const waveFxProgress = 1 - clamp((game.hudFx?.waveIntroT ?? 0) / 1.1, 0, 1);
  const waveEase = 1 - (1 - waveFxProgress) * (1 - waveFxProgress);

  const topY = M;
  const bottomY = h - M;
  const topBlockH = 60;
  const topBlockY = topY - 10;
  const topBlockAlpha = 0.3;
  const weaponScale = 1 + 0.05 * Math.sin(weaponFx * Math.PI);

  // Haut gauche: arme
  const weaponW = 252;
  drawPill(ctx, M, topBlockY, weaponW, topBlockH, topBlockAlpha + weaponFx * 0.13);
  ctx.save();
  ctx.translate(M + weaponW * 0.5, topY + 20);
  ctx.scale(weaponScale, weaponScale);
  drawWeaponIcon(ctx, -90, -2, level, style.solid);
  drawOutlinedText(ctx, style.label, -64, -2, {
    font: "700 20px 'Audiowide', system-ui, sans-serif",
    fillStyle: style.color,
    textBaseline: "middle",
  });
  ctx.restore();

  // Haut centre: vague
  const waveW = 210;
  const waveScale = 1.08 - 0.08 * waveEase;
  const waveAlpha = topBlockAlpha + (1 - waveEase) * 0.14;
  ctx.save();
  ctx.translate(w * 0.5, topY + 20);
  ctx.scale(waveScale, waveScale);
  drawPill(ctx, -waveW * 0.5, topBlockY - (topY + 20), waveW, topBlockH, waveAlpha);
  drawOutlinedText(ctx, `VAGUE ${game.level}`, 0, -2, {
    font: "700 24px 'Audiowide', system-ui, sans-serif",
    fillStyle: "rgba(255,255,255,0.96)",
    textAlign: "center",
    textBaseline: "middle",
  });
  ctx.restore();

  // Haut droite: combo + timer
  const comboTextY = topY + 4;
  const comboRight = w - M;
  const comboW = 268;
  const comboH = 90;
  drawPill(ctx, comboRight - comboW, topBlockY, comboW, comboH, topBlockAlpha);
  const comboScale = 1 + 0.06 * Math.sin(comboFx * Math.PI);
  ctx.save();
  ctx.translate(comboRight - 12, comboTextY + 12);
  ctx.scale(comboScale, comboScale);
  drawOutlinedText(ctx, `COMBO x${game.combo.toFixed(2)}`, 0, 0, {
    font: "700 33px 'Audiowide', system-ui, sans-serif",
    fillStyle: style.color,
    textAlign: "right",
    textBaseline: "top",
    lineWidth: 5,
  });
  ctx.restore();

  const barW = 240;
  const barH = 14;
  const barRight = comboRight - 12;
  const barX = barRight - barW;
  const barY = topY + 52;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = style.solid;
  ctx.shadowColor = style.solid;
  ctx.shadowBlur = ratio < 0.25 ? 20 : 9;
  ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.restore();

  // Bas gauche: vies (3 icônes fixes)
  const livesW = 172;
  const livesH = 52;
  drawPill(ctx, M, bottomY - 42, livesW, livesH, 0.3);
  for (let i = 0; i < 3; i += 1) {
    drawXWingIcon(ctx, M + 24 + i * 42, bottomY - 16, 24, i < game.lives);
  }

  // Bas centre: score
  const scoreW = 320;
  const scoreH = 88;
  drawPill(ctx, w * 0.5 - scoreW * 0.5, bottomY - 78, scoreW, scoreH);
  drawOutlinedText(ctx, "SCORE", w * 0.5, bottomY - 48, {
    font: "700 18px 'Audiowide', system-ui, sans-serif",
    fillStyle: "rgba(230,230,230,0.95)",
    textAlign: "center",
    textBaseline: "middle",
    lineWidth: 4,
  });
  drawOutlinedText(ctx, `${Math.floor(game.score)}`, w * 0.5, bottomY - 20, {
    font: "700 40px 'Audiowide', system-ui, sans-serif",
    fillStyle: "rgba(255,255,255,0.98)",
    textAlign: "center",
    textBaseline: "middle",
    lineWidth: 6,
  });
}
