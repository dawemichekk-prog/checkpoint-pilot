/**
 * Centrální konfigurace a ladicí konstanty hry Checkpoint Pilot.
 */

export const WORLD = {
  width: 1280,
  height: 720,
  fixedDt: 1 / 60,
  maxFrameDt: 0.05,
};

export const PLANE = {
  x: 240,
  startY: 340,
  hitRadius: 18,
  climbAccel: -1250,       // tah nahoru při stoupání
  diveAccel: 920,          // zrychlení dolů při klesání
  gravity: 460,            // přirozená gravitace / klouzání
  vyDamping: 1.65,         // aerodynamický odpor ve svislé ose
  maxVy: 520,
  minY: 36,
  maxY: WORLD.height - 36,
  turboSpeedMultiplier: 1.55,
  invulnDuration: 1.5,
  magnetDuration: 8.0,
  magnetPullStrength: 420,
};

export const FUEL = {
  max: 100,
  drainPerSecond: 4.8,
  turboDrainMultiplier: 3.0,
  refillNormal: 24,
  refillPerfect: 36,
  refillCanister: 100,
};

export const SCORING = {
  baseNormal: 100,
  basePerfect: 250,
  distancePointsPerMeter: 0.25,
  comboThresholds: [
    { streak: 6, multiplier: 5 },
    { streak: 4, multiplier: 3 },
    { streak: 2, multiplier: 2 },
    { streak: 0, multiplier: 1 },
  ],
  gatesPerLevel: 10,
};

export const GATES = {
  initialRadius: 96,
  minRadius: 56,
  radiusShrinkPerLevel: 6,
  perfectRatio: 0.38,      // vnitřní kruh = 38 % poloměru brány
  baseSpacing: 460,
  minSpacing: 340,
  spacingShrinkPerLevel: 14,
  baseScrollSpeed: 310,
  speedGainPerLevel: 38,
  maxScrollSpeed: 640,
};

export const OBSTACLES = {
  initialLives: 3,
  maxLives: 3,
  terrainStepX: 64,
  baseTerrainHeight: 54,
  maxTerrainHeight: 175,
  baseCloudHeight: 42,
  maxCloudHeight: 135,
  corridorPadding: 120,    // minimální volný prostor nad/pod středem nejbližších bran
  birdRadius: 20,
  balloonRadius: 30,
  balloonUnlockLevel: 3,
  powerupRadius: 22,
};

export const STORAGE_KEYS = {
  highScore: "checkpoint_pilot_high_score_v1",
  muted: "checkpoint_pilot_muted_v1",
};

export const SKY_THEMES = [
  {
    name: "Den",
    skyTop: "#1d6fa5",
    skyBottom: "#93d5f6",
    sunColor: "#ffe484",
    sunGlow: "rgba(255, 228, 132, 0.28)",
    farHill: "#5a93b8",
    midHill: "#356c8f",
    terrainTop: "#2f6b47",
    terrainBody: "#1c432d",
    cloudFill: "rgba(255, 255, 255, 0.85)",
    stormFill: "#475569",
    stars: false,
  },
  {
    name: "Západ slunce",
    skyTop: "#2d1e4f",
    skyBottom: "#f57f5b",
    sunColor: "#ffb347",
    sunGlow: "rgba(255, 140, 66, 0.34)",
    farHill: "#6f446b",
    midHill: "#49284f",
    terrainTop: "#382542",
    terrainBody: "#211529",
    cloudFill: "rgba(255, 198, 165, 0.65)",
    stormFill: "#332940",
    stars: false,
  },
  {
    name: "Noc",
    skyTop: "#060b19",
    skyBottom: "#172a4f",
    sunColor: "#e2e8f0",
    sunGlow: "rgba(226, 232, 240, 0.22)",
    farHill: "#172544",
    midHill: "#0f1930",
    terrainTop: "#1b3348",
    terrainBody: "#0d1a28",
    cloudFill: "rgba(148, 163, 184, 0.3)",
    stormFill: "#1e293b",
    stars: true,
  },
];

export function getSkyThemeForLevel(level) {
  const idx = (Math.max(1, level) - 1) % SKY_THEMES.length;
  return SKY_THEMES[idx];
}
