import { PLANE, WORLD } from "./config.js";
import {
  checkBoundaryCollision,
  circleCollision,
  evaluateGateCross,
} from "./collision.js";
import { createInputController } from "./input.js";
import { createPlane, updatePlane } from "./plane.js";
import { createRenderer } from "./render.js";
import {
  applyGateMiss,
  applyGatePass,
  applyObstacleHit,
  applyPowerup,
  consumeFuelAndDistance,
  createGameStats,
  getScrollSpeedForLevel,
} from "./scoring.js";
import { createWorld, getNextPendingGate, updateWorld } from "./world.js";

const canvas = document.getElementById("gameCanvas");
const touchTurboBtn = document.getElementById("touchTurboBtn");
const hudEl = document.getElementById("hud");
const hudScore = document.getElementById("hudScore");
const hudCombo = document.getElementById("hudCombo");
const hudDistance = document.getElementById("hudDistance");
const hudCheckpoints = document.getElementById("hudCheckpoints");
const hudFuelBar = document.getElementById("hudFuelBar");
const hudFuelText = document.getElementById("hudFuelText");
const hudLives = document.getElementById("hudLives");
const hudPowerups = document.getElementById("hudPowerups");
const hudLevel = document.getElementById("hudLevel");

const menuOverlay = document.getElementById("menuOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverReason = document.getElementById("gameOverReason");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");

const renderer = createRenderer(canvas);
const input = createInputController({ canvas, touchTurboBtn });

const state = {
  mode: "menu",
  plane: createPlane(),
  world: createWorld(),
  stats: createGameStats(),
  particles: [],
  popups: [],
};

function spawnBurst(x, y, colorTemplate, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 70 + Math.random() * 190;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 2.5 + Math.random() * 3.5,
      life: 0.45 + Math.random() * 0.25,
      maxLife: 0.7,
      color: colorTemplate,
    });
  }
}

function addPopup(x, y, text, colorTemplate = "rgba(255, 255, 255, ALPHA)", size = 18) {
  state.popups.push({
    x,
    y,
    vy: -48,
    text,
    color: colorTemplate,
    size,
    life: 1.0,
    maxLife: 1.0,
  });
}

function startGame() {
  state.mode = "playing";
  state.plane = createPlane();
  state.world = createWorld();
  state.stats = createGameStats();
  state.particles = [];
  state.popups = [];
  menuOverlay?.classList.add("hidden");
  gameOverOverlay?.classList.add("hidden");
  hudEl?.classList.remove("hidden");
}

function endGame(reasonText) {
  state.mode = "gameover";
  if (gameOverReason) gameOverReason.textContent = reasonText;
  gameOverOverlay?.classList.remove("hidden");
}

startBtn?.addEventListener("click", startGame);
retryBtn?.addEventListener("click", startGame);

function syncBasicHud() {
  if (!hudScore) return;
  hudScore.textContent = String(Math.floor(state.stats.score));
  hudCombo.textContent = `×${state.stats.multiplier}`;
  hudDistance.textContent = `${Math.floor(state.stats.distanceMeters)} m`;
  hudCheckpoints.textContent = `${state.stats.checkpointsPassed} bran`;
  hudFuelText.textContent = `${Math.ceil(state.stats.fuel)}%`;
  hudFuelBar.style.width = `${state.stats.fuel}%`;
  hudLevel.textContent = `Úroveň ${state.stats.level}`;

  if (hudLives) {
    let heartsHtml = "";
    for (let i = 0; i < 3; i++) {
      heartsHtml += i < state.stats.lives
        ? `<span>❤️</span>`
        : `<span class="heart-lost">❤️</span>`;
    }
    hudLives.innerHTML = heartsHtml;
  }

  if (hudPowerups) {
    const chips = [];
    if (state.plane.hasShield) chips.push(`<span class="power-chip">🛡️ Štít</span>`);
    if (state.plane.magnetTimer > 0) {
      chips.push(`<span class="power-chip">🧲 ${Math.ceil(state.plane.magnetTimer)}s</span>`);
    }
    hudPowerups.innerHTML = chips.join("");
  }
}

let lastTime = performance.now();
let accumulator = 0;

