import { dist2, rand } from "../math.js";
import { Asteroid } from "../../entities/Asteroid.js";

export function spawnLevel(game) {
  buildWave(game, game.level);
}

export function nextLevel(game) {
  if (game.waveQueued) return;
  game.waveQueued = true;
  game.level += 1;
  game.hudFx.waveIntroT = 1.10;
  spawnLevel(game);
  game.waveQueued = false;
}

export function getWaveBudget(game, wave) {
  const cycle = Math.floor((wave - 1) / 6);
  const step = (wave - 1) % 6;
  const baseBudget = 8 + wave * 2 + cycle * 4;
  const stepMult = [0.92, 1.00, 1.08, 1.16, 1.24, 1.45][step];
  const difficulty = game.difficultyPresets[game.difficultyPreset] ?? game.difficultyPresets.NORMAL;
  return Math.floor(baseBudget * stepMult * difficulty.waveBudgetMult);
}

export function getWaveWeights(wave) {
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

export function buildWave(game, wave) {
  const cycle = Math.floor((wave - 1) / 6);
  const step = (wave - 1) % 6;
  const costs = { normal: 1, dense: 2, fast: 3, splitter: 4 };
  const maxFrag3 = 1 + cycle;
  const budget = getWaveBudget(game, wave);
  const weights = getWaveWeights(wave);
  game.logDebug(`Spawn wave=${wave} budget=${budget}`);

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

  const difficulty = game.difficultyPresets[game.difficultyPreset] ?? game.difficultyPresets.NORMAL;

  for (const type of picks) {
    let x;
    let y;
    do {
      x = rand(0, game.world.w);
      y = rand(0, game.world.h);
    } while (dist2(x, y, game.ship.x, game.ship.y) < 240 * 240);

    const sizeRoll = Math.random();
    let size = 3;
    if (wave >= 4 && sizeRoll < 0.28) size = 2;
    if (wave >= 9 && sizeRoll < 0.10) size = 1;

    const a = new Asteroid(x, y, size, type);
    const boost = 1 + Math.min(1.2, wave * 0.03 + cycle * 0.05);
    a.vx *= boost * difficulty.asteroidSpeedMult;
    a.vy *= boost * difficulty.asteroidSpeedMult;
    game.asteroids.push(a);
  }
}
