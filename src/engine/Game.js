import { Input } from "./Input.js";
import { drawText } from "./utils.js";
import { dist2, rand, dot } from "./math.js";
import { Ship } from "../entities/Ship.js";
import { Asteroid } from "../entities/Asteroid.js";
import { Particle } from "../entities/effects/Particle.js";
import { Explosion } from "../entities/effects/Explosion.js";
import { DebrisParticle } from "../entities/effects/DebrisParticle.js";
import { Background } from "./Background.js";
import { drawHUD } from "../ui/HUD.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.input = new Input(window);

    this.last = 0;
    this.running = false;

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

    const initialRect = this.canvas.getBoundingClientRect();
    const initialCssW = initialRect.width || this.canvas.clientWidth || window.innerWidth;
    const initialCssH = initialRect.height || this.canvas.clientHeight || window.innerHeight;
    this.background = new Background(initialCssW, initialCssH);
    this.fastTrailAcc = 0;
    this.waveQueued = false;

    // États principaux: TITLE -> PLAY -> GAME_OVER_ANIM -> GAME_OVER_READY.
    this.state = "TITLE";
    this.gameOverDelay = 0;

    this.difficultyPreset = null;
    this.difficultyPresets = {
      EASY: { waveBudgetMult: 0.85, asteroidSpeedMult: 0.9, scoreDrainCombo1PerSec: 800 },
      NORMAL: { waveBudgetMult: 1.0, asteroidSpeedMult: 1.0, scoreDrainCombo1PerSec: 1200 },
      HARD: { waveBudgetMult: 1.15, asteroidSpeedMult: 1.1, scoreDrainCombo1PerSec: 1600 },
    };

    this.hoveredButtonId = null;
    this.titleButtons = [];
    this.menuButton = { id: "MENU", label: "MENU", x: 0, y: 0, w: 180, h: 50 };

    this.debugEnabled = false;
    this.debugLogAccum = 0;

    this.hudFx = {
      weaponFlashT: 0,
      comboPulseT: 0,
      waveIntroT: 0,
    };

    // Listener souris unique: on ignore selon l'état courant.
    this.canvas.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    this.canvas.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
  }

  #resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width || this.canvas.clientWidth || window.innerWidth;
    const cssH = rect.height || this.canvas.clientHeight || window.innerHeight;
    const pixelW = Math.round(cssW * dpr);
    const pixelH = Math.round(cssH * dpr);

    const changed = this.canvas.width !== pixelW || this.canvas.height !== pixelH;
    if (changed) {
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { changed, cssW, cssH };
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
    return Math.max(1, 5.0 - (level - 1) * 0.5);
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

  #pointInRect(mx, my, rect) {
    return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
  }

  #mouseToCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const scaleX = this.canvas.width / this.world.w;
    const scaleY = this.canvas.height / this.world.h;
    return { mx: mx / scaleX, my: my / scaleY };
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
    this.hoveredButtonId = null;

    if (this.state === "TITLE") {
      for (const button of this.titleButtons) {
        if (this.#pointInRect(mx, my, button)) {
          this.hoveredButtonId = button.id;
          break;
        }
      }
    } else if (this.state === "GAME_OVER_READY") {
      if (this.#pointInRect(mx, my, this.menuButton)) this.hoveredButtonId = this.menuButton.id;
    }

    this.canvas.style.cursor = this.hoveredButtonId ? "pointer" : "default";
  }

  #onPointerDown(e) {
    const { mx, my } = this.#mouseToCanvas(e);

    if (this.state === "TITLE") {
      for (const button of this.titleButtons) {
        if (this.#pointInRect(mx, my, button)) {
          this.#startWithDifficulty(button.id);
          return;
        }
      }
    }

    if (this.state === "GAME_OVER_READY" && this.#pointInRect(mx, my, this.menuButton)) {
      this.state = "TITLE";
      this.hoveredButtonId = null;
    }
  }

  #startWithDifficulty(id) {
    this.difficultyPreset = id;
    this.#newGame();
    this.state = "PLAY";
    this.logDebug(`Start game difficulty=${id}`);
  }

  start() {
    const r = this.#resizeCanvasToDisplaySize();
    this.world.w = r.cssW;
    this.world.h = r.cssH;

    this.background.resize(this.world.w, this.world.h);
    this.#rebuildMenuButtons();

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);

    this.running = true;
    requestAnimationFrame((t) => this.#loop(t));
  }

  #newGame() {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.lives = 3;

    this.level = 1;
    this.particles = [];
    this.explosions = [];
    this.debris = [];

    this.bullets = [];
    this.asteroids = [];
    this.waveQueued = false;
    this.fastTrailAcc = 0;

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);
    this.comboTimer = this.getCurrentComboWindow();
    this.hudFx.waveIntroT = 1.10;

    this.#spawnLevel();
  }

  #resolveAsteroidCollisions() {
    const A = this.asteroids;

    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.dead) continue;

      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        if (b.dead) continue;

        const r = a.radius + b.radius;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;

        if (d2 > r * r || d2 === 0) continue;

        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;

        const overlap = r - d;
        const sep = overlap * 0.5;
        a.x -= nx * sep;
        a.y -= ny * sep;
        b.x += nx * sep;
        b.y += ny * sep;

        const rvx = a.vx - b.vx;
        const rvy = a.vy - b.vy;
        const velAlongNormal = dot(rvx, rvy, nx, ny);
        if (velAlongNormal <= 0) continue;

        const impulse = velAlongNormal;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }

  #spawnLevel() {
    this.buildWave(this.level);
  }

  #pushCapped(list, items, max) {
    if (Array.isArray(items)) list.push(...items);
    else list.push(items);
    if (list.length > max) list.splice(0, list.length - max);
  }

  #compactAlive(items) {
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      const item = items[read];
      if (!item.dead) {
        items[write] = item;
        write += 1;
      }
    }
    items.length = write;
  }

  #debrisColorFor(type) {
    const cfg = Asteroid.TYPE[type] ?? Asteroid.TYPE.normal;
    return cfg.tint;
  }

  #spawnDebris(x, y, count, type, speedMin, speedMax) {
    const color = this.#debrisColorFor(type);
    this.debris.push(...DebrisParticle.spray(x, y, count, color, speedMin, speedMax));
    if (this.debris.length > this.maxDebris) {
      this.debris.splice(0, this.debris.length - this.maxDebris);
    }
  }

  #nextLevel() {
    if (this.waveQueued) return;
    this.waveQueued = true;
    this.level += 1;
    this.hudFx.waveIntroT = 1.10;
    this.#spawnLevel();
    this.waveQueued = false;
  }

  getWaveBudget(wave) {
    const cycle = Math.floor((wave - 1) / 6);
    const step = (wave - 1) % 6;
    const baseBudget = 8 + wave * 2 + cycle * 4;
    const stepMult = [0.92, 1.00, 1.08, 1.16, 1.24, 1.45][step];
    const difficulty = this.difficultyPresets[this.difficultyPreset] ?? this.difficultyPresets.NORMAL;
    return Math.floor(baseBudget * stepMult * difficulty.waveBudgetMult);
  }

  getWaveWeights(wave) {
    const step = (wave - 1) % 6;
    const weightsByStep = [
      { normal: 0.60, dense: 0.30, fast: 0.10 },
      { normal: 0.50, dense: 0.35, fast: 0.15 },
      { dense: 0.55, normal: 0.35, fast: 0.10 },
      { fast: 0.45, normal: 0.35, dense: 0.20 },
      { dense: 0.40, fast: 0.35, normal: 0.25 },
      { fast: 0.45, dense: 0.35, normal: 0.20 },
    ];
    return weightsByStep[step];
  }

  buildWave(wave) {
    const cycle = Math.floor((wave - 1) / 6);
    const step = (wave - 1) % 6;
    const costs = { normal: 1, dense: 2, fast: 3, splitter: 4 };
    const maxFrag3 = 1 + cycle;
    const budget = this.getWaveBudget(wave);
    const weights = this.getWaveWeights(wave);
    this.logDebug(`Spawn wave=${wave} budget=${budget}`);

    const picks = [];
    let remainingBudget = budget;
    let normalCount = 0;
    let frag3Count = 0;

    if (step === 5 && wave >= 6 && remainingBudget >= costs.splitter && frag3Count < maxFrag3) {
      picks.push("splitter");
      remainingBudget -= costs.splitter;
      frag3Count += 1;
    }

    const weightedPick = (poolWeights) => {
      const entries = Object.entries(poolWeights);
      const total = entries.reduce((acc, [, w]) => acc + w, 0);
      let roll = Math.random() * total;
      for (const [type, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return type;
      }
      return entries[entries.length - 1][0];
    };

    while (remainingBudget >= 1) {
      let type = weightedPick(weights);

      if (wave >= 6 && frag3Count < maxFrag3 && remainingBudget >= costs.splitter && Math.random() < (0.08 + cycle * 0.03)) {
        type = "splitter";
      }

      const cost = costs[type] ?? 1;
      if (cost > remainingBudget) break;

      picks.push(type);
      remainingBudget -= cost;
      if (type === "normal") normalCount += 1;
      if (type === "splitter") frag3Count += 1;
    }

    if (normalCount === 0) {
      if (remainingBudget >= costs.normal) {
        picks.push("normal");
      } else if (picks.length > 0) {
        const idx = picks.findIndex((type) => type !== "splitter");
        if (idx >= 0) picks[idx] = "normal";
      }
    }

    const difficulty = this.difficultyPresets[this.difficultyPreset] ?? this.difficultyPresets.NORMAL;

    for (const type of picks) {
      let x;
      let y;
      do {
        x = rand(0, this.world.w);
        y = rand(0, this.world.h);
      } while (dist2(x, y, this.ship.x, this.ship.y) < 240 * 240);

      const sizeRoll = Math.random();
      let size = 3;
      if (wave >= 4 && sizeRoll < 0.28) size = 2;
      if (wave >= 9 && sizeRoll < 0.10) size = 1;

      const a = new Asteroid(x, y, size, type);
      const boost = 1 + Math.min(1.2, wave * 0.03 + cycle * 0.05);
      a.vx *= boost * difficulty.asteroidSpeedMult;
      a.vy *= boost * difficulty.asteroidSpeedMult;
      this.asteroids.push(a);
    }
  }

  #loop(t) {
    if (!this.running) return;

    const dt = Math.min(0.033, (t - this.last) / 1000 || 0);
    this.last = t;

    const r = this.#resizeCanvasToDisplaySize();
    if (r.changed) {
      this.world.w = r.cssW;
      this.world.h = r.cssH;
      this.background.resize(this.world.w, this.world.h);
      this.#rebuildMenuButtons();
    }

    this.#update(dt);
    this.#draw();

    this.input.endFrame();
    requestAnimationFrame((tt) => this.#loop(tt));
  }

  #updateGameplay(dt) {
    const dtSec = dt > 1 ? dt / 1000 : dt;

    this.hudFx.weaponFlashT = Math.max(0, this.hudFx.weaponFlashT - dt);
    this.hudFx.comboPulseT = Math.max(0, this.hudFx.comboPulseT - dt);
    this.hudFx.waveIntroT = Math.max(0, this.hudFx.waveIntroT - dt);

    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.applyComboBreak();
      this.comboTimer = this.getCurrentComboWindow();
    }

    this.ship.update(dt, this.input, this.world);

    if (this.input.wasPressed("Space") || this.input.isDown("Space")) {
      this.ship.tryShoot(this.bullets);
      if (this.bullets.length > this.maxBullets) {
        this.bullets.splice(0, this.bullets.length - this.maxBullets);
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

          this.fastTrailAcc += dt * rate;

          while (this.fastTrailAcc >= 1) {
            this.fastTrailAcc -= 1;

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
              new Particle(
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

    this.#resolveAsteroidCollisions();

    for (const p of this.particles) p.update(dt, this.world);
    for (const e of this.explosions) e.update(dt);
    for (const d of this.debris) d.update(dt, this.world);

    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const r = b.radius + a.radius;
        if (dist2(b.x, b.y, a.x, a.y) <= r * r) {
          b.dead = true;

          a.hitFlash = 1;
          const destroyed = a.hit();
          this.comboTimer = Math.min(this.comboTimer + 0.5, this.getCurrentComboWindow());

          if (destroyed) {
            const prevWeaponLevel = this.ship.weaponLevel;
            this.combo += a.comboValue;
            this.ship.updateWeaponLevel(this.combo);
            this.comboTimer = this.getCurrentComboWindow();
            this.hudFx.comboPulseT = 0.12;
            if (this.ship.weaponLevel > prevWeaponLevel) {
              this.hudFx.weaponFlashT = 0.20;
            }

            const cfg = Asteroid.TYPE[a.type] ?? Asteroid.TYPE.normal;
            this.score += Math.round(100 * a.size * cfg.scoreMul * this.combo);

            const kids = a.split();
            this.asteroids.push(...kids);

            this.#pushCapped(this.explosions, new Explosion(a.x, a.y, 0.28, a.radius * 1.1), this.maxExplosions);
            this.#spawnDebris(a.x, a.y, Math.round(rand(12, 25)), a.type, 70, 230);
            this.#pushCapped(this.particles, Particle.burst(a.x, a.y, 18 + a.size * 8, 60, 260, 0.25, 0.85, 1, 2.6), this.maxParticles);
          } else {
            this.#spawnDebris(b.x, b.y, Math.round(rand(4, 8)), a.type, 45, 170);
            this.#pushCapped(this.particles, Particle.burst(a.x, a.y, 6, 30, 140, 0.12, 0.25, 1, 2), this.maxParticles);
          }

          break;
        }
      }
    }

    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const r = this.ship.radius + a.radius;
        if (dist2(this.ship.x, this.ship.y, a.x, a.y) <= r * r) {
          this.lives -= 1;
          this.combo = 1;
          this.comboTimer = 0;
          this.ship.updateWeaponLevel(this.combo);

          this.#pushCapped(this.explosions, new Explosion(this.ship.x, this.ship.y, 0.45, 70), this.maxExplosions);
          this.#pushCapped(this.particles, Particle.burst(this.ship.x, this.ship.y, 70, 80, 380, 0.35, 1.05, 1, 3), this.maxParticles);

          if (this.lives <= 0) {
            this.logDebug(`Game over score=${Math.floor(this.score)} -> GAME_OVER_ANIM`);
            this.state = "GAME_OVER_ANIM";
            this.gameOverDelay = 2.0;
          } else {
            this.ship.respawn(this.world.w / 2, this.world.h / 2);
          }

          return;
        }
      }
    }

    this.#compactAlive(this.bullets);
    this.#compactAlive(this.asteroids);
    this.#compactAlive(this.particles);
    this.#compactAlive(this.explosions);
    this.#compactAlive(this.debris);

    if (this.asteroids.length <= 1 && !this.waveQueued) {
      this.#nextLevel();
    }

    if (this.combo === 1) {
      const difficulty = this.difficultyPresets[this.difficultyPreset] ?? this.difficultyPresets.NORMAL;
      this.score -= difficulty.scoreDrainCombo1PerSec * dtSec;
      this.score = Math.max(0, this.score);
    }
  }

  #update(dt) {
    if (this.input.wasPressed("KeyL")) {
      this.debugEnabled = !this.debugEnabled;
      console.log(`[DEBUG] ${this.debugEnabled ? "Enabled" : "Disabled"}`);
    }

    const dtSec = dt > 1 ? dt / 1000 : dt;
    this.debugLogAccum += dtSec;
    if (this.debugEnabled && this.debugLogAccum >= 1.0) {
      this.debugLogAccum = 0;
      const difficulty = this.difficultyPreset ?? "NORMAL";
      console.log(
        `[DEBUG] state=${this.state} wave=${this.level} asteroidCount=${this.asteroids.length} score=${Math.floor(this.score)} combo=${this.combo.toFixed(2)} comboTimer=${this.comboTimer.toFixed(2)} weaponLevel=${this.ship?.weaponLevel ?? 1} difficulty=${difficulty}`
      );
    }

    this.background.update(dt);

    if (this.state === "TITLE") {
      if (this.input.wasPressed("Digit1")) this.#startWithDifficulty("EASY");
      if (this.input.wasPressed("Digit2")) this.#startWithDifficulty("NORMAL");
      if (this.input.wasPressed("Digit3")) this.#startWithDifficulty("HARD");
      return;
    }

    if (this.state === "PLAY") {
      this.#updateGameplay(dt);
      return;
    }

    // GAME_OVER_ANIM: on laisse tourner effets/anim 2s avant prompt restart.
    if (this.state === "GAME_OVER_ANIM") {
      for (const p of this.particles) p.update(dt, this.world);
      for (const e of this.explosions) e.update(dt);
      for (const d of this.debris) d.update(dt, this.world);
      this.#compactAlive(this.particles);
      this.#compactAlive(this.explosions);
      this.#compactAlive(this.debris);
      this.gameOverDelay -= dt;
      if (this.gameOverDelay <= 0) {
        this.state = "GAME_OVER_READY";
        this.logDebug("State transition -> GAME_OVER_READY");
      }
      return;
    }

    if (this.state === "GAME_OVER_READY") {
      for (const p of this.particles) p.update(dt, this.world);
      for (const e of this.explosions) e.update(dt);
      for (const d of this.debris) d.update(dt, this.world);
      this.#compactAlive(this.particles);
      this.#compactAlive(this.explosions);
      this.#compactAlive(this.debris);

      if (this.input.wasPressed("KeyR") || this.input.wasPressed("Enter")) {
        this.#newGame();
        this.state = "PLAY";
      }
      if (this.input.wasPressed("KeyM")) {
        this.state = "TITLE";
      }
    }
  }

  #roundedRectPath(ctx, x, y, w, h, r = 10) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  #drawPanelGlow(x, y, w, h) {
    const ctx = this.ctx;
    const pad = 26;

    ctx.save();
    const panelGrad = ctx.createLinearGradient(x, y, x, y + h);
    panelGrad.addColorStop(0, "rgba(34,12,66,0.45)");
    panelGrad.addColorStop(0.5, "rgba(10,16,48,0.35)");
    panelGrad.addColorStop(1, "rgba(4,20,34,0.42)");
    this.#roundedRectPath(ctx, x, y, w, h, 20);
    ctx.fillStyle = panelGrad;
    ctx.fill();

    const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    borderGrad.addColorStop(0, "rgba(255,87,239,0.45)");
    borderGrad.addColorStop(1, "rgba(86,240,255,0.45)");
    this.#roundedRectPath(ctx, x, y, w, h, 20);
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    const glowGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, 20, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.85);
    glowGrad.addColorStop(0, "rgba(188,91,255,0.20)");
    glowGrad.addColorStop(1, "rgba(86,240,255,0)");
    ctx.fillStyle = glowGrad;
    this.#roundedRectPath(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 34);
    ctx.fill();
    ctx.restore();
  }

  #drawNeonTitle(text, x, y) {
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createLinearGradient(x, y - 72, x, y + 10);
    grad.addColorStop(0, "#ff8bff");
    grad.addColorStop(0.52, "#c867ff");
    grad.addColorStop(1, "#70efff");

    ctx.font = "900 86px 'Audiowide', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    ctx.shadowColor = "rgba(255,84,238,0.95)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(224,245,255,0.75)";
    ctx.strokeText(text, x, y);
    ctx.restore();
  }

  #drawNeonButton(rect, label, state) {
    const ctx = this.ctx;
    const { x, y, w, h } = rect;
    const radius = 9;
    const pulse = state.hovered ? 0.5 + 0.5 * Math.sin(performance.now() * 0.006) : 0;
    const glowBoost = state.hovered ? 1 : 0.35;
    const pressBoost = state.pressed ? 0.35 : 0;

    const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    borderGrad.addColorStop(0, "rgba(255,84,236,0.96)");
    borderGrad.addColorStop(1, "rgba(82,237,255,0.96)");

    ctx.save();
    this.#roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = "rgba(10,10,20,0.55)";
    ctx.fill();

    ctx.shadowColor = "rgba(244,103,255,0.95)";
    ctx.shadowBlur = 10 + glowBoost * 14 + pulse * 4 + pressBoost * 10;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = borderGrad;
    this.#roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();

    if (state.hovered || state.pressed) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(215,252,255,${0.55 + pulse * 0.3 + pressBoost})`;
      this.#roundedRectPath(ctx, x + 4, y + 4, w - 8, h - 8, radius - 3);
      ctx.stroke();
    }

    const textGrad = ctx.createLinearGradient(x, y, x, y + h);
    textGrad.addColorStop(0, "#fff7ff");
    textGrad.addColorStop(1, "#bff7ff");
    ctx.fillStyle = textGrad;
    ctx.font = "700 27px 'Audiowide', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(127,245,255,0.85)";
    ctx.shadowBlur = 4 + glowBoost * 4 + pressBoost * 8;
    ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 1);
    ctx.restore();
  }

  #drawTitleScreen() {
    const ctx = this.ctx;
    this.background.render(ctx);
    const panelW = 440;
    const panelH = 330;
    const panelX = this.world.w * 0.5 - panelW * 0.5;
    const panelY = this.world.h * 0.5 - panelH * 0.5 + 40;
    this.#drawPanelGlow(panelX, panelY, panelW, panelH);

    this.#drawNeonTitle("ASTEROID", this.world.w * 0.5, this.world.h * 0.22);
    ctx.save();
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillStyle = "rgba(212,236,255,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Choisissez une difficulté", this.world.w * 0.5, this.world.h * 0.34);
    ctx.restore();

    for (const button of this.titleButtons) {
      this.#drawNeonButton(button, button.label, {
        hovered: this.hoveredButtonId === button.id,
        pressed: false,
      });
    }

    ctx.save();
    ctx.font = "600 16px 'Audiowide', system-ui, sans-serif";
    ctx.fillStyle = "rgba(178,242,255,0.95)";
    ctx.shadowColor = "rgba(112,233,255,0.55)";
    ctx.shadowBlur = 4;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("[1] EASY   [2] NORMAL   [3] HARD", this.world.w * 0.5, this.world.h * 0.79);
    ctx.restore();
  }

  #drawPlayScene() {
    const ctx = this.ctx;
    this.background.render(ctx);
    this.ship.render(ctx, this.combo);
    for (const a of this.asteroids) a.draw(ctx);
    for (const e of this.explosions) e.draw(ctx);
    for (const d of this.debris) d.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);

    drawHUD(ctx, this);
  }

  #drawGameOverOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, this.world.w, this.world.h);
    ctx.restore();

    drawText(ctx, "GAME OVER", this.world.w * 0.5 - 120, this.world.h * 0.38, 52);
    drawText(ctx, `Score: ${Math.floor(this.score)}`, this.world.w * 0.5 - 80, this.world.h * 0.50, 24);
    drawText(ctx, "[R] Rejouer", this.world.w * 0.5 - 65, this.world.h * 0.58, 20);
    drawText(ctx, "[M] Menu", this.world.w * 0.5 - 52, this.world.h * 0.64, 20);
  }

  #draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.world.w, this.world.h);

    if (this.state === "TITLE") {
      this.#drawTitleScreen();
      return;
    }

    this.#drawPlayScene();

    if (this.state === "GAME_OVER_ANIM" || this.state === "GAME_OVER_READY") {
      this.#drawGameOverOverlay();
    }
  }
}
