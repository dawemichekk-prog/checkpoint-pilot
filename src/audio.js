/**
 * Procedurální syntéza zvuků a jemného vrnění motoru přes Web Audio API.
 */
export function createAudioManager(initialMuted = false) {
  let ctx = null;
  let muted = Boolean(initialMuted);
  let engineOsc = null;
  let engineGain = null;

  function ensureContext() {
    if (muted) return null;
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        ctx = new AudioCtx();
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  }

  function playTone(freqStart, freqEnd, duration, type = "sine", volume = 0.14, delay = 0) {
    const audio = ensureContext();
    if (!audio) return;
    try {
      const t0 = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t0);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + duration);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch {
      // Ignoruj případné chyby AudioContextu v headless prostředí
    }
  }

  function updateEngine(active, turbo, climb, engineOut) {
    if (muted || !active || engineOut) {
      if (engineGain && ctx) {
        try {
          engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        } catch {}
      }
      return;
    }

    const audio = ensureContext();
    if (!audio) return;

    try {
      if (!engineOsc) {
        engineOsc = audio.createOscillator();
        const filter = audio.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 260;
        engineGain = audio.createGain();
        engineGain.gain.value = 0.0001;
        engineOsc.type = "sawtooth";
        engineOsc.frequency.value = 72;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(audio.destination);
        engineOsc.start();
      }

      const targetFreq = turbo ? 116 : climb ? 92 : 70;
      const targetVol = turbo ? 0.045 : 0.026;
      engineOsc.frequency.setTargetAtTime(targetFreq, audio.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(targetVol, audio.currentTime, 0.06);
    } catch {}
  }

  return {
    unlock() {
      ensureContext();
    },
    setMuted(nextMuted) {
      muted = Boolean(nextMuted);
      if (muted && engineGain && ctx) {
        try {
          engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
        } catch {}
      }
    },
    isMuted() {
      return muted;
    },
    updateEngine,
    playPass(multiplier = 1) {
      const boost = Math.min(200, (multiplier - 1) * 40);
      playTone(460 + boost, 660 + boost, 0.14, "triangle", 0.14);
    },
    playPerfect(multiplier = 1) {
      const boost = Math.min(240, (multiplier - 1) * 40);
      playTone(587 + boost, 587 + boost, 0.1, "triangle", 0.15, 0);
      playTone(784 + boost, 988 + boost, 0.18, "sine", 0.16, 0.07);
    },
    playMiss() {
      playTone(240, 155, 0.16, "sine", 0.09);
    },
    playPowerup() {
      playTone(440, 660, 0.1, "sine", 0.13, 0);
      playTone(660, 880, 0.14, "triangle", 0.14, 0.08);
    },
    playHit(shieldBroken = false) {
      if (shieldBroken) {
        playTone(620, 260, 0.2, "triangle", 0.15);
      } else {
        playTone(170, 62, 0.24, "sawtooth", 0.16);
      }
    },
    playLevelUp() {
      playTone(523, 523, 0.09, "triangle", 0.13, 0);
      playTone(659, 659, 0.09, "triangle", 0.13, 0.09);
      playTone(784, 1046, 0.22, "triangle", 0.15, 0.18);
    },
    playGameOver() {
      playTone(320, 220, 0.18, "sawtooth", 0.12, 0);
      playTone(220, 110, 0.34, "sawtooth", 0.13, 0.16);
    },
  };
}
