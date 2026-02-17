import { Input } from "./Input.js";
import { debugLog, resizeCanvasToDisplaySize } from "./utils.js";
import { dist2, rand } from "./math.js";
import { Ship } from "../entities/Ship.js";
import { Bullet } from "../entities/Bullet.js";
import { Particle } from "../entities/effects/Particle.js";
import { Explosion } from "../entities/effects/Explosion.js";
import { DebrisParticle } from "../entities/effects/DebrisParticle.js";
import { Background } from "./Background.js";
import { drawHUD } from "../ui/HUD.js";
import { SpatialHash } from "./SpatialHash.js";
import { Pool } from "./Pool.js";
import { spawnLevel, nextLevel, getWaveBudget, getWaveWeights, buildWave } from "./systems/Spawner.js";
import { updateEffectsOnly, spawnDebris } from "./systems/Effects.js";
import { rebuildAsteroidSpatialHash, resolveAsteroidCollisions, resolveBulletAsteroidCollisions } from "./systems/Combat.js";
import { updateTitleState } from "./states/TitleState.js";
import { updatePlayState } from "./states/PlayState.js";
import { updateGameOverAnimState, updateGameOverReadyState } from "./states/GameOverState.js";
import { DIFFICULTY_PRESETS, COMBO_OVERLAY, COMBO_WINDOW } from "../config/gameplay.js";
import { UIRenderer } from "../ui/UIRenderer.js";
import { mouseToCanvas } from "../ui/UIInput.js";
import { UI_ACTION } from "../ui/UIActionTypes.js";
import AudioManager, { DEFAULT_AUDIO_MANIFEST } from "../audio/AudioManager.js";

const PLAYER_HIT_SHAKE = { amp: 10, dur: 0.18 };
const WEAPON4_SHOT_SHAKE = { amp: 1.5, dur: 0.05 };

const UI_LAYOUT = {
  menuButtonWidth: 180,
  menuButtonHeight: 50,
  titleButtonWidth: 220,
  titleButtonHeight: 56,
  titleButtonGap: 16,
  titleButtonStartYOffset: 30,
  menuButtonYFactor: 0.6,
};

const HUD_VOLUME_LAYOUT = {
  margin: 28,
  scorePanelWidth: 350,
  scorePanelHeight: 94,
  sliderWidth: 196,
  sliderHeight: 24,
  sliderGap: 10,
  topOffsetAfterScore: 40,
  hitPaddingX: 10,
  hitPaddingY: 8,
};

const DEBUG = {
  logIntervalSec: 1.0,
  perfLogIntervalSec: 1.0,
  profilerFreezeSec: 2,
  seamSampleSmoothingLabel: {
    nearest: "nearest (OFF)",
    linear: "linear (ON)",
  },
};

const COMBO_WARN_FX = {
  thresholdSec: 3.0,
  pulseBase: 0.5,
  pulseAmplitude: 0.5,
  pulseTimeScale: 0.01,
  pulseFrequency: 4.0,
  alphaBase: 0.08,
  alphaScale: 0.18,
  thicknessBase: 8,
  thicknessScale: 6,
};

const GAME_STATE = {
  TITLE: "TITLE",
  PLAY: "PLAY",
  GAME_OVER_ANIM: "GAME_OVER_ANIM",
  GAME_OVER_READY: "GAME_OVER_READY",
};

const SHOOT_SFX_BY_LEVEL = {
  1: "shoot_lvl1",
  2: "shoot_lvl2",
  3: "shoot_lvl3",
  4: "shoot_lvl4",
};

export class Game {
  constructor(canvas, { audio } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) {
      throw new Error('2D canvas context unavailable');
    }

    this.input = new Input(window);
    this.uiRenderer = new UIRenderer();
    this.audio = audio ?? null;
    this.audioReady = false;
    this.audioUnlockAttached = false;
    this.musicStarted = false;
    this.musicLoopHandle = null;
    this.engineLoopHandle = null;
    this.wasThrusting = false;
    this.settings = { music: 0.6, sfx: 0.8 };
    this.hudVolumeUI = {
      musicVolume: this.settings.music,
      sfxVolume: this.settings.sfx,
      hoveredSlider: null,
      activeSlider: null,
      sliderRects: {
        music: { x: 0, y: 0, w: 0, h: 0 },
        sfx: { x: 0, y: 0, w: 0, h: 0 },
      },
    };

    this.last = 0;
    this.running = false;

    this.resizeObserver = null;
    this.resizeDirty = true;
    this.resizeFallbackHandler = () => {
      this.resizeDirty = true;
    };
    this.orientationChangeHandler = () => {
      this.resizeDirty = true;
    };

    this.pointerTransform = {
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
    };

    this.world = { w: 0, h: 0 };

    this.ship = null;
    this.asteroids = [];
    this.bullets = [];

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.lives = 3;

    this.level = 1;
    this.particles = [];
    this.explosions = [];
    this.debris = [];
    this.maxDebris = 250;
    this.maxBullets = 120;
    this.maxParticles = 900;
    this.maxExplosions = 80;
    this.fxSpawnBudgetTotal = 200;
    this.fxParticleBudgetPerFrame = 120;
    this.fxDebrisBudgetPerFrame = 80;
    this.fxSpawnedThisFrame = 0;
    this.fxSpawnedParticlesThisFrame = 0;
    this.fxSpawnedDebrisThisFrame = 0;

