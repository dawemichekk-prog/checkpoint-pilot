import { GATES, WORLD } from "./config.js";

/**
 * Vyhodnotí průlet bránou v okamžiku, kdy střed brány projde kolem pozice X letadla.
 */
export function evaluateGateCross(gatePrevX, gateX, planeX, planeY, gateY, gateRadius) {
  const crossed = gatePrevX >= planeX && gateX <= planeX;
  if (!crossed) {
    return { crossed: false, hit: false, perfect: false, dy: Infinity };
  }

  const dy = Math.abs(planeY - gateY);
  const hit = dy <= gateRadius;
  const perfect = hit && dy <= gateRadius * GATES.perfectRatio;

  return { crossed: true, hit, perfect, dy };
}

/**
 * Kruhová kolize dvou entit.
 */
export function circleCollision(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const maxR = ar + br;
  return dx * dx + dy * dy <= maxR * maxR;
}

/**
 * Lineárně interpoluje výšku profilu (terén dole nebo mraky nahoře) v souřadnici X.
 */
export function sampleProfileHeightAt(points, x) {
  if (!points || points.length === 0) return 0;
  if (x <= points[0].x) return points[0].h;
  if (x >= points[points.length - 1].x) return points[points.length - 1].h;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const span = b.x - a.x;
      if (span <= 0) return a.h;
      const t = (x - a.x) / span;
      return a.h + (b.h - a.h) * t;
    }
  }
  return 0;
}

/**
 * Zkontroluje kolizi letadla s terénem dole nebo bouřkovým mrakem nahoře.
 */
export function checkBoundaryCollision(plane, terrainPoints, cloudPoints) {
  const terrainH = sampleProfileHeightAt(terrainPoints, plane.x);
  if (plane.y + plane.radius >= WORLD.height - terrainH) {
    return "terrain";
  }

  const cloudH = sampleProfileHeightAt(cloudPoints, plane.x);
  if (cloudH > 0 && plane.y - plane.radius <= cloudH) {
    return "cloud";
  }

  return null;
}
