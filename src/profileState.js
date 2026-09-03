import { readJsonFromStorage, writeJsonToStorage } from "./storage.js?v=20260904-guides101";
import {
  DEFAULT_PROFILE_FRAME_ID,
  DEFAULT_PROFILE_PORTRAIT_ID,
  getProfileFrame,
  getProfilePortrait,
} from "./profileCatalog.js?v=20260904-guides101";

export const PROFILE_STATE_KEY = "kumaChessProfileState";
export const PROFILE_STATE_BACKUP_KEY = "kumaChessProfileStateBackupV1";

const STATE_VERSION = 2;
const PLAYER_CODE_KEY = "kumaChessPlayerCode";
const PROFILE_KEYS = Object.freeze([
  "displayName",
  "avatar",
  "language",
  "soundEnabled",
  "bgmVolume",
  "vibrationEnabled",
]);

const DEFAULT_PROFILE = Object.freeze({
  version: STATE_VERSION,
  displayName: "",
  avatar: Object.freeze({
    portraitId: DEFAULT_PROFILE_PORTRAIT_ID,
    frameId: DEFAULT_PROFILE_FRAME_ID,
    skinId: "classic",
    color: "w",
  }),
  language: "ko",
  soundEnabled: true,
  bgmVolume: 0.35,
  vibrationEnabled: true,
});

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

export function normalizeDisplayName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replaceAll("/", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function defaultPlayerName() {
  try {
    let code = window.localStorage.getItem(PLAYER_CODE_KEY);
    if (!/^\d{8}$/.test(code || "")) {
      const random = new Uint32Array(1);
      window.crypto?.getRandomValues?.(random);
      code = String((random[0] || Math.floor(Math.random() * 100000000)) % 100000000)
        .padStart(8, "0");
      window.localStorage.setItem(PLAYER_CODE_KEY, code);
    }
    return `Player ${code}`;
  } catch (_error) {
    return "Player 00000000";
  }
}

function normalizeAvatar(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    portraitId: getProfilePortrait(input.portraitId).id,
    frameId: getProfileFrame(input.frameId).id,
    skinId: cleanText(input.skinId || input.skin || "classic", 40) || "classic",
    color: input.color === "b" || input.color === "black" ? "b" : "w",
  };
}

export function normalizeProfile(source = null, legacy = null) {
  const saved = source && typeof source === "object" ? source : {};
  const fallback = legacy && typeof legacy === "object" ? legacy : {};
  const hasSavedBgmVolume = Object.prototype.hasOwnProperty.call(saved, "bgmVolume");
  const hasLegacyBgmVolume = Object.prototype.hasOwnProperty.call(fallback, "bgmVolume");
  const rawVolume = hasSavedBgmVolume
    ? saved.bgmVolume
    : hasLegacyBgmVolume
      ? fallback.bgmVolume
      : undefined;
  const volume = Number(rawVolume);
  const soundEnabled = (saved.soundEnabled ?? fallback.soundEnabled) !== false;
  const language = ["ko", "en", "ja"].includes(saved.language)
    ? saved.language
    : ["ko", "en", "ja"].includes(fallback.language)
      ? fallback.language
      : DEFAULT_PROFILE.language;

  return {
    version: STATE_VERSION,
    displayName: normalizeDisplayName(saved.displayName ?? fallback.displayName) || defaultPlayerName(),
    avatar: normalizeAvatar(saved.avatar ?? fallback.avatar),
    language,
    soundEnabled,
    bgmVolume: Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : ((saved.soundEnabled ?? fallback.soundEnabled) === false ? 0 : DEFAULT_PROFILE.bgmVolume),
    vibrationEnabled: (saved.vibrationEnabled ?? fallback.vibrationEnabled) !== false,
  };
}

export function profileFieldsFromState(state = {}) {
  const result = {};
  if (state.profile && typeof state.profile === "object") {
    Object.assign(result, state.profile);
  }
  for (const key of PROFILE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(state, key)) result[key] = state[key];
  }
  return result;
}

export function stripProfileFields(state = {}) {
  const next = { ...state };
  delete next.profile;
  for (const key of PROFILE_KEYS) delete next[key];
  return next;
}

export function attachProfileFields(state, profile) {
  const normalized = normalizeProfile(profile);
  return {
    ...state,
    profile: normalized,
    displayName: normalized.displayName,
    avatar: { ...normalized.avatar },
    language: normalized.language,
    soundEnabled: normalized.soundEnabled,
    bgmVolume: normalized.bgmVolume,
    vibrationEnabled: normalized.vibrationEnabled,
  };
}

export function readProfileState(legacyState = null) {
  const saved = readJsonFromStorage([PROFILE_STATE_KEY, PROFILE_STATE_BACKUP_KEY], null);
  const profile = normalizeProfile(saved.value, legacyState);
  const serialized = JSON.stringify(profile);
  const hasLegacyProfile = Object.keys(profileFieldsFromState(legacyState || {})).length > 0;
  if (saved.recovered || (saved.key && serialized !== saved.raw) || (!saved.key && hasLegacyProfile)) {
    writeJsonToStorage([PROFILE_STATE_KEY, PROFILE_STATE_BACKUP_KEY], profile);
  }
  return profile;
}

export function writeProfileState(profile) {
  const normalized = normalizeProfile(profile);
  writeJsonToStorage([PROFILE_STATE_KEY, PROFILE_STATE_BACKUP_KEY], normalized);
  try {
    window.dispatchEvent(new CustomEvent("kuma-profile-changed", { detail: normalized }));
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "kuma-profile-changed" }, window.location.origin);
    }
  } catch (_error) {
    // Non-browser validation runs do not need DOM events.
  }
  return normalized;
}
