import { readPlayerState } from "./playerState.js?v=20260716-mobile25";

const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

const HAPTIC_PATTERNS = Object.freeze({
  ui: 10,
  move: 16,
  capture: [24, 16, 34],
  check: [18, 18, 28],
  correct: [14, 12, 22],
  success: [16, 22, 24, 22, 36],
  reward: [12, 18, 12, 18, 28],
  purchase: [14, 16, 22, 16, 32],
  error: [42, 26, 42],
  win: [18, 22, 26, 22, 42],
  draw: [18, 24, 18],
});

let audioContext = null;
let masterGain = null;
let unlockInstalled = false;
let pendingSoundType = null;
let resumePromise = null;
let audioUnlocked = false;
let foregroundRecoveryTimer = 0;
let lastPrimeAt = 0;

function stateAllows(key) {
  const state = readPlayerState();
  return key === "sound" ? state.soundEnabled !== false : state.vibrationEnabled !== false;
}

function ensureAudioContext() {
  if (!AudioContextCtor) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.78;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

function startSilentBuffer(context) {
  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(masterGain);
  source.start(0);
}

function flushPendingSound() {
  if (!audioUnlocked || !pendingSoundType) return;
  const type = pendingSoundType;
  pendingSoundType = null;
  playPattern(type);
}

function resetAudioGraph() {
  const context = audioContext;
  audioContext = null;
  masterGain = null;
  resumePromise = null;
  audioUnlocked = false;
  if (context && context.state !== "closed") context.close().catch(() => {});
}

function settleWithTimeout(promise, timeout = 650) {
  return Promise.race([
    promise.then(() => true).catch(() => false),
    new Promise((resolve) => window.setTimeout(() => resolve(false), timeout)),
  ]);
}

export function primeAudioFromGesture(force = false) {
  if (!force && !stateAllows("sound")) return false;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (audioContext && now - lastPrimeAt < 80) return audioUnlocked;
  lastPrimeAt = now;
  const context = ensureAudioContext();
  if (!context) return false;

  try {
    // This must run synchronously inside touchend/pointerup for iOS Safari.
    startSilentBuffer(context);
    const finish = () => {
      audioUnlocked = context.state === "running";
      if (audioUnlocked) Promise.resolve().then(flushPendingSound);
      return audioUnlocked;
    };

    if (context.state === "running") {
      finish();
      return true;
    }

    if (!resumePromise) {
      resumePromise = context.resume()
        .then(finish)
        .catch(() => false)
        .finally(() => { resumePromise = null; });
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function unlockAudio(force = false) {
  if (!force && !stateAllows("sound")) return false;
  const context = ensureAudioContext();
  if (!context) return false;
  try {
    if (context.state !== "running") {
      if (!resumePromise) {
        resumePromise = context.resume()
          .then(() => context.state === "running")
          .catch(() => false)
          .finally(() => { resumePromise = null; });
      }
      const resumed = await resumePromise;
      if (!resumed) return false;
    }

    audioUnlocked = true;
    flushPendingSound();
    return true;
  } catch (error) {
    return false;
  }
}

export function installFeedbackUnlock() {
  if (unlockInstalled) return;
  unlockInstalled = true;
  const prime = () => {
    primeAudioFromGesture();
  };
  window.addEventListener("pointerup", prime, { capture: true, passive: true });
  window.addEventListener("touchend", prime, { capture: true, passive: true });
  window.addEventListener("click", prime, { capture: true, passive: true });
  window.addEventListener("keydown", prime, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) recoverAudioAfterForeground();
  });
  window.addEventListener("pageshow", recoverAudioAfterForeground, { passive: true });
}

async function recoverAudioAfterForeground() {
  window.clearTimeout(foregroundRecoveryTimer);
  if (!audioContext || !audioUnlocked || !stateAllows("sound")) return;

  const context = audioContext;
  const before = context.currentTime;
  if (context.state !== "running" && !(await settleWithTimeout(context.resume()))) {
    resetAudioGraph();
    return;
  }

  foregroundRecoveryTimer = window.setTimeout(async () => {
    if (audioContext !== context) return;
    const stalled = context.state !== "running" || context.currentTime <= before + 0.001;
    if (!stalled) return;
    const suspended = await settleWithTimeout(context.suspend());
    const resumed = suspended && await settleWithTimeout(context.resume());
    if (!resumed) {
      resetAudioGraph();
      return;
    }
    const verifyAt = context.currentTime;
    window.setTimeout(() => {
      if (audioContext === context && (context.state !== "running" || context.currentTime <= verifyAt + 0.001)) {
        resetAudioGraph();
      }
    }, 180);
  }, 180);
}

function tone(frequency, duration, options = {}) {
  const context = audioContext;
  if (!context || context.state !== "running" || !masterGain) return;
  const when = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(Math.max(40, frequency), when);
  if (options.toFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.toFrequency), when + duration);
  }
  const level = Math.max(0.0001, options.gain || 0.1);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + Math.min(0.015, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.03);
}

