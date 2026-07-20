import { readPlayerState } from "./playerState.js?v=20260720-puzzles100hint37";

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

const BGM_BLOCKING_SCENES = new Set(["Game", "Puzzle"]);

let audio = null;
let currentTrack = null;
let menuPlaybackWanted = true;
let userActivated = false;
let installed = false;
let sceneHooksInstalled = false;
let liveVolume = 0.35;
let consecutiveFailures = 0;

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
  audio.volume = liveVolume;
  audio.addEventListener("ended", () => {
    consecutiveFailures = 0;
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

function syncPlayback() {
  if (!userActivated && !audio) return;
  const player = ensureAudio();
  player.volume = liveVolume;
  const shouldPlay = userActivated
    && menuPlaybackWanted
    && !document.hidden
    && liveVolume > 0;

  if (!shouldPlay) {
    player.pause();
    return;
  }
  if (!player.paused) return;
  const request = player.play();
  if (request?.catch) request.catch(() => {});
}

function activateFromGesture() {
  userActivated = true;
  syncPlayback();
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

export function installMenuBgm() {
  if (installed) return;
  installed = true;
  liveVolume = clampVolume(readPlayerState().bgmVolume);

  const gestureEvents = ["pointerup", "touchend", "click", "keydown"];
  for (const eventName of gestureEvents) {
    window.addEventListener(eventName, activateFromGesture, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pageshow", syncPlayback, { passive: true });
  window.addEventListener("kuma-state-changed", (event) => {
    setMenuBgmVolume(event.detail?.bgmVolume ?? readPlayerState().bgmVolume);
  });
}

export function installMenuBgmSceneHooks(game) {
  if (sceneHooksInstalled) return;
  sceneHooksInstalled = true;
  for (const scene of game.scene.scenes) {
    const key = scene.sys.settings.key;
    scene.events.on(Phaser.Scenes.Events.START, () => setActiveScene(key));
  }
}