    this.asteroidSpatialHash = new SpatialHash(96);
    this.asteroidSpatialQuery = [];
    this.asteroidIndexMap = new Map();

    this.bulletPool = new Pool(() => new Bullet());
    this.particlePool = new Pool(() => new Particle());
    this.debrisPool = new Pool(() => new DebrisParticle());

    this.background = new Background(canvas.width, canvas.height);
    this.waveQueued = false;

    this.shakeTime = 0;
    this.shakeDur = 0;
    this.shakeAmp = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.hitStop = 0;

    // États principaux: TITLE -> PLAY -> GAME_OVER_ANIM -> GAME_OVER_READY.
    this.state = GAME_STATE.TITLE;
    this.GAME_STATE = GAME_STATE;
    this.gameOverDelay = 0;

    this.difficultyPreset = null;
    this.difficultyPresets = DIFFICULTY_PRESETS;

    this.hoveredButtonId = null;
    this.titleButtons = [];
    this.menuButton = { id: "MENU", label: "MENU", x: 0, y: 0, w: UI_LAYOUT.menuButtonWidth, h: UI_LAYOUT.menuButtonHeight };

    this.debugEnabled = false;
    this.debugColliders = false;
    this.debugProfiler = false;
    this.debugSeams = false;
    this._fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._updateMs = 0;
    this._renderMs = 0;
    this.debugLogAccum = 0;
    this.debugPerfAccum = 0;
    this.debugPerf = {
      updateMs: 0,
      drawMs: 0,
      frameCount: 0,
      frameTimeTotal: 0,
    };
    this.debugStats = {
      asteroidCollisionCount: 0,
      asteroidMaxSpeed: 0,
      asteroidTotalKineticEnergy: 0,
      asteroidSpatialHashRebuilds: 0,
    };

    this.profView = {
      accTime: 0,
      refreshEvery: 0.25,
      shownUpdateMs: 0,
      shownDrawMs: 0,
      shownFps: 0,
      shownCollisions: 0,
      shownMaxSpeed: 0,
      shownKE: 0,
      shownSpatialHashRebuilds: 0,
      peakWindow: 1.0,
      peakUpdateMs: 0,
      peakDrawMs: 0,
      peakTimer: 0,
      freezeT: 0,
    };

    this.hudFx = {
      weaponFlashT: 0,
      comboPulseT: 0,
      waveIntroT: 0,
    };

    this.loopHandle = (t) => this.#loop(t);

    this.pointerMoveHandler = (e) => this.#onPointerMove(e);
    this.pointerDownHandler = (e) => this.#onPointerDown(e);
    this.pointerUpHandler = (e) => this.#onPointerUp(e);
    this.pointerCancelHandler = (e) => this.#onPointerUp(e);
    this.audioUnlockHandler = () => this.#unlockAudioOnFirstInput();

