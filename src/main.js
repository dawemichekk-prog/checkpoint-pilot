import { PLANE, WORLD } from "./config.js";
import { evaluateGateCross } from "./collision.js";
import { createInputController } from "./input.js";
import { createPlane, updatePlane } from "./plane.js";
import { createRenderer } from "./render.js";
import {
  applyGateMiss,
  applyGatePass,
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
const hudLevel = document.getElementById("hudLevel");

const menuOverlay = document.getElementById("menuOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");

const renderer = createRenderer(canvas);
const input = createInputController({ canvas, touchTurboBtn });

const state = {
  mode: "menu",
  plane: createPlane(),
  world: createWorld(),
  stats: createGameStats(),
};

function startGame() {
  state.mode = "playing";
  state.plane = createPlane();
  state.world = createWorld();
  state.stats = createGameStats();
  menuOverlay?.classList.add("hidden");
  gameOverOverlay?.classList.add("hidden");
  hudEl?.classList.remove("hidden");
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
}

let lastTime = performance.now();
let accumulator = 0;

function tick(now) {
  const frameDt = Math.min(WORLD.maxFrameDt, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= WORLD.fixedDt) {
    if (state.mode === "playing") {
      const ctrl = input.getState();
      const baseSpeed = getScrollSpeedForLevel(state.stats.level);
      const speedMult = ctrl.turbo && state.stats.fuel > 0 ? PLANE.turboSpeedMultiplier : 1;
      const scrollSpeed = baseSpeed * speedMult;

      const nextGate = getNextPendingGate(state.world, state.plane.x);
      updatePlane(state.plane, ctrl, WORLD.fixedDt, {
        forwardSpeed: scrollSpeed,
        magnetTargetY: nextGate ? nextGate.y : null,
        fuel: state.stats.fuel,
      });

      consumeFuelAndDistance(
        state.stats,
        WORLD.fixedDt,
        scrollSpeed,
        state.plane.turboActive
      );

      updateWorld(state.world, WORLD.fixedDt, scrollSpeed, state.stats.level);

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
            applyGatePass(state.stats, check.perfect);
          } else {
            gate.status = "missed";
            applyGateMiss(state.stats);
          }
        }
      }

      if (state.plane.y >= WORLD.height - 45) {
        state.mode = "gameover";
        gameOverOverlay?.classList.remove("hidden");
      }

      syncBasicHud();
    }
    accumulator -= WORLD.fixedDt;
  }

  renderer.render(state);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
