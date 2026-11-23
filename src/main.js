import { PLANE, WORLD } from "./config.js";
import {
  checkBoundaryCollision,
  circleCollision,
  evaluateGateCross,
} from "./collision.js";
import { createAudioManager } from "./audio.js";
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
  finalizeHighScore,
  getScrollSpeedForLevel,
} from "./scoring.js";
import {
  createUIController,
  loadStoredHighScore,
  loadStoredMuted,
  saveStoredHighScore,
  saveStoredMuted,
} from "./ui.js";
import { createWorld, getNextPendingGate, updateWorld } from "./world.js";

const canvas = document.getElementById("gameCanvas");
const renderer = createRenderer(canvas);
const audio = createAudioManager(loadStoredMuted());

const state = {
  mode: "menu", // menu | playing | paused | gameover
  plane: createPlane(),
  world: createWorld(),
  stats: createGameStats(loadStoredHighScore()),
  particles: [],
  popups: [],
};

const ui = createUIController({
  onStart: startGame,
  onResume: resumeGame,
  onPauseToggle: togglePause,
  onToMenu: goToMenu,
  onMuteToggle: toggleMute,
});

const input = createInputController({
  canvas,
  touchTurboBtn: ui.touchTurboBtn,
  onTogglePause: togglePause,
});

ui.syncMute(audio.isMuted());
ui.showMenu(state.stats.highScore);

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
  audio.unlock();
  input.reset();
  state.mode = "playing";
  state.plane = createPlane();
  state.world = createWorld();
  state.stats = createGameStats(loadStoredHighScore());
  state.particles = [];
  state.popups = [];
  ui.showPlaying();
  ui.updateHud(state.stats, state.plane);
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    input.reset();
    audio.updateEngine(false, false, false, true);
    ui.showPause();
  } else if (state.mode === "paused") {
    resumeGame();
  }
}

function resumeGame() {
  if (state.mode !== "paused") return;
  audio.unlock();
  input.reset();
  state.mode = "playing";
  ui.showPlaying();
}

function goToMenu() {
  input.reset();
  audio.updateEngine(false, false, false, true);
  state.mode = "menu";
  state.plane = createPlane();
  state.world = createWorld();
  state.stats = createGameStats(loadStoredHighScore());
  state.particles = [];
  state.popups = [];
  ui.showMenu(state.stats.highScore);
}

function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  saveStoredMuted(next);
  ui.syncMute(next);
}

function endGame(reasonText) {
  state.mode = "gameover";
  input.reset();
  audio.updateEngine(false, false, false, true);
  audio.playGameOver();

  finalizeHighScore(state.stats);
  if (state.stats.newRecord) {
    saveStoredHighScore(state.stats.highScore);
  }

  ui.updateHud(state.stats, state.plane);
  ui.showGameOver(state.stats, reasonText);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && !e.repeat) {
    if (state.mode === "menu" || state.mode === "gameover") {
      startGame();
    } else if (state.mode === "paused") {
      resumeGame();
    }
  }
});

let lastTime = performance.now();
let accumulator = 0;

function stepPlaying(dt) {
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
  audio.updateEngine(true, state.plane.turboActive, ctrl.climb, state.plane.engineOut);

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
        if (check.perfect) audio.playPerfect(res.multiplier);
        else audio.playPass(res.multiplier);

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
          audio.playLevelUp();
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
        audio.playMiss();
        if (missRes.lostCombo) {
          addPopup(
            state.plane.x,
            state.plane.y - 30,
            "COMBO ZTRACENO",
            "rgba(248, 113, 113, ALPHA)",
            16
          );
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
      audio.playPowerup();
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
        audio.playHit(hitRes.shieldBroken);
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
          return;
        }
      }
    }
  }

  // Kolize s horami nebo bouřkovým mrakem
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
      audio.playHit(true);
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
      return;
    }
  }

  // Částice a popupy
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

  ui.updateHud(state.stats, state.plane);
}

function tick(now) {
  const frameDt = Math.min(WORLD.maxFrameDt, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= WORLD.fixedDt) {
    if (state.mode === "playing") {
      stepPlaying(WORLD.fixedDt);
    } else if (state.mode === "menu") {
      // Jemná animace pozadí v menu
      updateWorld(state.world, WORLD.fixedDt, 110, 1);
      state.plane.y = PLANE.startY + Math.sin(now * 0.0025) * 14;
      state.plane.angle = Math.cos(now * 0.0025) * 0.06;
      state.plane.propPhase = (state.plane.propPhase + 24 * WORLD.fixedDt) % (Math.PI * 2);
    }
    accumulator -= WORLD.fixedDt;
  }

  renderer.render(state, now / 1000);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
