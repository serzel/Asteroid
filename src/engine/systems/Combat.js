import { rand, dot } from "../math.js";
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

const EXPLOSION_SFX_BY_SIZE = {
  1: "asteroid_explosion_small",
  2: "asteroid_explosion_medium",
  3: "asteroid_explosion_large",
};

function findDeepestAsteroidPairContact(a, b) {
  const circlesA = a.getWorldHitCircles(a._worldHitCircles ?? (a._worldHitCircles = []));
  const circlesB = b.getWorldHitCircles(b._worldHitCircles ?? (b._worldHitCircles = []));

  let best = null;
  for (let i = 0; i < circlesA.length; i++) {
    const ca = circlesA[i];
    for (let j = 0; j < circlesB.length; j++) {
      const cb = circlesB[j];
      const dx = cb.x - ca.x;
      const dy = cb.y - ca.y;
      const rr = ca.r + cb.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) continue;

      let d = Math.sqrt(d2);
      let nx = 1;
      let ny = 0;
      if (d > 1e-8) {
        nx = dx / d;
        ny = dy / d;
      } else {
        const fallbackDx = b.x - a.x;
        const fallbackDy = b.y - a.y;
        const fallbackLen = Math.hypot(fallbackDx, fallbackDy);
        if (fallbackLen > 1e-8) {
          nx = fallbackDx / fallbackLen;
          ny = fallbackDy / fallbackLen;
        }
        d = 0;
      }

      const penetration = rr - d;
      if (!best || penetration > best.penetration) {
        best = { nx, ny, penetration };
        if (penetration >= rr * 0.4) return best;
      }
    }
  }

  return best;
}

function findBulletAsteroidHit(bullet, asteroid) {
  const circles = asteroid.getWorldHitCircles(asteroid._worldHitCircles ?? (asteroid._worldHitCircles = []));
  let bestD2 = Infinity;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const dx = bullet.x - c.x;
    const dy = bullet.y - c.y;
    const rr = bullet.radius + c.r;
    const d2 = dx * dx + dy * dy;
    if (d2 > rr * rr || d2 >= bestD2) continue;
    bestD2 = d2;
  }

  return bestD2;
}

