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
assert(migrated.stats.ai.challenge.played === 0, "legacy saves must migrate challenge AI stats");
assert(migrated.stats.pvp.played === 0, "legacy saves must migrate PVP stats");
assert(migrated.bgmVolume === 0, "legacy sound mute must also mute newly introduced BGM");
assert(migrated.profile.language === "ko", "legacy language must migrate into profile state");
assert(JSON.parse(values.get(profile.PROFILE_STATE_KEY)).soundEnabled === false, "profile state must be stored separately");
assert(!Object.prototype.hasOwnProperty.call(JSON.parse(values.get(state.PLAYER_STATE_KEY)), "language"), "player progress storage must not keep profile language");

const firstDailyReward = state.claimDailyReward(new Date(2026, 7, 28, 12));
assert(firstDailyReward.claimed, "a new local date must grant the daily reward");
const nextDailyReward = state.claimDailyReward(new Date(2026, 7, 29, 12));
assert(nextDailyReward.claimed, "the next local date must grant the daily reward");
const cycledDailyReward = state.claimDailyReward(new Date(2026, 7, 28, 12));
assert(!cycledDailyReward.claimed, "cycling the device date backward must not grant the same daily reward again");
const dailyClaims = state.readPlayerState().rewardClaims.filter((claim) => claim.startsWith("daily-login:"));
assert(dailyClaims.length === 2, "daily rewards must keep one stable claim for each awarded date");

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
assert(state.AI_DIFFICULTIES.challenge.reward === 100, "challenge AI reward must be 100 coins");

const legacyHourglassState = state.readPlayerState();
legacyHourglassState.ownedProfilePortraits.push("portrait-hourglass");
legacyHourglassState.rewardClaims.push("profile-purchase:portrait:portrait-hourglass:v1");
values.set(state.PLAYER_STATE_KEY, JSON.stringify(legacyHourglassState));
values.set(state.PLAYER_STATE_BACKUP_KEY, JSON.stringify(legacyHourglassState));
const migratedHourglassState = state.readPlayerState();
assert(migratedHourglassState.ownedProfilePortraits.includes("portrait-180"),
  "the removed image 784 purchase must migrate to the corrected Frame 180 portrait");
assert(!migratedHourglassState.ownedProfilePortraits.includes("portrait-hourglass"),
  "the removed image 784 portrait ID must not remain in ownership");
values.set(profile.PROFILE_STATE_KEY, JSON.stringify({
  displayName: "Legacy Player",
  avatar: { portraitId: "portrait-hourglass", frameId: "frame-basic-01", skinId: "classic", color: "w" },
}));
assert(profile.readProfileState().avatar.portraitId === "portrait-180",
  "the selected image 784 portrait must migrate to the corrected Frame 180 portrait");

const profileCollection = state.getProfileCosmeticCollection();
assert(profileCollection.portraits.length === 199, "profile catalog must expose 199 portraits");
assert(profileCollection.frames.length === 15, "profile catalog must expose 15 frames");
assert(profileCollection.portraits.filter((item) => item.cost === 0 && item.owned).length === 8,
  "all eight default portraits must be owned");
assert(profileCollection.frames.filter((item) => item.cost === 0 && item.owned).length === 4,
  "all four default frames must be owned");
const profilePurchase = state.purchaseProfileCosmetic("portrait", "portrait-79");
assert(profilePurchase.ok && profilePurchase.coins === 40, "a paid portrait must deduct its configured coin cost once");
const duplicateProfilePurchase = state.purchaseProfileCosmetic("portrait", "portrait-79");
assert(duplicateProfilePurchase.ok && duplicateProfilePurchase.coins === 40,
  "an owned portrait must not charge coins again");
const claimedPortraitState = state.readPlayerState();
claimedPortraitState.ownedProfilePortraits = claimedPortraitState.ownedProfilePortraits
  .filter((id) => id !== "portrait-79");
values.set(state.PLAYER_STATE_KEY, JSON.stringify(claimedPortraitState));
values.set(state.PLAYER_STATE_BACKUP_KEY, JSON.stringify(claimedPortraitState));
const recoveredPortraitState = state.readPlayerState();
assert(recoveredPortraitState.ownedProfilePortraits.includes("portrait-79"),
  "a profile purchase claim must restore ownership when the ownership list is damaged");
const recoveredPortraitCoins = recoveredPortraitState.coins;
assert(state.purchaseProfileCosmetic("portrait", "portrait-79").coins === recoveredPortraitCoins,
  "claim-restored profile ownership must never charge coins again");
assert(!state.purchaseProfileCosmetic("frame", "frame-a-01").ok,
  "a profile frame purchase must fail when coins are insufficient");

state.writePlayerState({ ...state.readPlayerState(), coins: 209 });
const failedLoadoutPurchase = state.purchaseProfileLoadout("portrait-80", "frame-a-01");
assert(!failedLoadoutPurchase.ok && failedLoadoutPurchase.cost === 210,
  "a profile loadout purchase must calculate the combined portrait and frame cost");
