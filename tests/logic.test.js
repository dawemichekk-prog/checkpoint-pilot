import test from "node:test";
import assert from "node:assert/strict";

import { FUEL, GATES, OBSTACLES, PLANE, WORLD, getSkyThemeForLevel } from "../src/config.js";
import {
  checkBoundaryCollision,
  circleCollision,
  evaluateGateCross,
  sampleProfileHeightAt,
} from "../src/collision.js";
import { createPlane, updatePlane } from "../src/plane.js";
import {
  applyGateMiss,
  applyGatePass,
  applyObstacleHit,
  applyPowerup,
  consumeFuelAndDistance,
  createGameStats,
  finalizeHighScore,
  getGateRadiusForLevel,
  getMultiplierForStreak,
  getScrollSpeedForLevel,
} from "../src/scoring.js";
import { createWorld, spawnNextGate, updateWorld } from "../src/world.js";

test("Fyzika letadla: stoupání, klesání, mez obrazovky a zhasnutí motoru bez paliva", () => {
  const plane = createPlane();
  const startY = plane.y;

  // Stoupání zvedá letadlo nahoru
  for (let i = 0; i < 20; i++) {
    updatePlane(plane, { climb: true, dive: false, turbo: false }, WORLD.fixedDt, {
      fuel: 100,
    });
  }
  assert.ok(plane.y < startY, "Letadlo má po stoupání klesající souřadnici Y");
  assert.ok(plane.angle < 0, "Nos letadla má mířit nahoru (záporný úhel)");

  // Bez paliva motor zhasne a stoupání nefunguje
  const pEmpty = createPlane();
  for (let i = 0; i < 20; i++) {
    updatePlane(pEmpty, { climb: true, dive: false, turbo: true }, WORLD.fixedDt, {
      fuel: 0,
    });
  }
  assert.equal(pEmpty.engineOut, true);
  assert.equal(pEmpty.turboActive, false);
  assert.ok(pEmpty.y > PLANE.startY, "Bez paliva letadlo klesá k zemi");

  // Horní mez obrazovky
  const pTop = createPlane();
  pTop.y = 5;
  pTop.vy = -300;
  updatePlane(pTop, { climb: true, dive: false, turbo: false }, WORLD.fixedDt, { fuel: 100 });
  assert.equal(pTop.y, PLANE.minY);
});

test("Fyzika magnetu přitahuje letadlo ke středu nadcházející brány", () => {
  const plane = createPlane();
  plane.y = 480;
  plane.magnetTimer = 5;

  updatePlane(plane, { climb: false, dive: false, turbo: false }, 0.2, {
    fuel: 100,
    magnetTargetY: 200,
  });

  const planeNoMagnet = createPlane();
  planeNoMagnet.y = 480;
  updatePlane(planeNoMagnet, { climb: false, dive: false, turbo: false }, 0.2, {
    fuel: 100,
    magnetTargetY: 200,
  });

  assert.ok(plane.y < planeNoMagnet.y, "Magnet musí táhnout letadlo směrem k cílové bráně");
});

test("Skóre, palivo, combo násobiče a minutí brány", () => {
  const stats = createGameStats(500);
  stats.fuel = 40;

  // 1. normální průlet -> streak 1 -> ×1
  const r1 = applyGatePass(stats, false);
  assert.equal(r1.multiplier, 1);
  assert.equal(r1.pointsGained, 100);
  assert.equal(stats.fuel, 40 + FUEL.refillNormal);

  // 2. PERFECT průlet -> streak 2 -> ×2
  const r2 = applyGatePass(stats, true);
  assert.equal(r2.multiplier, 2);
  assert.equal(r2.pointsGained, 500);
  assert.equal(stats.perfectCount, 1);

  // Postup na ×3 a ×5
  applyGatePass(stats, false); // streak 3 -> ×2
  const r4 = applyGatePass(stats, false); // streak 4 -> ×3
  assert.equal(r4.multiplier, 3);
  applyGatePass(stats, false); // streak 5 -> ×3
  const r6 = applyGatePass(stats, true); // streak 6 -> ×5
  assert.equal(r6.multiplier, 5);
  assert.equal(r6.pointsGained, 1250);
  assert.equal(stats.maxCombo, 5);

  // Minutí vynuluje combo a nepřidá palivo
  const fuelBeforeMiss = stats.fuel;
  const miss = applyGateMiss(stats);
  assert.equal(miss.lostCombo, true);
  assert.equal(stats.streak, 0);
  assert.equal(stats.multiplier, 1);
  assert.equal(stats.fuel, fuelBeforeMiss);
  assert.equal(getMultiplierForStreak(0), 1);
});

test("Spotřeba paliva s turbem a postup na další úroveň", () => {
  const normalStats = createGameStats();
  const turboStats = createGameStats();

  consumeFuelAndDistance(normalStats, 1.0, 300, false);
  consumeFuelAndDistance(turboStats, 1.0, 300, true);

  const normalLoss = FUEL.max - normalStats.fuel;
  const turboLoss = FUEL.max - turboStats.fuel;
  assert.ok(Math.abs(turboLoss - normalLoss * FUEL.turboDrainMultiplier) < 1e-6);

  // Postup do úrovně 2 po 10 branách
  const levelStats = createGameStats();
  for (let i = 0; i < 9; i++) {
    const res = applyGatePass(levelStats, false);
    assert.equal(res.leveledUp, false);
  }
  const tenth = applyGatePass(levelStats, false);
  assert.equal(tenth.leveledUp, true);
  assert.equal(tenth.newLevel, 2);
  assert.ok(getScrollSpeedForLevel(2) > getScrollSpeedForLevel(1));
  assert.ok(getGateRadiusForLevel(2) < getGateRadiusForLevel(1));
});

