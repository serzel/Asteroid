import { Asteroid } from "../../entities/Asteroid.js";
import { DebrisParticle } from "../../entities/effects/DebrisParticle.js";

export const MAX_PARTICLES = 800;

export function debrisColorFor(type) {
  const cfg = Asteroid.TYPE[type] ?? Asteroid.TYPE.normal;
  return cfg.tint;
}

export function spawnDebris(game, x, y, count, type, speedMin, speedMax) {
  const color = debrisColorFor(type);
  const reducedCount = Math.max(1, Math.round(count * 0.65));
  const debrisBudgetLeft = Math.max(0, (game.fxDebrisBudgetPerFrame ?? 0) - (game.fxSpawnedDebrisThisFrame ?? 0));
  const totalBudgetLeft = Math.max(0, (game.fxSpawnBudgetTotal ?? 0) - (game.fxSpawnedThisFrame ?? 0));
  const maxToSpawn = Math.min(reducedCount, debrisBudgetLeft, totalBudgetLeft);

  if (maxToSpawn <= 0) return;

  const items = DebrisParticle.spray(
    x,
    y,
    reducedCount,
    color,
    speedMin,
    speedMax,
    (...args) => game.debrisPool.acquire(...args),
    maxToSpawn
  );
  const spawned = items.length;
  if (spawned <= 0) return;
  game.fxSpawnedDebrisThisFrame += spawned;
  game.fxSpawnedThisFrame += spawned;
  game.pushCapped(game.debris, items, game.maxDebris, game.debrisPool);
}

export function updateEffectsOnly(game, dt) {
  if (game.particles.length > MAX_PARTICLES) {
    const removed = game.particles.splice(0, game.particles.length - MAX_PARTICLES);
    game.particlePool.releaseMany(removed);
  }

  for (const p of game.particles) p.update(dt, game.world);
  for (const e of game.explosions) e.update(dt);
  for (const d of game.debris) d.update(dt, game.world);
  game.compactAlive(game.particles, game.particlePool);
  game.compactAlive(game.explosions);
  game.compactAlive(game.debris, game.debrisPool);
}
