import { PLANE } from "./config.js";

/**
 * Vytvoří počáteční stav letadla.
 */
export function createPlane() {
  return {
    x: PLANE.x,
    y: PLANE.startY,
    vy: 0,
    angle: 0,
    radius: PLANE.hitRadius,
    propPhase: 0,
    invulnTimer: 0,
    hasShield: false,
    magnetTimer: 0,
    turboActive: false,
    engineOut: false,
  };
}

/**
 * Aktualizuje fyziku letadla (setrvačnost, gravitace, náklon, magnet a časovače).
 */
export function updatePlane(plane, input, dt, options = {}) {
  const {
    forwardSpeed = 310,
    magnetTargetY = null,
    fuel = 100,
  } = options;

  plane.engineOut = fuel <= 0;
  plane.turboActive = Boolean(input.turbo && !plane.engineOut);

  if (plane.invulnTimer > 0) {
    plane.invulnTimer = Math.max(0, plane.invulnTimer - dt);
  }
  if (plane.magnetTimer > 0) {
    plane.magnetTimer = Math.max(0, plane.magnetTimer - dt);
  }

  let accelY = PLANE.gravity;

  if (!plane.engineOut) {
    if (input.climb && !input.dive) {
      accelY += PLANE.climbAccel;
    } else if (input.dive && !input.climb) {
      accelY += PLANE.diveAccel;
    }
  } else {
    // Bez paliva motor zhasne a letadlo klesá/plachtí k zemi
    accelY += 160;
  }

  // Magnet jemně přitahuje letadlo ke středu nejbližší nadcházející brány
  if (plane.magnetTimer > 0 && magnetTargetY !== null && !plane.engineOut) {
    const dy = magnetTargetY - plane.y;
    const normalized = Math.max(-1, Math.min(1, dy / 140));
    accelY += normalized * PLANE.magnetPullStrength;
  }

  plane.vy += accelY * dt;
  plane.vy *= Math.exp(-PLANE.vyDamping * dt);
  plane.vy = Math.max(-PLANE.maxVy, Math.min(PLANE.maxVy, plane.vy));

  plane.y += plane.vy * dt;

  // Horní mez obrazovky
  if (plane.y < PLANE.minY) {
    plane.y = PLANE.minY;
    if (plane.vy < 0) plane.vy = 0;
  }

  // Plynulý náklon letadla podle směru letu
  const effectiveSpeed = Math.max(180, forwardSpeed);
  const targetAngle = Math.max(
    -0.66,
    Math.min(0.72, Math.atan2(plane.vy, effectiveSpeed))
  );
  plane.angle += (targetAngle - plane.angle) * Math.min(1, dt * 12);

  // Vrtule se zpomalí při zhaslém motoru
  const propSpeed = plane.engineOut ? 4 : plane.turboActive ? 48 : 28;
  plane.propPhase = (plane.propPhase + propSpeed * dt) % (Math.PI * 2);
}
