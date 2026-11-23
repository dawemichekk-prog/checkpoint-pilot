import { GATES, WORLD, getSkyThemeForLevel } from "./config.js";

/**
 * Vykreslování paralaxového pozadí, terénu, mraků, překážek, power-upů, bran, částic a letadla.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");

  // Deterministická sada hvězd pro noční oblohu
  const stars = Array.from({ length: 55 }, (_, i) => ({
    x: ((i * 197) % 1240) + 20,
    y: ((i * 89) % 410) + 30,
    r: (i % 3) * 0.7 + 0.8,
    phase: i * 0.7,
  }));

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

  function drawSkyAndParallax(world, theme, timeSec) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    if (theme.stars) {
      for (const s of stars) {
        const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(timeSec * 2 + s.phase));
        ctx.fillStyle = `rgba(248, 250, 252, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Slunce / Měsíc
    const sunX = 1040;
    const sunY = theme.name === "Západ slunce" ? 260 : 145;
    ctx.fillStyle = theme.sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 74, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = theme.sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
    ctx.fill();

    // Vrstva 1: vzdálené hory (pomalý paralax)
    drawParallaxRidge(world.scrollDistance * 0.14, 215, 58, 0.0042, theme.farHill);
    // Vrstva 2: střední kopce (střední paralax)
    drawParallaxRidge(world.scrollDistance * 0.32, 145, 42, 0.0068, theme.midHill);

    // Vrstva 3: dekorativní mraky
    ctx.save();
    ctx.fillStyle = theme.cloudFill;
    for (const c of world.bgClouds) {
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

  function drawParallaxRidge(offset, baseH, amp, freq, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.height);
    for (let x = 0; x <= WORLD.width + 40; x += 40) {
      const wx = x + offset;
      const h =
        baseH +
        Math.sin(wx * freq) * amp +
        Math.cos(wx * freq * 1.9) * (amp * 0.45);
      ctx.lineTo(x, WORLD.height - h);
    }
    ctx.lineTo(WORLD.width, WORLD.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(points, theme) {
    if (points.length < 2) return;

    ctx.fillStyle = theme.terrainBody;
    ctx.beginPath();
    ctx.moveTo(points[0].x, WORLD.height);
    for (const p of points) {
      ctx.lineTo(p.x, WORLD.height - p.h);
    }
    ctx.lineTo(points[points.length - 1].x, WORLD.height);
    ctx.closePath();
    ctx.fill();

    // Hřeben hor
    ctx.strokeStyle = theme.terrainTop;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, idx) => {
      const y = WORLD.height - p.h;
      if (idx === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.stroke();
  }

  function drawStormClouds(points, theme, world) {
    if (points.length < 2) return;

    ctx.fillStyle = theme.stormFill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, 0);
    for (const p of points) {
      ctx.lineTo(p.x, p.h);
    }
    ctx.lineTo(points[points.length - 1].x, 0);
    ctx.closePath();
    ctx.fill();

    // Bouřkové oblouky na spodní hraně
    ctx.fillStyle = theme.stormFill;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const mx = (a.x + b.x) * 0.5;
      const mh = (a.h + b.h) * 0.5;
      ctx.beginPath();
      ctx.arc(mx, mh - 4, 28, 0, Math.PI);
      ctx.fill();
    }

    // Zablýsknutí bleskem
    if (world.lightningTimer > 0) {
      const lx = world.lightningX;
      ctx.strokeStyle = "rgba(253, 224, 71, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, 18);
      ctx.lineTo(lx - 10, 48);
      ctx.lineTo(lx + 6, 54);
      ctx.lineTo(lx - 8, 92);
      ctx.stroke();
    }
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

    ctx.strokeStyle = glow;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * pulse, ry * pulse, 0, startAngle, endAngle);
    ctx.stroke();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, startAngle, endAngle);
    ctx.stroke();

    if (isBackHalf && gate.status === "pending") {
      const innerRy = ry * GATES.perfectRatio;
      const innerRx = rx * GATES.perfectRatio;
      ctx.strokeStyle = "rgba(251, 191, 36, 0.78)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, innerRx, innerRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawObstacles(obstacles) {
    for (const obs of obstacles) {
      if (obs.kind === "bird") {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        const flap = Math.sin(obs.phase * 2.8) * 11;

        // Tělo ptáka
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Křídlo
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.quadraticCurveTo(4, -14 + flap, 12, -8 + flap);
        ctx.stroke();

        // Zobák
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(-13, -1);
        ctx.lineTo(-21, 2);
        ctx.lineTo(-13, 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else if (obs.kind === "balloon") {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        // Lana koše
        ctx.strokeStyle = "rgba(226, 232, 240, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, 18);
        ctx.lineTo(-6, 30);
        ctx.moveTo(8, 18);
        ctx.lineTo(6, 30);
        ctx.stroke();

        // Koš
        ctx.fillStyle = "#92400e";
        ctx.fillRect(-7, 29, 14, 9);

        // Balon
        const grad = ctx.createLinearGradient(-24, -30, 24, 20);
        grad.addColorStop(0, "#fb7185");
        grad.addColorStop(0.5, "#f43f5e");
        grad.addColorStop(1, "#be123c");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, -4, 24, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Světlý pruh na balonu
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.ellipse(0, -4, 9, 27, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  function drawPowerups(powerups) {
    for (const pu of powerups) {
      ctx.save();
      ctx.translate(pu.x, pu.y);

      let bg = "#38bdf8";
      let label = "🛡️";
      if (pu.type === "fuel") {
        bg = "#22c55e";
        label = "⛽";
      } else if (pu.type === "magnet") {
        bg = "#f59e0b";
        label = "🧲";
      }

      const scale = 1 + Math.sin(pu.phase * 1.6) * 0.08;
      ctx.scale(scale, scale);

      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = bg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 1);

      ctx.restore();
    }
  }

  function drawPlane(plane, theme) {
    // Blikání během krátké nesmrtelnosti po zásahu
    if (plane.invulnTimer > 0 && Math.floor(plane.invulnTimer * 14) % 2 === 1) {
      return;
    }

    ctx.save();
    ctx.translate(plane.x, plane.y);

    // Indikátor magnetu
    if (plane.magnetTimer > 0) {
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Bublina štítu
    if (plane.hasShield) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.82)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.rotate(plane.angle);

    if (plane.turboActive) {
      ctx.fillStyle = "rgba(255, 138, 43, 0.88)";
      ctx.beginPath();
      ctx.moveTo(-24, -4);
      ctx.lineTo(-42 - Math.random() * 14, 0);
      ctx.lineTo(-24, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Trup
    ctx.fillStyle = plane.engineOut ? "#94a3b8" : "#f97316";
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
    ctx.fillStyle = plane.engineOut ? "#64748b" : "#ea580c";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(-2, 12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();

    // Noční poziční světlo
    if (theme.stars && !plane.engineOut) {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(-2, 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

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

  function drawEffects(particles, popups) {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color.replace("ALPHA", alpha.toFixed(2));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pop of popups) {
      const alpha = Math.max(0, pop.life / pop.maxLife);
      ctx.save();
      ctx.font = `800 ${pop.size || 18}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(0, 0, 0, ${(alpha * 0.45).toFixed(2)})`;
      ctx.fillText(pop.text, pop.x + 1.5, pop.y + 1.5);
      ctx.fillStyle = pop.color.replace("ALPHA", alpha.toFixed(2));
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  function render(state, timeSec = 0) {
    resize();
    const theme = getSkyThemeForLevel(state.stats.level);

    ctx.save();
    ctx.scale(canvas.width / WORLD.width, canvas.height / WORLD.height);

    drawSkyAndParallax(state.world, theme, timeSec);
    drawTerrain(state.world.terrainPoints, theme);
    drawStormClouds(state.world.cloudPoints, theme, state.world);

    for (const gate of state.world.gates) {
      drawGate(gate, true);
    }

    drawPowerups(state.world.powerups);
    drawObstacles(state.world.obstacles);
    drawPlane(state.plane, theme);

    for (const gate of state.world.gates) {
      drawGate(gate, false);
    }

    drawEffects(state.particles || [], state.popups || []);

    // Rychlostní čáry při Turbu
    if (state.plane.turboActive && state.mode === "playing") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ly = ((i * 113 + Math.floor(timeSec * 360)) % (WORLD.height - 140)) + 70;
        const lx = ((i * 271 - Math.floor(timeSec * 1400)) % WORLD.width + WORLD.width) % WORLD.width;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 75, ly);
        ctx.stroke();
      }
    }

    // Výstraha při nízkém palivu
    if (state.mode === "playing" && state.stats.fuel <= 25) {
      const pulse = 0.08 + 0.08 * Math.sin(timeSec * 8);
      ctx.strokeStyle = `rgba(239, 68, 68, ${(pulse + 0.16).toFixed(2)})`;
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
    }

    ctx.restore();
  }

  return { render, resize };
}
