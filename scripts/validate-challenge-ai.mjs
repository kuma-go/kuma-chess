import assert from "node:assert/strict";
import fs from "node:fs";

import { chooseChallengeMove } from "../src/ai/challengeEngine.js";
import { Chess } from "../src/vendor-chess.js";

const gameSceneSource = fs.readFileSync(new URL("../src/scenes/Game.js", import.meta.url), "utf8");
assert.match(gameSceneSource, /COSTS\.aiUndo/, "AI undo must use the shared configured cost");
assert.match(gameSceneSource, /spendCoins\(COSTS\.aiUndo\)/, "AI undo must charge coins only through player state");
assert.match(gameSceneSource, /showGameConfirm\(/, "AI undo must require confirmation before charging");

const opening = new Chess();
const openingFen = opening.fen();
const openingResult = chooseChallengeMove(opening, "w", { timeMs: 100, maxDepth: 2 });
assert.deepEqual(openingResult.move, { from: "e2", to: "e4" }, "Challenge AI must use its legal opening book.");
assert.equal(opening.fen(), openingFen, "Opening selection must not mutate the source position.");

const mate = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
const mateFen = mate.fen();
const mateResult = chooseChallengeMove(mate, "w", {
  timeMs: 700,
  maxDepth: 4,
  nodeLimit: 80000,
  useBook: false,
});
assert.ok(mateResult.move, "Challenge AI must return a move in a legal position.");
mate.move(mateResult.move);
assert.ok(mate.isCheckmate(), `Challenge AI missed mate in one with ${JSON.stringify(mateResult.move)}.`);
assert.notEqual(mate.fen(), mateFen, "The validation move must have been applied.");

const search = new Chess("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 2 3");
const searchFen = search.fen();
const startedAt = Date.now();
const searchResult = chooseChallengeMove(search, "w", {
  timeMs: 350,
  maxDepth: 5,
  nodeLimit: 70000,
  useBook: false,
});
const legalKeys = new Set(search.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion || ""}`));
const resultKey = `${searchResult.move?.from || ""}${searchResult.move?.to || ""}${searchResult.move?.promotion || ""}`;
assert.ok(legalKeys.has(resultKey), `Challenge AI returned an illegal move: ${resultKey}`);
assert.equal(search.fen(), searchFen, "Search must restore the source position after iterative deepening.");
assert.ok(Date.now() - startedAt < 2000, "Challenge AI must respect a practical browser search budget.");

console.log(`Validated challenge AI opening, mate search, legality, and position integrity (${searchResult.depth} ply, ${searchResult.nodes} nodes).`);
