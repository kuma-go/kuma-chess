import {
  attachProfileFields,
  profileFieldsFromState,
  readProfileState,
  stripProfileFields,
  writeProfileState,
} from "./profileState.js?v=20260903-gameplay99";
import {
  FREE_PROFILE_FRAME_IDS,
  FREE_PROFILE_PORTRAIT_IDS,
  PROFILE_FRAMES,
  PROFILE_PORTRAITS,
  getProfileCosmetic,
} from "./profileCatalog.js?v=20260903-gameplay99";
import { readJsonFromStorage, writeJsonToStorage } from "./storage.js?v=20260903-gameplay99";

export const PLAYER_STATE_KEY = "kumaChessPlayerState";
export const PUZZLE_PROGRESS_KEY = "kumaChessPuzzleClears";
export const PLAYER_STATE_BACKUP_KEY = "kumaChessPlayerStateBackupV1";
export const PUZZLE_PROGRESS_BACKUP_KEY = "kumaChessPuzzleClearsBackupV1";

export const REWARDS = {
  daily: 2,
  puzzle: 5,
  aiWin: 15,
  install: 20,
};

export const COSTS = Object.freeze({
  puzzleHint: 2,
  aiUndo: 5,
});

export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: "easy", reward: 5 }),
  normal: Object.freeze({ id: "normal", reward: 15 }),
  hard: Object.freeze({ id: "hard", reward: 35 }),
  challenge: Object.freeze({ id: "challenge", reward: 100 }),
});

export const DEFAULT_AI_DIFFICULTY = "normal";

export const SKIN_SHOP = [
  { id: "classic", nameKo: "기본", nameEn: "CLASSIC", cost: 0 },
  { id: "bear", nameKo: "곰", nameEn: "BEAR", cost: 80, colorCosts: { w: 40, b: 80 } },
  { id: "rabbit", nameKo: "토끼", nameEn: "RABBIT", cost: 80, colorCosts: { w: 80, b: 40 } },
  { id: "cat", nameKo: "고양이", nameEn: "CAT", cost: 140 },
  { id: "wolf", nameKo: "늑대", nameEn: "WOLF", cost: 180 },
  { id: "sheep", nameKo: "양", nameEn: "SHEEP", cost: 220 },
  { id: "eagle", nameKo: "독수리", nameEn: "EAGLE", cost: 260 },
  { id: "owl", nameKo: "부엉이", nameEn: "OWL", cost: 300 },
  { id: "capybara", nameKo: "카피바라", nameEn: "CAPYBARA", cost: 340 },
  { id: "brownBear", nameKo: "브라운 곰", nameEn: "BROWN BEAR", cost: 0, countsTowardCollection: false, unlockSource: "coupon" },
  { id: "goldBear", nameKo: "황금 곰", nameEn: "GOLD BEAR", cost: 0, countsTowardCollection: false, unlockSource: "collection" },
];

export const COLLECTION_SKINS = SKIN_SHOP.filter((skin) => skin.countsTowardCollection !== false);

export const GOLD_BEAR_PIECES = Object.freeze([
  Object.freeze({ id: "p", nameEn: "Pawn", nameKo: "폰", cost: 500, unlockType: "coin" }),
  Object.freeze({ id: "n", nameEn: "Knight", nameKo: "나이트", cost: 600, unlockType: "coin" }),
  Object.freeze({ id: "r", nameEn: "Rook", nameKo: "룩", target: 100, unlockType: "daily" }),
  Object.freeze({ id: "b", nameEn: "Bishop", nameKo: "비숍", cost: 700, unlockType: "coin" }),
  Object.freeze({ id: "q", nameEn: "Queen", nameKo: "퀸", unlockType: "ad" }),
  Object.freeze({ id: "k", nameEn: "King", nameKo: "킹", cost: 1000, unlockType: "coin" }),
]);

export const HIDDEN_REWARD_COUPON_CLAIM = "coupon:hidden:forestCrown:v1";
const HIDDEN_REWARD_COUPON_HASHES = Object.freeze([
  "c09f7853",
  "aaf7e436",
]);

const EMPTY_RESULT_STATS = Object.freeze({ wins: 0, losses: 0, draws: 0, played: 0 });

