import { updatePlayerState, readPlayerState } from "./playerState.js?v=20260903-online94";
import { recordDailyMissionDay } from "./medals.js?v=20260903-online94";

const STATE_VERSION = 2;
const EVENT_ID_LIMIT = 160;
const COMPLETED_DATE_LIMIT = 140;
const ALL_CLEAR_REWARD = 5;

const MISSION_POOLS = Object.freeze({
  easy: Object.freeze([
    mission("puzzle-1", "puzzleCompletions", 1, 2,
      { ko: "퍼즐 완료하기", en: "Complete a puzzle", ja: "パズルを完成する" }),
    mission("ai-play-1", "aiGames", 1, 2,
      { ko: "AI 대전 완료하기", en: "Finish an AI game", ja: "AI対戦を完了する" }),
    mission("move-12", "playerMoves", 12, 2,
      { ko: "기물 12회 움직이기", en: "Make 12 moves", ja: "駒を12回動かす" }),
    mission("capture-3", "captures", 3, 2,
      { ko: "상대 기물 3개 잡기", en: "Capture 3 pieces", ja: "相手の駒を3個取る" }),
    mission("minigame-play-1", "miniGameCompletions", 1, 2,
      { ko: "미니게임 1회 플레이", en: "Play a mini-game", ja: "ミニゲームを1回プレイ" }),
  ]),
  normal: Object.freeze([
    mission("puzzle-2", "puzzleCompletions", 2, 4,
      { ko: "퍼즐 2개 완료하기", en: "Complete 2 puzzles", ja: "パズルを2問完成する" }),
    mission("ai-win-1", "aiWins", 1, 4,
      { ko: "AI 대전 승리하기", en: "Win an AI game", ja: "AI対戦に勝利する" }),
    mission("check-2", "checks", 2, 4,
      { ko: "체크 2회 하기", en: "Give check twice", ja: "チェックを2回かける" }),
    mission("queen-capture-3", "queenCaptures", 3, 4,
      { ko: "여왕으로 3개 잡기", en: "Capture 3 pieces with a queen", ja: "クイーンで3個取る" }),
    mission("minigame-win-1", "miniGameWins", 1, 4,
      { ko: "미니게임에서 1회 승리", en: "Win a mini-game", ja: "ミニゲームで1回勝利" }),
  ]),
  challenge: Object.freeze([
    mission("puzzle-no-hint-2", "puzzleNoHint", 2, 7,
      { ko: "힌트 없이 퍼즐 2개 완료", en: "Solve 2 puzzles without hints", ja: "ヒントなしでパズルを2問完成" }),
    mission("normal-ai-win-1", "normalPlusAiWins", 1, 7,
      { ko: "보통 이상 AI에게 승리", en: "Beat Normal or Hard AI", ja: "ふつう以上のAIに勝利" }),
    mission("capture-8", "captures", 8, 7,
      { ko: "상대 기물 8개 잡기", en: "Capture 8 pieces", ja: "相手の駒を8個取る" }),
    mission("checkmate-1", "checkmates", 1, 7,
      { ko: "체크메이트로 승리하기", en: "Win by checkmate", ja: "チェックメイトで勝利" }),
    mission("minigame-variety-3", "miniGameVariety", 3, 7,
      { ko: "서로 다른 미니게임 3종 플레이", en: "Play 3 different mini-games", ja: "3種類のミニゲームをプレイ" }),
  ]),
});

export const DAILY_MISSION_REWARDS = Object.freeze({
  easy: 2,
  normal: 4,
  challenge: 7,
  allClear: ALL_CLEAR_REWARD,
});

