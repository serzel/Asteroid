import { Input } from "./Input.js";
import { resizeCanvasToDisplaySize } from "./utils.js";
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

const PLAYER_HIT_SHAKE = { amp: 10, dur: 0.18 };
const WEAPON4_SHOT_SHAKE = { amp: 1.5, dur: 0.05 };

const GAME_STATE = {
  TITLE: "TITLE",
  PLAY: "PLAY",
  GAME_OVER_ANIM: "GAME_OVER_ANIM",
  GAME_OVER_READY: "GAME_OVER_READY",
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.input = new Input(window);
    this.uiRenderer = new UIRenderer();

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
    this.menuButton = { id: "MENU", label: "MENU", x: 0, y: 0, w: 180, h: 50 };
    this.titleButtonDrawState = { hovered: false, pressed: false };

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

    // Listener souris unique: on ignore selon l'état courant.
    this.canvas.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    this.canvas.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
  }

  applyComboBreak() {
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
    this.logDebug(`Combo break combo ${oldCombo.toFixed(2)} -> ${this.combo.toFixed(2)} level ${oldLevel} -> ${this.ship.weaponLevel}`);
  }



  getComboWindowForWeaponLevel(level) {
    return Math.max(COMBO_WINDOW.min, COMBO_WINDOW.base - (level - 1) * COMBO_WINDOW.perWeaponLevel);
  }

  getCurrentComboWindow() {
    return this.getComboWindowForWeaponLevel(this.ship?.weaponLevel ?? 1);
  }

  getComboWindow() {
    return this.getCurrentComboWindow();
  }

  logDebug(message) {
    if (!this.debugEnabled) return;
    console.log(`[DEBUG] ${message}`);
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

  #mouseToCanvas(e) {
    const mx = (e.clientX - this.pointerTransform.left) * this.pointerTransform.scaleX;
    const my = (e.clientY - this.pointerTransform.top) * this.pointerTransform.scaleY;
    return { mx, my };
  }

  #refreshPointerTransform() {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTransform.left = rect.left;
    this.pointerTransform.top = rect.top;
    this.pointerTransform.scaleX = rect.width > 0 ? this.world.w / rect.width : 1;
    this.pointerTransform.scaleY = rect.height > 0 ? this.world.h / rect.height : 1;
  }

  #rebuildMenuButtons() {
    const w = 220;
    const h = 56;
    const gap = 16;
    const x = this.world.w * 0.5 - w * 0.5;
    const startY = this.world.h * 0.5 - (h * 3 + gap * 2) * 0.5 + 30;

    this.titleButtons = [
      { id: "EASY", label: "EASY", x, y: startY, w, h },
      { id: "NORMAL", label: "NORMAL", x, y: startY + (h + gap), w, h },
      { id: "HARD", label: "HARD", x, y: startY + 2 * (h + gap), w, h },
    ];

    this.menuButton.x = this.world.w * 0.5 - this.menuButton.w * 0.5;
    this.menuButton.y = this.world.h * 0.6;
  }

  #onPointerMove(e) {
    const { mx, my } = this.#mouseToCanvas(e);
    this.hoveredButtonId = this.uiRenderer.handlePointerMove(this, mx, my);
    this.canvas.style.cursor = this.hoveredButtonId ? "pointer" : "default";
  }

  #onPointerDown(e) {
    const { mx, my } = this.#mouseToCanvas(e);
    const action = this.uiRenderer.handlePointerDown(this, mx, my);
    this.#applyUIAction(action);
  }

  #applyUIAction(action) {
    if (!action) return;

    if (action.type === "START_GAME") {
      this.#startWithDifficulty(action.difficulty);
      return;
    }

    if (action.type === "OPEN_MENU") {
      this.state = GAME_STATE.TITLE;
      this.hoveredButtonId = null;
    }
  }

  #startWithDifficulty(id) {
    this.difficultyPreset = id;
    this.#newGame();
    this.state = GAME_STATE.PLAY;
    this.logDebug(`Start game difficulty=${id}`);
  }

  start() {
    this.#applyResizeIfNeeded(true);

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);

    window.addEventListener("resize", this.resizeFallbackHandler);
    window.addEventListener("orientationchange", this.orientationChangeHandler);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeDirty = true;
      });
      this.resizeObserver.observe(document.documentElement);
    }

    this.running = true;
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
    this.input.destroy();
    this.canvas.style.cursor = "default";
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

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);
    this.comboTimer = this.getCurrentComboWindow();
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
    this.#refreshPointerTransform();
  }

  #updateGameplay(dt) {
    this.fxSpawnedThisFrame = 0;
    this.fxSpawnedParticlesThisFrame = 0;
    this.fxSpawnedDebrisThisFrame = 0;

    this.hudFx.weaponFlashT = Math.max(0, this.hudFx.weaponFlashT - dt);
    this.hudFx.comboPulseT = Math.max(0, this.hudFx.comboPulseT - dt);
    this.hudFx.waveIntroT = Math.max(0, this.hudFx.waveIntroT - dt);

    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.applyComboBreak();
      this.comboTimer = this.getCurrentComboWindow();
    }

    this.ship.update(dt, this.input, this.world);

    if (this.input.wasPressed("shoot") || this.input.isDown("shoot")) {
      const bulletsBeforeShot = this.bullets.length;
      this.ship.tryShoot(this.bullets, (...args) => this.bulletPool.acquire(...args));
      if (this.ship.weaponLevel >= 4 && this.bullets.length > bulletsBeforeShot) {
        this.addShake(WEAPON4_SHOT_SHAKE.amp, WEAPON4_SHOT_SHAKE.dur);
      }
      if (this.bullets.length > this.maxBullets) {
        const removed = this.bullets.splice(0, this.bullets.length - this.maxBullets);
        this.bulletPool.releaseMany(removed);
      }
    }

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

    rebuildAsteroidSpatialHash(this);
    resolveAsteroidCollisions(this);
    rebuildAsteroidSpatialHash(this);

    for (const p of this.particles) p.update(dt, this.world);
    for (const e of this.explosions) e.update(dt);
    for (const d of this.debris) d.update(dt, this.world);

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
            this.logDebug(`Game over score=${Math.floor(this.score)} -> GAME_OVER_ANIM`);
            this.state = GAME_STATE.GAME_OVER_ANIM;
            this.gameOverDelay = 2.0;
          } else {
            this.ship.respawn(this.world.w / 2, this.world.h / 2);
          }

          return;
        }
      }
    }

    this.#compactAlive(this.bullets, this.bulletPool);
    this.#compactAlive(this.asteroids);
    this.#compactAlive(this.particles, this.particlePool);
    this.#compactAlive(this.explosions);
    this.#compactAlive(this.debris, this.debrisPool);

    if (this.asteroids.length <= 1 && !this.waveQueued) {
      this.#nextLevel();
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
      console.log(`[DEBUG] ${this.debugEnabled ? "Enabled" : "Disabled"}`);
    }

    if (this.input.wasPressed("debugToggle")) {
      this.debugColliders = !this.debugColliders;
      console.log(`[DEBUG] Colliders ${this.debugColliders ? "ON" : "OFF"}`);
    }

    if (this.input.wasPressed("debugProfiler")) {
      this.debugProfiler = !this.debugProfiler;
    }

    if (this.input.wasPressed("debugProfilerFreeze")) {
      this.profView.freezeT = 2;
      this.profView.accTime = 0;
    }

    if (this.input.wasPressed("debugSeams")) {
      this.debugSeams = !this.debugSeams;
      this.background.debugSeams = this.debugSeams;
      console.log(`[DEBUG] Seams ${this.debugSeams ? "ON" : "OFF"}`);
    }

    if (this.input.wasPressed("debugSeamsNearest")) {
      this.background.debugForceNearestSmoothing = !this.background.debugForceNearestSmoothing;
      console.log(`[DEBUG] Seam smoothing mode: ${this.background.debugForceNearestSmoothing ? "nearest (OFF)" : "linear (ON)"}`);
    }

    this.debugLogAccum += dt;
    this.debugPerfAccum += dt;
    if (this.debugEnabled && this.debugLogAccum >= 1.0) {
      this.debugLogAccum = 0;
      const difficulty = this.difficultyPreset ?? "NORMAL";
      console.log(
        `[DEBUG] state=${this.state} wave=${this.level} asteroidCount=${this.asteroids.length} score=${Math.floor(this.score)} combo=${this.combo.toFixed(2)} comboTimer=${this.comboTimer.toFixed(2)} weaponLevel=${this.ship?.weaponLevel ?? 1} difficulty=${difficulty}`
      );
    }

    if (this.debugEnabled && this.debugPerfAccum >= 1.0 && this.debugPerf.frameCount > 0) {
      const avgFrame = this.debugPerf.frameTimeTotal / this.debugPerf.frameCount;
      const avgUpdate = this.debugPerf.updateMs / this.debugPerf.frameCount;
      const avgDraw = this.debugPerf.drawMs / this.debugPerf.frameCount;
      const fps = this.debugPerf.frameCount / this.debugPerfAccum;
      console.log(
        `[PERF] fps=${fps.toFixed(1)} frame=${avgFrame.toFixed(2)}ms update=${avgUpdate.toFixed(2)}ms draw=${avgDraw.toFixed(2)}ms`
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
      updateTitleState(this, (id) => this.#startWithDifficulty(id));
      return;
    }

    if (this.state === GAME_STATE.PLAY) {
      updatePlayState(() => this.#updateGameplay(dt));
      return;
    }

    // GAME_OVER_ANIM: on laisse tourner effets/anim 2s avant prompt restart.
    if (this.state === GAME_STATE.GAME_OVER_ANIM) {
      updateGameOverAnimState(this, dt, (dtSec) => this.#updateEffectsOnly(dtSec));
      return;
    }

    if (this.state === GAME_STATE.GAME_OVER_READY) {
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

    const WARN = 3.0;
    const t = this.comboTimer;
    if (t <= WARN) {
      const progress = 1 - (t / WARN);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01 * 4.0);
      const alpha = 0.08 + 0.18 * progress * pulse;
      const thickness = 8 + 6 * progress;

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
    ctx.clearRect(0, 0, this.world.w, this.world.h);

    if (this.state === GAME_STATE.TITLE) {
      this.uiRenderer.drawTitleScreen(this);
      return;
    }

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    this.#drawPlayScene();
    this.#drawCollidersOverlay();

    if (this.state === GAME_STATE.GAME_OVER_ANIM || this.state === GAME_STATE.GAME_OVER_READY) {
      this.uiRenderer.drawGameOverOverlay(this);
    }
    ctx.restore();

    drawHUD(ctx, this);
    this.uiRenderer.drawProfilerOverlay(this);
  }
}