    // Listener souris unique: on ignore selon l'état courant.
    this.canvas.addEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.addEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.addEventListener("pointerup", this.pointerUpHandler);
    this.canvas.addEventListener("pointercancel", this.pointerCancelHandler);
  }

  applyComboBreak() {
    if (!this.ship) return;
    // Combo break uniquement à l'expiration : diviser jusqu'à perdre au moins 1 palier d'arme.
    const oldCombo = this.combo;
    const oldLevel = this.ship.weaponLevel;
    let c = this.combo / 2;

    while (c > 1) {
      this.ship.updateWeaponLevel(c);
      if (this.ship.weaponLevel < oldLevel) break;
      c /= 2;
    }

    this.combo = Math.max(1, c);
    this.ship.updateWeaponLevel(this.combo);
    if (this.ship.weaponLevel < oldLevel && this.audioReady && this.audio) {
      this.audio.play("weapon_downgrade");
    }
    this.logDebug("combo", `Combo break combo ${oldCombo.toFixed(2)} -> ${this.combo.toFixed(2)} level ${oldLevel} -> ${this.ship.weaponLevel}`);
  }



  getComboWindowForWeaponLevel(level) {
    return Math.max(COMBO_WINDOW.min, COMBO_WINDOW.base - (level - 1) * COMBO_WINDOW.perWeaponLevel);
  }

  getComboWindow() {
    const level = this.ship?.weaponLevel ?? 1;
    const comboWindow = this.getComboWindowForWeaponLevel(level);
    if (this.debugEnabled) {
      const legacyComboWindow = Math.max(COMBO_WINDOW.min, COMBO_WINDOW.base - (level - 1) * COMBO_WINDOW.perWeaponLevel);
      console.assert(
        comboWindow === legacyComboWindow,
        `[DEBUG] Combo window mismatch: ${comboWindow} vs legacy ${legacyComboWindow}`,
      );
    }
    return comboWindow;
  }

  logDebug(category, ...args) {
    debugLog(this.debugEnabled, category, ...args);
  }

  clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  addShake(amp, dur) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeDur = Math.max(this.shakeDur, dur);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  addHitStop(sec) {
    this.hitStop = Math.max(this.hitStop, sec);
  }


  #refreshPointerTransform() {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTransform.left = rect.left;
    this.pointerTransform.top = rect.top;
    this.pointerTransform.scaleX = rect.width > 0 ? this.world.w / rect.width : 1;
    this.pointerTransform.scaleY = rect.height > 0 ? this.world.h / rect.height : 1;
  }

  #rebuildMenuButtons() {
    const w = UI_LAYOUT.titleButtonWidth;
    const h = UI_LAYOUT.titleButtonHeight;
    const gap = UI_LAYOUT.titleButtonGap;
    const x = this.world.w * 0.5 - w * 0.5;
    const startY = this.world.h * 0.5 - (h * 3 + gap * 2) * 0.5 + UI_LAYOUT.titleButtonStartYOffset;

    this.titleButtons = [
      { id: "EASY", label: "EASY", x, y: startY, w, h },
      { id: "NORMAL", label: "NORMAL", x, y: startY + (h + gap), w, h },
      { id: "HARD", label: "HARD", x, y: startY + 2 * (h + gap), w, h },
    ];

    this.menuButton.x = this.world.w * 0.5 - this.menuButton.w * 0.5;
    this.menuButton.y = this.world.h * UI_LAYOUT.menuButtonYFactor;
  }

  #createUIModel() {
    return {
      state: this.state,
      GAME_STATE: this.GAME_STATE,
      world: this.world,
      hoveredButtonId: this.hoveredButtonId,
      titleButtons: this.titleButtons,
      menuButton: this.menuButton,
      score: this.score,
      debugProfiler: this.debugProfiler,
      profView: this.profView,
    };
  }

  #onPointerMove(e) {
    const { mx, my } = mouseToCanvas(this.pointerTransform, e);

    if (this.hudVolumeUI.activeSlider) {
      this.#updateVolumeFromPointer(this.hudVolumeUI.activeSlider, mx);
      this.hudVolumeUI.hoveredSlider = this.hudVolumeUI.activeSlider;
      this.canvas.style.cursor = "pointer";
      return;
    }

    const hoveredSlider = this.#findHoveredSlider(mx, my);
    this.hudVolumeUI.hoveredSlider = hoveredSlider;
    if (hoveredSlider) {
      this.canvas.style.cursor = "pointer";
      return;
    }

    const previousHoveredButtonId = this.hoveredButtonId;
    this.hoveredButtonId = this.uiRenderer.handlePointerMove(this.#createUIModel(), mx, my);
    const hoveredChangedToButton = this.hoveredButtonId && this.hoveredButtonId !== previousHoveredButtonId;
    if (hoveredChangedToButton && this.audioReady && this.audio) {
      this.audio.play("ui_hover");
    }
    this.canvas.style.cursor = this.hoveredButtonId ? "pointer" : "default";
  }

  #onPointerDown(e) {
    const { mx, my } = mouseToCanvas(this.pointerTransform, e);
    const hoveredSlider = this.#findHoveredSlider(mx, my);
    if (hoveredSlider) {
      this.hudVolumeUI.activeSlider = hoveredSlider;
      this.hudVolumeUI.hoveredSlider = hoveredSlider;
      this.#updateVolumeFromPointer(hoveredSlider, mx);
      this.canvas.style.cursor = "pointer";
      this.canvas.setPointerCapture?.(e.pointerId);
      return;
    }

    const action = this.uiRenderer.handlePointerDown(this.#createUIModel(), mx, my);
    this.#applyUIAction(action);
  }

  #onPointerUp(e) {
    const { mx, my } = mouseToCanvas(this.pointerTransform, e);
    this.hudVolumeUI.activeSlider = null;
    this.hudVolumeUI.hoveredSlider = this.#findHoveredSlider(mx, my);
    this.canvas.style.cursor = this.hudVolumeUI.hoveredSlider || this.hoveredButtonId ? "pointer" : "default";
    this.canvas.releasePointerCapture?.(e.pointerId);
  }

  #findHoveredSlider(mx, my) {
    if (this.state === GAME_STATE.TITLE) return null;

    const entries = [
      ["music", this.hudVolumeUI.sliderRects.music],
      ["sfx", this.hudVolumeUI.sliderRects.sfx],
    ];
    for (const [id, rect] of entries) {
      if (!rect || rect.w <= 0 || rect.h <= 0) continue;
      const hitX = rect.x - HUD_VOLUME_LAYOUT.hitPaddingX;
      const hitY = rect.y - HUD_VOLUME_LAYOUT.hitPaddingY;
      const hitW = rect.w + HUD_VOLUME_LAYOUT.hitPaddingX * 2;
      const hitH = rect.h + HUD_VOLUME_LAYOUT.hitPaddingY * 2;
      if (mx >= hitX && mx <= hitX + hitW && my >= hitY && my <= hitY + hitH) {
        return id;
      }
    }

    return null;
  }

  #updateVolumeFromPointer(sliderId, mx) {
    const rect = this.hudVolumeUI.sliderRects[sliderId];
    if (!rect || rect.w <= 0) return;

    const value01 = this.clamp01((mx - rect.x) / rect.w);
    if (sliderId === "music") {
      this.settings.music = value01;
      this.hudVolumeUI.musicVolume = value01;
      if (this.audio) this.audio.setVolume("music", value01);
      return;
    }

    this.settings.sfx = value01;
    this.hudVolumeUI.sfxVolume = value01;
    if (this.audio) this.audio.setVolume("sfx", value01);
  }

  #applyUIAction(action) {
    if (!action) return;

    if (action.type === UI_ACTION.START_GAME) {
      if (this.audioReady && this.audio) this.audio.play("ui_click");
      this.#startWithDifficulty(action.difficulty);
      return;
    }

    if (action.type === UI_ACTION.GO_TO_MENU) {
      if (this.audioReady && this.audio) this.audio.play("ui_click");
      this.#stopEngineLoop();
      this.state = GAME_STATE.TITLE;
      this.hoveredButtonId = null;
    }
  }

  #startWithDifficulty(id) {
    this.difficultyPreset = id;
    this.#newGame();
    this.state = GAME_STATE.PLAY;
    this.logDebug("state", `Start game difficulty=${id}`);
  }

  async start() {
    if (this.running) return;

    this.#applyResizeIfNeeded(true);

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);

    await this.#initAudio();

    window.addEventListener("resize", this.resizeFallbackHandler);
    window.addEventListener("orientationchange", this.orientationChangeHandler);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeDirty = true;
      });
      this.resizeObserver.observe(document.documentElement);
    }

    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.loopHandle);
  }

  destroy() {
    this.running = false;
    window.removeEventListener("resize", this.resizeFallbackHandler);
    window.removeEventListener("orientationchange", this.orientationChangeHandler);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.removeEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.removeEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.removeEventListener("pointerup", this.pointerUpHandler);
    this.canvas.removeEventListener("pointercancel", this.pointerCancelHandler);
    this.#detachAudioUnlockListeners();
    if (this.audio) {
      this.#stopEngineLoop();
      this.wasThrusting = false;
      if (this.musicLoopHandle) {
        this.audio.stopLoop(this.musicLoopHandle);
        this.musicLoopHandle = null;
      }
      this.musicStarted = false;
      this.audio.dispose().catch((error) => {
        console.warn("Audio dispose failed", error);
      });
      this.audio = null;
    }
    this.input.destroy();
    this.canvas.style.cursor = "default";
  }

  async #initAudio() {
    if (!this.audio) {
      this.audio = new AudioManager();
    }

    try {
      await this.audio.init();
      await this.audio.load(DEFAULT_AUDIO_MANIFEST);
      this.audio.setVolume("music", this.settings.music);
      this.audio.setVolume("sfx", this.settings.sfx);
      this.audioReady = true;
      this.#attachAudioUnlockListeners();
      this.#ensureMusicStarted();
    } catch (error) {
      this.audioReady = false;
      console.warn("Audio init/load failed", error);
    }
  }

  #attachAudioUnlockListeners() {
    if (this.audioUnlockAttached) return;
    window.addEventListener("keydown", this.audioUnlockHandler, { once: true });
    window.addEventListener("pointerdown", this.audioUnlockHandler, { once: true });
    this.audioUnlockAttached = true;
  }

  #detachAudioUnlockListeners() {
    if (!this.audioUnlockAttached) return;
    window.removeEventListener("keydown", this.audioUnlockHandler);
    window.removeEventListener("pointerdown", this.audioUnlockHandler);
    this.audioUnlockAttached = false;
  }

  #unlockAudioOnFirstInput() {
    this.#detachAudioUnlockListeners();
    if (!this.audio || !this.audioReady) return;
    this.audio.unlock()
      .then(() => {
        this.#ensureMusicStarted();
      })
      .catch((error) => {
        console.warn("Audio unlock failed", error);
      });
  }

  #ensureMusicStarted() {
    if (!this.audio || !this.audioReady || this.musicStarted) return;

    try {
      this.musicLoopHandle = this.audio.playLoop("music_theme");
      this.musicStarted = true;
    } catch (error) {
      console.warn("Music start failed", error);
    }
  }

  #startEngineLoop() {
    if (!this.audioReady || !this.audio || this.engineLoopHandle) return;
    this.engineLoopHandle = this.audio.playLoop("engine_loop");
  }

  #stopEngineLoop() {
    if (!this.audio || !this.engineLoopHandle) return;
    this.audio.stopLoop(this.engineLoopHandle);
    this.engineLoopHandle = null;
  }

  #syncEngineLoop() {
    const thrusting = Boolean(this.ship?.thrusting);
    if (thrusting && !this.wasThrusting) {
      this.#startEngineLoop();
    } else if (!thrusting && this.wasThrusting) {
      this.#stopEngineLoop();
    }
    this.wasThrusting = thrusting;
  }

  #newGame() {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.lives = 3;

    this.level = 1;
    this.#releaseAllToPool(this.particles, this.particlePool);
    this.#releaseAllToPool(this.debris, this.debrisPool);
    this.#releaseAllToPool(this.bullets, this.bulletPool);

    this.particles = [];
    this.explosions = [];
    this.debris = [];

    this.bullets = [];
    this.asteroids = [];
    this.waveQueued = false;
    this.shakeTime = 0;
    this.shakeDur = 0;
    this.shakeAmp = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.hitStop = 0;
    this.#stopEngineLoop();
    this.wasThrusting = false;

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);
    this.comboTimer = this.getComboWindow();
    this.hudFx.waveIntroT = 1.10;

    this.#spawnLevel();
  }

  #spawnLevel() {
    spawnLevel(this);
  }

  #pushCapped(list, items, max, pool = null) {
    if (Array.isArray(items)) list.push(...items);
    else list.push(items);
    if (list.length > max) {
      const removed = list.splice(0, list.length - max);
      if (pool) pool.releaseMany(removed);
    }
  }

  #releaseAllToPool(items, pool) {
    if (!pool || items.length === 0) return;
    pool.releaseMany(items);
    items.length = 0;
  }

  #compactAlive(items, pool = null) {
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      const item = items[read];
      if (!item.dead) {
        items[write] = item;
        write += 1;
      } else if (pool) {
        pool.release(item);
      }
    }
    items.length = write;
  }

  #spawnDebris(x, y, count, type, speedMin, speedMax) {
    spawnDebris(this, x, y, count, type, speedMin, speedMax);
  }

  #nextLevel() {
    nextLevel(this);
  }

  getWaveBudget(wave) {
    return getWaveBudget(this, wave);
  }

  getWaveWeights(wave) {
    return getWaveWeights(wave);
  }

  buildWave(wave) {
    buildWave(this, wave);
  }

  #loop(t) {
    if (!this.running) return;

    const dt = Math.min(0.033, (t - this.last) / 1000 || 0);
    this.last = t;

    this.#applyResizeIfNeeded();

    const updateStart = performance.now();
    this.#update(dt);
    this._updateMs = performance.now() - updateStart;

    const renderStart = performance.now();
    this.#draw();
    this._renderMs = performance.now() - renderStart;

    this._frameCount += 1;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps = this._fpsTimer > 0 ? this._frameCount / this._fpsTimer : 0;
      this._frameCount = 0;
      this._fpsTimer = 0;
    }

    if (this.debugEnabled) {
      this.debugPerf.updateMs += this._updateMs;
      this.debugPerf.drawMs += this._renderMs;
      this.debugPerf.frameTimeTotal += this._updateMs + this._renderMs;
      this.debugPerf.frameCount += 1;
    }

    this.profView.peakUpdateMs = Math.max(this.profView.peakUpdateMs, this._updateMs);
    this.profView.peakDrawMs = Math.max(this.profView.peakDrawMs, this._renderMs);
    this.profView.peakTimer += dt;
    if (this.profView.peakTimer >= this.profView.peakWindow) {
      this.profView.peakUpdateMs = 0;
      this.profView.peakDrawMs = 0;
      this.profView.peakTimer = 0;
    }

    if (this.profView.freezeT > 0) {
      this.profView.freezeT = Math.max(0, this.profView.freezeT - dt);
    }

    this.profView.accTime += dt;
    if (this.profView.freezeT <= 0 && this.profView.accTime >= this.profView.refreshEvery) {
      this.profView.shownUpdateMs = this._updateMs;
      this.profView.shownDrawMs = this._renderMs;
      this.profView.shownFps = this._fps;
      this.profView.shownCollisions = this.debugStats.asteroidCollisionCount;
      this.profView.shownMaxSpeed = this.debugStats.asteroidMaxSpeed;
      this.profView.shownKE = this.debugStats.asteroidTotalKineticEnergy;
      this.profView.shownSpatialHashRebuilds = this.debugStats.asteroidSpatialHashRebuilds;
      this.profView.accTime = 0;
    }

    this.input.endFrame();
    requestAnimationFrame(this.loopHandle);
  }

  #applyResizeIfNeeded(force = false) {
    if (!force && !this.resizeDirty) return;
    const r = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    const changed = force || r.changed || this.world.w !== r.cssW || this.world.h !== r.cssH;
    this.resizeDirty = false;
    if (!changed) return;

    this.world.w = r.cssW;
    this.world.h = r.cssH;
    this.background.resize(this.world.w, this.world.h);
    this.#rebuildMenuButtons();
    this.#rebuildHudSliderLayout();
    this.#refreshPointerTransform();
  }

  #rebuildHudSliderLayout() {
    const margin = HUD_VOLUME_LAYOUT.margin;
    const top = margin + 8 + HUD_VOLUME_LAYOUT.scorePanelHeight + HUD_VOLUME_LAYOUT.topOffsetAfterScore;
    const scorePanelX = this.world.w - margin - HUD_VOLUME_LAYOUT.scorePanelWidth;
    const sliderW = HUD_VOLUME_LAYOUT.sliderWidth;
    const sliderH = HUD_VOLUME_LAYOUT.sliderHeight;
    const rightX = scorePanelX + HUD_VOLUME_LAYOUT.scorePanelWidth - sliderW;

    this.hudVolumeUI.sliderRects.music = { x: rightX, y: top, w: sliderW, h: sliderH };
    this.hudVolumeUI.sliderRects.sfx = { x: rightX, y: top + sliderH + HUD_VOLUME_LAYOUT.sliderGap, w: sliderW, h: sliderH };
  }

  #updateGameplay(dt) {
    this.#updateTimersAndScore(dt);

    this.ship.update(dt, this.input, this.world);
    this.#syncEngineLoop();

    this.#updateShooting();
    this.#updateEntities(dt);

    if (this.#resolveCollisions()) return;

    this.#compactAlive(this.bullets, this.bulletPool);
    this.#compactAlive(this.asteroids);
    this.#compactAlive(this.particles, this.particlePool);
    this.#compactAlive(this.explosions);
    this.#compactAlive(this.debris, this.debrisPool);

    this.#updateWaveOrSpawner();
    this.#updateTimersAndScore(dt, true);
  }

  #updateShooting() {
    if (this.input.wasPressed("shoot") || this.input.isDown("shoot")) {
      const bulletsBeforeShot = this.bullets.length;
      this.ship.tryShoot(this.bullets, (...args) => this.bulletPool.acquire(...args));
      if (this.bullets.length > bulletsBeforeShot) {
        const level = Math.min(4, Math.max(1, this.ship.weaponLevel || 1));
        const shootSfx = SHOOT_SFX_BY_LEVEL[level];
        if (shootSfx && this.audioReady && this.audio) {
          this.audio.play(shootSfx);
        }
      }
      if (this.ship.weaponLevel >= 4 && this.bullets.length > bulletsBeforeShot) {
        this.addShake(WEAPON4_SHOT_SHAKE.amp, WEAPON4_SHOT_SHAKE.dur);
      }
      if (this.bullets.length > this.maxBullets) {
        const removed = this.bullets.splice(0, this.bullets.length - this.maxBullets);
        this.bulletPool.releaseMany(removed);
      }
    }
  }

  #updateEntities(dt) {
    for (const b of this.bullets) b.update(dt, this.world);

    for (const a of this.asteroids) {
      a.update(dt, this.world);

      if (a.type === "fast") {
        const speed = Math.hypot(a.vx, a.vy);
        if (speed > 10) {
          const nx = -a.vx / speed;
          const ny = -a.vy / speed;

          const scale = a.radius / 26;
          const rate = 55 * scale;
          const spread = 6 * scale;
          const lifeMin = 0.75 + 0.12 * scale;
          const lifeMax = 1.60 + 0.25 * scale;
          const rMin = 1.2 * scale;
          const rMax = 2.8 * scale;

          a.fastTrailAcc = (a.fastTrailAcc ?? 0) + dt * rate;

          while (a.fastTrailAcc >= 1) {
            a.fastTrailAcc -= 1;

            const tx = -ny;
            const ty = nx;

            const back = rand(0.6, 1.4) * a.radius;
            const sx2 = a.x + nx * back + (Math.random() - 0.5) * spread;
            const sy2 = a.y + ny * back + (Math.random() - 0.5) * spread;

            const baseBackSpeed = rand(5, 25) * scale;
            const sideSpeed = rand(-12, 12) * scale;

            const pvx = nx * baseBackSpeed + tx * sideSpeed;
            const pvy = ny * baseBackSpeed + ty * sideSpeed;

            const inherit = 0.12;
            const vx = pvx + a.vx * inherit;
            const vy = pvy + a.vy * inherit;

            this.particles.push(
              this.particlePool.acquire(
                sx2,
                sy2,
                vx,
                vy,
                rand(lifeMin, lifeMax),
                rand(rMin, rMax)
              )
            );
          }
        }
      }
    }

    this.debugStats.asteroidSpatialHashRebuilds = 0;
    rebuildAsteroidSpatialHash(this);
    resolveAsteroidCollisions(this);
    // Rebuild requis: resolveAsteroidCollisions corrige les positions, et les collisions balle->astéroïde
    // doivent requêter la grille avec ces positions finales pour garder un résultat identique.
    rebuildAsteroidSpatialHash(this);

    for (const p of this.particles) p.update(dt, this.world);
    for (const e of this.explosions) e.update(dt);
    for (const d of this.debris) d.update(dt, this.world);
  }

  #resolveCollisions() {
    resolveBulletAsteroidCollisions(this);

    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (a.dead) continue;

        const broadR = this.ship.radius + a.radius;
        if (dist2(this.ship.x, this.ship.y, a.x, a.y) > broadR * broadR) continue;

        const hitCircles = a.getWorldHitCircles(a._worldHitCircles ?? (a._worldHitCircles = []));
        let shipHit = false;
        for (let i = 0; i < hitCircles.length; i++) {
          const c = hitCircles[i];
          const rr = this.ship.radius + c.r;
          if (dist2(this.ship.x, this.ship.y, c.x, c.y) <= rr * rr) {
            shipHit = true;
            break;
          }
        }

        if (shipHit) {
          this.lives -= 1;
          this.combo = 1;
          this.comboTimer = 0;
          this.ship.updateWeaponLevel(this.combo);

          this.#pushCapped(this.explosions, new Explosion(this.ship.x, this.ship.y, { life: 0.45, ringCount: 3, maxRadius: 100, flashAlpha: 0.95, colorMode: "normal" }), this.maxExplosions);
          this.addShake(PLAYER_HIT_SHAKE.amp, PLAYER_HIT_SHAKE.dur);
          {
            const baseParticleCount = Math.round(70 * 0.65);
            const particleBudgetLeft = Math.max(0, this.fxParticleBudgetPerFrame - this.fxSpawnedParticlesThisFrame);
            const totalBudgetLeft = Math.max(0, this.fxSpawnBudgetTotal - this.fxSpawnedThisFrame);
            const maxToSpawn = Math.min(baseParticleCount, particleBudgetLeft, totalBudgetLeft);
            const spawnedParticles = Particle.burst(
              this.ship.x,
              this.ship.y,
              baseParticleCount,
              80,
              380,
              0.35,
              1.05,
              1,
              3,
              (...args) => this.particlePool.acquire(...args),
              maxToSpawn
            );
            const spawned = spawnedParticles.length;
            this.fxSpawnedParticlesThisFrame += spawned;
            this.fxSpawnedThisFrame += spawned;
            this.#pushCapped(this.particles, spawnedParticles, this.maxParticles, this.particlePool);
          }

          if (this.lives <= 0) {
            this.logDebug("state", `Game over score=${Math.floor(this.score)} -> GAME_OVER_ANIM`);
            this.state = GAME_STATE.GAME_OVER_ANIM;
            this.gameOverDelay = 2.0;
          } else {
            this.ship.respawn(this.world.w / 2, this.world.h / 2);
          }

          return true;
        }
      }
    }

    return false;
  }

  #updateWaveOrSpawner() {
    if (this.asteroids.length <= 1 && !this.waveQueued) {
      this.#nextLevel();
    }
  }

  #updateTimersAndScore(dt, scoreOnly = false) {
    if (!scoreOnly) {
      this.fxSpawnedThisFrame = 0;
      this.fxSpawnedParticlesThisFrame = 0;
      this.fxSpawnedDebrisThisFrame = 0;

      this.hudFx.weaponFlashT = Math.max(0, this.hudFx.weaponFlashT - dt);
      this.hudFx.comboPulseT = Math.max(0, this.hudFx.comboPulseT - dt);
      this.hudFx.waveIntroT = Math.max(0, this.hudFx.waveIntroT - dt);

      if (this.comboTimer > 0) this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.applyComboBreak();
        this.comboTimer = this.getComboWindow();
      }

      return;
    }

    if (this.combo === 1) {
      const difficulty = this.difficultyPresets[this.difficultyPreset] ?? this.difficultyPresets.NORMAL;
      this.score -= difficulty.scoreDrainCombo1PerSec * dt;
      this.score = Math.max(0, this.score);
    }
  }

  #update(dt) {
    if (this.input.wasPressed("KeyL")) {
      this.debugEnabled = !this.debugEnabled;
      debugLog(true, "toggle", this.debugEnabled ? "Enabled" : "Disabled");
    }

    if (this.input.wasPressed("debugToggle")) {
      this.debugColliders = !this.debugColliders;
      this.logDebug("colliders", `Colliders ${this.debugColliders ? "ON" : "OFF"}`);
    }

    if (this.input.wasPressed("debugProfiler")) {
      this.debugProfiler = !this.debugProfiler;
    }

    if (this.input.wasPressed("debugProfilerFreeze")) {
      this.profView.freezeT = DEBUG.profilerFreezeSec;
      this.profView.accTime = 0;
    }

    if (this.input.wasPressed("debugSeams")) {
      this.debugSeams = !this.debugSeams;
      this.background.debugSeams = this.debugSeams;
      this.logDebug("seams", `Seams ${this.debugSeams ? "ON" : "OFF"}`);
    }

    if (this.input.wasPressed("debugSeamsNearest")) {
      this.background.debugForceNearestSmoothing = !this.background.debugForceNearestSmoothing;
      this.logDebug("seams", `Seam smoothing mode: ${this.background.debugForceNearestSmoothing ? DEBUG.seamSampleSmoothingLabel.nearest : DEBUG.seamSampleSmoothingLabel.linear}`);
    }

    this.debugLogAccum += dt;
    this.debugPerfAccum += dt;
    if (this.debugEnabled && this.debugLogAccum >= DEBUG.logIntervalSec) {
      this.debugLogAccum = 0;
      const difficulty = this.difficultyPreset ?? "NORMAL";
      this.logDebug(
        "state",
        `state=${this.state} wave=${this.level} asteroidCount=${this.asteroids.length} score=${Math.floor(this.score)} combo=${this.combo.toFixed(2)} comboTimer=${this.comboTimer.toFixed(2)} weaponLevel=${this.ship?.weaponLevel ?? 1} difficulty=${difficulty}`
      );
    }

    if (this.debugEnabled && this.debugPerfAccum >= DEBUG.perfLogIntervalSec && this.debugPerf.frameCount > 0) {
      const avgFrame = this.debugPerf.frameTimeTotal / this.debugPerf.frameCount;
      const avgUpdate = this.debugPerf.updateMs / this.debugPerf.frameCount;
      const avgDraw = this.debugPerf.drawMs / this.debugPerf.frameCount;
      const fps = this.debugPerf.frameCount / this.debugPerfAccum;
      this.logDebug(
        "perf",
        `fps=${fps.toFixed(1)} frame=${avgFrame.toFixed(2)}ms update=${avgUpdate.toFixed(2)}ms draw=${avgDraw.toFixed(2)}ms`
      );
      this.debugPerfAccum = 0;
      this.debugPerf.frameCount = 0;
      this.debugPerf.frameTimeTotal = 0;
      this.debugPerf.updateMs = 0;
      this.debugPerf.drawMs = 0;
    }

    this.background.update(dt);

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const ratio = this.shakeDur > 0 ? this.shakeTime / this.shakeDur : 0;
      const strength = this.shakeAmp * ratio;
      this.shakeX = (Math.random() * 2 - 1) * strength;
      this.shakeY = (Math.random() * 2 - 1) * strength;
      if (this.shakeTime <= 0) {
        this.shakeAmp = 0;
        this.shakeDur = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      if (this.hitStop > 0) return;
      this.hitStop = 0;
    }

    if (this.state === GAME_STATE.TITLE) {
      this.#stopEngineLoop();
      this.wasThrusting = false;
      this.#ensureMusicStarted();
      updateTitleState(this, (id) => this.#startWithDifficulty(id));
      return;
    }

    if (this.state === GAME_STATE.PLAY) {
      updatePlayState(() => this.#updateGameplay(dt));
      return;
    }

    // GAME_OVER_ANIM: on laisse tourner effets/anim 2s avant prompt restart.
    if (this.state === GAME_STATE.GAME_OVER_ANIM) {
      this.#stopEngineLoop();
      this.wasThrusting = false;
      updateGameOverAnimState(this, dt, (dtSec) => this.#updateEffectsOnly(dtSec));
      return;
    }

    if (this.state === GAME_STATE.GAME_OVER_READY) {
      this.#stopEngineLoop();
      this.wasThrusting = false;
      updateGameOverReadyState(this, () => this.#updateEffectsOnly(dt), () => this.#newGame());
    }
  }

  #updateEffectsOnly(dt) {
    updateEffectsOnly(this, dt);
  }

  pushCapped(list, items, max, pool = null) {
    this.#pushCapped(list, items, max, pool);
  }

  compactAlive(items, pool = null) {
    this.#compactAlive(items, pool);
  }

  spawnDebris(x, y, count, type, speedMin, speedMax) {
    this.#spawnDebris(x, y, count, type, speedMin, speedMax);
  }

  #drawPlayScene() {
    const ctx = this.ctx;
    this.background.draw(ctx);
    this.ship.render(ctx, this.combo);
    for (const a of this.asteroids) a.draw(ctx);
    for (const e of this.explosions) e.draw(ctx);
    for (const d of this.debris) d.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);

    const amb = this.clamp01((this.combo - COMBO_OVERLAY.ambienceStart) / COMBO_OVERLAY.ambienceRange);
    this.background.setAmbienceFactor(amb);

    const t = this.comboTimer;
    if (t <= COMBO_WARN_FX.thresholdSec) {
      const progress = 1 - (t / COMBO_WARN_FX.thresholdSec);
      const pulse = COMBO_WARN_FX.pulseBase + COMBO_WARN_FX.pulseAmplitude * Math.sin(performance.now() * COMBO_WARN_FX.pulseTimeScale * COMBO_WARN_FX.pulseFrequency);
      const alpha = COMBO_WARN_FX.alphaBase + COMBO_WARN_FX.alphaScale * progress * pulse;
      const thickness = COMBO_WARN_FX.thicknessBase + COMBO_WARN_FX.thicknessScale * progress;

      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, this.world.w, 0);
      grad.addColorStop(0, `rgba(255, 80, 220, ${alpha})`);
      grad.addColorStop(1, `rgba(0, 220, 255, ${alpha})`);
      ctx.fillStyle = grad;

      ctx.fillRect(0, 0, this.world.w, thickness);
      ctx.fillRect(0, this.world.h - thickness, this.world.w, thickness);
      ctx.fillRect(0, 0, thickness, this.world.h);
      ctx.fillRect(this.world.w - thickness, 0, thickness, this.world.h);
      ctx.restore();
    }
  }


  #drawColliderCircle(x, y, radius, strokeStyle, lineWidth = 1.5) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }

  #drawCollidersOverlay() {
    if (!this.debugColliders || this.state === GAME_STATE.TITLE) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    if (this.ship) {
      this.#drawColliderCircle(this.ship.x, this.ship.y, this.ship.radius, "rgba(80, 210, 255, 0.95)", 2);
    }

    for (const b of this.bullets) {
      this.#drawColliderCircle(b.x, b.y, b.radius, "rgba(255, 243, 120, 0.95)");
    }

    for (const a of this.asteroids) {
      this.#drawColliderCircle(a.x, a.y, a.radius, "rgba(255, 102, 102, 0.55)");

      const hitCircles = a.getWorldHitCircles(a._worldHitCircles ?? (a._worldHitCircles = []));
      for (let i = 0; i < hitCircles.length; i++) {
        const c = hitCircles[i];
        this.#drawColliderCircle(c.x, c.y, c.r, "rgba(255, 58, 58, 0.95)");
      }
    }

    ctx.restore();
  }
  #draw() {
    const ctx = this.ctx;
    const uiModel = this.#createUIModel();
    ctx.clearRect(0, 0, this.world.w, this.world.h);

    if (this.state === GAME_STATE.TITLE) {
      this.background.setAmbienceFactor(0);
      this.background.render(ctx);
      this.uiRenderer.drawTitleScreen(ctx, uiModel);
      return;
    }

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    this.#drawPlayScene();
    this.#drawCollidersOverlay();

    if (this.state === GAME_STATE.GAME_OVER_ANIM || this.state === GAME_STATE.GAME_OVER_READY) {
      this.uiRenderer.drawGameOverOverlay(ctx, uiModel);
    }
    ctx.restore();

    drawHUD(ctx, this);
    this.uiRenderer.drawProfilerOverlay(ctx, uiModel);
  }
}