function mission(id, metric, target, reward, name) {
  return Object.freeze({ id, metric, target, reward, name: Object.freeze(name) });
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeId(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim().slice(0, 180)
    : "";
}

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayNumber(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectedMissionIds(dateKey) {
  return Object.entries(MISSION_POOLS).map(([tier, pool]) => {
    const index = hashText(`${dateKey}:${tier}:kuma-chess`) % pool.length;
    return pool[index].id;
  });
}

function missionById(id) {
  for (const pool of Object.values(MISSION_POOLS)) {
    const found = pool.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

function uniqueLimited(values, limit) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result.slice(-limit);
}

function emptyDailyState(dateKey) {
  return {
    version: STATE_VERSION,
    dateKey,
    latestDateKey: dateKey,
    missionIds: selectedMissionIds(dateKey),
    progress: {},
    completedAt: {},
    processedEventIds: [],
    miniGamesPlayed: [],
    pendingRewards: [],
    completedDates: [],
    currentStreak: 0,
    bestStreak: 0,
    totalCompletedDays: 0,
    lastCompletedDate: "",
    allClearRewarded: false,
    noticeRevision: 1,
    seenRevision: 0,
  };
}

function normalizeDailyState(source, requestedDateKey) {
  const input = source && typeof source === "object" ? source : {};
  const latestDateKey = String(input.latestDateKey || input.dateKey || requestedDateKey);
  const effectiveDateKey = requestedDateKey < latestDateKey ? latestDateKey : requestedDateKey;
  const dateChanged = String(input.dateKey || "") !== effectiveDateKey;
  const next = dateChanged ? {
    ...emptyDailyState(effectiveDateKey),
    completedDates: input.completedDates,
    pendingRewards: input.pendingRewards,
    currentStreak: input.currentStreak,
    bestStreak: input.bestStreak,
    totalCompletedDays: input.totalCompletedDays,
    lastCompletedDate: input.lastCompletedDate,
    noticeRevision: Math.max(1, count(input.noticeRevision)) + 1,
    seenRevision: count(input.seenRevision),
  } : {
    ...emptyDailyState(effectiveDateKey),
    ...input,
  };

  next.version = STATE_VERSION;
  next.dateKey = effectiveDateKey;
  next.latestDateKey = effectiveDateKey > latestDateKey ? effectiveDateKey : latestDateKey;
  next.missionIds = Array.isArray(next.missionIds)
    && next.missionIds.length === 3
    && next.missionIds.every((id) => missionById(id))
    ? [...next.missionIds]
    : selectedMissionIds(effectiveDateKey);
  next.progress = next.progress && typeof next.progress === "object" ? { ...next.progress } : {};
  next.completedAt = next.completedAt && typeof next.completedAt === "object" ? { ...next.completedAt } : {};
  next.processedEventIds = uniqueLimited(next.processedEventIds, EVENT_ID_LIMIT);
  next.miniGamesPlayed = uniqueLimited(next.miniGamesPlayed, 12);
  next.pendingRewards = Array.isArray(next.pendingRewards)
    ? next.pendingRewards
      .filter((item) => item && normalizeId(item.claimKey) && count(item.amount))
      .map((item) => ({
        id: normalizeId(item.id),
        claimKey: normalizeId(item.claimKey),
        amount: count(item.amount),
      }))
    : [];
  next.completedDates = uniqueLimited(next.completedDates, COMPLETED_DATE_LIMIT).sort();
  next.currentStreak = count(next.currentStreak);
  next.bestStreak = Math.max(next.currentStreak, count(next.bestStreak));
  next.totalCompletedDays = Math.max(next.completedDates.length, count(next.totalCompletedDays));
  next.lastCompletedDate = String(next.lastCompletedDate || "");
  next.allClearRewarded = next.allClearRewarded === true;
  next.noticeRevision = Math.max(1, count(next.noticeRevision));
  next.seenRevision = count(next.seenRevision);
  for (const id of next.missionIds) {
    next.progress[id] = count(next.progress[id]);
    if (next.completedAt[id]) next.completedAt[id] = count(next.completedAt[id]) || Date.now();
  }
  return next;
}

function rememberEvent(state, rawId) {
  const id = normalizeId(rawId);
  if (!id || state.processedEventIds.includes(id)) return false;
  state.processedEventIds.push(id);
  if (state.processedEventIds.length > EVENT_ID_LIMIT) {
    state.processedEventIds.splice(0, state.processedEventIds.length - EVENT_ID_LIMIT);
  }
  return true;
}

function addReward(playerState, reasonKey, amount) {
  if (playerState.rewardClaims.includes(reasonKey)) return 0;
  playerState.rewardClaims.push(reasonKey);
  playerState.coins += amount;
  return amount;
}

function queueReward(daily, id, claimKey, amount) {
  if (!claimKey || !amount || daily.pendingRewards.some((item) => item.claimKey === claimKey)) return;
  daily.pendingRewards.push({ id, claimKey, amount });
}

function completeDailyDay(daily, now) {
  if (!daily.missionIds.every((id) => daily.completedAt[id])) return null;
  if (daily.completedDates.includes(daily.dateKey)) return null;

  const previousDay = dayNumber(daily.lastCompletedDate);
  const currentDay = dayNumber(daily.dateKey);
  daily.currentStreak = previousDay && currentDay - previousDay === 1
    ? daily.currentStreak + 1
    : 1;
  daily.bestStreak = Math.max(daily.bestStreak, daily.currentStreak);
  daily.lastCompletedDate = daily.dateKey;
  daily.completedDates.push(daily.dateKey);
  daily.completedDates = uniqueLimited(daily.completedDates, COMPLETED_DATE_LIMIT).sort();
  daily.totalCompletedDays += 1;
  daily.noticeRevision += 1;

  if (!daily.allClearRewarded) {
    daily.allClearRewarded = true;
    queueReward(
      daily,
      "all-clear",
      `daily-all-clear:${daily.dateKey}`,
      ALL_CLEAR_REWARD,
    );
  }
  return {
    dateKey: daily.dateKey,
    currentStreak: daily.currentStreak,
    bestStreak: daily.bestStreak,
    totalCompletedDays: daily.totalCompletedDays,
    completedAt: now,
  };
}

function localizeMission(item, language) {
  const lang = ["ko", "en", "ja"].includes(language) ? language : "ko";
  return item.name[lang] || item.name.ko;
}

function tierForMission(id) {
  return Object.entries(MISSION_POOLS).find(([, pool]) => pool.some((item) => item.id === id))?.[0] || "easy";
}

function snapshotFromState(playerState, now = new Date()) {
  const requestedDateKey = localDateKey(now);
  const daily = normalizeDailyState(playerState.dailyMissions, requestedDateKey);
  const language = playerState.language || "ko";
  const missions = daily.missionIds.map((id) => {
    const item = missionById(id);
    const progress = count(daily.progress[id]);
    return {
      ...item,
      tier: tierForMission(id),
      title: localizeMission(item, language),
      progress,
      displayProgress: Math.min(progress, item.target),
      complete: Boolean(daily.completedAt[id]),
    };
  });
  return {
    dateKey: daily.dateKey,
    missions,
    allComplete: missions.every((item) => item.complete),
    allClearReward: ALL_CLEAR_REWARD,
    currentStreak: daily.currentStreak,
    bestStreak: daily.bestStreak,
    totalCompletedDays: daily.totalCompletedDays,
    hasNotice: daily.seenRevision < daily.noticeRevision,
    pendingRewardTotal: daily.pendingRewards.reduce((sum, item) => sum + count(item.amount), 0),
    state: daily,
  };
}

function processEvent(eventId, increments, now = new Date()) {
  const requestedDateKey = localDateKey(now);
  let result = null;
  const saved = updatePlayerState((playerState) => {
    const daily = normalizeDailyState(playerState.dailyMissions, requestedDateKey);
    const newlyCompleted = [];
    const pendingRewards = [];

    if (rememberEvent(daily, eventId)) {
      const eventIncrements = { ...increments };
      const miniGameId = normalizeId(eventIncrements.miniGameId);
      if (miniGameId && !daily.miniGamesPlayed.includes(miniGameId)) {
        daily.miniGamesPlayed.push(miniGameId);
        eventIncrements.miniGameVariety = 1;
      } else {
        eventIncrements.miniGameVariety = 0;
      }
      for (const id of daily.missionIds) {
        const item = missionById(id);
        const amount = count(eventIncrements[item.metric]);
        if (!amount || daily.completedAt[id]) continue;
        daily.progress[id] = count(daily.progress[id]) + amount;
        if (daily.progress[id] >= item.target) {
          daily.completedAt[id] = Date.now();
          daily.noticeRevision += 1;
          newlyCompleted.push(id);
          const claimKey = `daily-mission:${daily.dateKey}:${id}`;
          queueReward(daily, id, claimKey, item.reward);
          pendingRewards.push({ id, amount: item.reward });
        }
      }
    }

    const completedDay = completeDailyDay(daily, Date.now());
    if (completedDay) pendingRewards.push({ id: "all-clear", amount: ALL_CLEAR_REWARD });
    playerState.dailyMissions = daily;
    result = { newlyCompleted, pendingRewards, completedDay };
  });

  const medalResult = result?.completedDay
    ? recordDailyMissionDay(result.completedDay)
    : { newlyUnlocked: [] };
  return {
    ...(result || { newlyCompleted: [], pendingRewards: [], completedDay: null }),
    newlyUnlocked: medalResult.newlyUnlocked || [],
    totalReward: 0,
    pendingRewardTotal: (result?.pendingRewards || []).reduce((sum, item) => sum + item.amount, 0),
    coins: saved.coins,
    snapshot: snapshotFromState(saved, now),
  };
}

function moveColor(move) {
  if (move?.color === "w" || move?.color === "white") return "w";
  if (move?.color === "b" || move?.color === "black") return "b";
  return "";
}

function pieceType(value) {
  const type = String(value || "").toLowerCase();
  return ({ pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" })[type]
    || ("pnbrqk".includes(type) && type.length === 1 ? type : "");
}

function isCapture(move) {
  return Boolean(pieceType(move?.captured)
    || String(move?.flags || "").includes("c")
    || String(move?.flags || "").includes("e")
    || String(move?.san || "").includes("x"));
}

export function getDailyMissionSnapshot(now = new Date()) {
  const playerState = readPlayerState();
  const snapshot = snapshotFromState(playerState, now);
  if (JSON.stringify(playerState.dailyMissions || null) !== JSON.stringify(snapshot.state)) {
    updatePlayerState((state) => {
      state.dailyMissions = snapshot.state;
    });
  }
  return snapshot;
}

export function markDailyMissionsSeen(now = new Date()) {
  const requestedDateKey = localDateKey(now);
  let claimedRewards = [];
  const saved = updatePlayerState((playerState) => {
    const daily = normalizeDailyState(playerState.dailyMissions, requestedDateKey);
    daily.seenRevision = daily.noticeRevision;
    claimedRewards = daily.pendingRewards
      .map((item) => ({
        id: item.id,
        amount: addReward(playerState, item.claimKey, item.amount),
      }))
      .filter((item) => item.amount > 0);
    daily.pendingRewards = [];
    playerState.dailyMissions = daily;
  });
  return {
    ...snapshotFromState(saved, now),
    claimedRewards,
    claimedTotal: claimedRewards.reduce((sum, item) => sum + item.amount, 0),
  };
}

export function recordDailyPuzzleCompletion(record = {}, now = new Date()) {
  const sessionId = normalizeId(record.sessionId || record.puzzleSessionId);
  if (!sessionId) return {
    newlyCompleted: [], pendingRewards: [], completedDay: null, newlyUnlocked: [], totalReward: 0,
    pendingRewardTotal: 0,
    snapshot: getDailyMissionSnapshot(now),
  };
  return processEvent(`puzzle:${sessionId}`, {
    puzzleCompletions: 1,
    puzzleNoHint: record.hintUsed === true ? 0 : 1,
  }, now);
}

export function recordDailyGameCompletion(record = {}, now = new Date()) {
  const sessionId = normalizeId(record.gameSessionId);
  if (!sessionId) return {
    newlyCompleted: [], pendingRewards: [], completedDay: null, newlyUnlocked: [], totalReward: 0,
    pendingRewardTotal: 0,
    snapshot: getDailyMissionSnapshot(now),
  };

  const mode = String(record.mode || "").toLowerCase() === "ai" ? "ai" : "pvp";
  const playerColor = record.playerColor === "b" ? "b" : "w";
  const winnerColor = record.winnerColor === "b" ? "b" : record.winnerColor === "w" ? "w" : "";
  const humanWon = mode === "ai" && winnerColor === playerColor;
  const history = Array.isArray(record.history) ? record.history : [];
  let playerMoves = 0;
  let captures = 0;
  let queenCaptures = 0;
  let checks = 0;

  for (const move of history) {
    if (moveColor(move) !== playerColor) continue;
    playerMoves += 1;
    if (isCapture(move)) {
      captures += 1;
      if (pieceType(move.piece) === "q") queenCaptures += 1;
    }
    if (/[+#]/.test(String(move.san || ""))) checks += 1;
  }

  const difficulty = ["easy", "normal", "hard", "challenge"].includes(record.difficulty)
    ? record.difficulty
    : "normal";
  const checkmate = humanWon && (
    String(record.reason || "").toLowerCase() === "checkmate"
    || history.some((move, index) => index === history.length - 1 && /#/.test(String(move?.san || "")))
  );

  return processEvent(`game:${sessionId}`, {
    aiGames: mode === "ai" ? 1 : 0,
    aiWins: humanWon ? 1 : 0,
    normalPlusAiWins: humanWon && difficulty !== "easy" ? 1 : 0,
    playerMoves: mode === "ai" ? playerMoves : 0,
    captures: mode === "ai" ? captures : 0,
    queenCaptures: mode === "ai" ? queenCaptures : 0,
    checks: mode === "ai" ? checks : 0,
    checkmates: checkmate ? 1 : 0,
  }, now);
}

export function recordDailyMiniGameCompletion(record = {}, now = new Date()) {
  const sessionId = normalizeId(record.sessionId || record.gameSessionId);
  const gameId = normalizeId(record.gameId);
  const supportedGames = new Set(["tug", "road", "road-puzzle", "crown", "siege"]);
  if (!sessionId || !supportedGames.has(gameId)) return {
    newlyCompleted: [], pendingRewards: [], completedDay: null, newlyUnlocked: [], totalReward: 0,
    pendingRewardTotal: 0,
    snapshot: getDailyMissionSnapshot(now),
  };

  const mode = ["ai", "pvp", "solo"].includes(record.mode) ? record.mode : "ai";
  const playerColor = record.playerColor === "b" ? "b" : "w";
  const winnerColor = record.winnerColor === "b" ? "b" : record.winnerColor === "w" ? "w" : "";
  const playerWon = mode === "pvp" ? Boolean(winnerColor) : winnerColor === playerColor;
  return processEvent(`minigame:${gameId}:${sessionId}`, {
    miniGameCompletions: 1,
    miniGameWins: playerWon ? 1 : 0,
    miniGameId: gameId,
  }, now);
}

export function getDailyMissionDefinitions() {
  return Object.fromEntries(
    Object.entries(MISSION_POOLS).map(([tier, pool]) => [tier, [...pool]]),
  );
}
