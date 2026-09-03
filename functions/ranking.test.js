import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import {
  calculateEloPair,
  currentWeeklySeasonId,
  nextLeaderboardEntry,
  publicLeaderboardId,
  verifyFinishedRoom,
} from "./ranking.js";

test("weekly seasons use Korea time and Monday boundaries", () => {
  assert.equal(currentWeeklySeasonId(new Date("2026-08-30T14:59:59Z")), "weekly-2026-W35");
  assert.equal(currentWeeklySeasonId(new Date("2026-08-30T15:00:00Z")), "weekly-2026-W36");
});

test("equal ratings move by 16 points", () => {
  assert.deepEqual(calculateEloPair(1000, 1000, 1), { white: 1016, black: 984, delta: 16 });
  assert.deepEqual(calculateEloPair(1000, 1000, 0.5), { white: 1000, black: 1000, delta: 0 });
});

test("opaque IDs are stable and do not expose auth UIDs", () => {
  assert.equal(publicLeaderboardId("user-a"), publicLeaderboardId("user-a"));
  assert.notEqual(publicLeaderboardId("user-a"), publicLeaderboardId("user-b"));
  assert.doesNotMatch(publicLeaderboardId("user-a"), /user-a/);
});

test("completed checkmates are replayed and actor verified", () => {
  const game = new Chess();
  const moves = [];
  for (const request of [
    { from: "f2", to: "f3" },
    { from: "e7", to: "e5" },
    { from: "g2", to: "g4" },
    { from: "d8", to: "h4" },
  ]) {
    assert.ok(game.move(request));
    moves.push(`${request.from}${request.to}`);
  }
  const room = {
    status: "finished",
    whiteUid: "white",
    blackUid: "black",
    result: "b_win",
    reason: "checkmate",
    moves,
    fen: game.fen(),
  };
  assert.equal(verifyFinishedRoom(room, "black").valid, true);
  assert.equal(verifyFinishedRoom(room, "white").valid, false);
  assert.equal(verifyFinishedRoom({ ...room, fen: new Chess().fen() }, "black").valid, false);
});

test("draws and resignations require the correct result actor", () => {
  const game = new Chess();
  const moves = [];
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (const request of [
      { from: "g1", to: "f3" },
      { from: "g8", to: "f6" },
      { from: "f3", to: "g1" },
      { from: "f6", to: "g8" },
    ]) {
      assert.ok(game.move(request));
      moves.push(`${request.from}${request.to}`);
    }
  }
  const base = { status: "finished", whiteUid: "white", blackUid: "black" };
  assert.equal(verifyFinishedRoom({
    ...base, result: "draw", reason: "draw", moves, fen: game.fen(),
  }, "white").valid, true);

  const initial = new Chess();
  const resigned = { ...base, result: "b_win", reason: "resign", moves: [], fen: initial.fen() };
  assert.equal(verifyFinishedRoom(resigned, "white").valid, true);
  assert.equal(verifyFinishedRoom(resigned, "black").valid, false);
});

test("leaderboard totals increment once per entry update", () => {
  const next = nextLeaderboardEntry(
    { wins: 2, losses: 1, draws: 1, playTimeSeconds: 120 },
    { displayName: "KUMA", avatar: { portraitId: "portrait-basic-01", frameId: "frame-basic-01" } },
    1,
    1042,
    90,
  );
  assert.equal(next.score, 1042);
  assert.equal(next.wins, 3);
  assert.equal(next.played, 5);
  assert.equal(next.playTimeSeconds, 210);
});
