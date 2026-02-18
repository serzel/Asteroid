import { neonBar, neonLine, neonPanel, neonText, roundRectPath } from './neon.js';

const WEAPON_HUD_STYLES = {
  1: { color: '#76e9ff', label: 'BLASTER' },
  2: { color: '#7fffd4', label: 'SNIPER' },
  3: { color: '#cda3ff', label: 'DOUBLE' },
  4: { color: '#ff8dbb', label: 'FUSIL À POMPE' },
};

const HUD_FONTS = {
  neon: "'Audiowide', system-ui, sans-serif",
  mono: "'Audiowide', monospace",
};

const lifeFullImg = new Image();
lifeFullImg.src = new URL('../../assets/life_full.png', import.meta.url);

const lifeEmptyImg = new Image();
lifeEmptyImg.src = new URL('../../assets/life_empty.png', import.meta.url);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatWave(level) {
  return String(Math.max(1, Math.floor(level))).padStart(2, '0');
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
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    const indexFromEnd = digits.length - i;
    out += digits[i];
    if (indexFromEnd > 1 && indexFromEnd % 3 === 1) out += ' ';
  }
  return out;
}

function getWeaponHUDStyle(level) {
  return WEAPON_HUD_STYLES[level] ?? WEAPON_HUD_STYLES[1];
}

function buildLayout(world) {
  const M = 28;
  const { w, h } = world;

  const comboPanel = { x: M, y: M + 8, w: 360, h: 64, skew: 22 };
  const comboBarPanel = { x: M, y: comboPanel.y + comboPanel.h + 24, w: 420, h: 56, skew: 18 };
  const wavePanel = { x: w * 0.5 - 180, y: M, w: 360, h: 74, radius: 14 };
  const scorePanel = { x: w - M - 350, y: M + 8, w: 350, h: 64, skew: 22 };
  const weaponPanel = { x: w * 0.5 - 330, y: h - M - 88, w: 660, h: 78, skew: 30 };

  return {
    comboPanel,
    comboBarPanel,
    wavePanel,
    scorePanel,
    weaponPanel,
    topLineY: wavePanel.y + wavePanel.h * 0.5,
    margin: M,
  };
}

function drawVolumeSlider(ctx, rect, label, value01, state) {
  const clamped = clamp(value01, 0, 1);
  const { x, y, w, h } = rect;
  const hovered = Boolean(state?.hovered);
  const active = Boolean(state?.active);
  const intensity = active ? 1.15 : hovered ? 0.94 : 0.72;

  neonText(ctx, `${label}.`, x, y - 8, {
    color: '#ff9ff8',
    font: `700 17px ${HUD_FONTS.neon}`,
    baseline: 'bottom',
    intensity: 0.7,
  });

  const trackH = Math.max(8, h * 0.44);
  const trackY = y + h * 0.5 - trackH * 0.5;
  neonBar(ctx, { x, y: trackY, w, h: trackH }, clamped, {
    fillColor: '#53d8ff',
    fillColor2: '#ff56df',
    intensity,
    radius: 7,
  });

  const handleX = x + w * clamped;
  const handleY = trackY + trackH * 0.5;
  const r = active ? 8.2 : hovered ? 7.5 : 7;
  ctx.save();
  neonLine(ctx, handleX - r, handleY, handleX + r, handleY, {
    color: '#9bf4ff',
    width: 5.4,
    coreWidth: 2.8,
    intensity,
    mediumBlur: 8,
    largeBlur: 16,
  });
  neonLine(ctx, handleX, handleY - r, handleX, handleY + r, {
    color: '#ff7ee8',
    width: 2.5,
    coreWidth: 1.6,
    intensity,
    mediumBlur: 6,
    largeBlur: 12,
  });
  ctx.restore();
}

