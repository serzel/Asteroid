const WEAPON_HUD_STYLES = {
  1: {
    color: "#76e9ff",
    glow: "rgba(118, 233, 255, 0.95)",
    label: "BLASTER",
  },
  2: {
    color: "#7fffd4",
    glow: "rgba(127, 255, 212, 0.95)",
    label: "SNIPER",
  },
  3: {
    color: "#cda3ff",
    glow: "rgba(205, 163, 255, 0.95)",
    label: "DOUBLE",
  },
  4: {
    color: "#ff8dbb",
    glow: "rgba(255, 141, 187, 0.95)",
    label: "FUSIL À POMPE",
  },
};

const PALETTE = {
  magenta: "#ff4fd8",
  cyan: "#53d8ff",
  connector: "rgba(220, 128, 255, 0.85)",
};

const HUD_LAYOUT = {
  wavePanel: { x: 0, y: 0, w: 360, h: 74, skew: 26 },
  comboPanel: { x: 0, y: 0, w: 360, h: 64, skew: 22 },
  comboBarPanel: { x: 0, y: 0, w: 420, h: 56, skew: 18 },
  scorePanel: { x: 0, y: 0, w: 350, h: 94, skew: 24 },
  weaponPanel: { x: 0, y: 0, w: 660, h: 78, skew: 30 },
};

const lifeFullImg = new Image();
lifeFullImg.src = new URL("../../assets/life_full.png", import.meta.url);

const lifeEmptyImg = new Image();
lifeEmptyImg.src = new URL("../../assets/life_empty.png", import.meta.url);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatWave(level) {
  return String(Math.max(1, Math.floor(level))).padStart(2, "0");
}

function formatCombo(combo) {
  if (combo >= 10 || Math.abs(combo - Math.round(combo)) < 0.01) {
    return String(Math.round(combo));
  }
  return combo.toFixed(1);
}

function formatScoreFr(score) {
  const value = Math.max(0, Math.floor(score));
  const digits = String(value);
  let out = "";

  for (let i = 0; i < digits.length; i += 1) {
    const indexFromEnd = digits.length - i;
    out += digits[i];
    if (indexFromEnd > 1 && indexFromEnd % 3 === 1) {
      out += " ";
    }
  }

  return out;
}

function buildPanelPath(ctx, x, y, w, h, skew = 18) {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawNeonPanel(ctx, x, y, w, h, options = {}) {
  const {
    skew = 18,
    borderColor = PALETTE.magenta,
    glowColor = borderColor,
    fillAlpha = 0.6,
    mirror = false,
  } = options;

  ctx.save();
  if (mirror) {
    ctx.translate(x + w * 0.5, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w * 0.5), 0);
  }

  buildPanelPath(ctx, x, y, w, h, skew);
  const fillGradient = ctx.createLinearGradient(x, y, x, y + h);
  fillGradient.addColorStop(0, `rgba(12, 16, 44, ${0.45 * fillAlpha})`);
  fillGradient.addColorStop(0.6, `rgba(24, 12, 46, ${0.55 * fillAlpha})`);
  fillGradient.addColorStop(1, `rgba(8, 10, 26, ${0.8 * fillAlpha})`);
  ctx.fillStyle = fillGradient;
  ctx.fill();

  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,0.09)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  buildPanelPath(ctx, x, y, w, h, skew);
  ctx.fillStyle = sheen;
  ctx.fill();

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderColor;
  buildPanelPath(ctx, x, y, w, h, skew);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + skew + 8, y + 10);
  ctx.lineTo(x + w - 18, y + 10);
  ctx.stroke();

  ctx.restore();
}

