import { Asteroid } from "../../entities/Asteroid.js";
import { DebrisParticle } from "../../entities/effects/DebrisParticle.js";

export const MAX_PARTICLES = 800;

export function debrisColorFor(type) {
  const cfg = Asteroid.TYPE[type] ?? Asteroid.TYPE.normal;
  return cfg.tint;
}

export function spawnDebris(game, x, y, count, type, speedMin, speedMax) {
  const color = debrisColorFor(type);
  const items = DebrisParticle.spray(
    x,
    y,
    count,
    color,
    speedMin,
    speedMax,
    (...args) => game.debrisPool.acquire(...args)
  );
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