function createDefaultStats() {
  return {
    ai: {
      easy: { ...EMPTY_RESULT_STATS },
      normal: { ...EMPTY_RESULT_STATS },
      hard: { ...EMPTY_RESULT_STATS },
      challenge: { ...EMPTY_RESULT_STATS },
    },
    pvp: { wWins: 0, bWins: 0, draws: 0, played: 0 },
  };
}

const DEFAULT_STATE = {
  coins: 100,
  unlockedSkinColors: ["classic:w", "classic:b"],
  ownedProfilePortraits: [...FREE_PROFILE_PORTRAIT_IDS],
  ownedProfileFrames: [...FREE_PROFILE_FRAME_IDS],
  specialPieces: [],
  pendingPieceUnlockNotices: [],
  rewardClaims: [],
  lastDailyRewardDate: "",
  stats: createDefaultStats(),
};

function cloneDefaultState() {
  return {
    ...DEFAULT_STATE,
    unlockedSkinColors: [...DEFAULT_STATE.unlockedSkinColors],
    ownedProfilePortraits: [...DEFAULT_STATE.ownedProfilePortraits],
    ownedProfileFrames: [...DEFAULT_STATE.ownedProfileFrames],
    specialPieces: [...DEFAULT_STATE.specialPieces],
    pendingPieceUnlockNotices: [],
    rewardClaims: [...DEFAULT_STATE.rewardClaims],
    stats: createDefaultStats(),
  };
}

export function skinColorKey(skinId, color) {
  return `${skinId}:${color === "b" ? "b" : "w"}`;
}

function normalizeState(state) {
  const next = { ...cloneDefaultState(), ...(state || {}) };
  next.coins = Math.max(0, Number(next.coins) || 0);
  next.unlockedSkinColors = Array.from(new Set(
    Array.isArray(next.unlockedSkinColors)
      ? next.unlockedSkinColors
      : DEFAULT_STATE.unlockedSkinColors
  ));
  const validPortraits = new Set(PROFILE_PORTRAITS.map((item) => item.id));
  const validFrames = new Set(PROFILE_FRAMES.map((item) => item.id));
  next.ownedProfilePortraits = Array.from(new Set(
    (Array.isArray(next.ownedProfilePortraits) ? next.ownedProfilePortraits : [])
      .map((id) => id === "portrait-hourglass" ? "portrait-180" : id)
      .filter((id) => validPortraits.has(id)),
  ));
  next.ownedProfileFrames = Array.from(new Set(
    (Array.isArray(next.ownedProfileFrames) ? next.ownedProfileFrames : [])
      .filter((id) => validFrames.has(id)),
  ));
  next.rewardClaims = Array.from(new Set(
    Array.isArray(next.rewardClaims) ? next.rewardClaims : []
  ));
  for (const claimId of next.rewardClaims) {
    const match = /^profile-purchase:(portrait|frame):(.+):v1$/.exec(claimId);
    if (!match) continue;
    const [, type, rawId] = match;
    const id = type === "portrait" && rawId === "portrait-hourglass" ? "portrait-180" : rawId;
    const validIds = type === "frame" ? validFrames : validPortraits;
    const ownership = type === "frame" ? next.ownedProfileFrames : next.ownedProfilePortraits;
    if (validIds.has(id) && !ownership.includes(id)) ownership.push(id);
  }
  next.specialPieces = Array.from(new Set(
    Array.isArray(next.specialPieces) ? next.specialPieces.map(normalizeSpecialPieceId).filter(Boolean) : []
  ));
  next.pendingPieceUnlockNotices = normalizePieceUnlockNotices(next.pendingPieceUnlockNotices);
  for (const key of DEFAULT_STATE.unlockedSkinColors) {
    if (!next.unlockedSkinColors.includes(key)) next.unlockedSkinColors.unshift(key);
  }
  for (const id of FREE_PROFILE_PORTRAIT_IDS) {
    if (!next.ownedProfilePortraits.includes(id)) next.ownedProfilePortraits.unshift(id);
  }
  for (const id of FREE_PROFILE_FRAME_IDS) {
    if (!next.ownedProfileFrames.includes(id)) next.ownedProfileFrames.unshift(id);
  }
  const sourceStats = state?.stats || {};
  const defaults = createDefaultStats();
  next.stats = {
    ai: {},
    pvp: normalizePvpStats(sourceStats.pvp, defaults.pvp),
  };
  for (const difficulty of Object.keys(AI_DIFFICULTIES)) {
    next.stats.ai[difficulty] = normalizeResultStats(sourceStats.ai?.[difficulty], defaults.ai[difficulty]);
  }
  return next;
}

