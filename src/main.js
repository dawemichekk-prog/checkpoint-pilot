import { WORLD } from "./config.js";
import { createInputController } from "./input.js";
import { createPlane, updatePlane } from "./plane.js";
import { createRenderer } from "./render.js";

const canvas = document.getElementById("gameCanvas");
const touchTurboBtn = document.getElementById("touchTurboBtn");
const startBtn = document.getElementById("startBtn");
const menuOverlay = document.getElementById("menuOverlay");

const renderer = createRenderer(canvas);
const input = createInputController({ canvas, touchTurboBtn });

const state = {
  mode: "menu",
  level: 1,
  plane: createPlane(),
};

let lastTime = performance.now();
let accumulator = 0;

if (startBtn) {
  startBtn.addEventListener("click", () => {
    state.mode = "playing";
    state.plane = createPlane();
    menuOverlay?.classList.add("hidden");
  });
}

function tick(now) {
  const frameDt = Math.min(WORLD.maxFrameDt, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= WORLD.fixedDt) {
    if (state.mode === "playing") {
      updatePlane(state.plane, input.getState(), WORLD.fixedDt);
      if (state.plane.y > WORLD.height - 40) {
        state.plane.y = WORLD.height - 40;
        state.plane.vy = 0;
      }
    }
    accumulator -= WORLD.fixedDt;
  }

  renderer.render(state);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
