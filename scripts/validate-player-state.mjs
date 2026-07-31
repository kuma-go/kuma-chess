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
const profile = await import("../src/profileState.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

values.set(state.PLAYER_STATE_KEY, JSON.stringify({
  coins: 100,
  unlockedSkinColors: ["classic:w", "classic:b"],
  language: "ko",
  soundEnabled: false,
}));

const migrated = state.readPlayerState();
assert(migrated.stats.ai.normal.played === 0, "legacy saves must migrate AI stats");
assert(migrated.stats.pvp.played === 0, "legacy saves must migrate PVP stats");
assert(migrated.bgmVolume === 0, "legacy sound mute must also mute newly introduced BGM");
assert(migrated.profile.language === "ko", "legacy language must migrate into profile state");
assert(JSON.parse(values.get(profile.PROFILE_STATE_KEY)).soundEnabled === false, "profile state must be stored separately");
assert(!Object.prototype.hasOwnProperty.call(JSON.parse(values.get(state.PLAYER_STATE_KEY)), "language"), "player progress storage must not keep profile language");

state.writePlayerState({ ...migrated, soundEnabled: true, bgmVolume: 0 });
const explicitlyMutedBgm = state.readPlayerState();
assert(explicitlyMutedBgm.soundEnabled === true, "effects can remain enabled while BGM is muted");
assert(explicitlyMutedBgm.bgmVolume === 0, "saved zero BGM volume must remain muted");

values.set(state.PLAYER_STATE_KEY, "{broken json");
values.set(state.PLAYER_STATE_BACKUP_KEY, JSON.stringify({ coins: 432, unlockedSkinColors: ["classic:w", "classic:b"] }));
assert(state.readPlayerState().coins === 432, "player state must recover from the backup key");
assert(JSON.parse(values.get(state.PLAYER_STATE_KEY)).coins === 432, "backup recovery must repair the primary player key");

values.clear();
state.readPlayerState();
assert(!values.has(state.PLAYER_STATE_KEY), "empty reads must not overwrite player storage with a default save");
profile.readProfileState();
assert(!values.has(profile.PROFILE_STATE_KEY), "empty reads must not overwrite profile storage with a default save");

values.set(state.PUZZLE_PROGRESS_KEY, "{broken json");
values.set(state.PUZZLE_PROGRESS_BACKUP_KEY, JSON.stringify(["p1", "p2", "p2"]));
assert(state.getClearedPuzzleIds().join(",") === "p1,p2", "puzzle clears must recover from the backup key");
assert(JSON.parse(values.get(state.PUZZLE_PROGRESS_KEY)).length === 2, "backup recovery must repair puzzle clears");

assert(state.getSkinCost("bear", "w") === 40, "white bear must be the cheap white set");
assert(state.getSkinCost("rabbit", "b") === 40, "black rabbit must be the cheap black set");
assert(state.getSkinCost("goldBear", "w") === 0, "gold bear must not be a direct set purchase");
assert(state.getSkinCost("brownBear", "b") === 0, "brown bear must not be a direct set purchase");
assert(state.getCollectionSkinColorTotal() === 18, "special bear sets must not change the base collection total");
assert(state.getSkinUnlockState("cat", "w").purchasable === false, "quest sets must not be purchasable");
assert(state.getSkinUnlockState("goldBear", "w").purchasable === false, "gold bear must be unlocked by piece collection");
assert(state.getSkinUnlockState("brownBear", "b").purchasable === false, "brown bear must be unlocked by coupon");
assert(state.AI_DIFFICULTIES.easy.reward === 5, "easy AI reward must be 5 coins");
assert(state.AI_DIFFICULTIES.normal.reward === 15, "normal AI reward must be 15 coins");
assert(state.AI_DIFFICULTIES.hard.reward === 35, "hard AI reward must be 35 coins");

state.writePlayerState({
  ...state.readPlayerState(),
  coins: 4000,
  specialPieces: [],
  unlockedSkinColors: ["classic:w", "classic:b"],
  dailyMissions: { totalCompletedDays: 100 },
});
for (const piece of ["p", "n", "r", "b", "k"]) {
  const result = state.unlockGoldBearPiece(piece);
  assert(result.ok, `gold bear ${piece} must unlock when its requirement is satisfied`);
}
assert(!state.getSkinUnlockState("goldBear", "w").unlocked, "gold bear set must wait for every special piece");
assert(state.grantSpecialPiece("goldBear:q").ok, "ad reward must be able to grant the gold bear queen");
assert(state.getGoldBearProgress().complete, "gold bear piece progress must become complete");
assert(state.getSkinUnlockState("goldBear", "w").unlocked, "white gold bear must unlock after all pieces");
assert(state.getSkinUnlockState("goldBear", "b").unlocked, "black gold bear must unlock after all pieces");
assert(!state.redeemHiddenRewardCoupon("wrong-code").ok, "invalid hidden reward coupon must fail");
state.writePlayerState({
  ...state.readPlayerState(),
  rewardClaims: [...state.readPlayerState().rewardClaims, state.HIDDEN_REWARD_COUPON_CLAIM],
});
assert(state.getSkinUnlockState("brownBear", "w").unlocked, "white brown bear must unlock with coupon");
assert(state.getSkinUnlockState("brownBear", "b").unlocked, "black brown bear must unlock with coupon");

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
