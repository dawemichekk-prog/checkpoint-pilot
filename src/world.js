import { WORLD } from "./config.js";
import { getGateRadiusForLevel, getGateSpacingForLevel } from "./scoring.js";

/**
 * Spravuje herní svět: checkpointy a dekorativní mraky (M2).
 */
export function createWorld(rng = Math.random) {
  const world = {
    gates: [],
    bgClouds: [],
    gateCounter: 0,
    lastGateY: WORLD.height * 0.48,
    scrollDistance: 0,
  };

  // Dekorativní mraky pro paralaxu
  for (let i = 0; i < 8; i++) {
    world.bgClouds.push({
      x: rng() * (WORLD.width + 260),
      y: 70 + rng() * 260,
      scale: 0.65 + rng() * 0.75,
      speedFactor: 0.25 + rng() * 0.2,
    });
  }

  // Počáteční sada checkpointů před letadlem
  let nextX = 680;
  for (let i = 0; i < 4; i++) {
    spawnNextGate(world, 1, nextX, rng);
    nextX += getGateSpacingForLevel(1);
  }

  return world;
}

export function spawnNextGate(world, level, xPos, rng = Math.random) {
  const radius = getGateRadiusForLevel(level);
  const minY = Math.max(130, radius + 85);
  const maxY = Math.min(WORLD.height - 150, WORLD.height - radius - 110);

  // Vyšší úrovně mají výraznější výškové přechody mezi branami
  const maxSwing = Math.min(250, 125 + (level - 1) * 28);
  const deltaY = (rng() * 2 - 1) * maxSwing;
  const y = Math.max(minY, Math.min(maxY, world.lastGateY + deltaY));

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
}

export function updateWorld(world, dt, scrollSpeed, level, rng = Math.random) {
  const dx = scrollSpeed * dt;
  world.scrollDistance += dx;

  for (const cloud of world.bgClouds) {
    cloud.x -= dx * cloud.speedFactor;
    if (cloud.x < -160) {
      cloud.x = WORLD.width + 140 + rng() * 120;
      cloud.y = 70 + rng() * 260;
    }
  }

  for (const gate of world.gates) {
    gate.prevX = gate.x;
    gate.x -= dx;
    gate.pulse += dt * 4;
  }

  // Odstraň staré brány daleko vlevo
  world.gates = world.gates.filter((g) => g.x > -180);

  // Doplň další brány vpravo
  const spacing = getGateSpacingForLevel(level);
  let rightmostX = world.gates.length
    ? world.gates[world.gates.length - 1].x
    : WORLD.width * 0.5;

  while (rightmostX < WORLD.width + spacing) {
    rightmostX += spacing;
    spawnNextGate(world, level, rightmostX, rng);
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
