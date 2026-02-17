const WEAPON_HUD_STYLES = {
  1: {
    color: "#76e9ff",
    glow: "rgba(118, 233, 255, 0.88)",
    label: "BLASTER",
  },
  2: {
    color: "#7fffd4",
    glow: "rgba(127, 255, 212, 0.88)",
    label: "SNIPER",
  },
  3: {
    color: "#cda3ff",
    glow: "rgba(205, 163, 255, 0.88)",
    label: "DOUBLE",
  },
  4: {
    color: "#ff8dbb",
    glow: "rgba(255, 141, 187, 0.88)",
    label: "FUSIL À POMPE",
  },
};

const PALETTE = {
  magenta: "#ff4fd8",
  cyan: "#53d8ff",
  connector: "rgba(220, 128, 255, 0.85)",
};

const HUD_FONTS = {
  neon: "'Audiowide', system-ui, sans-serif",
  mono: "'Audiowide', monospace",
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

function drawNeonPanel(ctx, rect, options = {}) {
  const {
    color = PALETTE.magenta,
    intensity = 1,
    cornerRadius = 0,
    flicker = 1,
    skew = 18,
    borderColor = color,
    glowColor = color,
    fillAlpha = 0.6,
    mirror = false,
    borderWidth = 1.25,
    tubeMode = true,
  } = options;
  const { x, y, w, h } = rect;
  const neonPulse = 1 + (flicker - 1) * 0.85;
  const innerInset = Math.max(0, cornerRadius * 0.12);

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

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (tubeMode) {
    const scaledIntensity = clamp(intensity, 0, 1);

    ctx.globalAlpha = (0.1 + scaledIntensity * 0.06) * neonPulse;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (18 + scaledIntensity * 10) * neonPulse;
    ctx.lineWidth = borderWidth * 3;
    ctx.strokeStyle = borderColor;
    buildPanelPath(ctx, x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2, skew);
    ctx.stroke();

    ctx.globalAlpha = (0.8 + scaledIntensity * 0.1) * neonPulse;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (8 + scaledIntensity * 4) * neonPulse;
    ctx.lineWidth = borderWidth * 1.8;
    ctx.strokeStyle = borderColor;
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();

    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "rgba(255,255,255,0.96)";
    ctx.shadowBlur = 2;
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();

    ctx.globalAlpha = (0.55 + scaledIntensity * 0.15) * neonPulse;
    ctx.shadowBlur = 0;
    ctx.lineWidth = borderWidth * 0.9;
    ctx.strokeStyle = borderColor;
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();
  } else {
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (9 + intensity * 2) * neonPulse;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = borderColor;
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();

    ctx.globalAlpha = Math.min(0.1, 0.08 + intensity * 0.02);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.min(28, 22 + intensity * 4) * neonPulse;
    ctx.lineWidth = 3.2;
    buildPanelPath(ctx, x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2, skew);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    buildPanelPath(ctx, x, y, w, h, skew);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + skew + 8, y + 10);
  ctx.lineTo(x + w - 18, y + 10);
  ctx.stroke();

  ctx.restore();
}

function drawNeonText(ctx, text, x, y, options = {}) {
  const {
    color = "#fff",
    font = "700 24px 'Audiowide', system-ui, sans-serif",
    align = "left",
    baseline = "middle",
    intensity = 1,
    flicker = 1,
  } = options;
  const scaledIntensity = clamp(intensity, 0, 1);
  const glowPulse = 1 + (flicker - 1) * 0.9;
  const fontMatch = /(\d+(?:\.\d+)?)px/.exec(font);
  const fontPx = fontMatch ? Number(fontMatch[1]) : 24;
  const coreWidth = Math.max(0.9, fontPx * 0.028);
  const midWidth = Math.max(1.3, fontPx * 0.047);
  const haloWidth = Math.max(2.1, fontPx * 0.082);

  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = "round";

  ctx.globalAlpha = 0.94;
  ctx.lineWidth = coreWidth;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  ctx.shadowBlur = 3.5;
  ctx.strokeText(text, x, y);

  ctx.globalAlpha = (0.66 + scaledIntensity * 0.19) * glowPulse;
  ctx.lineWidth = midWidth;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = (8 + scaledIntensity * 4) * glowPulse;
  ctx.strokeText(text, x, y);

  ctx.globalAlpha = (0.08 + scaledIntensity * 0.04) * glowPulse;
  ctx.lineWidth = haloWidth;
  ctx.shadowBlur = (22 + scaledIntensity * 8) * glowPulse;
  ctx.strokeText(text, x, y);

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawNeonLine(ctx, x1, y1, x2, y2, color = PALETTE.connector, intensity = 1, baseWidth = 3.2) {
  const scaledIntensity = clamp(intensity, 0, 1);
  const tubeWidth = Math.max(baseWidth * 2.5, 8);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = tubeWidth * 1.05;
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  ctx.shadowBlur = 1 + scaledIntensity * 2;
  ctx.globalAlpha = 0.95 + scaledIntensity * 0.05;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = tubeWidth * 1.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + scaledIntensity * 4;
  ctx.globalAlpha = (0.8 + scaledIntensity * 0.1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = tubeWidth * 3.2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22 + scaledIntensity * 12;
  ctx.globalAlpha = (0.12 + scaledIntensity * 0.06);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
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

function drawVolumeSlider(ctx, rect, label, value01, state, style) {
  const clamped = clamp(value01, 0, 1);
  const { x, y, w, h } = rect;
  const hovered = Boolean(state?.hovered);
  const active = Boolean(state?.active);
  const intensity = active ? 0.95 : hovered ? 0.68 : 0.44;

  drawNeonText(ctx, label, x, y - 7, {
    color: style.labelColor,
    font: `700 18px ${HUD_FONTS.neon}`,
    baseline: "bottom",
    intensity: 0.7,
    flicker: style.flicker,
  });

  const trackH = Math.max(8, h * 0.3);
  const trackY = y + h * 0.5 - trackH * 0.5;
  const fillW = w * clamped;

  ctx.save();
  ctx.fillStyle = style.trackBg;
  ctx.strokeStyle = style.trackStroke;
  ctx.lineWidth = 1.3;
  ctx.shadowColor = style.trackGlow;
  ctx.shadowBlur = (6.2 + intensity * 4.6) * style.flicker;
  ctx.beginPath();
  ctx.roundRect(x, trackY, w, trackH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = (14 + intensity * 6) * style.flicker;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(x, trackY, w, trackH, 6);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (fillW > 0) {
    const fillGrad = ctx.createLinearGradient(x, trackY, x + w, trackY);
    fillGrad.addColorStop(0, style.fillStart);
    fillGrad.addColorStop(1, style.fillEnd);
    ctx.fillStyle = fillGrad;
    ctx.shadowColor = style.fillGlow;
    ctx.shadowBlur = (8 + intensity * 5.8) * style.flicker;
    ctx.beginPath();
    ctx.roundRect(x, trackY + 1, fillW, Math.max(2, trackH - 2), 5);
    ctx.fill();

    ctx.shadowBlur = (14 + intensity * 6) * style.flicker;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(x, trackY + 1, fillW, Math.max(2, trackH - 2), 5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const handleX = x + fillW;
  const handleY = trackY + trackH * 0.5;
  const handleR = 5.2 + (active ? 1.05 : hovered ? 0.5 : 0);
  const handleGlowBoost = active ? 1.16 : hovered ? 1.1 : 1;
  ctx.fillStyle = style.handleFill;
  ctx.strokeStyle = style.handleStroke;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = style.handleGlow;
  ctx.shadowBlur = (6.4 + intensity * 5.4) * style.flicker * handleGlowBoost;
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = style.trackGlow;
  ctx.shadowBlur = (10 + intensity * 6.8) * style.flicker * handleGlowBoost;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleR + 1.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.95;
  ctx.shadowBlur = 2;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(handleX - 0.8, handleY - 0.8, Math.max(1.6, handleR * 0.34), 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
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
  const hudTime = (game.last || performance.now()) * 0.001;
  const flicker = 1 + Math.sin(hudTime * 3) * 0.024;

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
  comboBarPanel.y = comboPanel.y + comboPanel.h + 24;
  const scorePanel = HUD_LAYOUT.scorePanel;
  scorePanel.x = w - M - scorePanel.w;
  scorePanel.y = M + 8;
  const weaponPanel = HUD_LAYOUT.weaponPanel;
  weaponPanel.x = w * 0.5 - weaponPanel.w * 0.5;
  weaponPanel.y = h - M - 88;
  const volumeUI = game.hudVolumeUI ?? {};
  const volumeStyle = {
    labelColor: "#8be7ff",
    labelGlow: "rgba(117, 233, 255, 0.95)",
    trackBg: "rgba(3, 8, 20, 0.7)",
    trackStroke: "rgba(173, 228, 255, 0.35)",
    trackGlow: "rgba(83, 216, 255, 0.7)",
    fillStart: "rgba(255, 86, 215, 0.92)",
    fillEnd: "rgba(87, 227, 255, 0.92)",
    fillGlow: "rgba(151, 236, 255, 0.9)",
    handleFill: "#c9fdff",
    handleStroke: "#53d8ff",
    handleGlow: "rgba(144, 236, 255, 0.95)",
  };

  const leftLineStart = comboPanel.x + comboPanel.w - 8;
  const leftLineEnd = wavePanel.x - 8;
  const leftLineY = comboPanel.y + comboPanel.h * 0.5;
  const leftSplit = leftLineStart + (leftLineEnd - leftLineStart) * 0.38;
  drawNeonLine(ctx, leftLineStart, leftLineY, leftSplit, leftLineY, PALETTE.magenta, 1, 3.2);
  drawNeonLine(ctx, leftSplit, leftLineY, leftLineEnd, wavePanel.y + wavePanel.h * 0.5, PALETTE.magenta, 0.75, 3.2);

  const rightLineStart = wavePanel.x + wavePanel.w + 8;
  const rightLineEnd = scorePanel.x + 14;
  const rightLineY = wavePanel.y + wavePanel.h * 0.5;
  const rightSplit = rightLineStart + (rightLineEnd - rightLineStart) * 0.38;
  drawNeonLine(ctx, rightLineStart, rightLineY, rightSplit, rightLineY, PALETTE.cyan, 1, 3.2);
  drawNeonLine(ctx, rightSplit, rightLineY, rightLineEnd, scorePanel.y + scorePanel.h * 0.5, PALETTE.cyan, 0.75, 3.2);

  drawNeonPanel(ctx, comboPanel, { color: PALETTE.magenta, intensity: 0.9, skew: comboPanel.skew, glowColor: "rgba(255, 79, 216, 0.95)", fillAlpha: 0.72, borderWidth: 1.3, tubeMode: true, flicker });
  drawNeonText(ctx, `COMBO x${formatCombo(game.combo)}`, comboPanel.x + 24, comboPanel.y + comboPanel.h * 0.46, {
    color: "#89e8ff",
    font: `700 44px ${HUD_FONTS.neon}`,
    intensity: 1,
    flicker,
  });

  drawNeonPanel(ctx, comboBarPanel, { color: "#ff64df", intensity: 0.82, skew: comboBarPanel.skew, glowColor: "rgba(255, 100, 223, 0.9)", fillAlpha: 0.66, tubeMode: false, flicker });
  const barPad = 20;
  const timerText = game.comboTimer.toFixed(1).padStart(4, "0");
  drawComboBar(ctx, comboBarPanel.x + barPad, comboBarPanel.y + 16, comboBarPanel.w - 140, 24, ratio);
  drawNeonText(ctx, timerText, comboBarPanel.x + comboBarPanel.w - 26, comboBarPanel.y + comboBarPanel.h * 0.56, {
    align: "right",
    color: "#ff8cf4",
    font: `700 38px ${HUD_FONTS.mono}`,
    intensity: 0.68,
    flicker,
  });

  drawNeonPanel(ctx, wavePanel, { color: "#f45cff", intensity: 0.95, skew: wavePanel.skew, glowColor: "rgba(244, 92, 255, 0.95)", fillAlpha: 0.76, borderWidth: 1.3, tubeMode: true, flicker });
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "rgba(255, 121, 241, 0.36)";
  ctx.shadowColor = "rgba(255, 121, 241, 0.8)";
  ctx.shadowBlur = 28 * flicker;
  ctx.beginPath();
  ctx.ellipse(wavePanel.x + wavePanel.w * 0.5, wavePanel.y + wavePanel.h * 0.56, wavePanel.w * 0.31, wavePanel.h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  drawNeonText(ctx, `VAGUE ${formatWave(game.level)}`, wavePanel.x + wavePanel.w * 0.5, wavePanel.y + wavePanel.h * 0.56, {
    align: "center",
    color: "#ff9bf5",
    font: `700 64px ${HUD_FONTS.neon}`,
    intensity: 1,
    flicker,
  });

  drawNeonPanel(ctx, scorePanel, { color: PALETTE.cyan, intensity: 0.96, skew: scorePanel.skew, glowColor: "rgba(83, 216, 255, 1)", fillAlpha: 0.74, borderWidth: 1.3, tubeMode: true, mirror: true, flicker });
  drawNeonText(ctx, "SCORE", scorePanel.x + scorePanel.w * 0.68, scorePanel.y + 24, {
    align: "center",
    color: "#8be7ff",
    font: `700 26px ${HUD_FONTS.neon}`,
    baseline: "middle",
    intensity: 1,
    flicker,
  });
  drawNeonText(ctx, game.uiCache.scoreText, scorePanel.x + scorePanel.w * 0.55, scorePanel.y + 66, {
    align: "center",
    color: "#c9fdff",
    font: `700 54px ${HUD_FONTS.neon}`,
    baseline: "middle",
    intensity: 1,
    flicker,
  });

  if (volumeUI.sliderRects?.music) {
    drawVolumeSlider(
      ctx,
      volumeUI.sliderRects.music,
      "MUSIC",
      volumeUI.musicVolume ?? 0,
      {
        hovered: volumeUI.hoveredSlider === "music",
        active: volumeUI.activeSlider === "music",
      },
      { ...volumeStyle, flicker },
    );
  }

  if (volumeUI.sliderRects?.sfx) {
    drawVolumeSlider(
      ctx,
      volumeUI.sliderRects.sfx,
      "SFX",
      volumeUI.sfxVolume ?? 0,
      {
        hovered: volumeUI.hoveredSlider === "sfx",
        active: volumeUI.activeSlider === "sfx",
      },
      { ...volumeStyle, flicker },
    );
  }

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

  drawNeonPanel(ctx, weaponPanel, { color: PALETTE.cyan, intensity: 0.75, skew: weaponPanel.skew, glowColor: "rgba(113, 231, 255, 0.82)", fillAlpha: 0.8, borderWidth: 1.3, tubeMode: true, flicker });
  drawNeonText(ctx, "ARME", weaponPanel.x + 34, weaponPanel.y + 24, {
    color: "#8feaff",
    font: `700 32px ${HUD_FONTS.neon}`,
    baseline: "middle",
    intensity: 0.75,
    flicker,
  });
  drawNeonText(ctx, weaponStyle.label, weaponPanel.x + weaponPanel.w * 0.53, weaponPanel.y + 50, {
    align: "center",
    color: weaponStyle.color,
    font: `700 56px ${HUD_FONTS.neon}`,
    baseline: "middle",
    intensity: 0.94,
    flicker,
  });
}