function normalizePuzzleClears(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((id) => String(id || "").trim()).filter(Boolean)))
    : [];
}

function safeCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeSpecialPieceId(value) {
  const id = String(value || "").trim();
  if (GOLD_BEAR_PIECES.some((piece) => id === specialPieceKey("goldBear", piece.id))) return id;
  return "";
}

function normalizeResultStats(stats, fallback = EMPTY_RESULT_STATS) {
  const next = { ...fallback, ...(stats || {}) };
  next.wins = safeCount(next.wins);
  next.losses = safeCount(next.losses);
  next.draws = safeCount(next.draws);
  next.played = Math.max(safeCount(next.played), next.wins + next.losses + next.draws);
  return next;
}

function normalizePvpStats(stats, fallback) {
  const next = { ...fallback, ...(stats || {}) };
  next.wWins = safeCount(next.wWins);
  next.bWins = safeCount(next.bWins);
  next.draws = safeCount(next.draws);
  next.played = Math.max(safeCount(next.played), next.wWins + next.bWins + next.draws);
  return next;
}

function totalAiPlayed(stats) {
  return Object.values(stats.ai).reduce((sum, item) => sum + item.played, 0);
}

function questDefinition(skinId, color) {
  const key = skinColorKey(skinId, color);
  if (key === "cat:w") {
    return { type: "puzzle", target: 12 };
  }
  if (key === "cat:b") {
    return { type: "aiPlayed", target: 20 };
  }
  return null;
}

function questProgress(quest, state) {
  if (quest.type === "puzzle") return getClearedPuzzleIds().length;
  if (quest.type === "aiPlayed") return totalAiPlayed(state.stats);
  return 0;
}

function questLabel(quest, progress, language) {
  const capped = Math.min(progress, quest.target);
  if (language === "en") {
    return quest.type === "puzzle"
      ? `Puzzles ${capped}/${quest.target}`
      : `AI plays ${capped}/${quest.target}`;
  }
  if (language === "ja") {
    return quest.type === "puzzle"
      ? `パズル ${capped}/${quest.target}`
      : `AI対戦 ${capped}/${quest.target}回`;
  }
  return quest.type === "puzzle"
    ? `퍼즐 ${capped}/${quest.target}`
    : `AI 대전 ${capped}/${quest.target}회`;
}

function specialPieceKey(skinId, type) {
  return `${skinId}:${type}`;
}

function normalizePieceUnlockNotices(values) {
  const result = [];
  const seen = new Set();
  for (const item of Array.isArray(values) ? values : []) {
    const skinId = SKIN_SHOP.some((skin) => skin.id === item?.skinId) ? item.skinId : "";
    const color = item?.color === "b" ? "b" : "w";
    const type = "pnbrqk".includes(item?.type) ? item.type : "k";
    const id = String(item?.id || "").trim().slice(0, 120);
    if (!id || !skinId || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, skinId, color, type, set: item?.set === true });
  }
  return result.slice(-24);
}

function queuePieceUnlockNotice(state, notice) {
  state.pendingPieceUnlockNotices = normalizePieceUnlockNotices([
    ...(state.pendingPieceUnlockNotices || []),
    notice,
  ]);
}

function getDailyCompletedDays(state) {
  return safeCount(state?.dailyMissions?.totalCompletedDays);
}

function goldBearPieceProgress(piece, state) {
  if (piece.unlockType === "daily") return getDailyCompletedDays(state);
  if (piece.unlockType === "ad") {
    return state.specialPieces.includes(specialPieceKey("goldBear", piece.id)) ? 1 : 0;
  }
  return 0;
}

function formatGoldBearRequirement(piece, progress, language) {
  if (piece.unlockType === "coin") return String(piece.cost);
  if (piece.unlockType === "daily") {
    const value = Math.min(progress, piece.target);
    if (language === "en") return `Daily clears ${value}/${piece.target}`;
    if (language === "ja") return `デイリー ${value}/${piece.target}`;
    return `100일출석 (${value}/${piece.target})`;
  }
  if (language === "en") return progress ? "Ad reward complete" : "Ad reward";
  if (language === "ja") return progress ? "広告報酬 完了" : "広告報酬";
  return progress ? "광고보상 완료" : "광고보상";
}

