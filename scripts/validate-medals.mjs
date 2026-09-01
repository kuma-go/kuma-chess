import assert from "node:assert/strict";
import fs from "node:fs";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};

const medals = await import(`../src/medals.js?validation=${Date.now()}`);
const entries = medals.getMedalEntries("ko");

assert.equal(entries.length, 81, "The catalog must contain all 81 medal definitions.");
for (const entry of entries) {
  assert.ok(entry.name && entry.description, `Missing Korean copy for ${entry.id}`);
  assert.ok(fs.existsSync(new URL(`../assets/kuma/ui/${entry.asset}`, import.meta.url)), `Missing asset ${entry.asset}`);
}
const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
assert.equal(entriesById.get("online-challenger")?.unavailable, true,
  "The online challenge medal must remain unavailable until online play ships.");
assert.equal(entriesById.get("online-challenger")?.asset, "메달_도전장.webp",
  "The online challenge medal must keep its original art.");
assert.equal(entriesById.get("challenge-ai-victory")?.unavailable, false,
  "The Challenge AI medal must be obtainable now.");
assert.equal(entriesById.get("challenge-ai-victory")?.asset, "메달_AI도전난이도.png",
  "The Challenge AI medal must use its dedicated art.");
assert.equal(entriesById.get("challenge-ai-victory")?.category, "honor",
  "The Challenge AI medal must live in the dedicated honor category.");
assert.equal(entriesById.get("stockfish-18-lite-victory")?.unavailable, true,
  "The future Stockfish medal must remain unavailable.");
assert.equal(entriesById.get("stockfish-18-lite-victory")?.asset, "메달_Stockfish18Lite.png",
  "The future Stockfish medal must use its dedicated art.");
assert.equal(entriesById.get("stockfish-18-lite-victory")?.category, "honor",
  "The future Stockfish medal must live in the dedicated honor category.");
assert.ok(medals.MEDAL_CATEGORIES.some((category) => category.id === "honor"),
  "The honor medal category is missing.");
for (const language of ["en", "ja"]) {
  for (const entry of medals.getMedalEntries(language)) {
    assert.ok(entry.name && entry.description, `Missing ${language} copy for ${entry.id}`);
  }
}

let result = medals.syncContextMedals({ coins: 10000, ownedSkinCount: 2, totalSkinCount: 18 });
assert.ok(result.newlyUnlocked.includes("coin-master"), "Coin medal did not unlock.");
assert.ok(medals.hasNewMedals(), "A newly unlocked medal must expose the NEW state.");
medals.markMedalsSeen();
assert.equal(medals.hasNewMedals(), false, "Confirming the catalog must clear every NEW badge.");
memory.set("kumaChessMedalsV1", "{broken json");
assert.ok(medals.readMedalState().unlockedAt["coin-master"], "Medals must recover from the backup key.");
assert.ok(JSON.parse(memory.get("kumaChessMedalsV1")).unlockedAt["coin-master"], "Medal backup recovery must repair the primary key.");

for (let index = 0; index < 30; index += 1) {
  medals.recordPuzzleHint({ sessionId: `hint-${index}` });
}
assert.ok(medals.readMedalState().unlockedAt["hint-user"], "Hint medal did not unlock.");

for (let index = 1; index <= 10; index += 1) {
  medals.recordPuzzleCompletion({ sessionId: `puzzle-${index}`, firstClear: true, totalCleared: index });
}
assert.ok(medals.readMedalState().unlockedAt["puzzle-10"], "Puzzle milestone did not unlock.");

for (let index = 0; index < 10; index += 1) {
  medals.recordCompletedGame({
    gameSessionId: `pvp-${index}`,
    mode: "pvp",
    result: "draw",
    skins: { w: "classic", b: "classic" },
  });
}
assert.ok(medals.readMedalState().unlockedAt["face-to-face-10"], "Face-to-face medal did not unlock.");
const progressBeforeDuplicate = medals.readMedalState().progress["face-to-face-10"];
medals.recordCompletedGame({ gameSessionId: "pvp-9", mode: "pvp", result: "draw" });
assert.equal(
  medals.readMedalState().progress["face-to-face-10"],
  progressBeforeDuplicate,
  "A duplicate game session was counted twice."
);

for (let index = 0; index < 5; index += 1) {
  medals.recordCompletedGame({
    gameSessionId: `gold-bear-${index}`,
    mode: "ai",
    result: "w_win",
    winnerColor: "w",
    playerColor: "w",
    skins: { w: "goldBear", b: "classic" },
  });
}
assert.ok(medals.readMedalState().unlockedAt["gold-bear"], "Gold Bear medal did not unlock.");
for (let index = 0; index < 5; index += 1) {
  medals.recordCompletedGame({
    gameSessionId: `brown-bear-${index}`,
    mode: "ai",
    result: "w_win",
    winnerColor: "w",
    playerColor: "w",
    skins: { w: "brownBear", b: "classic" },
  });
}
assert.ok(medals.readMedalState().unlockedAt["brown-bear"], "Brown Bear medal did not unlock.");

result = medals.recordDailyMissionDay({ currentStreak: 7, totalCompletedDays: 7 });
assert.ok(result.newlyUnlocked.includes("diligent-knight"), "Seven-day streak medal did not unlock.");
result = medals.recordDailyMissionDay({ currentStreak: 2, totalCompletedDays: 100 });
assert.ok(result.newlyUnlocked.includes("kingdom-routine"), "Thirty-day daily medal did not unlock.");
assert.ok(result.newlyUnlocked.includes("hundred-day-training"), "Hundred-day daily medal did not unlock.");

