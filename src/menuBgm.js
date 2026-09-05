import { readPlayerState } from "./playerState.js?v=20260906-accountinfo111";
import { recordAmbientMedalEvent } from "./medals.js?v=20260906-accountinfo111";

const TRACKS = Object.freeze([
  Object.freeze({
    id: "window-little-forest",
    src: "./assets/audio/window-little-forest-a213e3c0.mp3",
    weight: 3,
  }),
  Object.freeze({
    id: "kuma-chess",
    src: "./assets/audio/kuma-chess-78386844.mp3",
    weight: 1,
  }),
  Object.freeze({
    id: "kuma-chess-new",
    src: "./assets/audio/kuma-chess-a38de74e.mp3",
    weight: 1,
  }),
]);

const BGM_BLOCKING_SCENES = new Set(["Game", "Puzzle", "Demo"]);
const IDLE_LISTEN_TARGET_MS = 30 * 60 * 1000;

let audio = null;
let currentTrack = null;
let menuPlaybackWanted = true;
let userActivated = false;
let autoplayAttemptPending = false;
let installed = false;
let sceneHooksInstalled = false;
let liveVolume = 0.35;
let consecutiveFailures = 0;
let idleListeningMs = 0;
let idleSampleAt = 0;
let idleTimer = null;
let idleMedalRecorded = false;

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.35;
  return Math.min(1, Math.max(0, number));
}

function pickWeightedTrack() {
  const total = TRACKS.reduce((sum, track) => sum + track.weight, 0);
  let target = Math.random() * total;
  for (const track of TRACKS) {
    target -= track.weight;
    if (target < 0) return track;
  }
  return TRACKS[0];
}

function chooseNextTrack(avoidCurrent = false) {
  const previous = currentTrack;
  currentTrack = pickWeightedTrack();
  if (avoidCurrent && TRACKS.length > 1 && currentTrack === previous) {
    currentTrack = TRACKS.find((track) => track !== previous) || currentTrack;
  }
  if (!audio) return;
  audio.src = currentTrack.src;
  audio.load();
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.playsInline = true;
  audio.dataset.kumaMenuBgm = "host";
  audio.hidden = true;
  document.body?.append(audio);
  audio.volume = liveVolume;
  audio.addEventListener("ended", () => {
    consecutiveFailures = 0;
    if (currentTrack) {
      recordAmbientMedalEvent({
        eventId: `bgm-track:${currentTrack.id}:v1`,
        type: "bgm-track",
      });
    }
    chooseNextTrack();
    syncPlayback();
  });
  audio.addEventListener("playing", () => {
    consecutiveFailures = 0;
  });
  audio.addEventListener("error", () => {
    consecutiveFailures += 1;
    if (consecutiveFailures >= TRACKS.length) return;
    chooseNextTrack(true);
    syncPlayback();
  });
  chooseNextTrack();
  return audio;
}

function syncPlayback(options = {}) {
  const allowAutoplay = options.allowAutoplay === true;
  if (allowAutoplay) autoplayAttemptPending = true;
  if (!userActivated && !allowAutoplay && !audio) return;
  const player = ensureAudio();
  player.volume = liveVolume;
  const shouldPlay = (userActivated || autoplayAttemptPending)
    && menuPlaybackWanted
    && !document.hidden
    && liveVolume > 0;

  if (!shouldPlay) {
    if (allowAutoplay) autoplayAttemptPending = false;
    player.pause();
    return;
  }
  if (!player.paused) return;
  const request = player.play();
  if (request?.then) {
    request.then(() => {
      autoplayAttemptPending = false;
      userActivated = true;
    }).catch(() => {
      autoplayAttemptPending = false;
    });
  }
}

function activateFromGesture() {
  resetIdleListening();
  autoplayAttemptPending = false;
  userActivated = true;
  syncPlayback();
}

function resetIdleListening() {
  idleListeningMs = 0;
  idleSampleAt = typeof performance !== "undefined" ? performance.now() : Date.now();
}

function sampleIdleListening() {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const delta = idleSampleAt ? Math.min(2000, Math.max(0, now - idleSampleAt)) : 0;
  idleSampleAt = now;
  const listening = audio
    && !audio.paused
    && menuPlaybackWanted
    && !document.body?.classList.contains("game-open")
    && !document.hidden
    && liveVolume > 0;
  if (!listening || idleMedalRecorded) return;
  idleListeningMs += delta;
  if (idleListeningMs < IDLE_LISTEN_TARGET_MS) return;
  idleMedalRecorded = true;
  recordAmbientMedalEvent({ eventId: "bgm-idle-30:v1", type: "bgm-idle-30" });
}

function setActiveScene(sceneKey) {
  menuPlaybackWanted = !BGM_BLOCKING_SCENES.has(sceneKey);
  syncPlayback();
}

export function setMenuBgmVolume(value) {
  liveVolume = clampVolume(value);
  if (audio) audio.volume = liveVolume;
  syncPlayback();
  return liveVolume;
}

export function setMenuBgmPlaybackWanted(wanted) {
  menuPlaybackWanted = Boolean(wanted);
  syncPlayback();
}

export function activateMenuBgm() {
  activateFromGesture();
}

export function getMenuBgmPlaybackState() {
  return {
    hasAudio: Boolean(audio),
    trackId: currentTrack?.id || "",
    currentTime: Number(audio?.currentTime) || 0,
    paused: audio?.paused !== false,
    playbackWanted: menuPlaybackWanted,
  };
}

export function installMenuBgm() {
  if (installed) return;
  installed = true;
  liveVolume = clampVolume(readPlayerState().bgmVolume);

  const gestureEvents = ["pointerup", "touchend", "click", "keydown"];
  for (const eventName of gestureEvents) {
    window.addEventListener(eventName, activateFromGesture, { capture: true, passive: true });
  }
  for (const eventName of ["pointerdown", "touchstart", "wheel"]) {
    window.addEventListener(eventName, resetIdleListening, { capture: true, passive: true });
  }
  resetIdleListening();
  idleTimer = window.setInterval(sampleIdleListening, 1000);
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pageshow", syncPlayback, { passive: true });
  window.addEventListener("kuma-state-changed", (event) => {
    setMenuBgmVolume(event.detail?.bgmVolume ?? readPlayerState().bgmVolume);
  });
  syncPlayback({ allowAutoplay: true });
}

export function installMenuBgmSceneHooks(game) {
  if (sceneHooksInstalled) return;
  sceneHooksInstalled = true;
  for (const scene of game.scene.scenes) {
    const key = scene.sys.settings.key;
    scene.events.on(Phaser.Scenes.Events.START, () => setActiveScene(key));
  }
}
