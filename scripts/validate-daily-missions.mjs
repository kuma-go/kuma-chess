import assert from "node:assert/strict";

const values = new Map();
const storage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.localStorage = storage;
globalThis.window = { localStorage: storage, dispatchEvent() {} };

const player = await import(`../src/playerState.js?daily-validation=${Date.now()}`);
const daily = await import(`../src/dailyMissions.js?daily-validation=${Date.now()}`);
const medals = await import(`../src/medals.js?daily-validation=${Date.now()}`);

function syntheticWinningGame(sessionId) {
  return {
    gameSessionId: sessionId,
    mode: "ai",
    result: "w_win",
    reason: "checkmate",
    winnerColor: "w",
    playerColor: "w",
    difficulty: "normal",
    history: Array.from({ length: 12 }, (_, index) => ({
      color: "w",
      piece: "q",
      captured: "p",
      flags: "c",
      san: index === 11 ? "Qxh8#" : "Qxg7+",
    })),
  };
}

function completeDay(date, suffix) {
  daily.recordDailyPuzzleCompletion({ sessionId: `puzzle-a-${suffix}`, hintUsed: false }, date);
  daily.recordDailyPuzzleCompletion({ sessionId: `puzzle-b-${suffix}`, hintUsed: false }, date);
  daily.recordDailyGameCompletion(syntheticWinningGame(`game-${suffix}`), date);
  for (const gameId of ["tug", "road", "crown"]) {
    daily.recordDailyMiniGameCompletion({
      sessionId: `${gameId}-${suffix}`,
      gameId,
      mode: "ai",
      playerColor: "w",
      winnerColor: "w",
    }, date);
  }
  return daily.getDailyMissionSnapshot(date);
}

const firstDay = new Date(2026, 6, 24, 12);
const startingCoins = player.readPlayerState().coins;
const first = completeDay(firstDay, "day-1");
assert.equal(first.allComplete, true, "Every mission must be completable with supported events.");
assert.equal(first.currentStreak, 1, "The first completed day must start a one-day streak.");
assert.ok(first.pendingRewardTotal > 0, "Completed missions must expose a pending reward total.");
assert.equal(
  player.readPlayerState().coins,
  startingCoins,
  "Mission rewards must wait until the daily popup is checked.",
);
const firstClaim = daily.markDailyMissionsSeen(firstDay);
assert.ok(firstClaim.claimedTotal > 0, "Checking the daily popup must claim pending rewards.");
assert.ok(player.readPlayerState().coins > startingCoins, "Claimed daily rewards were not added.");
assert.equal(
  daily.markDailyMissionsSeen(firstDay).claimedTotal,
  0,
  "A checked daily reward must not be claimed twice.",
);

const coinsAfterFirst = player.readPlayerState().coins;
daily.recordDailyGameCompletion(syntheticWinningGame("game-day-1"), firstDay);
daily.markDailyMissionsSeen(firstDay);
assert.equal(player.readPlayerState().coins, coinsAfterFirst, "A duplicate event awarded coins twice.");

const miniGameDefinitions = daily.getDailyMissionDefinitions();
assert.ok(
  Object.values(miniGameDefinitions).flat().some((mission) => mission.metric === "miniGameCompletions"),
  "Daily missions must include mini-game participation.",
);
assert.ok(
  Object.values(miniGameDefinitions).flat().some((mission) => mission.metric === "miniGameVariety"),
  "Daily missions must include distinct mini-game variety.",
);

for (let offset = 1; offset < 7; offset += 1) {
  const date = new Date(2026, 6, 24 + offset, 12);
  const snapshot = completeDay(date, `day-${offset + 1}`);
  assert.equal(snapshot.allComplete, true, `Day ${offset + 1} did not complete.`);
  daily.markDailyMissionsSeen(date);
}

const seventhDay = daily.getDailyMissionSnapshot(new Date(2026, 6, 30, 12));
assert.equal(seventhDay.currentStreak, 7, "Consecutive daily completion streak is incorrect.");
assert.equal(seventhDay.totalCompletedDays, 7, "Total completed daily count is incorrect.");
assert.ok(medals.readMedalState().unlockedAt["diligent-knight"], "Daily streak medal did not unlock.");
assert.equal(player.REWARDS.daily, 2, "Login reward should remain modest beside mission rewards.");

const eighthDay = new Date(2026, 6, 31, 12);
const ninthDay = new Date(2026, 7, 1, 12);
const eighthSnapshot = completeDay(eighthDay, "day-8");
assert.ok(eighthSnapshot.pendingRewardTotal > 0, "Day-eight rewards were not queued.");
const rolloverSnapshot = daily.getDailyMissionSnapshot(ninthDay);
assert.equal(
  rolloverSnapshot.pendingRewardTotal,
  eighthSnapshot.pendingRewardTotal,
  "Pending rewards disappeared when the daily date rolled over.",
);
assert.ok(
  daily.markDailyMissionsSeen(ninthDay).claimedTotal > 0,
  "A previous day's pending rewards could not be claimed.",
);

console.log("Validated daily assignment, progress, rewards, idempotency, streaks, and medal integration.");
