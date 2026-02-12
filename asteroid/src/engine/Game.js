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
    this.lives = 3;
    this.gameOver = false;

    this.level = 1;
    this.particles = [];
    this.explosions = [];

    this.starfield = new Starfield();
    this.fastTrailAcc = 0;

  }

  start() {
    const r = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    this.world.w = r.cssW;
    this.world.h = r.cssH;

    this.starfield.resize(this.world.w, this.world.h);

    this.#newGame();
    this.running = true;
    requestAnimationFrame((t) => this.#loop(t));
  }

  #newGame() {
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;

    this.level = 1;
    this.particles = [];
    this.explosions = [];

    this.bullets = [];
    this.asteroids = [];

    this.ship = new Ship(this.world.w / 2, this.world.h / 2);
    this.ship.respawn(this.world.w / 2, this.world.h / 2);

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

        // pas en contact
        if (d2 > r * r || d2 === 0) continue;

        const d = Math.sqrt(d2);

        // normale (a -> b)
        const nx = dx / d;
        const ny = dy / d;

        // 1) Séparer pour éviter qu’ils se “collent”
        const overlap = r - d;
        const sep = overlap * 0.5;
        a.x -= nx * sep;
        a.y -= ny * sep;
        b.x += nx * sep;
        b.y += ny * sep;

        // 2) Rebonds élastiques (masses égales)
        // vitesse relative
        const rvx = a.vx - b.vx;
        const rvy = a.vy - b.vy;

        // composante sur la normale
        const velAlongNormal = dot(rvx, rvy, nx, ny);

        // si déjà en train de s’éloigner, on ne fait rien
        if (velAlongNormal <= 0) continue;

        // impulse (masses égales => échange de composante normale)
        const impulse = velAlongNormal;

        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }

  #spawnLevel() {
    // progression :
    // - + astéroïdes par niveau
    // - vitesse augmente légèrement
    // - tailles mixées (plus de gros au début, plus de petits ensuite)
    const count = 4 + this.level; // 5 au lvl1, 6 au lvl2, etc.

    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, this.world.w);
        y = rand(0, this.world.h);
      } while (dist2(x, y, this.ship.x, this.ship.y) < 240 * 240);

      // distribution de taille selon niveau
      // lvl 1-2 : surtout gros, lvl 3+ : mix
      const roll = Math.random();
      let size = 3;
      if (this.level >= 3 && roll < 0.25) size = 2;
      if (this.level >= 5 && roll < 0.12) size = 1;

      let type = "normal";

      if (this.level >= 4 && Math.random() < 0.16) {
        type = "splitter";
      } else if (this.level >= 3 && Math.random() < 0.14) {
        type = "fast";
      } else if (this.level >= 2 && Math.random() < 0.18) {
        type = "dense";
      }


      const a = new Asteroid(x, y, size, type);


      // difficulté : boost léger de la vitesse
      const boost = 1 + Math.min(0.6, (this.level - 1) * 0.08);
      a.vx *= boost;
      a.vy *= boost;

      this.asteroids.push(a);
    }
  }

  #nextLevel() {
    this.level += 1;
    this.#spawnLevel();
  }

  #loop(t) {
    if (!this.running) return;

    const dt = Math.min(0.033, (t - this.last) / 1000 || 0);
    this.last = t;

    // resize + world
    const r = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    if (r.changed) {
      this.world.w = r.cssW;
      this.world.h = r.cssH;
      this.starfield.resize(this.world.w, this.world.h);
    }


    this.#update(dt);
    this.#draw();

    this.input.endFrame();
    requestAnimationFrame((tt) => this.#loop(tt));
  }

  #update(dt) {
    if (this.gameOver) {
      if (this.input.wasPressed("Enter")) this.#newGame();
      return;
    }

    // actions
    this.ship.update(dt, this.input, this.world);
    this.starfield.update(dt, this.ship.vx, this.ship.vy);

    if (this.input.wasPressed("Space")) {
      this.ship.tryShoot(this.bullets);
    }

    // update entities
    for (const b of this.bullets) b.update(dt, this.world);

    for (const a of this.asteroids) {
      a.update(dt, this.world);

      // Traînée poussière pour les Fast (directionnelle, proportionnelle, FPS-indépendante)
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

    // collisions asteroid <-> asteroid
    this.#resolveAsteroidCollisions();

    // effets
    for (const p of this.particles) p.update(dt, this.world);
    for (const e of this.explosions) e.update(dt);



    // collisions bullet <-> asteroid
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const r = b.radius + a.radius;
        if (dist2(b.x, b.y, a.x, a.y) <= r * r) {
          b.dead = true;

          const destroyed = a.hit();

          if (destroyed) {
            this.score += 100 * a.size;

            const kids = a.split();
            this.asteroids.push(...kids);

            this.explosions.push(new Explosion(a.x, a.y, 0.28, a.radius * 1.1));
            this.particles.push(
              ...Particle.burst(a.x, a.y, 18 + a.size * 8, 60, 260, 0.25, 0.85, 1, 2.6)
            );
          } else {
            // petit feedback quand ça tape un dense non détruit
            this.particles.push(
              ...Particle.burst(a.x, a.y, 6, 30, 140, 0.12, 0.25, 1, 2)
            );
          }

          break;
        }
      }
    }

    // collision ship <-> asteroid (si pas invincible)
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (a.dead) continue;
        const r = this.ship.radius + a.radius;
        if (dist2(this.ship.x, this.ship.y, a.x, a.y) <= r * r) {
          this.lives -= 1;

          this.explosions.push(new Explosion(this.ship.x, this.ship.y, 0.45, 70));
          this.particles.push(
            ...Particle.burst(this.ship.x, this.ship.y, 70, 80, 380, 0.35, 1.05, 1, 3)
          );

          if (this.lives <= 0) {
            this.gameOver = true;
          } else {
            this.ship.respawn(this.world.w / 2, this.world.h / 2);
          }

          return;

        }
      }
    }

    // cleanup
    this.bullets = this.bullets.filter(b => !b.dead);
    this.asteroids = this.asteroids.filter(a => !a.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.explosions = this.explosions.filter(e => !e.dead);


    // nouvelle vague
    if (this.asteroids.length === 0) {
      this.#nextLevel();
    }
  }

  #draw() {
    const ctx = this.ctx;
    this.starfield.draw(ctx);
    this.ship.draw(ctx);
    for (const a of this.asteroids) a.draw(ctx);
    for (const e of this.explosions) e.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);

    drawText(ctx, `Score: ${this.score}`, 16, 12, 18);
    drawText(ctx, `Vies: ${this.lives}`, 16, 34, 18);
    drawText(ctx, `Niveau: ${this.level}`, 16, 56, 18);


    if (this.gameOver) {
      drawText(ctx, `GAME OVER`, this.world.w * 0.5 - 70, this.world.h * 0.45, 28);
      drawText(ctx, `Entrée pour rejouer`, this.world.w * 0.5 - 110, this.world.h * 0.52, 18);
    }
  }
}
