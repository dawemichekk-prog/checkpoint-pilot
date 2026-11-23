import { GATES, WORLD, getSkyThemeForLevel } from "./config.js";

/**
 * Vykreslování herního světa, bran a letadla na HTML5 Canvas.
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

  function drawBgClouds(clouds, theme) {
    ctx.save();
    ctx.fillStyle = theme.cloudFill;
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.arc(24, -8, 22, 0, Math.PI * 2);
      ctx.arc(46, 2, 20, 0, Math.PI * 2);
      ctx.arc(-22, 4, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGate(gate, isBackHalf) {
    ctx.save();
    ctx.translate(gate.x, gate.y);

    const rx = Math.max(14, gate.radius * 0.28);
    const ry = gate.radius;
    const pulse = 1 + Math.sin(gate.pulse) * 0.04;

    let stroke = "#38bdf8";
    let glow = "rgba(56, 189, 248, 0.35)";
    if (gate.status === "passed") {
      stroke = "#22c55e";
      glow = "rgba(34, 197, 94, 0.45)";
    } else if (gate.status === "perfect") {
      stroke = "#fbbf24";
      glow = "rgba(251, 191, 36, 0.65)";
    } else if (gate.status === "missed") {
      stroke = "#ef4444";
      glow = "rgba(239, 68, 68, 0.25)";
    }

    const startAngle = isBackHalf ? -Math.PI / 2 : Math.PI / 2;
    const endAngle = isBackHalf ? Math.PI / 2 : (Math.PI * 3) / 2;

    // Vnější záře
    ctx.strokeStyle = glow;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * pulse, ry * pulse, 0, startAngle, endAngle);
    ctx.stroke();

    // Hlavní prstenec brány
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, startAngle, endAngle);
    ctx.stroke();

    // Vnitřní PERFECT terč (kreslí se jen v zadní půlce)
    if (isBackHalf && gate.status === "pending") {
      const innerRy = ry * GATES.perfectRatio;
      const innerRx = rx * GATES.perfectRatio;
      ctx.strokeStyle = "rgba(251, 191, 36, 0.72)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, innerRx, innerRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawPlane(plane) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);

    if (plane.turboActive) {
      ctx.fillStyle = "rgba(255, 138, 43, 0.85)";
      ctx.beginPath();
      ctx.moveTo(-24, -4);
      ctx.lineTo(-42 - Math.random() * 14, 0);
      ctx.lineTo(-24, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Trup
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

    // Pruh
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
    const theme = getSkyThemeForLevel(state.stats.level);

    ctx.save();
    ctx.scale(canvas.width / WORLD.width, canvas.height / WORLD.height);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    drawBgClouds(state.world.bgClouds, theme);

    for (const gate of state.world.gates) {
      drawGate(gate, true);
    }

    drawPlane(state.plane);

    for (const gate of state.world.gates) {
      drawGate(gate, false);
    }

    ctx.restore();
  }

  return { render, resize };
}