function rebuildStaticLayer(game, layout) {
  const { w, h } = game.world;
  const cache = game.uiCache;
  cache.staticCanvas = cache.staticCanvas ?? document.createElement('canvas');
  cache.staticCanvas.width = w;
  cache.staticCanvas.height = h;
  const c = cache.staticCanvas.getContext('2d');
  c.clearRect(0, 0, w, h);

  neonLine(c, layout.margin, layout.topLineY, w * 0.5, layout.topLineY, {
    color: '#ff56df',
    width: 4.6,
    coreWidth: 3.8,
    intensity: 1.08,
    mediumBlur: 11,
    largeBlur: 26,
  });
  neonLine(c, w * 0.5, layout.topLineY, w - layout.margin, layout.topLineY, {
    color: '#53d8ff',
    width: 4.6,
    coreWidth: 3.8,
    intensity: 1.08,
    mediumBlur: 11,
    largeBlur: 26,
  });

  neonPanel(c, layout.comboPanel, { color: '#ff56df', width: 3.9, skew: layout.comboPanel.skew, intensity: 1.12 });
  neonPanel(c, layout.comboBarPanel, { color: '#ff56df', width: 3.2, skew: layout.comboBarPanel.skew, intensity: 0.94 });
  neonPanel(c, layout.wavePanel, {
    color: '#ff56df',
    width: 6.4,
    radius: layout.wavePanel.radius,
    intensity: 1.4,
    fillTop: 'rgba(36, 14, 72, 0.72)',
    fillBottom: 'rgba(8, 10, 30, 0.84)',
  });
  neonPanel(c, layout.scorePanel, { color: '#53d8ff', width: 3.9, skew: layout.scorePanel.skew, intensity: 1.12 });

  neonPanel(c, layout.weaponPanel, {
    color: '#ff56df',
    width: 4.3,
    skew: layout.weaponPanel.skew,
    intensity: 1.08,
    fillTop: 'rgba(46, 16, 88, 0.72)',
    fillBottom: 'rgba(6, 10, 28, 0.88)',
  });

  c.save();
  const plate = c.createLinearGradient(layout.weaponPanel.x + 24, 0, layout.weaponPanel.x + layout.weaponPanel.w - 24, 0);
  plate.addColorStop(0, 'rgba(83,216,255,0.22)');
  plate.addColorStop(0.5, 'rgba(255,86,223,0.2)');
  plate.addColorStop(1, 'rgba(255,216,94,0.2)');
  roundRectPath(c, layout.weaponPanel.x + 28, layout.weaponPanel.y + 16, layout.weaponPanel.w - 56, layout.weaponPanel.h - 32, 8);
  c.fillStyle = plate;
  c.fill();
  c.restore();

  cache.staticKey = `${w}x${h}`;
}