result = medals.recordCompletedGame({
  gameSessionId: "king-power-1",
  mode: "ai",
  result: "w_win",
  winnerColor: "w",
  playerColor: "w",
  history: Array.from({ length: 5 }, (_, index) => ({
    color: "w", piece: "k", captured: "p", flags: "c", san: `Kx${index}`,
  })),
});
assert.ok(result.newlyUnlocked.includes("king-power"), "King capture medal did not unlock.");

result = medals.recordCompletedGame({
  gameSessionId: "challenge-ai-victory-1",
  mode: "ai",
  difficulty: "challenge",
  result: "w_win",
  winnerColor: "w",
  playerColor: "w",
  reason: "checkmate",
});
assert.ok(result.newlyUnlocked.includes("challenge-ai-victory"), "Challenge AI victory medal did not unlock.");
assert.ok(!result.newlyUnlocked.includes("online-challenger"), "Challenge AI must not unlock the online challenge medal.");
assert.ok(!result.newlyUnlocked.includes("stockfish-18-lite-victory"), "Challenge AI must not unlock the future Stockfish medal.");
medals.recordCompletedGame({
  gameSessionId: "challenge-ai-victory-1",
  mode: "ai",
  difficulty: "challenge",
  result: "w_win",
  winnerColor: "w",
  playerColor: "w",
});
assert.equal(medals.readMedalState().progress["challenge-ai-victory"], 1, "Challenge AI victory was counted twice.");
assert.equal(medals.readMedalState().progress["online-challenger"] || 0, 0,
  "Challenge AI must not advance online challenge progress.");
assert.equal(medals.readMedalState().progress["stockfish-18-lite-victory"] || 0, 0,
  "Challenge AI must not advance Stockfish progress.");

for (const [index, gameId] of ["tug", "crown", "road", "road-puzzle", "siege"].entries()) {
  medals.recordMiniGameCompletion({
    sessionId: `experience-${index}`,
    gameId,
    mode: gameId === "road-puzzle" ? "solo" : "ai",
    playerColor: "w",
    winnerColor: "w",
    stats: gameId === "road-puzzle" ? { firstClear: true } : {},
  });
}
assert.ok(medals.readMedalState().unlockedAt["minigame-explorer"], "Mini-game explorer medal did not unlock.");

result = medals.recordMiniGameCompletion({
  sessionId: "crown-metrics-1",
  gameId: "crown",
  mode: "ai",
  playerColor: "w",
  winnerColor: "w",
  stats: { crownStolen: 2, crownFirst: 1, crownLost: 3, portalUses: 4 },
});
assert.equal(result.state.progress["crown-thief"], 2, "Crown steals were not recorded.");
assert.equal(result.state.progress["crown-lost"], 3, "Lost crowns were not recorded.");
assert.equal(result.state.progress["portal-uses-10"], 4, "Portal uses were not recorded.");
medals.recordMiniGameCompletion({
  sessionId: "crown-metrics-1",
  gameId: "crown",
  mode: "ai",
  playerColor: "w",
  winnerColor: "w",
  stats: { crownStolen: 20, portalUses: 20 },
});
assert.equal(medals.readMedalState().progress["crown-thief"], 2, "A duplicate mini-game session was counted twice.");

result = medals.recordMiniGameCompletion({
  sessionId: "siege-metrics-1",
  gameId: "siege",
  mode: "ai",
  playerColor: "w",
  winnerColor: "w",
  stats: {
    castleDestroyed: true,
    defenseSaves: 2,
    summonedTypes: ["pawn", "knight", "rook", "bishop", "queen", "king"],
    maxCrownPoints: 1500,
    itemUses: 3,
  },
});
assert.equal(result.state.progress["siege-defender"], 2, "Siege defenses were not recorded.");
assert.equal(result.state.progress["siege-breaker"], 1, "Castle destruction was not recorded.");
assert.equal(result.state.progress["siege-all-classes"], 1, "All-class siege victory was not recorded.");
assert.ok(result.newlyUnlocked.includes("siege-points-1500"), "Crown point medal did not unlock.");

result = medals.recordAmbientMedalEvent({ eventId: "test-track:v1", type: "bgm-track" });
assert.ok(result.newlyUnlocked.includes("bgm-track"), "BGM track medal did not unlock.");
result = medals.recordAmbientMedalEvent({ eventId: "test-idle:v1", type: "bgm-idle-30" });
assert.ok(result.newlyUnlocked.includes("bgm-idle-30"), "BGM idle medal did not unlock.");
result = medals.recordAmbientMedalEvent({ eventId: "test-scroll:v1", type: "thorough-visitor" });
assert.ok(result.newlyUnlocked.includes("thorough-visitor"), "Full-page scroll medal did not unlock.");

const enthusiastState = medals.readMedalState();
for (const entry of entries.filter((item) => item.id === "minigame-explorer" || item.minigameId)) {
  if (entry.id !== "minigame-enthusiast") enthusiastState.progress[entry.id] = entry.target;
}
memory.set("kumaChessMedalsV1", JSON.stringify(enthusiastState));
memory.set("kumaChessMedalsBackupV1", JSON.stringify(enthusiastState));
assert.ok(
  medals.readMedalState().unlockedAt["minigame-enthusiast"],
  "Mini-game enthusiast medal did not unlock after every mini-game medal."
);

console.log(`Validated ${entries.length} medals, localized copy, assets, unlocks, and idempotency.`);