function syncSpecialSetUnlocks(state) {
  let changed = false;
  const ownedPieces = new Set(state.specialPieces);
  const hasAllGoldBearPieces = GOLD_BEAR_PIECES.every((piece) => (
    ownedPieces.has(specialPieceKey("goldBear", piece.id))
  ));
  if (hasAllGoldBearPieces) {
    let unlockedSet = false;
    for (const color of ["w", "b"]) {
      const key = skinColorKey("goldBear", color);
      if (!state.unlockedSkinColors.includes(key)) {
        state.unlockedSkinColors.push(key);
        changed = true;
        unlockedSet = true;
      }
    }
    if (unlockedSet) {
      queuePieceUnlockNotice(state, {
        id: "unlock-set:goldBear:v1",
        skinId: "goldBear",
        color: "w",
        type: "k",
        set: true,
      });
    }
  }
  if (state.rewardClaims.includes(HIDDEN_REWARD_COUPON_CLAIM)) {
    let unlockedSet = false;
    for (const color of ["w", "b"]) {
      const key = skinColorKey("brownBear", color);
      if (!state.unlockedSkinColors.includes(key)) {
        state.unlockedSkinColors.push(key);
        changed = true;
        unlockedSet = true;
      }
    }
    if (unlockedSet) {
      queuePieceUnlockNotice(state, {
        id: "unlock-set:brownBear:v1",
        skinId: "brownBear",
        color: "b",
        type: "k",
        set: true,
      });
    }
  }
  return changed;
}

function syncQuestUnlocks(state) {
  let changed = false;
  for (const [skinId, color] of [["cat", "w"], ["cat", "b"]]) {
    const quest = questDefinition(skinId, color);
    const key = skinColorKey(skinId, color);
    if (!state.unlockedSkinColors.includes(key) && questProgress(quest, state) >= quest.target) {
      state.unlockedSkinColors.push(key);
      queuePieceUnlockNotice(state, {
        id: `unlock-quest:${key}:v1`,
        skinId,
        color,
        type: "k",
        set: false,
      });
      changed = true;
    }
  }
  return syncSpecialSetUnlocks(state) || changed;
}

export function readPlayerState() {
  const saved = readJsonFromStorage([PLAYER_STATE_KEY, PLAYER_STATE_BACKUP_KEY], null);
  const state = normalizeState(saved.value);
  const profile = readProfileState(saved.value);
  const changed = syncQuestUnlocks(state);
  const progressState = stripProfileFields(state);
  const serialized = JSON.stringify(progressState);
  if (changed || saved.recovered || (saved.key && serialized !== saved.raw)) {
    writeJsonToStorage([PLAYER_STATE_KEY, PLAYER_STATE_BACKUP_KEY], progressState);
    try {
      window.dispatchEvent(new CustomEvent("kuma-state-changed", { detail: attachProfileFields(state, profile) }));
    } catch (_error) {
      // Non-browser validation runs do not need DOM events.
    }
  }
  return attachProfileFields(state, profile);
}

export function writePlayerState(state) {
  const next = normalizeState(state);
  syncQuestUnlocks(next);
  const profileFields = profileFieldsFromState(state);
  const profile = Object.keys(profileFields).length
    ? writeProfileState(profileFields)
    : readProfileState();
  const progressState = stripProfileFields(next);
  writeJsonToStorage([PLAYER_STATE_KEY, PLAYER_STATE_BACKUP_KEY], progressState);
  const combined = attachProfileFields(next, profile);
  try {
    window.dispatchEvent(new CustomEvent("kuma-state-changed", { detail: combined }));
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "kuma-player-state-changed" }, window.location.origin);
    }
  } catch (_error) {
    // Non-browser validation runs do not need DOM events.
  }
  return combined;
}

export function updatePlayerState(mutator) {
  const state = readPlayerState();
  mutator(state);
  return writePlayerState(state);
}

export function consumePieceUnlockNotices() {
  const state = readPlayerState();
  const notices = normalizePieceUnlockNotices(state.pendingPieceUnlockNotices);
  if (!notices.length) return [];
  state.pendingPieceUnlockNotices = [];
  writePlayerState(state);
  return notices;
}