export function drawHUD(ctx, game) {
  if (!game?.ship) return;

  ctx.save();
  try {

  if (!game.uiCache) {
    game.uiCache = { lastScoreInt: null, scoreText: '0', staticCanvas: null, staticKey: '' };
  }

  const layout = buildLayout(game.world);
  const scoreInt = Math.max(0, Math.floor(game.score));
  if (game.uiCache.lastScoreInt !== scoreInt) {
    game.uiCache.lastScoreInt = scoreInt;
    game.uiCache.scoreText = formatScoreFr(scoreInt);
  }

  const key = `${game.world.w}x${game.world.h}`;
  if (game.uiCache.staticKey !== key) {
    rebuildStaticLayer(game, layout);
  }

  if (game.uiCache.staticCanvas) {
    ctx.drawImage(game.uiCache.staticCanvas, 0, 0);
  }

  const comboWindow = typeof game.getComboWindow === 'function' ? game.getComboWindow() : 1;
  const ratio = clamp(game.comboTimer / Math.max(comboWindow, 0.001), 0, 1);
  const weaponStyle = getWeaponHUDStyle(game.ship.weaponLevel ?? 1);
  const volumeUI = game.hudVolumeUI ?? {};

  neonText(ctx, `COMBO x${formatCombo(game.combo)}`, layout.comboPanel.x + 24, layout.comboPanel.y + layout.comboPanel.h * 0.5, {
    color: '#72e9ff',
    font: `700 44px ${HUD_FONTS.neon}`,
    intensity: 1.2,
  });

  const timerText = game.comboTimer.toFixed(1).padStart(4, '0');
  neonBar(ctx, {
    x: layout.comboBarPanel.x + 18,
    y: layout.comboBarPanel.y + 16,
    w: layout.comboBarPanel.w - 136,
    h: 24,
  }, ratio, {
    fillColor: '#53d8ff',
    fillColor2: '#ff56df',
    intensity: 1,
  });
  neonText(ctx, timerText, layout.comboBarPanel.x + layout.comboBarPanel.w - 24, layout.comboBarPanel.y + layout.comboBarPanel.h * 0.56, {
    align: 'right',
    color: '#ff9bf5',
    font: `700 36px ${HUD_FONTS.mono}`,
    intensity: 0.9,
  });

  neonText(ctx, `VAGUE ${formatWave(game.level)}`, layout.wavePanel.x + layout.wavePanel.w * 0.5, layout.wavePanel.y + layout.wavePanel.h * 0.56, {
    align: 'center',
    color: '#ff98f5',
    font: `700 64px ${HUD_FONTS.neon}`,
    intensity: 1.35,
  });

  neonText(ctx, 'SCORE', layout.scorePanel.x + layout.scorePanel.w * 0.7, layout.scorePanel.y + 23, {
    align: 'center',
    color: '#7be9ff',
    font: `700 25px ${HUD_FONTS.neon}`,
    intensity: 0.9,
  });
  neonText(ctx, game.uiCache.scoreText, layout.scorePanel.x + layout.scorePanel.w * 0.54, layout.scorePanel.y + 48, {
    align: 'center',
    color: '#d4fcff',
    font: `700 48px ${HUD_FONTS.neon}`,
    intensity: 1.05,
  });

  if (volumeUI.sliderRects?.music) {
    drawVolumeSlider(ctx, volumeUI.sliderRects.music, 'MUSIC', volumeUI.musicVolume ?? 0, {
      hovered: volumeUI.hoveredSlider === 'music',
      active: volumeUI.activeSlider === 'music',
    });
  }

  if (volumeUI.sliderRects?.sfx) {
    drawVolumeSlider(ctx, volumeUI.sliderRects.sfx, 'SFX', volumeUI.sfxVolume ?? 0, {
      hovered: volumeUI.hoveredSlider === 'sfx',
      active: volumeUI.activeSlider === 'sfx',
    });
  }

  const maxLives = 3;
  const size = 84;
  const spacing = 16;
  const livesX = layout.margin;
  const livesY = game.world.h - layout.margin - size;
  ctx.save();
  for (let i = 0; i < maxLives; i += 1) {
    const img = i < game.lives ? lifeFullImg : lifeEmptyImg;
    const dx = livesX + i * (size + spacing);
    ctx.shadowColor = i < game.lives ? 'rgba(255, 115, 227, 0.9)' : 'rgba(88, 126, 173, 0.45)';
    ctx.shadowBlur = i < game.lives ? 14 : 8;
    ctx.drawImage(img, dx, livesY, size, size);
  }
  ctx.restore();

  neonText(ctx, 'ARME', layout.weaponPanel.x + 34, layout.weaponPanel.y + 24, {
    color: '#8feaff',
    font: `700 32px ${HUD_FONTS.neon}`,
    baseline: 'middle',
    intensity: 0.8,
  });
  neonLine(ctx, layout.weaponPanel.x + 34, layout.weaponPanel.y + 46, layout.weaponPanel.x + 170, layout.weaponPanel.y + 46, {
    color: '#53d8ff',
    width: 3.5,
    coreWidth: 1.7,
    intensity: 0.95,
  });
  neonText(ctx, weaponStyle.label, layout.weaponPanel.x + layout.weaponPanel.w * 0.56, layout.weaponPanel.y + 50, {
    align: 'center',
    color: weaponStyle.color,
    font: `700 56px ${HUD_FONTS.neon}`,
    baseline: 'middle',
    intensity: 1.2,
  });
  } finally {
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
