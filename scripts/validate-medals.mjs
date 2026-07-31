import assert from "node:assert/strict";
import fs from "node:fs";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};

const medals = await import(`../src/medals.js?validation=${Date.now()}`);
const entries = medals.getMedalEntries("ko");

assert.equal(entries.length, 50, "The catalog must contain all 50 medal definitions.");
for (const entry of entries) {
  assert.ok(entry.name && entry.description, `Missing Korean copy for ${entry.id}`);
  assert.ok(fs.existsSync(new URL(`../assets/kuma/ui/${entry.asset}`, import.meta.url)), `Missing asset ${entry.asset}`);
}
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

console.log(`Validated ${entries.length} medals, localized copy, assets, unlocks, and idempotency.`);
