import { OBSTACLES, WORLD } from "./config.js";
import { getGateRadiusForLevel, getGateSpacingForLevel } from "./scoring.js";

/**
 * Spravuje procedurální svět: brány, terén hor, bouřkové mraky, ptáky, balony a power-upy.
 */
export function createWorld(rng = Math.random) {
  const world = {
    gates: [],
    obstacles: [],    // { kind: 'bird'|'balloon', x, y, baseY, radius, phase, speedOffset, bobAmp, bobFreq, hit }
    powerups: [],     // { type: 'shield'|'fuel'|'magnet', x, y, radius, phase, collected }
    terrainPoints: [],// { x, h }
    cloudPoints: [],  // { x, h }
    bgClouds: [],
    gateCounter: 0,
    lastGateY: WORLD.height * 0.48,
    scrollDistance: 0,
    nextPowerupInGates: 3,
    lightningTimer: 0,
    lightningX: 600,
  };

  for (let i = 0; i < 8; i++) {
    world.bgClouds.push({
      x: rng() * (WORLD.width + 260),
      y: 95 + rng() * 250,
      scale: 0.65 + rng() * 0.75,
      speedFactor: 0.24 + rng() * 0.18,
    });
  }

  // Počáteční checkpointy
  let nextX = 680;
  for (let i = 0; i < 4; i++) {
    spawnNextGate(world, 1, nextX, rng, false);
    nextX += getGateSpacingForLevel(1);
  }

  // Počáteční body terénu a horních mraků přes celou šířku + rezerva
  const step = OBSTACLES.terrainStepX;
  for (let x = -step; x <= WORLD.width + step * 6; x += step) {
    world.terrainPoints.push({
      x,
      h: computeSafeTerrainHeight(world, x, 1, rng),
    });
    world.cloudPoints.push({
      x,
      h: computeSafeCloudHeight(world, x, 1, rng),
    });
  }

  return world;
}

function getSafeCorridorAt(world, x) {
  if (world.gates.length === 0) {
    return { centerY: WORLD.height * 0.5, clearance: 170 };
  }

  // Najdi nejbližší brány před a za x pro plynulý koridor
  let left = null;
  let right = null;
  for (const g of world.gates) {
    if (g.x <= x && (!left || g.x > left.x)) left = g;
    if (g.x >= x && (!right || g.x < right.x)) right = g;
  }

  if (left && right && right !== left) {
    const t = (x - left.x) / Math.max(1, right.x - left.x);
    const centerY = left.y + (right.y - left.y) * t;
    const maxR = Math.max(left.radius, right.radius);
    return { centerY, clearance: maxR + OBSTACLES.corridorPadding };
  }

  const nearest = left || right;
  return {
    centerY: nearest.y,
    clearance: nearest.radius + OBSTACLES.corridorPadding,
  };
}

function computeSafeTerrainHeight(world, x, level, rng) {
  const { centerY, clearance } = getSafeCorridorAt(world, x);
  const maxAllowedByCorridor = Math.max(
    OBSTACLES.baseTerrainHeight,
    WORLD.height - (centerY + clearance)
  );
  const levelCap = Math.min(
    OBSTACLES.maxTerrainHeight,
    92 + (level - 1) * 18
  );
  const cap = Math.min(maxAllowedByCorridor, levelCap);
  const minH = Math.min(OBSTACLES.baseTerrainHeight, cap);
  return minH + rng() * Math.max(0, cap - minH);
}

function computeSafeCloudHeight(world, x, level, rng) {
  const { centerY, clearance } = getSafeCorridorAt(world, x);
  const maxAllowedByCorridor = Math.max(
    OBSTACLES.baseCloudHeight,
    centerY - clearance
  );
  const levelCap = Math.min(
    OBSTACLES.maxCloudHeight,
    64 + (level - 1) * 15
  );
  const cap = Math.min(maxAllowedByCorridor, levelCap);
  const minH = Math.min(OBSTACLES.baseCloudHeight, cap);
  return minH + rng() * Math.max(0, cap - minH);
}

