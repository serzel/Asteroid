export const WEAPON_LEVEL_RULES = [
  { minCombo: 45, weaponLevel: 4, bulletLife: 0.95 },
  { minCombo: 25, weaponLevel: 3, bulletLife: 1.2 },
  { minCombo: 10, weaponLevel: 2, bulletLife: 1.9 },
  { minCombo: 1, weaponLevel: 1, bulletLife: 1.2 },
];

export const DIFFICULTY_PRESETS = {
  EASY: { waveBudgetMult: 0.85, asteroidSpeedMult: 0.9, scoreDrainCombo1PerSec: 800 },
  NORMAL: { waveBudgetMult: 1.0, asteroidSpeedMult: 1.0, scoreDrainCombo1PerSec: 1200 },
  HARD: { waveBudgetMult: 1.15, asteroidSpeedMult: 1.1, scoreDrainCombo1PerSec: 1600 },
};

export const COMBO_WINDOW = {
  min: 1,
  base: 5.0,
  perWeaponLevel: 0.5,
};

export const COMBO_OVERLAY = {
  ambienceStart: 10,
  ambienceRange: 35,
  pulseAlpha: 0.06,
  baseAlpha: 0.06,
  color: "rgba(120,0,255,1)",
};