export function getPieceUnlockNotices() {
  return normalizePieceUnlockNotices(readPlayerState().pendingPieceUnlockNotices);
}

export function acknowledgePieceUnlockNotices(noticeIds) {
  const ids = new Set((Array.isArray(noticeIds) ? noticeIds : [noticeIds])
    .map((id) => String(id || "").trim())
    .filter(Boolean));
  if (!ids.size) return getPieceUnlockNotices();
  const state = readPlayerState();
  const notices = normalizePieceUnlockNotices(state.pendingPieceUnlockNotices);
  const remaining = notices.filter((notice) => !ids.has(notice.id));
  if (remaining.length !== notices.length) {
    state.pendingPieceUnlockNotices = remaining;
    writePlayerState(state);
  }
  return remaining;
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function claimDailyReward(date = new Date()) {
  const today = localDateKey(date);
  const claimId = `daily-login:${today}`;
  const state = readPlayerState();
  if (state.rewardClaims.includes(claimId)
    || (state.lastDailyRewardDate && today <= state.lastDailyRewardDate)) {
    return { claimed: false, amount: 0, coins: state.coins };
  }

  state.lastDailyRewardDate = today;
  state.rewardClaims.push(claimId);
  state.coins += REWARDS.daily;
  const saved = writePlayerState(state);
  return { claimed: true, amount: REWARDS.daily, coins: saved.coins };
}

export function grantCoinsOnce(reasonKey, amount) {
  const state = readPlayerState();
  if (state.rewardClaims.includes(reasonKey)) {
    return { awarded: false, amount: 0, coins: state.coins };
  }

  state.rewardClaims.push(reasonKey);
  state.coins += amount;
  const saved = writePlayerState(state);
  return { awarded: true, amount, coins: saved.coins };
}

export function spendCoins(amount) {
  const state = readPlayerState();
  if (state.coins < amount) return { ok: false, coins: state.coins };
  state.coins -= amount;
  const saved = writePlayerState(state);
  return { ok: true, coins: saved.coins };
}

function profileOwnershipKey(type) {
  return type === "frame" ? "ownedProfileFrames" : "ownedProfilePortraits";
}

export function isProfileCosmeticOwned(type, id, state = readPlayerState()) {
  const item = getProfileCosmetic(type, id);
  if (!item) return false;
  return (state[profileOwnershipKey(type)] || []).includes(item.id);
}

export function getProfileCosmeticCollection(state = readPlayerState()) {
  const ownedPortraits = new Set(state.ownedProfilePortraits || []);
  const ownedFrames = new Set(state.ownedProfileFrames || []);
  return {
    coins: state.coins,
    portraits: PROFILE_PORTRAITS.map((item) => ({ ...item, owned: ownedPortraits.has(item.id) })),
    frames: PROFILE_FRAMES.map((item) => ({ ...item, owned: ownedFrames.has(item.id) })),
  };
}

export function purchaseProfileCosmetic(type, id) {
  const item = getProfileCosmetic(type, id);
  const state = readPlayerState();
  if (!item) return { ok: false, reason: "unknown", coins: state.coins };
  const key = profileOwnershipKey(type);
  if (state[key].includes(item.id)) {
    return { ok: true, alreadyOwned: true, coins: state.coins, item };
  }
  if (state.coins < item.cost) {
    return { ok: false, reason: "coins", coins: state.coins, cost: item.cost, item };
  }

  state.coins -= item.cost;
  state[key].push(item.id);
  const claimId = `profile-purchase:${item.type}:${item.id}:v1`;
  if (!state.rewardClaims.includes(claimId)) state.rewardClaims.push(claimId);
  const saved = writePlayerState(state);
  return { ok: true, alreadyOwned: false, coins: saved.coins, cost: item.cost, item };
}

export function purchaseProfileLoadout(portraitId, frameId) {
  const state = readPlayerState();
  const selections = [
    { type: "portrait", item: getProfileCosmetic("portrait", portraitId) },
    { type: "frame", item: getProfileCosmetic("frame", frameId) },
  ];
  if (selections.some(({ item }) => !item)) {
    return { ok: false, reason: "unknown", coins: state.coins, cost: 0, items: [] };
  }

  const pending = selections.filter(({ type, item }) => (
    !state[profileOwnershipKey(type)].includes(item.id)
  ));
  const cost = pending.reduce((total, { item }) => total + item.cost, 0);
  if (state.coins < cost) {
    return { ok: false, reason: "coins", coins: state.coins, cost, items: pending.map(({ item }) => item) };
  }

  state.coins -= cost;
  for (const { type, item } of pending) {
    state[profileOwnershipKey(type)].push(item.id);
    const claimId = `profile-purchase:${item.type}:${item.id}:v1`;
    if (!state.rewardClaims.includes(claimId)) state.rewardClaims.push(claimId);
  }
  const saved = writePlayerState(state);
  return {
    ok: true,
    alreadyOwned: pending.length === 0,
    coins: saved.coins,
    cost,
    items: pending.map(({ item }) => item),
  };
}

export function getSkinInfo(skinId) {
  return SKIN_SHOP.find((skin) => skin.id === skinId) || SKIN_SHOP[0];
}

export function getCollectionSkinColorTotal() {
  return COLLECTION_SKINS.length * 2;
}

export function getOwnedCollectionSkinColorCount(state = readPlayerState()) {
  const owned = new Set(Array.isArray(state.unlockedSkinColors) ? state.unlockedSkinColors : []);
  return COLLECTION_SKINS.reduce((total, skin) => (
    total
      + Number(owned.has(skinColorKey(skin.id, "w")))
      + Number(owned.has(skinColorKey(skin.id, "b")))
  ), 0);
}

export function getAIDifficulty(id = DEFAULT_AI_DIFFICULTY) {
  return AI_DIFFICULTIES[id] || AI_DIFFICULTIES[DEFAULT_AI_DIFFICULTY];
}

export function getSkinCost(skinId, color = "w") {
  const skin = getSkinInfo(skinId);
  return safeCount(skin.colorCosts?.[color === "b" ? "b" : "w"] ?? skin.cost);
}

export function getGoldBearProgress(state = readPlayerState()) {
  const language = state.language || "ko";
  const ownedPieces = new Set(Array.isArray(state.specialPieces) ? state.specialPieces : []);
  const pieces = GOLD_BEAR_PIECES.map((piece) => {
    const key = specialPieceKey("goldBear", piece.id);
    const unlocked = ownedPieces.has(key);
    const progress = goldBearPieceProgress(piece, state);
    return {
      ...piece,
      key,
      unlocked,
      progress,
      target: piece.unlockType === "daily" ? piece.target : piece.unlockType === "ad" ? 1 : 0,
      requirementLabel: formatGoldBearRequirement(piece, progress, language),
      affordable: piece.unlockType === "coin" ? state.coins >= piece.cost : false,
      ready: piece.unlockType === "daily" ? progress >= piece.target : piece.unlockType === "ad" ? unlocked : false,
    };
  });
  const owned = pieces.filter((piece) => piece.unlocked).length;
  return {
    pieces,
    owned,
    total: pieces.length,
    complete: owned >= pieces.length,
  };
}

export function getSkinUnlockState(skinId, color = "w") {
  const normalizedColor = color === "b" ? "b" : "w";
  const state = readPlayerState();
  const key = skinColorKey(skinId, normalizedColor);
  const unlocked = state.unlockedSkinColors.includes(key);
  const skin = getSkinInfo(skinId);
  if (!unlocked && skin.unlockSource === "collection") {
    const progress = getGoldBearProgress(state);
    return {
      unlocked,
      purchasable: false,
      questLabel: state.language === "en"
        ? `Pieces ${progress.owned}/${progress.total}`
        : state.language === "ja"
          ? `駒 ${progress.owned}/${progress.total}`
          : `기물 ${progress.owned}/${progress.total} 수집`,
      progress: progress.owned,
      target: progress.total,
      cost: 0,
    };
  }
  if (!unlocked && skin.unlockSource === "coupon") {
    return {
      unlocked,
      purchasable: false,
      questLabel: state.language === "en"
        ? "Hidden piece"
        : state.language === "ja"
          ? "隠された駒"
          : "숨겨진 기물",
      progress: 0,
      target: 1,
      cost: 0,
    };
  }
  const quest = questDefinition(skinId, normalizedColor);
  const progress = quest ? questProgress(quest, state) : 0;
  return {
    unlocked,
    purchasable: !unlocked && !quest,
    questLabel: quest ? questLabel(quest, progress, state.language) : "",
    progress,
    target: quest?.target || 0,
    cost: getSkinCost(skinId, normalizedColor),
  };
}

export function isSkinUnlocked(skinId, color = "w") {
  return getSkinUnlockState(skinId, color).unlocked;
}

export function unlockSkin(skinId, color = "w") {
  const skin = getSkinInfo(skinId);
  const state = readPlayerState();
  const key = skinColorKey(skinId, color);
  if (state.unlockedSkinColors.includes(key)) {
    return { ok: true, alreadyUnlocked: true, coins: state.coins, skin };
  }
  const quest = questDefinition(skinId, color);
  if (quest) {
    return { ok: false, reason: "quest", coins: state.coins, skin };
  }
  if (skin.unlockSource) {
    return { ok: false, reason: skin.unlockSource, coins: state.coins, skin };
  }
  const cost = getSkinCost(skinId, color);
  if (state.coins < cost) {
    return { ok: false, reason: "coins", coins: state.coins, skin, cost };
  }

  state.coins -= cost;
  state.unlockedSkinColors.push(key);
  const saved = writePlayerState(state);
  return { ok: true, alreadyUnlocked: false, coins: saved.coins, skin, cost };
}

export function unlockGoldBearPiece(pieceId) {
  const piece = GOLD_BEAR_PIECES.find((item) => item.id === pieceId);
  const state = readPlayerState();
  if (!piece) return { ok: false, reason: "unknown", coins: state.coins };
  const key = specialPieceKey("goldBear", piece.id);
  if (state.specialPieces.includes(key)) {
    return { ok: true, alreadyUnlocked: true, coins: state.coins, piece };
  }
  if (piece.unlockType === "coin") {
    if (state.coins < piece.cost) {
      return { ok: false, reason: "coins", coins: state.coins, cost: piece.cost, piece };
    }
    state.coins -= piece.cost;
  } else if (piece.unlockType === "daily") {
    const progress = getDailyCompletedDays(state);
    if (progress < piece.target) {
      return { ok: false, reason: "daily", progress, target: piece.target, coins: state.coins, piece };
    }
  } else if (piece.unlockType === "ad") {
    return { ok: false, reason: "ad", coins: state.coins, piece };
  }
  state.specialPieces.push(key);
  queuePieceUnlockNotice(state, {
    id: `unlock-piece:goldBear:${piece.id}:v1`,
    skinId: "goldBear",
    color: "w",
    type: piece.id,
    set: false,
  });
  const saved = writePlayerState(state);
  const goldProgress = getGoldBearProgress(saved);
  return {
    ok: true,
    alreadyUnlocked: false,
    coins: saved.coins,
    piece,
    setUnlocked: goldProgress.complete,
  };
}

export function grantSpecialPiece(pieceKey) {
  const normalized = normalizeSpecialPieceId(pieceKey);
  const state = readPlayerState();
  if (!normalized) return { ok: false, reason: "unknown", coins: state.coins };
  if (state.specialPieces.includes(normalized)) {
    return { ok: true, alreadyUnlocked: true, coins: state.coins };
  }
  state.specialPieces.push(normalized);
  const [, type] = normalized.split(":");
  queuePieceUnlockNotice(state, {
    id: `unlock-piece:${normalized}:v1`,
    skinId: "goldBear",
    color: "w",
    type,
    set: false,
  });
  const saved = writePlayerState(state);
  return {
    ok: true,
    alreadyUnlocked: false,
    coins: saved.coins,
    setUnlocked: getGoldBearProgress(saved).complete,
  };
}

function couponHash(input) {
  let hash = 2166136261;
  const value = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function redeemHiddenRewardCoupon(input) {
  const state = readPlayerState();
  if (state.unlockedSkinColors.includes(skinColorKey("brownBear", "w"))
    && state.unlockedSkinColors.includes(skinColorKey("brownBear", "b"))) {
    return { ok: true, alreadyUnlocked: true, coins: state.coins };
  }
  if (!HIDDEN_REWARD_COUPON_HASHES.includes(couponHash(input))) {
    return { ok: false, reason: "invalid", coins: state.coins };
  }
  if (!state.rewardClaims.includes(HIDDEN_REWARD_COUPON_CLAIM)) {
    state.rewardClaims.push(HIDDEN_REWARD_COUPON_CLAIM);
  }
  for (const color of ["w", "b"]) {
    const key = skinColorKey("brownBear", color);
    if (!state.unlockedSkinColors.includes(key)) state.unlockedSkinColors.push(key);
  }
  queuePieceUnlockNotice(state, {
    id: "unlock-set:brownBear:v1",
    skinId: "brownBear",
    color: "b",
    type: "k",
    set: true,
  });
  const saved = writePlayerState(state);
  return { ok: true, alreadyUnlocked: false, coins: saved.coins };
}

export function getPlayStats() {
  const stats = readPlayerState().stats;
  return JSON.parse(JSON.stringify(stats));
}

export function recordGameResult(modeOrRecord, resultArg, optionsArg = {}) {
  const record = typeof modeOrRecord === "object" && modeOrRecord !== null
    ? modeOrRecord
    : { mode: modeOrRecord, result: resultArg, ...optionsArg };
  const mode = record.mode === "pvp" ? "pvp" : "ai";
  const saved = updatePlayerState((state) => {
    if (mode === "ai") {
      const difficulty = AI_DIFFICULTIES[record.difficulty] ? record.difficulty : DEFAULT_AI_DIFFICULTY;
      const bucket = state.stats.ai[difficulty];
      const result = normalizeAiResult(record.result, record.playerColor);
      bucket[result] += 1;
      bucket.played += 1;
      return;
    }

    const result = normalizePvpResult(record.result, record.winnerColor);
    state.stats.pvp[result] += 1;
    state.stats.pvp.played += 1;
  });
  return JSON.parse(JSON.stringify(saved.stats));
}

function normalizeAiResult(result, playerColor = "w") {
  if (result === "draw" || result === "draws") return "draws";
  if (result === "win" || result === "wins") return "wins";
  if (result === "loss" || result === "losses") return "losses";
  if (result === "w_win" || result === "b_win") {
    return result[0] === (playerColor === "b" ? "b" : "w") ? "wins" : "losses";
  }
  return "draws";
}

function normalizePvpResult(result, winnerColor) {
  const value = winnerColor || result;
  if (value === "w" || value === "white" || value === "w_win" || value === "wWins") return "wWins";
  if (value === "b" || value === "black" || value === "b_win" || value === "bWins") return "bWins";
  return "draws";
}

export function getClearedPuzzleIds() {
  const saved = readJsonFromStorage([PUZZLE_PROGRESS_KEY, PUZZLE_PROGRESS_BACKUP_KEY], []);
  const cleared = normalizePuzzleClears(saved.value);
  const serialized = JSON.stringify(cleared);
  if (saved.recovered || (saved.key && serialized !== saved.raw)) {
    writeJsonToStorage([PUZZLE_PROGRESS_KEY, PUZZLE_PROGRESS_BACKUP_KEY], cleared);
  }
  return cleared;
}

export function isPuzzleCleared(id) {
  return getClearedPuzzleIds().includes(id);
}

export function markPuzzleCleared(id) {
  let firstClear = false;
  try {
    const cleared = new Set(getClearedPuzzleIds());
    firstClear = !cleared.has(id);
    cleared.add(id);
    writeJsonToStorage([PUZZLE_PROGRESS_KEY, PUZZLE_PROGRESS_BACKUP_KEY], Array.from(cleared));
  } catch (e) {
    return { firstClear: false, reward: { awarded: false, amount: 0, coins: readPlayerState().coins } };
  }

  const reward = firstClear
    ? grantCoinsOnce(`puzzle:${id}`, REWARDS.puzzle)
    : { awarded: false, amount: 0, coins: readPlayerState().coins };

  return { firstClear, reward };
}

export function getPuzzleUnlockCount(puzzles) {
  const cleared = new Set(getClearedPuzzleIds());
  let count = 1;
  for (let i = 0; i < puzzles.length; i += 1) {
    if (!cleared.has(puzzles[i].id)) break;
    count = i + 2;
  }
  return Math.max(1, Math.min(puzzles.length, count));
}

export function isPuzzleUnlocked(index, puzzles) {
  return index < getPuzzleUnlockCount(puzzles);
}
