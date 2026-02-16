import { dist2, rand, dot } from "../math.js";
import { Asteroid } from "../../entities/Asteroid.js";
import { Particle } from "../../entities/effects/Particle.js";
import { Explosion } from "../../entities/effects/Explosion.js";
import { MAX_PARTICLES } from "./Effects.js";

const SHAKE_BY_ASTEROID_SIZE = {
  3: { amp: 6, dur: 0.12 },
  2: { amp: 4, dur: 0.1 },
  1: { amp: 2, dur: 0.08 },
};

const HIT_STOP_BIG = 0.05;
const HIT_STOP_DENSE = 0.04;
const HIT_STOP_WEAPON_UP = 0.03;

export function rebuildAsteroidSpatialHash(game) {
  game.asteroidSpatialHash.clear();
  game.asteroidIndexMap.clear();

  for (let i = 0; i < game.asteroids.length; i++) {
    const asteroid = game.asteroids[i];
    if (asteroid.dead) continue;
    game.asteroidIndexMap.set(asteroid, i);
    game.asteroidSpatialHash.insert(asteroid, asteroid.x, asteroid.y, asteroid.radius);
  }
}

export function resolveAsteroidCollisions(game) {
  const A = game.asteroids;
  const tmp = game._queryTmp ?? (game._queryTmp = []);
  let collisionCount = 0;

  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (a.dead) continue;

    tmp.length = 0;
    game.asteroidSpatialHash.query(a.x, a.y, a.radius, tmp);
    for (const b of tmp) {
      const j = game.asteroidIndexMap.get(b);
      if (j == null || j <= i) continue;
      if (b.dead) continue;

      const r = a.radius + b.radius;
      const r2 = r * r;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;

      if (d2 > r2 || d2 === 0) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;

      const penetration = r - d;
      const correctionPercent = 0.8;
      const slop = 0.5;
      const correction = Math.max(penetration - slop, 0) * correctionPercent;
      const sep = correction * 0.5;
      a.x -= nx * sep;
      a.y -= ny * sep;
      b.x += nx * sep;
      b.y += ny * sep;

      const rvx = a.vx - b.vx;
      const rvy = a.vy - b.vy;
      const velAlongNormal = dot(rvx, rvy, nx, ny);
      if (velAlongNormal > 0) continue;

      const impulse = -velAlongNormal;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
      collisionCount += 1;
    }
  }

  let maxSpeed = 0;
  let totalKineticEnergy = 0;
  for (let i = 0; i < A.length; i++) {
    const asteroid = A[i];
    if (asteroid.dead) continue;
    const speed2 = asteroid.vx * asteroid.vx + asteroid.vy * asteroid.vy;
    const speed = Math.sqrt(speed2);
    if (speed > maxSpeed) maxSpeed = speed;

    const m = asteroid.radius * asteroid.radius;
    totalKineticEnergy += 0.5 * m * speed2;
  }

  if (!game.debugStats) {
    game.debugStats = {
      asteroidCollisionCount: 0,
      asteroidMaxSpeed: 0,
      asteroidTotalKineticEnergy: 0,
    };
  }

  game.debugStats.asteroidCollisionCount = collisionCount;
  game.debugStats.asteroidMaxSpeed = maxSpeed;
  game.debugStats.asteroidTotalKineticEnergy = totalKineticEnergy;
}

