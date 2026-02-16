import { Asteroid } from "../../entities/Asteroid.js";
import { DebrisParticle } from "../../entities/effects/DebrisParticle.js";
import { Particle } from "../../entities/effects/Particle.js";

const FX_FRAME_SPAWN_CAP = 140;
const FX_MIN_SPAWN_SCALE = 0.35;
const FX_TARGET_FPS = 60;
const FX_FPS_SMOOTHING = 0.08;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function ensureFxBudgetState(game) {
  if (!game.fxBudget) {
    game.fxBudget = {
      fpsEstimate: FX_TARGET_FPS,
      spawnBudgetLeft: FX_FRAME_SPAWN_CAP,
    };
  }
  return game.fxBudget;
}

export function prepareFxFrameBudget(game, dt) {
  const state = ensureFxBudgetState(game);
  if (dt <= 0) {
    state.spawnBudgetLeft = FX_FRAME_SPAWN_CAP;
    return;
  }

  const fpsNow = 1 / dt;
  state.fpsEstimate += (fpsNow - state.fpsEstimate) * FX_FPS_SMOOTHING;

  const fpsFactor = clamp01(state.fpsEstimate / FX_TARGET_FPS);
  const dynamicScale = Math.max(FX_MIN_SPAWN_SCALE, fpsFactor);
  const dynamicCap = Math.max(1, Math.floor(FX_FRAME_SPAWN_CAP * dynamicScale));
  const availableSlots = Math.max(0, game.maxParticles - game.particles.length);

  state.spawnBudgetLeft = Math.min(dynamicCap, availableSlots);
}

export function spawnParticleBurstCapped(game, x, y, count, speedMin, speedMax, lifeMin, lifeMax, rMin, rMax) {
  const state = ensureFxBudgetState(game);
  const budget = Math.max(0, state.spawnBudgetLeft | 0);
  const cappedCount = Math.min(count, budget);
  if (cappedCount <= 0) return;

  state.spawnBudgetLeft -= cappedCount;

  game.pushCapped(
    game.particles,
    Particle.burst(
      x,
      y,
      cappedCount,
      speedMin,
      speedMax,
      lifeMin,
      lifeMax,
      rMin,
      rMax,
      (px, py, pvx, pvy, life, radius) => game.particlePool.acquire(px, py, pvx, pvy, life, radius)
    ),
    game.maxParticles,
    game.particlePool
  );
}

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
    (px, py, pvx, pvy, life, size, particleColor) => game.debrisPool.acquire(px, py, pvx, pvy, life, size, particleColor)
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
