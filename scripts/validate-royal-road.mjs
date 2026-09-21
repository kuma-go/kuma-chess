import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeRoadForcedTarget,
  advanceRoadKing,
  applyRoadClockEffect,
  beginNextRoadInterval,
  createRoadClock,
  createRoadSide,
  getRoadPlacement,
  placeRoadTile,
  ROAD_ROWS,
  roadKingCell,
  roadRemainingTiles,
  roadVisualTileId,
  roadWinner,
} from "../src/royalRoadLogic.js";

function extractSceneMethod(source, methodName, scope = {}) {
  const signaturePattern = new RegExp(`\\n\\s*${methodName}\\(ownerColor\\) \\{`);
  const signatureMatch = signaturePattern.exec(source);
  const signatureStart = signatureMatch ? signatureMatch.index + signatureMatch[0].indexOf(methodName) : -1;
  assert.notEqual(signatureStart, -1, `RoyalRoad must retain ${methodName}`);
  const bodyStart = source.indexOf("{", signatureStart);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        const methodSource = source.slice(signatureStart, index + 1);
        return Function(...Object.keys(scope), `return ({ ${methodSource} }).${methodName}`)(...Object.values(scope));
      }
    }
  }
  assert.fail(`Could not extract ${methodName}`);
}

const normalizeQueuePreview = extractSceneMethod(
  readFileSync(new URL("../src/scenes/RoyalRoad.js", import.meta.url), "utf8"),
  "normalizeQueuePreview",
  { activeRoadForcedTarget }
);

function makeQueueHarness(sides, forcedTargets, queues) {
  return {
    sides,
    forcedTargets,
    queues,
    randomTile: () => "straight",
    randomNonResumeTile: () => "straight",
    forcedResumeFor: (tileId) => tileId === "left" ? "resumeLeft" : tileId === "right" ? "resumeRight" : null,
    normalizeQueuePreview,
  };
}

assert.equal(ROAD_ROWS, 12, "Royal Road must use twelve vertical rows");

const white = createRoadSide("w");
const black = createRoadSide("b");
assert.deepEqual(white.endpoint, { row: 9, col: 1 });
assert.deepEqual(black.endpoint, { row: 2, col: 1 });
assert.equal(roadRemainingTiles(white), 10, "The prebuilt forward tile must leave ten tiles to the castle");
assert.equal(roadVisualTileId("left", true), "left");
assert.equal(roadVisualTileId("left", false), "right", "Top-down left turns must swap their visual corner asset");
assert.equal(roadVisualTileId("resumeLeft", false), "resumeRight", "Top-down return corners must keep the route connected");

assert.equal(placeRoadTile(white, "left").valid, true);
assert.deepEqual(white.endpoint, { row: 9, col: 0 });
assert.equal(white.lateral, -1, "A left corner must put the road into lateral movement");
assert.equal(getRoadPlacement(white, "left").valid, false, "A lateral road must force its return corner");
assert.equal(getRoadPlacement(white, "resumeLeft").valid, true);
assert.equal(placeRoadTile(white, "resumeLeft").valid, true);
assert.deepEqual(white.endpoint, { row: 8, col: 0 });
assert.equal(white.lateral, 0, "The forced corner must restore forward movement");

const staleForcedTarget = createRoadSide("w");
placeRoadTile(staleForcedTarget, "left");
assert.equal(activeRoadForcedTarget({ w: staleForcedTarget }, "w"), "w");
placeRoadTile(staleForcedTarget, "crossroad");
assert.equal(staleForcedTarget.lateral, 0);
assert.equal(
  activeRoadForcedTarget({ w: staleForcedTarget }, "w"),
  null,
  "A universal tile must release a stale forced target so the queue can recover"
);

const staleWhite = createRoadSide("w");
const staleBlack = createRoadSide("b");
placeRoadTile(staleWhite, "left");
placeRoadTile(staleWhite, "crossroad");
placeRoadTile(staleBlack, "right");
placeRoadTile(staleBlack, "crossroad");
const recoveredQueues = makeQueueHarness(
  { w: staleWhite, b: staleBlack },
  { w: "w", b: "b" },
  { w: ["resumeLeft", "resumeRight"], b: ["resumeRight", "resumeLeft"] }
);
recoveredQueues.normalizeQueuePreview("w");
recoveredQueues.normalizeQueuePreview("b");
assert.deepEqual(recoveredQueues.forcedTargets, { w: null, b: null });
for (const color of ["w", "b"]) {
  assert.notEqual(recoveredQueues.queues[color][0], "resumeLeft");
  assert.notEqual(recoveredQueues.queues[color][0], "resumeRight");
  assert.equal(getRoadPlacement(recoveredQueues.sides[color], recoveredQueues.queues[color][0]).valid, true);
}

const activeCorner = createRoadSide("w");
placeRoadTile(activeCorner, "left");
const activeCornerQueue = makeQueueHarness(
  { w: activeCorner, b: createRoadSide("b") },
  { w: "w", b: null },
  { w: ["straight", "straight"], b: ["straight", "straight"] }
);
activeCornerQueue.normalizeQueuePreview("w");
assert.equal(activeCornerQueue.forcedTargets.w, "w", "An active corner must retain its forced target");
assert.equal(activeCornerQueue.queues.w[0], "resumeLeft");
assert.equal(getRoadPlacement(activeCornerQueue.sides.w, activeCornerQueue.queues.w[0]).valid, true);

for (const tileId of ["crossroad", "bomb", "spike", "trap"]) {
  const universal = createRoadSide("w");
  placeRoadTile(universal, "left");
  assert.equal(getRoadPlacement(universal, tileId).valid, true, `${tileId} must connect from a lateral endpoint`);
  assert.equal(placeRoadTile(universal, tileId).valid, true);
  assert.equal(universal.lateral, 0, `${tileId} must restore forward movement`);
}

const clock = createRoadClock();
applyRoadClockEffect(clock, "bomb");
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 4000, skipCurrent: false });
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 3000, skipCurrent: false }, "Bomb delay lasts one interval");

applyRoadClockEffect(clock, "spike");
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 3500, skipCurrent: false });

applyRoadClockEffect(clock, "trap");
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 3000, skipCurrent: true });
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 3000, skipCurrent: false }, "Trap skips one placement cycle");

applyRoadClockEffect(clock, "speed");
for (let index = 0; index < 3; index += 1) {
  assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 1500, skipCurrent: false });
}
assert.deepEqual(beginNextRoadInterval(clock), { durationMs: 3000, skipCurrent: false }, "Speed lasts exactly three intervals");

const effects = createRoadSide("w");
placeRoadTile(effects, "bomb");
const bomb = advanceRoadKing(effects);
assert.equal(bomb.effect, "bomb", "A king triggers an obstacle only when reaching its tile");
assert.equal(advanceRoadKing(effects).moved, false, "A king cannot move beyond its connected route");

const race = { w: createRoadSide("w"), b: createRoadSide("b") };
while (race.w.endpoint.row >= 0) {
  placeRoadTile(race.w, "straight");
  advanceRoadKing(race.w);
}
assert.equal(roadKingCell(race.w).row, 0);
assert.equal(roadWinner(race), "w");

console.log("Validated Royal Road: real-time intervals, universal crossroads, turns, and 3x12 victory paths.");
