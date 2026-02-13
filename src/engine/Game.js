import { Input } from "./Input.js";
import { resizeCanvasToDisplaySize, drawText } from "./utils.js";
import { dist2, rand, dot } from "./math.js";
import { Ship } from "../entities/Ship.js";
import { Asteroid } from "../entities/Asteroid.js";
import { Particle } from "../entities/effects/Particle.js";
import { Explosion } from "../entities/effects/Explosion.js";
import { Starfield } from "./Starfield.js";

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

    this.COMBO_WINDOW = 5.0;

    this.level = 1;
    this.particles = [];
    this.explosions = [];

    this.starfield = new Starfield();
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
    return Math.max(1, 5.0 - (level - 1) * 0.5);
  }

  getCurrentComboWindow() {
    return this.getComboWindowForWeaponLevel(this.ship?.weaponLevel ?? 1);
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
    const r = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    this.world.w = r.cssW;
    this.world.h = r.cssH;

    this.starfield.resize(this.world.w, this.world.h);
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

    this.bullets = [];
    this.asteroids = [];
    this.waveQueued = false;
    this.fastTrailAcc = 0;

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);
    this.ship.updateWeaponLevel(this.combo);
    this.comboTimer = this.getCurrentComboWindow();

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

  #nextLevel() {
    if (this.waveQueued) return;
    this.waveQueued = true;
    this.level += 1;
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

    const r = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    if (r.changed) {
      this.world.w = r.cssW;
      this.world.h = r.cssH;
      this.starfield.resize(this.world.w, this.world.h);
      this.#rebuildMenuButtons();
    }

    this.#update(dt);
    this.#draw();

    this.input.endFrame();
    requestAnimationFrame((tt) => this.#loop(tt));
  }

  #updateGameplay(dt) {
    const dtSec = dt > 1 ? dt / 1000 : dt;

    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.applyComboBreak();
      this.comboTimer = this.getCurrentComboWindow();
    }

    this.ship.update(dt, this.input, this.world);
    this.starfield.update(dt, this.ship.vx, this.ship.vy);

    if (this.input.wasPressed("Space")) {
      this.ship.tryShoot(this.bullets);
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

    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const r = b.radius + a.radius;
        if (dist2(b.x, b.y, a.x, a.y) <= r * r) {
          b.dead = true;

          const destroyed = a.hit();
          this.comboTimer = Math.min(this.comboTimer + 0.5, this.getCurrentComboWindow());

          if (destroyed) {
            this.combo += a.comboValue;
            this.ship.updateWeaponLevel(this.combo);
            this.comboTimer = this.getCurrentComboWindow();

            const cfg = Asteroid.TYPE[a.type] ?? Asteroid.TYPE.normal;
            this.score += Math.round(100 * a.size * cfg.scoreMul * this.combo);

            const kids = a.split();
            this.asteroids.push(...kids);

            this.explosions.push(new Explosion(a.x, a.y, 0.28, a.radius * 1.1));
            this.particles.push(
              ...Particle.burst(a.x, a.y, 18 + a.size * 8, 60, 260, 0.25, 0.85, 1, 2.6)
            );
          } else {
            this.particles.push(
              ...Particle.burst(a.x, a.y, 6, 30, 140, 0.12, 0.25, 1, 2)
            );
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

          this.explosions.push(new Explosion(this.ship.x, this.ship.y, 0.45, 70));
          this.particles.push(
            ...Particle.burst(this.ship.x, this.ship.y, 70, 80, 380, 0.35, 1.05, 1, 3)
          );

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

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.asteroids = this.asteroids.filter((a) => !a.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.explosions = this.explosions.filter((e) => !e.dead);

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
      this.starfield.update(dt, this.ship.vx, this.ship.vy);
      for (const p of this.particles) p.update(dt, this.world);
      for (const e of this.explosions) e.update(dt);
      this.particles = this.particles.filter((p) => !p.dead);
      this.explosions = this.explosions.filter((e) => !e.dead);
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
      this.particles = this.particles.filter((p) => !p.dead);
      this.explosions = this.explosions.filter((e) => !e.dead);

      if (this.input.wasPressed("KeyR") || this.input.wasPressed("Enter")) {
        this.#newGame();
        this.state = "PLAY";
      }
      if (this.input.wasPressed("KeyM")) {
        this.state = "TITLE";
      }
    }
  }

  #drawButton(button) {
    const ctx = this.ctx;
    const hovered = this.hoveredButtonId === button.id;
    ctx.save();
    ctx.fillStyle = hovered ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.fillRect(button.x, button.y, button.w, button.h);
    ctx.strokeRect(button.x, button.y, button.w, button.h);
    ctx.fillStyle = "white";
    ctx.font = "24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, button.x + button.w * 0.5, button.y + button.h * 0.5);
    ctx.restore();
  }

  #drawTitleScreen() {
    const ctx = this.ctx;
    this.starfield.draw(ctx);
    drawText(ctx, "ASTEROID", this.world.w * 0.5 - 110, this.world.h * 0.22, 54);
    drawText(ctx, "Choisissez une difficulté", this.world.w * 0.5 - 130, this.world.h * 0.34, 24);

    for (const button of this.titleButtons) this.#drawButton(button);

    drawText(ctx, "[1] EASY  [2] NORMAL  [3] HARD", this.world.w * 0.5 - 155, this.world.h * 0.78, 18);
  }

  #drawPlayScene() {
    const ctx = this.ctx;
    this.starfield.draw(ctx);
    this.ship.draw(ctx);
    for (const a of this.asteroids) a.draw(ctx);
    for (const e of this.explosions) e.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);

    const difficultyLabel = this.difficultyPreset ?? "NORMAL";
    drawText(ctx, `Score: ${Math.floor(this.score)}`, 16, 12, 18);
    drawText(ctx, `Vies: ${this.lives}`, 16, 34, 18);
    drawText(ctx, `Niveau: ${this.level}`, 16, 56, 18);
    drawText(ctx, `COMBO x${this.combo.toFixed(2)}`, 16, 78, 18);
    const timerText = this.comboTimer < 1 && this.comboTimer > 0
      ? `TIMER: ${this.comboTimer.toFixed(1)}s !`
      : `TIMER: ${this.comboTimer.toFixed(1)}s`;
    drawText(ctx, timerText, 16, 100, 18);
    const weaponNames = {
      1: "Blaster",
      2: "Sniper",
      3: "Double Blaster",
      4: "Shotgun",
    };
    const weaponName = weaponNames[this.ship.weaponLevel] ?? `Weapon ${this.ship.weaponLevel}`;
    drawText(ctx, `WEAPON: ${weaponName}`, 16, 122, 18);
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
