import { STORAGE_KEYS, getSkyThemeForLevel } from "./config.js";

/**
 * Spravuje DOM rozhraní: Menu, HUD, Pauza, Game Over a ukládání rekordu do localStorage.
 */
export function loadStoredHighScore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.highScore);
    const val = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function saveStoredHighScore(score) {
  try {
    localStorage.setItem(STORAGE_KEYS.highScore, String(Math.floor(score)));
  } catch {}
}

export function loadStoredMuted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.muted) === "1";
  } catch {
    return false;
  }
}

export function saveStoredMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEYS.muted, muted ? "1" : "0");
  } catch {}
}

export function createUIController(callbacks) {
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
  const hudTimeOfDay = document.getElementById("hudTimeOfDay");

  const muteBtn = document.getElementById("muteBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const touchTurboBtn = document.getElementById("touchTurboBtn");

  const menuOverlay = document.getElementById("menuOverlay");
  const menuHighScore = document.getElementById("menuHighScore");
  const startBtn = document.getElementById("startBtn");
  const menuMuteBtn = document.getElementById("menuMuteBtn");

  const pauseOverlay = document.getElementById("pauseOverlay");
  const resumeBtn = document.getElementById("resumeBtn");
  const restartFromPauseBtn = document.getElementById("restartFromPauseBtn");
  const toMenuFromPauseBtn = document.getElementById("toMenuFromPauseBtn");

  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverReason = document.getElementById("gameOverReason");
  const newRecordBanner = document.getElementById("newRecordBanner");
  const finalScore = document.getElementById("finalScore");
  const finalBest = document.getElementById("finalBest");
  const finalDistance = document.getElementById("finalDistance");
  const finalGates = document.getElementById("finalGates");
  const finalCombo = document.getElementById("finalCombo");
  const finalLevel = document.getElementById("finalLevel");
  const retryBtn = document.getElementById("retryBtn");
  const toMenuBtn = document.getElementById("toMenuBtn");

  const isTouchEnvironment = () =>
    window.matchMedia?.("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 900;

  startBtn?.addEventListener("click", () => callbacks.onStart?.());
  retryBtn?.addEventListener("click", () => callbacks.onStart?.());
  resumeBtn?.addEventListener("click", () => callbacks.onResume?.());
  restartFromPauseBtn?.addEventListener("click", () => callbacks.onStart?.());
  toMenuFromPauseBtn?.addEventListener("click", () => callbacks.onToMenu?.());
  toMenuBtn?.addEventListener("click", () => callbacks.onToMenu?.());
  pauseBtn?.addEventListener("click", () => callbacks.onPauseToggle?.());
  muteBtn?.addEventListener("click", () => callbacks.onMuteToggle?.());
  menuMuteBtn?.addEventListener("click", () => callbacks.onMuteToggle?.());

  return {
    touchTurboBtn,
    syncMute(muted) {
      if (muteBtn) muteBtn.textContent = muted ? "🔇" : "🔊";
      if (menuMuteBtn) {
        menuMuteBtn.textContent = muted ? "Zvuk: Ztlumený" : "Zvuk: Zapnutý";
      }
    },
    showMenu(highScore) {
      if (menuHighScore) menuHighScore.textContent = String(highScore);
      menuOverlay?.classList.remove("hidden");
      pauseOverlay?.classList.add("hidden");
      gameOverOverlay?.classList.add("hidden");
      hudEl?.classList.add("hidden");
      touchTurboBtn?.classList.add("hidden");
    },
    showPlaying() {
      menuOverlay?.classList.add("hidden");
      pauseOverlay?.classList.add("hidden");
      gameOverOverlay?.classList.add("hidden");
      hudEl?.classList.remove("hidden");
      if (touchTurboBtn) {
        touchTurboBtn.classList.toggle("hidden", !isTouchEnvironment());
      }
    },
    showPause() {
      pauseOverlay?.classList.remove("hidden");
      touchTurboBtn?.classList.add("hidden");
    },
    showGameOver(stats, reasonText) {
      touchTurboBtn?.classList.add("hidden");
      if (gameOverReason) gameOverReason.textContent = reasonText.toUpperCase();
      if (newRecordBanner) {
        newRecordBanner.classList.toggle("hidden", !stats.newRecord);
      }
      if (finalScore) finalScore.textContent = String(Math.floor(stats.score));
      if (finalBest) finalBest.textContent = String(stats.highScore);
      if (finalDistance) finalDistance.textContent = `${Math.floor(stats.distanceMeters)} m`;
      if (finalGates) {
        finalGates.textContent = `${stats.checkpointsPassed} (${stats.perfectCount})`;
      }
      if (finalCombo) finalCombo.textContent = `×${stats.maxCombo}`;
      if (finalLevel) finalLevel.textContent = String(stats.level);
      gameOverOverlay?.classList.remove("hidden");
    },
    updateHud(stats, plane) {
      if (hudScore) hudScore.textContent = String(Math.floor(stats.score));
      if (hudCombo) {
        hudCombo.textContent = `×${stats.multiplier}`;
        hudCombo.classList.toggle("hot", stats.multiplier === 2 || stats.multiplier === 3);
        hudCombo.classList.toggle("max", stats.multiplier >= 5);
      }
      if (hudDistance) hudDistance.textContent = `${Math.floor(stats.distanceMeters)} m`;
      if (hudCheckpoints) hudCheckpoints.textContent = `${stats.checkpointsPassed} bran`;

      const fuelPct = Math.max(0, Math.min(100, stats.fuel));
      if (hudFuelText) hudFuelText.textContent = `${Math.ceil(fuelPct)}%`;
      if (hudFuelBar) {
        hudFuelBar.style.width = `${fuelPct}%`;
        hudFuelBar.classList.toggle("low", fuelPct <= 25);
        hudFuelBar.classList.toggle("warn", fuelPct > 25 && fuelPct <= 50);
      }

      if (hudLevel) hudLevel.textContent = `Úroveň ${stats.level}`;
      if (hudTimeOfDay) hudTimeOfDay.textContent = getSkyThemeForLevel(stats.level).name;

      if (hudLives) {
        let html = "";
        for (let i = 0; i < 3; i++) {
          html += i < stats.lives
            ? `<span aria-hidden="true">❤️</span>`
            : `<span class="heart-lost" aria-hidden="true">❤️</span>`;
        }
        hudLives.innerHTML = html;
      }

      if (hudPowerups) {
        const chips = [];
        if (plane.hasShield) chips.push(`<span class="power-chip">🛡️ Štít</span>`);
        if (plane.magnetTimer > 0) {
          chips.push(`<span class="power-chip">🧲 ${Math.ceil(plane.magnetTimer)}s</span>`);
        }
        hudPowerups.innerHTML = chips.join("");
      }
    },
  };
}