export function rebuildAsteroidSpatialHash(game) {
  if (game.debugStats) game.debugStats.asteroidSpatialHashRebuilds += 1;
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
  const e = 0.22;
  const mu = 0.26;
  const percent = 0.5;
  const slop = 0.8;
  const iterations = 4;
  let collisionCount = 0;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.dead) continue;

      tmp.length = 0;
      game.asteroidSpatialHash.query(a.x, a.y, a.radius, tmp);
      for (const b of tmp) {
        const j = game.asteroidIndexMap.get(b);
        if (j == null || j <= i) continue;
        if (b.dead) continue;

        const broadR = a.radius + b.radius;
        const broadR2 = broadR * broadR;

        const broadDx = b.x - a.x;
        const broadDy = b.y - a.y;
        const broadD2 = broadDx * broadDx + broadDy * broadDy;

        if (broadD2 > broadR2) continue;

        const contact = findDeepestAsteroidPairContact(a, b);
        if (!contact) continue;

        const nx = contact.nx;
        const ny = contact.ny;

        const mA = a.radius * a.radius;
        const mB = b.radius * b.radius;
        const invMA = 1 / mA;
        const invMB = 1 / mB;
        const invMassSum = invMA + invMB;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = dot(rvx, rvy, nx, ny);

        if (velAlongNormal <= 0) {
          const jn = (-(1 + e) * velAlongNormal) / invMassSum;
          const impulseX = jn * nx;
          const impulseY = jn * ny;
          a.vx -= impulseX * invMA;
          a.vy -= impulseY * invMA;
          b.vx += impulseX * invMB;
          b.vy += impulseY * invMB;

          const tvx = rvx - velAlongNormal * nx;
          const tvy = rvy - velAlongNormal * ny;
          const tLen2 = tvx * tvx + tvy * tvy;
          if (tLen2 > 1e-12) {
            const tLen = Math.sqrt(tLen2);
            const tx = tvx / tLen;
            const ty = tvy / tLen;
            const jt = -dot(rvx, rvy, tx, ty) / invMassSum;
            const maxFriction = mu * jn;
            const jtClamped = Math.max(-maxFriction, Math.min(jt, maxFriction));
            const frictionX = jtClamped * tx;
            const frictionY = jtClamped * ty;
            a.vx -= frictionX * invMA;
            a.vy -= frictionY * invMA;
            b.vx += frictionX * invMB;
            b.vy += frictionY * invMB;
          }

          if (iter === 0) collisionCount += 1;
        }

        const penetration = contact.penetration;
        const correctionMag = (Math.max(penetration - slop, 0) / invMassSum) * percent;
        const correctionX = correctionMag * nx;
        const correctionY = correctionMag * ny;
        a.x -= correctionX * invMA;
        a.y -= correctionY * invMA;
        b.x += correctionX * invMB;
        b.y += correctionY * invMB;
      }
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
      asteroidSpatialHashRebuilds: 0,
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

      const broadR = b.radius + a.radius;
      const broadDx = b.x - a.x;
      const broadDy = b.y - a.y;
      const broadD2 = broadDx * broadDx + broadDy * broadDy;
      if (broadD2 > broadR * broadR) continue;

      const d2 = findBulletAsteroidHit(b, a);
      if (d2 === Infinity || d2 >= minD2) continue;
      minD2 = d2;
      target = a;
    }

    if (target) {
      const a = target;
      b.dead = true;

      a.hitFlash = 1;
      const destroyed = a.hit();
      if (game.audioReady && game.audio) {
        game.audio.play("bullet_hit");
      }
      game.comboTimer = Math.min(game.comboTimer + 0.5, game.getComboWindow());

      if (destroyed) {
        const prevWeaponLevel = game.ship.weaponLevel;
        game.combo += a.comboValue;
        game.ship.updateWeaponLevel(game.combo);
        game.comboTimer = game.getComboWindow();
        game.hudFx.comboPulseT = 0.12;
        if (game.ship.weaponLevel > prevWeaponLevel) {
          game.hudFx.weaponFlashT = 0.20;
          game.addHitStop(HIT_STOP_WEAPON_UP);
          if (game.audioReady && game.audio) {
            game.audio.play("weapon_upgrade");
          }
          if ((game.ship.weaponLevel === 3 || game.ship.weaponLevel === 4) && game.audioReady && game.audio) {
            game.audio.play("weapon_electric");
          }
        }

        const cfg = Asteroid.TYPE[a.type] ?? Asteroid.TYPE.normal;
        game.score += Math.round(100 * a.size * cfg.scoreMul * game.combo);

        const kids = a.split();
        for (let i = 0; i < kids.length; i++) {
          game.asteroids.push(kids[i]);
        }

        const shakeCfg = SHAKE_BY_ASTEROID_SIZE[a.size] ?? SHAKE_BY_ASTEROID_SIZE[1];
        game.addShake(shakeCfg.amp, shakeCfg.dur);

        const explosionSfx = EXPLOSION_SFX_BY_SIZE[a.size] ?? EXPLOSION_SFX_BY_SIZE[1];
        if (explosionSfx && game.audioReady && game.audio) {
          game.audio.play(explosionSfx);
        }
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
          explosionProfile.ringCount = 2;
          explosionProfile.maxRadius = 102;
          explosionProfile.flashAlpha = 0.9;
        } else if (a.size === 3) {
          explosionProfile.life = 0.3;
          explosionProfile.ringCount = 2;
          explosionProfile.maxRadius = 95;
          explosionProfile.flashAlpha = 0.8;
        } else if (a.size === 2) {
          explosionProfile.life = 0.22;
          explosionProfile.ringCount = 1;
          explosionProfile.maxRadius = 66;
          explosionProfile.flashAlpha = 0.72;
        } else {
          explosionProfile.life = 0.14;
          explosionProfile.ringCount = 1;
          explosionProfile.maxRadius = 40;
          explosionProfile.flashAlpha = 0.65;
        }

        game.pushCapped(game.explosions, new Explosion(a.x, a.y, explosionProfile), game.maxExplosions);

        const debrisCountBase = a.size === 3 ? rand(20, 34) : a.size === 2 ? rand(12, 20) : rand(7, 12);
        const debrisCount = Math.round(debrisCountBase * (a.type === "dense" ? 1.4 : a.type === "fast" ? 1.15 : 1) * 0.65);
        game.spawnDebris(a.x, a.y, debrisCount, a.type, 70, 230);
        {
          const baseParticleCount = Math.round((18 + a.size * 8) * 0.65);
          const particleBudgetLeft = Math.max(0, (game.fxParticleBudgetPerFrame ?? 0) - (game.fxSpawnedParticlesThisFrame ?? 0));
          const totalBudgetLeft = Math.max(0, (game.fxSpawnBudgetTotal ?? 0) - (game.fxSpawnedThisFrame ?? 0));
          const maxToSpawn = Math.min(baseParticleCount, particleBudgetLeft, totalBudgetLeft);
          const spawnedParticles = Particle.burst(
            a.x,
            a.y,
            baseParticleCount,
            60,
            260,
            0.25,
            0.85,
            1,
            2.6,
            function () { return game.particlePool.acquire.apply(game.particlePool, arguments); },
            maxToSpawn
          );
          const spawned = spawnedParticles.length;
          game.fxSpawnedParticlesThisFrame += spawned;
          game.fxSpawnedThisFrame += spawned;
          game.pushCapped(
            game.particles,
            spawnedParticles,
            Math.min(game.maxParticles, MAX_PARTICLES),
            game.particlePool
          );
        }
      } else {
        game.spawnDebris(b.x, b.y, Math.round(rand(4, 8)), a.type, 45, 170);
        {
          const baseParticleCount = Math.round(6 * 0.65);
          const particleBudgetLeft = Math.max(0, (game.fxParticleBudgetPerFrame ?? 0) - (game.fxSpawnedParticlesThisFrame ?? 0));
          const totalBudgetLeft = Math.max(0, (game.fxSpawnBudgetTotal ?? 0) - (game.fxSpawnedThisFrame ?? 0));
          const maxToSpawn = Math.min(baseParticleCount, particleBudgetLeft, totalBudgetLeft);
          const spawnedParticles = Particle.burst(
            a.x,
            a.y,
            baseParticleCount,
            30,
            140,
            0.12,
            0.25,
            1,
            2,
            function () { return game.particlePool.acquire.apply(game.particlePool, arguments); },
            maxToSpawn
          );
          const spawned = spawnedParticles.length;
          game.fxSpawnedParticlesThisFrame += spawned;
          game.fxSpawnedThisFrame += spawned;
          game.pushCapped(
            game.particles,
            spawnedParticles,
            Math.min(game.maxParticles, MAX_PARTICLES),
            game.particlePool
          );
        }
      }
    }
  }
}
