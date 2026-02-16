import { Asteroid } from "../../entities/Asteroid.js";
import { DebrisParticle } from "../../entities/effects/DebrisParticle.js";

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
  for (const p of game.particles) p.update(dt, game.world);
  for (const e of game.explosions) e.update(dt);
  for (const d of game.debris) d.update(dt, game.world);
  game.compactAlive(game.particles, game.particlePool);
  game.compactAlive(game.explosions);
  game.compactAlive(game.debris, game.debrisPool);
}