test("Kolize při průletu bránou nevynechá průlet ani při vysoké rychlosti", () => {
  // Brána se přesunula z 270 na 210 kolem letadla na X=240
  const perfectCheck = evaluateGateCross(270, 210, 240, 305, 300, 80);
  assert.equal(perfectCheck.crossed, true);
  assert.equal(perfectCheck.hit, true);
  assert.equal(perfectCheck.perfect, true);

  const edgeHit = evaluateGateCross(270, 210, 240, 360, 300, 80);
  assert.equal(edgeHit.crossed, true);
  assert.equal(edgeHit.hit, true);
  assert.equal(edgeHit.perfect, false);

  const missed = evaluateGateCross(270, 210, 240, 420, 300, 80);
  assert.equal(missed.crossed, true);
  assert.equal(missed.hit, false);
  assert.equal(missed.perfect, false);

  const notCrossed = evaluateGateCross(340, 280, 240, 300, 300, 80);
  assert.equal(notCrossed.crossed, false);
});

test("Životy, štít, nesmrtelnost, power-upy a kolize s terénem/mraky", () => {
  const stats = createGameStats(100);
  const plane = createPlane();

  // Power-upy
  applyPowerup(stats, plane, "shield");
  assert.equal(plane.hasShield, true);

  stats.fuel = 15;
  applyPowerup(stats, plane, "fuel");
  assert.equal(stats.fuel, FUEL.max);

  applyPowerup(stats, plane, "magnet");
  assert.equal(plane.magnetTimer, PLANE.magnetDuration);

  // Štít pohltí první náraz bez ztráty života
  const shieldHit = applyObstacleHit(stats, plane);
  assert.equal(shieldHit.shieldBroken, true);
  assert.equal(stats.lives, 3);
  assert.ok(plane.invulnTimer > 0);

  // Během nesmrtelnosti je druhý náraz ignorován
  const ignoredHit = applyObstacleHit(stats, plane);
  assert.equal(ignoredHit.ignored, true);
  assert.equal(stats.lives, 3);

  // Po vypršení nesmrtelnosti ubývají životy až do konce hry
  plane.invulnTimer = 0;
  assert.equal(applyObstacleHit(stats, plane).fatal, false);
  plane.invulnTimer = 0;
  assert.equal(applyObstacleHit(stats, plane).fatal, false);
  plane.invulnTimer = 0;
  const lastHit = applyObstacleHit(stats, plane);
  assert.equal(lastHit.fatal, true);
  assert.equal(stats.lives, 0);

  // Záznam rekordu
  stats.score = 1234.8;
  const finalized = finalizeHighScore(stats);
  assert.equal(finalized, 1234);
  assert.equal(stats.highScore, 1234);
  assert.equal(stats.newRecord, true);

  // Terén a bouřkové mraky
  const terrain = [{ x: 0, h: 100 }, { x: 500, h: 100 }];
  const clouds = [{ x: 0, h: 80 }, { x: 500, h: 80 }];
  const pGround = createPlane();
  pGround.y = WORLD.height - 95;
  assert.equal(checkBoundaryCollision(pGround, terrain, clouds), "terrain");

  const pCloud = createPlane();
  pCloud.y = 75;
  assert.equal(checkBoundaryCollision(pCloud, terrain, clouds), "cloud");

  assert.equal(circleCollision(100, 100, 10, 115, 100, 10), true);
  assert.equal(circleCollision(100, 100, 10, 130, 100, 10), false);
});

test("Generování světa nechává průletný koridor a balony vznikají až od úrovně 3", () => {
  const fixedRng = () => 0.45;
  const world = createWorld(fixedRng);

  assert.ok(world.gates.length >= 4);
  for (const gate of world.gates) {
    const tH = sampleProfileHeightAt(world.terrainPoints, gate.x);
    const cH = sampleProfileHeightAt(world.cloudPoints, gate.x);
    assert.ok(WORLD.height - tH > gate.y + gate.radius, "Terén nesmí zasahovat do brány");
    assert.ok(cH < gate.y - gate.radius, "Mrak nesmí zasahovat do brány");
  }

  // V úrovni 1 a 2 nesmí vzniknout balon
  const w1 = createWorld(() => 0.1);
  for (let i = 0; i < 6; i++) {
    spawnNextGate(w1, 2, 1600 + i * 400, () => 0.1, true);
  }
  assert.equal(w1.obstacles.some((o) => o.kind === "balloon"), false);

  // V úrovni 3 se balon při nízkém RNG objeví
  spawnNextGate(w1, OBSTACLES.balloonUnlockLevel, 4200, () => 0.1, true);
  assert.equal(w1.obstacles.some((o) => o.kind === "balloon"), true);

  // Cyklus denní doby
  assert.equal(getSkyThemeForLevel(1).name, "Den");
  assert.equal(getSkyThemeForLevel(2).name, "Západ slunce");
  assert.equal(getSkyThemeForLevel(3).name, "Noc");

  // Posun světa udrží pole bran naplněné
  updateWorld(world, 0.5, 320, 1, fixedRng);
  assert.ok(world.gates.length >= 3);
});
