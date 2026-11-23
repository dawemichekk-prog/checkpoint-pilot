/**
 * Ovládání klávesnicí a dotykem / ukazatelem.
 */

export function createInputController({ canvas, touchTurboBtn, onTogglePause }) {
  const keys = new Set();
  let pointerClimb = false;
  let touchTurbo = false;

  const isClimbKey = (code) =>
    code === "ArrowUp" || code === "KeyW" || code === "Space";
  const isDiveKey = (code) =>
    code === "ArrowDown" || code === "KeyS";
  const isTurboKey = (code) =>
    code === "ShiftLeft" || code === "ShiftRight";

  function onKeyDown(e) {
    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat && typeof onTogglePause === "function") {
        onTogglePause();
      }
      return;
    }

    if (isClimbKey(e.code) || isDiveKey(e.code) || isTurboKey(e.code)) {
      // Zabraň posouvání stránky mezerníkem / šipkami během hraní
      if (e.target === document.body || e.target === canvas) {
        e.preventDefault();
      }
      keys.add(e.code);
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
    pointerClimb = false;
    setTouchTurbo(false);
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    pointerClimb = true;
  }

  function onPointerUp() {
    pointerClimb = false;
  }

  function setTouchTurbo(active) {
    touchTurbo = active;
    if (touchTurboBtn) {
      touchTurboBtn.classList.toggle("active", active);
    }
  }

  function onTurboDown(e) {
    e.preventDefault();
    e.stopPropagation();
    setTouchTurbo(true);
  }

  function onTurboUp(e) {
    e.preventDefault();
    e.stopPropagation();
    setTouchTurbo(false);
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  if (touchTurboBtn) {
    touchTurboBtn.addEventListener("pointerdown", onTurboDown);
    touchTurboBtn.addEventListener("pointerup", onTurboUp);
    touchTurboBtn.addEventListener("pointercancel", onTurboUp);
    touchTurboBtn.addEventListener("pointerleave", onTurboUp);
  }

  return {
    getState() {
      const climb =
        pointerClimb ||
        keys.has("ArrowUp") ||
        keys.has("KeyW") ||
        keys.has("Space");
      const dive = keys.has("ArrowDown") || keys.has("KeyS");
      const turbo =
        touchTurbo || keys.has("ShiftLeft") || keys.has("ShiftRight");
      return { climb, dive, turbo };
    },
    reset() {
      keys.clear();
      pointerClimb = false;
      setTouchTurbo(false);
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (touchTurboBtn) {
        touchTurboBtn.removeEventListener("pointerdown", onTurboDown);
        touchTurboBtn.removeEventListener("pointerup", onTurboUp);
        touchTurboBtn.removeEventListener("pointercancel", onTurboUp);
        touchTurboBtn.removeEventListener("pointerleave", onTurboUp);
      }
    },
  };
}
