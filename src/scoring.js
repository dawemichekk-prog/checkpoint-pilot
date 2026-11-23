import { FUEL, GATES, OBSTACLES, PLANE, SCORING } from "./config.js";

/**
 * Vytvoří počáteční statistiky letu.
 */
export function createGameStats(highScore = 0) {
  return {
    score: 0,
    distanceMeters: 0,
    fuel: FUEL.max,
    lives: OBSTACLES.initialLives,
    streak: 0,
    multiplier: 1,
    maxCombo: 1,
    checkpointsPassed: 0,
    perfectCount: 0,
    level: 1,
    highScore,
    newRecord: false,
  };
}

/**
 * Vrátí aktuální combo násobič podle počtu po sobě jdoucích průletů.
 */
export function getMultiplierForStreak(streak) {
  for (const tier of SCORING.comboThresholds) {
    if (streak >= tier.streak) {
      return tier.multiplier;
    }
  }
  return 1;
}

/**
 * Vypočítá poloměr nových bran pro danou úroveň.
 */
export function getGateRadiusForLevel(level) {
  return Math.max(
    GATES.minRadius,
    GATES.initialRadius - (Math.max(1, level) - 1) * GATES.radiusShrinkPerLevel
  );
}

/**
 * Vypočítá základní rychlost světa (px/s) pro danou úroveň.
 */
export function getScrollSpeedForLevel(level) {
  return Math.min(
    GATES.maxScrollSpeed,
    GATES.baseScrollSpeed + (Math.max(1, level) - 1) * GATES.speedGainPerLevel
  );
}

/**
 * Vypočítá rozestup mezi bránami (px) pro danou úroveň.
 */
export function getGateSpacingForLevel(level) {
  return Math.max(
    GATES.minSpacing,
    GATES.baseSpacing - (Math.max(1, level) - 1) * GATES.spacingShrinkPerLevel
  );
}

/**
 * Spotřebuje palivo a přičte uletěnou vzdálenost v jednom kroku simulace.
 */
export function consumeFuelAndDistance(stats, dt, scrollSpeed, turboActive) {
  if (stats.fuel > 0) {
    const drainRate =
      FUEL.drainPerSecond * (turboActive ? FUEL.turboDrainMultiplier : 1);
    stats.fuel = Math.max(0, stats.fuel - drainRate * dt);
  }

  const metersGained = (scrollSpeed * dt) / 28;
  stats.distanceMeters += metersGained;
  stats.score += metersGained * SCORING.distancePointsPerMeter;
}

/**
 * Zpracuje úspěšný průlet checkpointem (normální nebo PERFECT).
 */
export function applyGatePass(stats, isPerfect) {
  stats.checkpointsPassed += 1;
  stats.streak += 1;
  stats.multiplier = getMultiplierForStreak(stats.streak);
  stats.maxCombo = Math.max(stats.maxCombo, stats.multiplier);

  const basePoints = isPerfect ? SCORING.basePerfect : SCORING.baseNormal;
  const pointsGained = basePoints * stats.multiplier;
  stats.score += pointsGained;

  const fuelGained = isPerfect ? FUEL.refillPerfect : FUEL.refillNormal;
  stats.fuel = Math.min(FUEL.max, stats.fuel + fuelGained);

  if (isPerfect) {
    stats.perfectCount += 1;
  }

  const prevLevel = stats.level;
  stats.level = Math.floor(stats.checkpointsPassed / SCORING.gatesPerLevel) + 1;

  return {
    pointsGained,
    fuelGained,
    multiplier: stats.multiplier,
    leveledUp: stats.level > prevLevel,
    newLevel: stats.level,
    isPerfect,
  };
}

/**
 * Zpracuje minutí checkpointu (vynuluje combo a nepřidá palivo).
 */
export function applyGateMiss(stats) {
  const lostCombo = stats.multiplier > 1 || stats.streak > 0;
  stats.streak = 0;
  stats.multiplier = 1;
  return { lostCombo };
}

/**
 * Zpracuje zásah překážkou (pták, balon) s ohledem na štít a nesmrtelnost.
 */
export function applyObstacleHit(stats, plane) {
  if (plane.invulnTimer > 0) {
    return { ignored: true, shieldBroken: false, livesRemaining: stats.lives, fatal: false };
  }

  if (plane.hasShield) {
    plane.hasShield = false;
    plane.invulnTimer = PLANE.invulnDuration;
    return {
      ignored: false,
      shieldBroken: true,
      livesRemaining: stats.lives,
      fatal: false,
    };
  }

  stats.lives = Math.max(0, stats.lives - 1);
  plane.invulnTimer = PLANE.invulnDuration;

  return {
    ignored: false,
    shieldBroken: false,
    livesRemaining: stats.lives,
    fatal: stats.lives <= 0,
  };
}

/**
 * Aplikuje sebraný power-up.
 */
export function applyPowerup(stats, plane, type) {
  if (type === "shield") {
    plane.hasShield = true;
    return "Štít aktivní!";
  }
  if (type === "fuel") {
    stats.fuel = FUEL.max;
    return "Plná nádrž!";
  }
  if (type === "magnet") {
    plane.magnetTimer = PLANE.magnetDuration;
    return "Magnet 8 s!";
  }
  return "";
}

/**
 * Vyhodnotí a uloží případný nový rekord po skončení letu.
 */
export function finalizeHighScore(stats) {
  const finalScore = Math.floor(stats.score);
  if (finalScore > stats.highScore) {
    stats.highScore = finalScore;
    stats.newRecord = true;
  }
  return finalScore;
}