export function spawnNextGate(world, level, xPos, rng = Math.random, allowExtras = true) {
  const radius = getGateRadiusForLevel(level);
  const minY = Math.max(145, radius + 95);
  const maxY = Math.min(WORLD.height - 165, WORLD.height - radius - 120);

  const maxSwing = Math.min(250, 125 + (level - 1) * 28);
  const deltaY = (rng() * 2 - 1) * maxSwing;
  const y = Math.max(minY, Math.min(maxY, world.lastGateY + deltaY));

  const prevGateX = world.gates.length
    ? world.gates[world.gates.length - 1].x
    : xPos - getGateSpacingForLevel(level);
  const prevGateY = world.lastGateY;

  world.gateCounter += 1;
  world.lastGateY = y;

  world.gates.push({
    id: world.gateCounter,
    x: xPos,
    prevX: xPos,
    y,
    radius,
    status: "pending", // pending | passed | perfect | missed
    pulse: rng() * Math.PI * 2,
  });

  if (!allowExtras) return;

  const midX = (prevGateX + xPos) * 0.5;
  const midY = (prevGateY + y) * 0.5;

  // Power-upy mezi branami
  world.nextPowerupInGates -= 1;
  if (world.nextPowerupInGates <= 0) {
    const types = ["shield", "fuel", "magnet"];
    const type = types[Math.floor(rng() * types.length)];
    const puY = Math.max(125, Math.min(WORLD.height - 165, midY + (rng() * 140 - 70)));
    world.powerups.push({
      type,
      x: midX + (rng() * 40 - 20),
      y: puY,
      radius: OBSTACLES.powerupRadius,
      phase: rng() * Math.PI * 2,
      collected: false,
    });
    world.nextPowerupInGates = 3 + Math.floor(rng() * 3); // každé 3–5 bran
  }

  // Ptáci (od 3. brány)
  const birdChance = Math.min(0.85, 0.35 + (level - 1) * 0.14);
  if (world.gateCounter >= 3 && rng() < birdChance) {
    // Umísti ptáka mimo přímý střed koridoru, aby šlo bezpečně proletět
    const offsetSign = rng() < 0.5 ? -1 : 1;
    const birdY = Math.max(
      115,
      Math.min(WORLD.height - 165, midY + offsetSign * (55 + rng() * 95))
    );
    world.obstacles.push({
      kind: "bird",
      x: midX + (rng() * 70 - 35),
      y: birdY,
      baseY: birdY,
      radius: OBSTACLES.birdRadius,
      phase: rng() * Math.PI * 2,
      speedOffset: 55 + rng() * 65,
      bobAmp: 12 + rng() * 14,
      bobFreq: 3.4 + rng() * 1.4,
      hit: false,
    });
  }

  // Horkovzdušné balony (od úrovně 3)
  const balloonChance = level >= OBSTACLES.balloonUnlockLevel
    ? Math.min(0.65, 0.32 + (level - OBSTACLES.balloonUnlockLevel) * 0.12)
    : 0;
  if (balloonChance > 0 && rng() < balloonChance) {
    const offsetSign = rng() < 0.5 ? -1 : 1;
    const balloonY = Math.max(
      140,
      Math.min(WORLD.height - 185, midY + offsetSign * (75 + rng() * 85))
    );
    world.obstacles.push({
      kind: "balloon",
      x: xPos - 135 + (rng() * 40 - 20),
      y: balloonY,
      baseY: balloonY,
      radius: OBSTACLES.balloonRadius,
      phase: rng() * Math.PI * 2,
      speedOffset: 10,
      bobAmp: 46 + rng() * 24,
      bobFreq: 1.5 + rng() * 0.6,
      hit: false,
    });
  }
}

export function updateWorld(world, dt, scrollSpeed, level, rng = Math.random) {
  const dx = scrollSpeed * dt;
  world.scrollDistance += dx;

  // Občasné zablýsknutí v horních mracích
  if (world.lightningTimer > 0) {
    world.lightningTimer = Math.max(0, world.lightningTimer - dt);
  } else if (rng() < dt * (0.16 + level * 0.05)) {
    world.lightningTimer = 0.18;
    world.lightningX = 180 + rng() * (WORLD.width - 280);
  }

  for (const cloud of world.bgClouds) {
    cloud.x -= dx * cloud.speedFactor;
    if (cloud.x < -160) {
      cloud.x = WORLD.width + 140 + rng() * 120;
      cloud.y = 95 + rng() * 250;
    }
  }

  // Posun terénu a horních bouřkových mraků
  for (const pt of world.terrainPoints) pt.x -= dx;
  for (const pt of world.cloudPoints) pt.x -= dx;

  while (world.terrainPoints.length > 2 && world.terrainPoints[1].x < -OBSTACLES.terrainStepX) {
    world.terrainPoints.shift();
  }
  while (world.cloudPoints.length > 2 && world.cloudPoints[1].x < -OBSTACLES.terrainStepX) {
    world.cloudPoints.shift();
  }

  for (const gate of world.gates) {
    gate.prevX = gate.x;
    gate.x -= dx;
    gate.pulse += dt * 4;
  }

  for (const obs of world.obstacles) {
    obs.x -= dx + obs.speedOffset * dt;
    obs.phase += obs.bobFreq * dt;
    obs.y = obs.baseY + Math.sin(obs.phase) * obs.bobAmp;
  }

  for (const pu of world.powerups) {
    pu.x -= dx;
    pu.phase += dt * 3.2;
    pu.y += Math.sin(pu.phase) * 18 * dt;
  }

  world.gates = world.gates.filter((g) => g.x > -180);
  world.obstacles = world.obstacles.filter((o) => o.x > -120 && !o.hit);
  world.powerups = world.powerups.filter((p) => p.x > -100 && !p.collected);

  // Doplň brány vpravo před doplněním terénu, aby terén respektoval jejich koridor
  const spacing = getGateSpacingForLevel(level);
  let rightmostGateX = world.gates.length
    ? world.gates[world.gates.length - 1].x
    : WORLD.width * 0.5;

  while (rightmostGateX < WORLD.width + spacing) {
    rightmostGateX += spacing;
    spawnNextGate(world, level, rightmostGateX, rng, true);
  }

  const step = OBSTACLES.terrainStepX;
  let lastTerrainX = world.terrainPoints.length
    ? world.terrainPoints[world.terrainPoints.length - 1].x
    : 0;
  while (lastTerrainX < WORLD.width + step * 4) {
    lastTerrainX += step;
    world.terrainPoints.push({
      x: lastTerrainX,
      h: computeSafeTerrainHeight(world, lastTerrainX, level, rng),
    });
  }

  let lastCloudX = world.cloudPoints.length
    ? world.cloudPoints[world.cloudPoints.length - 1].x
    : 0;
  while (lastCloudX < WORLD.width + step * 4) {
    lastCloudX += step;
    world.cloudPoints.push({
      x: lastCloudX,
      h: computeSafeCloudHeight(world, lastCloudX, level, rng),
    });
  }
}

export function getNextPendingGate(world, planeX) {
  for (const gate of world.gates) {
    if (gate.status === "pending" && gate.x >= planeX - 10) {
      return gate;
    }
  }
  return null;
}
