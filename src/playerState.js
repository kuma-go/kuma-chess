export const PLAYER_STATE_KEY = "kumaChessPlayerState";
export const PUZZLE_PROGRESS_KEY = "kumaChessPuzzleClears";

export const REWARDS = {
  daily: 20,
  puzzle: 5,
  aiWin: 15,
  install: 20,
};

export const COSTS = Object.freeze({
  puzzleHint: 2,
});

export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: "easy", reward: 5 }),
  normal: Object.freeze({ id: "normal", reward: 15 }),
  hard: Object.freeze({ id: "hard", reward: 35 }),
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
];

const EMPTY_RESULT_STATS = Object.freeze({ wins: 0, losses: 0, draws: 0, played: 0 });

function createDefaultStats() {
  return {
    ai: {
      easy: { ...EMPTY_RESULT_STATS },
      normal: { ...EMPTY_RESULT_STATS },
      hard: { ...EMPTY_RESULT_STATS },
    },
    pvp: { wWins: 0, bWins: 0, draws: 0, played: 0 },
  };
}

const DEFAULT_STATE = {
  coins: 100,
  unlockedSkinColors: ["classic:w", "classic:b"],
  rewardClaims: [],
  lastDailyRewardDate: "",
  language: "ko",
  soundEnabled: true,
  bgmVolume: 0.35,
  vibrationEnabled: true,
  stats: createDefaultStats(),
};

function cloneDefaultState() {
  return {
    ...DEFAULT_STATE,
    unlockedSkinColors: [...DEFAULT_STATE.unlockedSkinColors],
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
  next.rewardClaims = Array.from(new Set(
    Array.isArray(next.rewardClaims) ? next.rewardClaims : []
  ));
  for (const key of DEFAULT_STATE.unlockedSkinColors) {
    if (!next.unlockedSkinColors.includes(key)) next.unlockedSkinColors.unshift(key);
  }
  next.language = ["ko", "en", "ja"].includes(next.language) ? next.language : "ko";
  next.soundEnabled = next.soundEnabled !== false;
  const hasSavedBgmVolume = Object.prototype.hasOwnProperty.call(state || {}, "bgmVolume");
  const bgmVolume = Number(hasSavedBgmVolume ? state.bgmVolume : undefined);
  next.bgmVolume = Number.isFinite(bgmVolume)
    ? Math.min(1, Math.max(0, bgmVolume))
    : (state?.soundEnabled === false ? 0 : DEFAULT_STATE.bgmVolume);
  next.vibrationEnabled = next.vibrationEnabled !== false;
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

function safeCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
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

function syncQuestUnlocks(state) {
  let changed = false;
  for (const [skinId, color] of [["cat", "w"], ["cat", "b"]]) {
    const quest = questDefinition(skinId, color);
    const key = skinColorKey(skinId, color);
    if (!state.unlockedSkinColors.includes(key) && questProgress(quest, state) >= quest.target) {
      state.unlockedSkinColors.push(key);
      changed = true;
    }
  }
  return changed;
}

export function readPlayerState() {
  try {
    const raw = window.localStorage.getItem(PLAYER_STATE_KEY);
    const state = normalizeState(raw ? JSON.parse(raw) : null);
    if (syncQuestUnlocks(state)) {
      window.localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("kuma-state-changed", { detail: state }));
    }
    return state;
  } catch (e) {
    return cloneDefaultState();
  }
}

export function writePlayerState(state) {
  const next = normalizeState(state);
  syncQuestUnlocks(next);
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

export function getAIDifficulty(id = DEFAULT_AI_DIFFICULTY) {
  return AI_DIFFICULTIES[id] || AI_DIFFICULTIES[DEFAULT_AI_DIFFICULTY];
}

export function getSkinCost(skinId, color = "w") {
  const skin = getSkinInfo(skinId);
  return safeCount(skin.colorCosts?.[color === "b" ? "b" : "w"] ?? skin.cost);
}

export function getSkinUnlockState(skinId, color = "w") {
  const normalizedColor = color === "b" ? "b" : "w";
  const state = readPlayerState();
  const key = skinColorKey(skinId, normalizedColor);
  const unlocked = state.unlockedSkinColors.includes(key);
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
  const cost = getSkinCost(skinId, color);
  if (state.coins < cost) {
    return { ok: false, reason: "coins", coins: state.coins, skin, cost };
  }

  state.coins -= cost;
  state.unlockedSkinColors.push(key);
  const saved = writePlayerState(state);
  return { ok: true, alreadyUnlocked: false, coins: saved.coins, skin, cost };
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
