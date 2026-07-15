const values = new Map();

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

globalThis.window = {
  localStorage: {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  },
  dispatchEvent() {},
};

const state = await import("../src/playerState.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

values.set(state.PLAYER_STATE_KEY, JSON.stringify({
  coins: 100,
  unlockedSkinColors: ["classic:w", "classic:b"],
  language: "ko",
}));

const migrated = state.readPlayerState();
assert(migrated.stats.ai.normal.played === 0, "legacy saves must migrate AI stats");
assert(migrated.stats.pvp.played === 0, "legacy saves must migrate PVP stats");
assert(state.getSkinCost("bear", "w") === 40, "white bear must be the cheap white set");
assert(state.getSkinCost("rabbit", "b") === 40, "black rabbit must be the cheap black set");
assert(state.getSkinUnlockState("cat", "w").purchasable === false, "quest sets must not be purchasable");
assert(state.AI_DIFFICULTIES.easy.reward === 5, "easy AI reward must be 5 coins");
assert(state.AI_DIFFICULTIES.normal.reward === 15, "normal AI reward must be 15 coins");
assert(state.AI_DIFFICULTIES.hard.reward === 35, "hard AI reward must be 35 coins");

state.recordGameResult({ mode: "ai", result: "win", difficulty: "hard", playerColor: "w" });
state.recordGameResult({ mode: "ai", result: "b_win", difficulty: "easy", playerColor: "w" });
state.recordGameResult({ mode: "pvp", result: "w_win" });
const stats = state.getPlayStats();
assert(stats.ai.hard.wins === 1, "hard AI win must be recorded");
assert(stats.ai.easy.losses === 1, "AI winner color must map to a player loss");
assert(stats.pvp.wWins === 1, "PVP white win must be recorded");

values.set(state.PUZZLE_PROGRESS_KEY, JSON.stringify(Array.from({ length: 12 }, (_, index) => `p${index}`)));
assert(state.getSkinUnlockState("cat", "w").unlocked, "white cat must unlock after 12 puzzles");

for (let index = 2; index < 20; index += 1) {
  state.recordGameResult({ mode: "ai", result: "draw", difficulty: "normal" });
}
assert(state.getSkinUnlockState("cat", "b").unlocked, "black cat must unlock after 20 AI games");

console.log("Validated player-state migration, prices, stats, and quest unlocks.");