assert(!state.isProfileCosmeticOwned("portrait", "portrait-80")
  && !state.isProfileCosmeticOwned("frame", "frame-a-01"),
  "an insufficient profile loadout purchase must not partially unlock items");
state.writePlayerState({ ...state.readPlayerState(), coins: 210 });
const loadoutPurchase = state.purchaseProfileLoadout("portrait-80", "frame-a-01");
assert(loadoutPurchase.ok && loadoutPurchase.coins === 0 && loadoutPurchase.items.length === 2,
  "a profile loadout purchase must deduct once and unlock both selected items atomically");
const duplicateLoadoutPurchase = state.purchaseProfileLoadout("portrait-80", "frame-a-01");
assert(duplicateLoadoutPurchase.ok && duplicateLoadoutPurchase.coins === 0 && duplicateLoadoutPurchase.cost === 0,
  "an owned profile loadout must not charge coins again");

const coinsBeforeTugReward = state.readPlayerState().coins;
const tugReward = state.grantCoinsOnce("ai-win:tug-validation-hard", state.AI_DIFFICULTIES.hard.reward);
assert(tugReward.awarded && tugReward.coins === coinsBeforeTugReward + 35, "tug AI win must grant its difficulty reward");
const duplicateTugReward = state.grantCoinsOnce("ai-win:tug-validation-hard", state.AI_DIFFICULTIES.hard.reward);
assert(!duplicateTugReward.awarded && duplicateTugReward.coins === tugReward.coins, "tug AI reward must be idempotent per session");

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
const couponCoinsBefore = state.readPlayerState().coins;
const couponResult = state.redeemHiddenRewardCoupon("HAPPINESS");
assert(couponResult.ok && !couponResult.alreadyUnlocked, "uppercase HAPPINESS must unlock the brown bear set");
assert(couponResult.coins === couponCoinsBefore, "coupon redemption must not change coins");
assert(state.getSkinUnlockState("brownBear", "w").unlocked, "white brown bear must unlock with coupon");
assert(state.getSkinUnlockState("brownBear", "b").unlocked, "black brown bear must unlock with coupon");
const couponNotices = state.getPieceUnlockNotices();
assert(couponNotices.some((notice) => notice.skinId === "brownBear" && notice.color === "b"), "brown bear coupon must queue a black-set unlock notice");
assert(state.getPieceUnlockNotices().length === couponNotices.length, "piece unlock notices must remain queued until they are displayed");
state.acknowledgePieceUnlockNotices(couponNotices.map((notice) => notice.id));
assert(state.getPieceUnlockNotices().length === 0, "displayed piece unlock notices must be acknowledged exactly once");
const couponState = state.readPlayerState();
assert(couponState.rewardClaims.filter((claim) => claim === state.HIDDEN_REWARD_COUPON_CLAIM).length === 1, "coupon claim must be stored exactly once");
const duplicateCouponResult = state.redeemHiddenRewardCoupon("happiness");
assert(duplicateCouponResult.ok && duplicateCouponResult.alreadyUnlocked, "lowercase happiness must be recognized without granting twice");
assert(duplicateCouponResult.coins === couponCoinsBefore, "duplicate coupon redemption must not change coins");
assert(state.readPlayerState().rewardClaims.filter((claim) => claim === state.HIDDEN_REWARD_COUPON_CLAIM).length === 1, "duplicate coupon redemption must keep one stable claim");

state.recordGameResult({ mode: "ai", result: "win", difficulty: "hard", playerColor: "w" });
state.recordGameResult({ mode: "ai", result: "win", difficulty: "challenge", playerColor: "w" });
state.recordGameResult({ mode: "ai", result: "b_win", difficulty: "easy", playerColor: "w" });
state.recordGameResult({ mode: "pvp", result: "w_win" });
const stats = state.getPlayStats();
assert(stats.ai.hard.wins === 1, "hard AI win must be recorded");
assert(stats.ai.challenge.wins === 1, "challenge AI win must be recorded");
assert(stats.ai.easy.losses === 1, "AI winner color must map to a player loss");
assert(stats.pvp.wWins === 1, "PVP white win must be recorded");

values.set(state.PUZZLE_PROGRESS_KEY, JSON.stringify(Array.from({ length: 12 }, (_, index) => `p${index}`)));
assert(state.getSkinUnlockState("cat", "w").unlocked, "white cat must unlock after 12 puzzles");

for (let index = 2; index < 20; index += 1) {
  state.recordGameResult({ mode: "ai", result: "draw", difficulty: "normal" });
}
assert(state.getSkinUnlockState("cat", "b").unlocked, "black cat must unlock after 20 AI games");

console.log("Validated player-state migration, prices, stats, and quest unlocks.");