function tick(now) {
  const frameDt = Math.min(WORLD.maxFrameDt, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= WORLD.fixedDt) {
    const dt = WORLD.fixedDt;

    if (state.mode === "playing") {
      const ctrl = input.getState();
      const baseSpeed = getScrollSpeedForLevel(state.stats.level);
      const speedMult = ctrl.turbo && state.stats.fuel > 0 ? PLANE.turboSpeedMultiplier : 1;
      const scrollSpeed = baseSpeed * speedMult;

      const nextGate = getNextPendingGate(state.world, state.plane.x);
      updatePlane(state.plane, ctrl, dt, {
        forwardSpeed: scrollSpeed,
        magnetTargetY: nextGate ? nextGate.y : null,
        fuel: state.stats.fuel,
      });

      consumeFuelAndDistance(state.stats, dt, scrollSpeed, state.plane.turboActive);
      updateWorld(state.world, dt, scrollSpeed, state.stats.level);

      // Částice z motoru
      if (!state.plane.engineOut && Math.random() < (state.plane.turboActive ? 0.9 : 0.45)) {
        state.particles.push({
          x: state.plane.x - 26,
          y: state.plane.y + (Math.random() * 6 - 3),
          vx: -scrollSpeed * 0.35,
          vy: (Math.random() - 0.5) * 20,
          size: state.plane.turboActive ? 4 : 2.5,
          life: 0.35,
          maxLife: 0.35,
          color: state.plane.turboActive
            ? "rgba(255, 146, 43, ALPHA)"
            : "rgba(255, 255, 255, ALPHA)",
        });
      }

      // Vyhodnocení bran
      for (const gate of state.world.gates) {
        if (gate.status !== "pending") continue;
        const check = evaluateGateCross(
          gate.prevX,
          gate.x,
          state.plane.x,
          state.plane.y,
          gate.y,
          gate.radius
        );
        if (check.crossed) {
          if (check.hit) {
            gate.status = check.perfect ? "perfect" : "passed";
            const res = applyGatePass(state.stats, check.perfect);
            const color = check.perfect
              ? "rgba(251, 191, 36, ALPHA)"
              : "rgba(74, 222, 128, ALPHA)";
            spawnBurst(state.plane.x, gate.y, color, check.perfect ? 20 : 12);
            addPopup(
              state.plane.x,
              state.plane.y - 36,
              check.perfect ? `PERFECT +${res.pointsGained}!` : `+${res.pointsGained}`,
              color,
              check.perfect ? 21 : 17
            );
            if (res.leveledUp) {
              addPopup(
                WORLD.width * 0.5,
                160,
                `ÚROVEŇ ${res.newLevel}!`,
                "rgba(56, 189, 248, ALPHA)",
                28
              );
            }
          } else {
            gate.status = "missed";
            const missRes = applyGateMiss(state.stats);
            if (missRes.lostCombo) {
              addPopup(state.plane.x, state.plane.y - 30, "COMBO ZTRACENO", "rgba(248, 113, 113, ALPHA)", 16);
            }
          }
        }
      }

      // Power-upy
      for (const pu of state.world.powerups) {
        if (pu.collected) continue;
        if (circleCollision(state.plane.x, state.plane.y, state.plane.radius + 4, pu.x, pu.y, pu.radius)) {
          pu.collected = true;
          const msg = applyPowerup(state.stats, state.plane, pu.type);
          spawnBurst(pu.x, pu.y, "rgba(56, 189, 248, ALPHA)", 14);
          addPopup(pu.x, pu.y - 24, msg, "rgba(125, 211, 252, ALPHA)", 18);
        }
      }

      // Překážky (ptáci, balony)
      for (const obs of state.world.obstacles) {
        if (obs.hit) continue;
        if (circleCollision(state.plane.x, state.plane.y, state.plane.radius, obs.x, obs.y, obs.radius)) {
          obs.hit = true;
          const hitRes = applyObstacleHit(state.stats, state.plane);
          if (!hitRes.ignored) {
            spawnBurst(
              state.plane.x,
              state.plane.y,
              hitRes.shieldBroken ? "rgba(56, 189, 248, ALPHA)" : "rgba(248, 113, 113, ALPHA)",
              18
            );
            addPopup(
              state.plane.x,
              state.plane.y - 32,
              hitRes.shieldBroken ? "ŠTÍT POHLTIL NÁRAZ!" : "-1 ŽIVOT!",
              hitRes.shieldBroken ? "rgba(56, 189, 248, ALPHA)" : "rgba(248, 113, 113, ALPHA)",
              18
            );
            if (hitRes.fatal) {
              endGame("Ztráta všech životů");
            }
          }
        }
      }

      // Kolize s horami nebo bouřkovým mrakem
      if (state.mode === "playing") {
        const boundaryHit = checkBoundaryCollision(
          state.plane,
          state.world.terrainPoints,
          state.world.cloudPoints
        );
        if (boundaryHit) {
          if (state.plane.hasShield) {
            state.plane.hasShield = false;
            state.plane.invulnTimer = PLANE.invulnDuration;
            state.plane.vy = boundaryHit === "terrain" ? -300 : 250;
            state.plane.y += boundaryHit === "terrain" ? -26 : 26;
            spawnBurst(state.plane.x, state.plane.y, "rgba(56, 189, 248, ALPHA)", 18);
            addPopup(state.plane.x, state.plane.y - 28, "ŠTÍT TĚ ZACHRÁNIL!", "rgba(56, 189, 248, ALPHA)", 18);
          } else {
            spawnBurst(state.plane.x, state.plane.y, "rgba(239, 68, 68, ALPHA)", 24);
            if (state.stats.fuel <= 0) {
              endGame("Došlo palivo");
            } else if (boundaryHit === "terrain") {
              endGame("Náraz do horského terénu");
            } else {
              endGame("Zásah bouřkovým mrakem");
            }
          }
        }
      }

      // Aktualizace částic a popupů
      for (const p of state.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      state.particles = state.particles.filter((p) => p.life > 0);

      for (const pop of state.popups) {
        pop.y += pop.vy * dt;
        pop.life -= dt;
      }
      state.popups = state.popups.filter((pop) => pop.life > 0);

      syncBasicHud();
    }

    accumulator -= dt;
  }

  renderer.render(state, now / 1000);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
