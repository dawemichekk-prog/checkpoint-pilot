import { WORLD, getSkyThemeForLevel } from "./config.js";

/**
 * Vykreslování herního světa a letadla na HTML5 Canvas.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawPlane(plane) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);

    // Trup letadla
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.quadraticCurveTo(10, -11, -18, -7);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-27, -14);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-26, 7);
    ctx.lineTo(-16, 7);
    ctx.quadraticCurveTo(12, 10, 24, 0);
    ctx.closePath();
    ctx.fill();

    // Pruh na trupu
    ctx.fillStyle = "#fff7ed";
    ctx.fillRect(-14, -2, 26, 4);

    // Kokpit
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.ellipse(5, -6, 8, 4.5, 0.1, Math.PI, 0);
    ctx.fill();

    // Křídlo
    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(-2, 12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();

    // Vrtule
    const bladeHalf = 4 + Math.abs(Math.sin(plane.propPhase)) * 11;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, -bladeHalf);
    ctx.lineTo(25, bladeHalf);
    ctx.stroke();

    ctx.restore();
  }

  function render(state) {
    resize();
    const theme = getSkyThemeForLevel(state.level || 1);

    ctx.save();
    ctx.scale(canvas.width / WORLD.width, canvas.height / WORLD.height);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    drawPlane(state.plane);

    ctx.restore();
  }

  return { render, resize };
}
