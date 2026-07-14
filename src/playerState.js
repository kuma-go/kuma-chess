export const PLAYER_STATE_KEY = "kumaChessPlayerState";
export const PUZZLE_PROGRESS_KEY = "kumaChessPuzzleClears";

export const REWARDS = {
  daily: 20,
  puzzle: 5,
  aiWin: 15,
};

export const SKIN_SHOP = [
  { id: "classic", nameKo: "기본", nameEn: "CLASSIC", cost: 0 },
  { id: "bear", nameKo: "곰", nameEn: "BEAR", cost: 80 },
  { id: "rabbit", nameKo: "토끼", nameEn: "RABBIT", cost: 80 },
  { id: "cat", nameKo: "고양이", nameEn: "CAT", cost: 140 },
  { id: "wolf", nameKo: "늑대", nameEn: "WOLF", cost: 180 },
  { id: "sheep", nameKo: "양", nameEn: "SHEEP", cost: 220 },
  { id: "eagle", nameKo: "독수리", nameEn: "EAGLE", cost: 260 },
  { id: "owl", nameKo: "부엉이", nameEn: "OWL", cost: 300 },
  { id: "capybara", nameKo: "카피바라", nameEn: "CAPYBARA", cost: 340 },
];

const DEFAULT_STATE = {
  coins: 100,
  unlockedSkinColors: ["classic:w", "classic:b"],
  rewardClaims: [],
  lastDailyRewardDate: "",
  language: "ko",
  soundEnabled: true,
  vibrationEnabled: true,
};

function cloneDefaultState() {
  return {
    ...DEFAULT_STATE,
    unlockedSkinColors: [...DEFAULT_STATE.unlockedSkinColors],
    rewardClaims: [...DEFAULT_STATE.rewardClaims],
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
  next.rewardClaims = Array.from(new Set(
    Array.isArray(next.rewardClaims) ? next.rewardClaims : []
  ));
  for (const key of DEFAULT_STATE.unlockedSkinColors) {
    if (!next.unlockedSkinColors.includes(key)) next.unlockedSkinColors.unshift(key);
  }
  next.language = ["ko", "en", "ja"].includes(next.language) ? next.language : "ko";
  next.soundEnabled = next.soundEnabled !== false;
  next.vibrationEnabled = next.vibrationEnabled !== false;
  return next;
}

export function readPlayerState() {
  try {
    const raw = window.localStorage.getItem(PLAYER_STATE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return cloneDefaultState();
  }
}

export function writePlayerState(state) {
  const next = normalizeState(state);
  try {
    window.localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("kuma-state-changed", { detail: next }));
  } catch (e) {
    // Local progress is optional; gameplay should continue even if storage is unavailable.
  }
  return next;
}

export function updatePlayerState(mutator) {
  const state = readPlayerState();
  mutator(state);
  return writePlayerState(state);
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function claimDailyReward() {
  const today = localDateKey();
  const state = readPlayerState();
  if (state.lastDailyRewardDate === today) {
    return { claimed: false, amount: 0, coins: state.coins };
  }

  state.lastDailyRewardDate = today;
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

export function getSkinInfo(skinId) {
  return SKIN_SHOP.find((skin) => skin.id === skinId) || SKIN_SHOP[0];
}

export function isSkinUnlocked(skinId, color = "w") {
  return readPlayerState().unlockedSkinColors.includes(skinColorKey(skinId, color));
}

export function unlockSkin(skinId, color = "w") {
  const skin = getSkinInfo(skinId);
  const state = readPlayerState();
  const key = skinColorKey(skinId, color);
  if (state.unlockedSkinColors.includes(key)) {
    return { ok: true, alreadyUnlocked: true, coins: state.coins, skin };
  }
  if (state.coins < skin.cost) {
    return { ok: false, reason: "coins", coins: state.coins, skin };
  }

  state.coins -= skin.cost;
  state.unlockedSkinColors.push(key);
  const saved = writePlayerState(state);
  return { ok: true, alreadyUnlocked: false, coins: saved.coins, skin };
}

export function getClearedPuzzleIds() {
  try {
    const raw = window.localStorage.getItem(PUZZLE_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
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
    window.localStorage.setItem(PUZZLE_PROGRESS_KEY, JSON.stringify(Array.from(cleared)));
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