export function resolveBulletAsteroidCollisions(game) {
  const tmp = game._queryTmp ?? (game._queryTmp = []);

  for (const b of game.bullets) {
    if (b.dead) continue;

    tmp.length = 0;
    game.asteroidSpatialHash.query(b.x, b.y, b.radius, tmp);
    let target = null;
    let minD2 = Infinity;

    for (const a of tmp) {
      if (a.dead) continue;
      const r = b.radius + a.radius;
      const r2 = r * r;
      const d2 = dist2(b.x, b.y, a.x, a.y);
      if (d2 > r2 || d2 >= minD2) continue;
      minD2 = d2;
      target = a;
    }

    if (target) {
      const a = target;
      b.dead = true;

      a.hitFlash = 1;
      const destroyed = a.hit();
      game.comboTimer = Math.min(game.comboTimer + 0.5, game.getCurrentComboWindow());

      if (destroyed) {
        const prevWeaponLevel = game.ship.weaponLevel;
        game.combo += a.comboValue;
        game.ship.updateWeaponLevel(game.combo);
        game.comboTimer = game.getCurrentComboWindow();
        game.hudFx.comboPulseT = 0.12;
        if (game.ship.weaponLevel > prevWeaponLevel) {
          game.hudFx.weaponFlashT = 0.20;
          game.addHitStop(HIT_STOP_WEAPON_UP);
        }

        const cfg = Asteroid.TYPE[a.type] ?? Asteroid.TYPE.normal;
        game.score += Math.round(100 * a.size * cfg.scoreMul * game.combo);

        const kids = a.split();
        for (let i = 0; i < kids.length; i++) {
          game.asteroids.push(kids[i]);
        }

        const shakeCfg = SHAKE_BY_ASTEROID_SIZE[a.size] ?? SHAKE_BY_ASTEROID_SIZE[1];
        game.addShake(shakeCfg.amp, shakeCfg.dur);
        if (a.size === 3) game.addHitStop(HIT_STOP_BIG);
        if (a.type === "dense") game.addHitStop(HIT_STOP_DENSE);

        const explosionProfile = {
          life: 0.3,
          ringCount: 2,
          maxRadius: a.radius * 3,
          flashAlpha: 0.8,
          colorMode: a.type === "dense" ? "dense" : a.type === "fast" ? "fast" : "normal",
        };
        if (a.size === 3 && a.type === "dense") {
          explosionProfile.life = 0.35;
          explosionProfile.ringCount = 3;
          explosionProfile.maxRadius = 120;
          explosionProfile.flashAlpha = 0.9;
        } else if (a.size === 3) {
          explosionProfile.life = 0.3;
          explosionProfile.ringCount = 2;
          explosionProfile.maxRadius = 110;
          explosionProfile.flashAlpha = 0.8;
        } else if (a.size === 2) {
          explosionProfile.life = 0.22;
          explosionProfile.ringCount = 2;
          explosionProfile.maxRadius = 75;
          explosionProfile.flashAlpha = 0.72;
        } else {
          explosionProfile.life = 0.14;
          explosionProfile.ringCount = 1;
          explosionProfile.maxRadius = 45;
          explosionProfile.flashAlpha = 0.65;
        }

        game.pushCapped(game.explosions, new Explosion(a.x, a.y, explosionProfile), game.maxExplosions);

        const debrisCountBase = a.size === 3 ? rand(20, 34) : a.size === 2 ? rand(12, 20) : rand(7, 12);
        const debrisCount = Math.round(debrisCountBase * (a.type === "dense" ? 1.4 : a.type === "fast" ? 1.15 : 1));
        game.spawnDebris(a.x, a.y, debrisCount, a.type, 70, 230);
        game.pushCapped(
          game.particles,
          Particle.burst(a.x, a.y, 18 + a.size * 8, 60, 260, 0.25, 0.85, 1, 2.6, function () { return game.particlePool.acquire.apply(game.particlePool, arguments); }),
          Math.min(game.maxParticles, MAX_PARTICLES),
          game.particlePool
        );
      } else {
        game.spawnDebris(b.x, b.y, Math.round(rand(4, 8)), a.type, 45, 170);
        game.pushCapped(
          game.particles,
          Particle.burst(a.x, a.y, 6, 30, 140, 0.12, 0.25, 1, 2, function () { return game.particlePool.acquire.apply(game.particlePool, arguments); }),
          Math.min(game.maxParticles, MAX_PARTICLES),
          game.particlePool
        );
      }
    }
  }
}
