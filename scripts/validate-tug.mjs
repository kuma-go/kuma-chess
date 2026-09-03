import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/scenes/KingdomTug.js", import.meta.url), "utf8");

assert.match(source, /const TURN_DURATION_MS = 8 \* 1000;/, "tug turns must allow eight seconds");
assert.match(source, /updateTurnClock\(delta\)/, "tug update loop must advance the turn clock");
assert.match(source, /this\.shotInProgress \|\| this\.isMotionActive\(\) \|\| this\._turnFlipBusy/, "turn time must pause during shots, motion, and turn flips");
assert.match(source, /skipExpiredTurn\(\)/, "expired tug turns must be skipped");
assert.match(source, /this\.turn = this\.turn === "w" \? "b" : "w";/, "skipping must hand the turn to the opponent");

console.log("Kingdom Tug turn timer validation passed.");