function drawNeonText(ctx, text, x, y, options = {}) {
  const {
    size = 24,
    align = "left",
    color = "#fff",
    glowColor = color,
    weight = 700,
    font = "'Audiowide', system-ui, sans-serif",
    baseline = "middle",
  } = options;

  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(text, x, y);

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = Math.max(8, size * 0.3);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawConnectorLine(ctx, x1, y1, x2, y2, color = PALETTE.connector) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawComboBar(ctx, x, y, w, h, ratio) {
  const clamped = clamp(ratio, 0, 1);
  const segments = 16;
  const gap = 2;
  const segW = (w - gap * (segments - 1)) / segments;

  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 20, 0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(173, 228, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  const lit = Math.round(segments * clamped);
  for (let i = 0; i < segments; i += 1) {
    const sx = x + i * (segW + gap);
    const progress = i / Math.max(1, segments - 1);
    if (i < lit) {
      const c = ctx.createLinearGradient(sx, y, sx + segW, y);
      c.addColorStop(0, `rgba(255, 86, 215, ${0.95 - progress * 0.2})`);
      c.addColorStop(1, `rgba(87, 227, 255, ${0.92 - progress * 0.18})`);
      ctx.fillStyle = c;
      ctx.shadowColor = "rgba(151, 236, 255, 0.9)";
      ctx.shadowBlur = 8;
      ctx.fillRect(sx, y + 2, segW, h - 4);
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(36, 30, 62, 0.72)";
      ctx.fillRect(sx, y + 2, segW, h - 4);
    }
  }
  ctx.restore();
}

function getWeaponHUDStyle(level) {
  return WEAPON_HUD_STYLES[level] ?? WEAPON_HUD_STYLES[1];
}

export function drawHUD(ctx, game) {
  if (!game?.ship) return;

  if (!game.uiCache) {
    game.uiCache = {
      lastScoreInt: null,
      scoreText: "0",
    };
  }

  const scoreInt = Math.max(0, Math.floor(game.score));
  if (game.uiCache.lastScoreInt !== scoreInt) {
    game.uiCache.lastScoreInt = scoreInt;
    game.uiCache.scoreText = formatScoreFr(scoreInt);
  }

  const M = 28;
  const { w, h } = game.world;
  const level = game.ship.weaponLevel ?? 1;
  const weaponStyle = getWeaponHUDStyle(level);

  const comboWindow = typeof game.getComboWindow === "function" ? game.getComboWindow() : 1;
  const ratio = clamp(game.comboTimer / Math.max(comboWindow, 0.001), 0, 1);

  const wavePanel = HUD_LAYOUT.wavePanel;
  wavePanel.x = w * 0.5 - 180;
  wavePanel.y = M;
  const comboPanel = HUD_LAYOUT.comboPanel;
  comboPanel.x = M;
  comboPanel.y = M + 8;
  const comboBarPanel = HUD_LAYOUT.comboBarPanel;
  comboBarPanel.x = M;
  comboBarPanel.y = comboPanel.y + comboPanel.h + 16;
  const scorePanel = HUD_LAYOUT.scorePanel;
  scorePanel.x = w - M - scorePanel.w;
  scorePanel.y = M + 8;
  const weaponPanel = HUD_LAYOUT.weaponPanel;
  weaponPanel.x = w * 0.5 - weaponPanel.w * 0.5;
  weaponPanel.y = h - M - 88;

  drawConnectorLine(ctx, comboPanel.x + comboPanel.w - 8, comboPanel.y + comboPanel.h * 0.5, wavePanel.x - 8, wavePanel.y + wavePanel.h * 0.5);
  drawConnectorLine(ctx, wavePanel.x + wavePanel.w + 8, wavePanel.y + wavePanel.h * 0.5, scorePanel.x + 14, scorePanel.y + scorePanel.h * 0.5, "rgba(126, 225, 255, 0.85)");

  drawNeonPanel(ctx, comboPanel.x, comboPanel.y, comboPanel.w, comboPanel.h, {
    skew: comboPanel.skew,
    borderColor: PALETTE.magenta,
    glowColor: "rgba(255, 79, 216, 0.95)",
    fillAlpha: 0.72,
  });
  drawNeonText(ctx, `COMBO x${formatCombo(game.combo)}`, comboPanel.x + 24, comboPanel.y + comboPanel.h * 0.54, {
    size: 44,
    color: "#89e8ff",
    glowColor: "rgba(137, 232, 255, 1)",
  });

  drawNeonPanel(ctx, comboBarPanel.x, comboBarPanel.y, comboBarPanel.w, comboBarPanel.h, {
    skew: comboBarPanel.skew,
    borderColor: "#ff64df",
    glowColor: "rgba(255, 100, 223, 0.9)",
    fillAlpha: 0.66,
  });
  const barPad = 20;
  const timerText = game.comboTimer.toFixed(1).padStart(4, "0");
  drawComboBar(ctx, comboBarPanel.x + barPad, comboBarPanel.y + 16, comboBarPanel.w - 140, 24, ratio);
  drawNeonText(ctx, timerText, comboBarPanel.x + comboBarPanel.w - 26, comboBarPanel.y + comboBarPanel.h * 0.56, {
    size: 38,
    align: "right",
    color: "#ff8cf4",
    glowColor: "rgba(255, 125, 237, 0.95)",
    font: "'Audiowide', monospace",
  });

  drawNeonPanel(ctx, wavePanel.x, wavePanel.y, wavePanel.w, wavePanel.h, {
    skew: wavePanel.skew,
    borderColor: "#f45cff",
    glowColor: "rgba(244, 92, 255, 0.95)",
    fillAlpha: 0.76,
  });
  drawNeonText(ctx, `VAGUE ${formatWave(game.level)}`, wavePanel.x + wavePanel.w * 0.5, wavePanel.y + wavePanel.h * 0.56, {
    size: 64,
    align: "center",
    color: "#ff9bf5",
    glowColor: "rgba(255, 121, 241, 1)",
    weight: 700,
  });

  drawNeonPanel(ctx, scorePanel.x, scorePanel.y, scorePanel.w, scorePanel.h, {
    skew: scorePanel.skew,
    borderColor: PALETTE.cyan,
    glowColor: "rgba(83, 216, 255, 1)",
    fillAlpha: 0.74,
    mirror: true,
  });
  drawNeonText(ctx, "SCORE", scorePanel.x + scorePanel.w * 0.68, scorePanel.y + 24, {
    size: 26,
    align: "center",
    color: "#8be7ff",
    glowColor: "rgba(117, 233, 255, 0.95)",
    baseline: "middle",
  });
  drawNeonText(ctx, game.uiCache.scoreText, scorePanel.x + scorePanel.w * 0.55, scorePanel.y + 66, {
    size: 54,
    align: "center",
    color: "#c9fdff",
    glowColor: "rgba(144, 236, 255, 0.95)",
    baseline: "middle",
  });

  const maxLives = 3;
  const size = 84;
  const spacing = 16;
  const livesX = M;
  const livesY = h - M - size;
  ctx.save();
  for (let i = 0; i < maxLives; i += 1) {
    const img = i < game.lives ? lifeFullImg : lifeEmptyImg;
    const dx = livesX + i * (size + spacing);
    ctx.shadowColor = i < game.lives ? "rgba(255, 115, 227, 0.9)" : "rgba(88, 126, 173, 0.45)";
    ctx.shadowBlur = i < game.lives ? 14 : 8;
    ctx.drawImage(img, dx, livesY, size, size);
  }
  ctx.restore();

  drawNeonPanel(ctx, weaponPanel.x, weaponPanel.y, weaponPanel.w, weaponPanel.h, {
    skew: weaponPanel.skew,
    borderColor: PALETTE.cyan,
    glowColor: "rgba(113, 231, 255, 0.95)",
    fillAlpha: 0.84,
  });
  drawNeonText(ctx, "ARME", weaponPanel.x + 34, weaponPanel.y + 24, {
    size: 32,
    color: "#8feaff",
    glowColor: "rgba(143, 234, 255, 0.95)",
    baseline: "middle",
  });
  drawNeonText(ctx, weaponStyle.label, weaponPanel.x + weaponPanel.w * 0.53, weaponPanel.y + 50, {
    size: 56,
    align: "center",
    color: weaponStyle.color,
    glowColor: weaponStyle.glow,
    baseline: "middle",
  });
}