function noise(duration = 0.08, options = {}) {
  const context = audioContext;
  if (!context || context.state !== "running" || !masterGain) return;
  const when = context.currentTime + (options.delay || 0);
  const frames = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.value = options.frequency || 900;
  gain.gain.setValueAtTime(options.gain || 0.07, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(when);
}

function playPattern(type) {
  switch (type) {
    case "ui":
      tone(620, 0.045, { gain: 0.055, type: "sine", toFrequency: 760 });
      break;
    case "move":
      tone(210, 0.065, { gain: 0.075, type: "triangle", toFrequency: 165 });
      noise(0.035, { gain: 0.028, frequency: 1100 });
      break;
    case "capture":
      tone(130, 0.12, { gain: 0.13, type: "triangle", toFrequency: 75 });
      noise(0.1, { gain: 0.105, frequency: 650 });
      break;
    case "check":
      tone(740, 0.11, { gain: 0.09, type: "triangle", toFrequency: 1040 });
      tone(1110, 0.13, { delay: 0.09, gain: 0.08, type: "sine" });
      break;
    case "correct":
      tone(590, 0.09, { gain: 0.07, type: "sine" });
      tone(880, 0.12, { delay: 0.07, gain: 0.085, type: "sine" });
      break;
    case "reward":
      tone(980, 0.09, { gain: 0.075, type: "sine" });
      tone(1320, 0.11, { delay: 0.07, gain: 0.08, type: "sine" });
      tone(1760, 0.15, { delay: 0.15, gain: 0.075, type: "sine" });
      break;
    case "purchase":
      tone(520, 0.1, { gain: 0.075, type: "triangle" });
      tone(780, 0.12, { delay: 0.08, gain: 0.085, type: "triangle" });
      tone(1170, 0.17, { delay: 0.17, gain: 0.08, type: "sine" });
      break;
    case "error":
      tone(190, 0.13, { gain: 0.105, type: "sawtooth", toFrequency: 145 });
      tone(160, 0.14, { delay: 0.16, gain: 0.095, type: "sawtooth", toFrequency: 120 });
      break;
    case "win":
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone(frequency, index === 3 ? 0.32 : 0.18, {
          delay: index * 0.12,
          gain: index === 3 ? 0.11 : 0.085,
          type: index % 2 ? "triangle" : "sine",
        });
      });
      break;
    case "draw":
      tone(440, 0.16, { gain: 0.07, type: "triangle" });
      tone(392, 0.22, { delay: 0.14, gain: 0.065, type: "triangle" });
      break;
    case "success":
    default:
      tone(523, 0.1, { gain: 0.07, type: "sine" });
      tone(784, 0.12, { delay: 0.09, gain: 0.08, type: "sine" });
      tone(1047, 0.18, { delay: 0.18, gain: 0.075, type: "sine" });
      break;
  }
}

export function isVibrationSupported() {
  return !!getNativeHaptics() || (typeof navigator !== "undefined" && typeof navigator.vibrate === "function");
}

function getNativeHaptics() {
  if (typeof window === "undefined") return null;
  return window.KumaNativeHaptics || window.Capacitor?.Plugins?.Haptics || null;
}

function playNativeHaptic(type) {
  const haptics = getNativeHaptics();
  if (!haptics) return false;
  try {
    let action = null;
    if (["success", "reward", "purchase", "win", "correct"].includes(type) && haptics.notification) {
      action = haptics.notification({ type: "SUCCESS" });
    } else if (type === "error" && haptics.notification) {
      action = haptics.notification({ type: "ERROR" });
    } else if (haptics.impact) {
      const style = ["capture", "check"].includes(type) ? "HEAVY" : type === "move" ? "MEDIUM" : "LIGHT";
      action = haptics.impact({ style });
    } else if (haptics.vibrate) {
      action = haptics.vibrate({ duration: 24 });
    }
    if (!action) return false;
    Promise.resolve(action).catch(() => {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.ui);
      }
    });
    return true;
  } catch (error) {
    return false;
  }
}

export function vibrateFeedback(type = "ui", force = false) {
  if (!force && !stateAllows("vibration")) return false;
  if (playNativeHaptic(type)) return true;
  if (!isVibrationSupported()) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.ui);
  } catch (error) {
    return false;
  }
}

export function playFeedback(type = "ui", options = {}) {
  const withVibration = options.vibrate !== false;
  if (withVibration) vibrateFeedback(type, options.forceVibration === true);
  if (!options.forceSound && !stateAllows("sound")) return;
  if (audioUnlocked && audioContext?.state === "running") {
    playPattern(type);
    return;
  }
  pendingSoundType = type;
}

export function stopFeedback() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(0); } catch (error) { /* optional */ }
  }
}
