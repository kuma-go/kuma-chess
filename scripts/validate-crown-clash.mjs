import assert from "node:assert/strict";
import {
  CROWN_ALLOWED_CELLS,
  CROWN_BOARD_SIZE,
  CROWN_CENTER_CELLS,
  CROWN_START_CELLS,
  chooseCrownCell,
  createCrownClashState,
  crownFirstPlayer,
  crownHomeCells,
  crownLegalMoves,
  crownPieceById,
  isCrownHomeCell,
  moveCrownPiece,
  resolveCrownTurnIfStuck,
  rollCrownDice,
} from "../src/crownClashLogic.js";

const hasMove = (moves, row, col) => moves.some((move) => move.row === row && move.col === col);
const relocate = (state, pieceId, row, col) => {
  const piece = crownPieceById(state, pieceId);
  piece.row = row;
  piece.col = col;
};
const createState = (options) => {
  const state = createCrownClashState(options);
  state.teleports = [];
  return state;
};

assert.equal(CROWN_BOARD_SIZE, 8);
assert.deepEqual(CROWN_START_CELLS.w, {
  knight: { row: 7, col: 0 },
  rook: { row: 7, col: 1 },
  pawn: { row: 6, col: 0 },
});
assert.deepEqual(CROWN_START_CELLS.b, {
  knight: { row: 0, col: 7 },
  rook: { row: 0, col: 6 },
  pawn: { row: 1, col: 7 },
});
assert.deepEqual(crownHomeCells("w"), [{ row: 7, col: 0 }]);
assert.deepEqual(crownHomeCells("b"), [{ row: 0, col: 7 }]);
assert.equal(isCrownHomeCell("w", 7, 0), true);
assert.equal(isCrownHomeCell("w", 6, 0), false);
assert.equal(isCrownHomeCell("b", 0, 7), true);
assert.equal(isCrownHomeCell("b", 1, 7), false);

assert.deepEqual(CROWN_ALLOWED_CELLS, [
  { row: 3, col: 3 },
  { row: 4, col: 4 },
]);
assert.equal(
  CROWN_ALLOWED_CELLS.every(({ row, col }) => (row + col) % 2 === 0),
  true,
  "Crown candidates must use the board renderer's white-square parity",
);
for (let index = 0; index < CROWN_ALLOWED_CELLS.length; index += 1) {
  const selected = chooseCrownCell(() => (index + 0.1) / CROWN_ALLOWED_CELLS.length);
  assert.deepEqual(selected, CROWN_ALLOWED_CELLS[index]);
  assert.equal((selected.row + selected.col) % 2, 0);
}
for (const crownCell of CROWN_ALLOWED_CELLS) {
  const state = createState({ crownCell });
  assert.deepEqual(
    { row: state.crown.row, col: state.crown.col },
    crownCell,
    "An explicit white center crownCell must be accepted",
  );
}
for (const crownCell of CROWN_CENTER_CELLS.filter(({ row, col }) => (row + col) % 2 === 1)) {
  assert.throws(
    () => createState({ crownCell }),
    /white center cell/,
    "An explicit black center crownCell must be rejected",
  );
}
assert.throws(
  () => createState({ crownCell: { row: 2, col: 2 } }),
  /white center cell/,
);

const movement = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(movement, "w-pawn", 4, 4);
let moves = crownLegalMoves(movement, "w-pawn");
assert.equal(moves.length, 4, "Pawn must move one square in each orthogonal direction");
assert.equal(hasMove(moves, 3, 4), true);
assert.equal(hasMove(moves, 3, 3), false, "Pawn cannot move diagonally");

const knightMovement = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(knightMovement, "w-knight", 4, 4);
moves = crownLegalMoves(knightMovement, "w-knight");
assert.equal(moves.length, 8, "Knight must retain all eight standard moves from the center");
assert.equal(hasMove(moves, 2, 3), true);
assert.equal(hasMove(moves, 4, 5), false);

const rookMovement = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(rookMovement, "w-rook", 4, 4);
moves = crownLegalMoves(rookMovement, "w-rook");
assert.equal(moves.length, 8, "Rook must move one or two orthogonal squares");
assert.equal(hasMove(moves, 2, 4), true);
assert.equal(hasMove(moves, 3, 4), true, "Rook may stop after one square");
relocate(rookMovement, "w-pawn", 3, 4);
assert.equal(hasMove(crownLegalMoves(rookMovement, "w-rook"), 2, 4), false, "Rook cannot jump an occupied middle square");
relocate(rookMovement, "w-pawn", 2, 4);
assert.equal(hasMove(crownLegalMoves(rookMovement, "w-rook"), 2, 4), false, "A friendly destination is blocked");
relocate(rookMovement, "w-pawn", 5, 1);
relocate(rookMovement, "b-pawn", 2, 4);
assert.equal(hasMove(crownLegalMoves(rookMovement, "w-rook"), 2, 4), true, "An enemy destination is capturable");

const turnOrder = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
assert.equal(moveCrownPiece(turnOrder, "w-pawn", 5, 0).valid, true);
assert.deepEqual(moveCrownPiece(turnOrder, "w-pawn", 4, 0), { valid: false, reason: "alreadyMoved" });
assert.equal(moveCrownPiece(turnOrder, "b-pawn", 3, 6).reason, "wrongTurn");
assert.equal(moveCrownPiece(turnOrder, "w-knight", 5, 1).valid, true);
const finalWhiteMove = moveCrownPiece(turnOrder, "w-rook", 7, 3);
assert.equal(finalWhiteMove.turnEnded, true);
assert.equal(turnOrder.turn, "b", "Turn changes only after all three pieces move once");
assert.deepEqual(turnOrder.movedPieceIds, []);

const capture = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(capture, "w-pawn", 3, 2);
relocate(capture, "b-pawn", 3, 3);
const captureResult = moveCrownPiece(capture, "w-pawn", 3, 3);
assert.equal(captureResult.capturedId, "b-pawn");
assert.deepEqual(captureResult.capturedReturnCell, CROWN_START_CELLS.b.pawn);
assert.deepEqual(
  { row: crownPieceById(capture, "b-pawn").row, col: crownPieceById(capture, "b-pawn").col },
  CROWN_START_CELLS.b.pawn,
);

const occupiedStart = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(occupiedStart, "w-rook", 2, 4);
relocate(occupiedStart, "b-knight", 2, 6);
relocate(occupiedStart, "b-pawn", 0, 7);
const fallback = moveCrownPiece(occupiedStart, "w-rook", 2, 6);
assert.equal(fallback.capturedId, "b-knight");
assert.deepEqual(fallback.capturedReturnCell, { row: 1, col: 7 }, "Occupied start uses the nearest empty home cell with deterministic ordering");

const pickup = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(pickup, "w-pawn", 3, 2);
const pickupResult = moveCrownPiece(pickup, "w-pawn", 3, 3);
assert.equal(pickupResult.crownPicked, true);
assert.equal(pickup.crown.carrierId, "w-pawn");
assert.deepEqual({ row: pickup.crown.row, col: pickup.crown.col }, { row: 3, col: 3 });

const theft = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(theft, "w-pawn", 3, 2);
relocate(theft, "b-pawn", 3, 3);
theft.crown.carrierId = "b-pawn";
const theftResult = moveCrownPiece(theft, "w-pawn", 3, 3);
assert.equal(theftResult.crownStolen, true);
assert.equal(theft.crown.carrierId, "w-pawn", "Capturing piece immediately steals the crown");

const teleportTheft = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(teleportTheft, "w-pawn", 4, 1);
relocate(teleportTheft, "b-pawn", 2, 5);
teleportTheft.crown.carrierId = "b-pawn";
teleportTheft.crown.row = 2;
teleportTheft.crown.col = 5;
teleportTheft.teleports = [{ row: 4, col: 2 }, { row: 2, col: 5 }];
const teleportResult = moveCrownPiece(teleportTheft, "w-pawn", 4, 2, () => 0);
assert.equal(teleportResult.teleported, true);
assert.deepEqual({ row: teleportResult.row, col: teleportResult.col }, { row: 2, col: 5 });
assert.equal(teleportResult.crownStolen, true, "Teleporting onto a carrier steals the crown");
assert.equal(teleportTheft.crown.carrierId, "w-pawn");
assert.equal(teleportTheft.teleports.length, 2, "A consumed pair is replaced immediately");
assert.equal(teleportTheft.teleportGeneration, 2);

const blockedTeleport = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(blockedTeleport, "w-pawn", 4, 1);
relocate(blockedTeleport, "w-rook", 2, 5);
blockedTeleport.teleports = [{ row: 4, col: 2 }, { row: 2, col: 5 }];
const blockedTeleportResult = moveCrownPiece(blockedTeleport, "w-pawn", 4, 2, () => 0);
assert.equal(blockedTeleportResult.teleported, false, "A friendly piece blocks the teleport exit");
assert.deepEqual(blockedTeleport.teleports, [{ row: 4, col: 2 }, { row: 2, col: 5 }]);

const victory = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(victory, "w-knight", 5, 1);
relocate(victory, "w-pawn", 6, 0);
victory.crown.carrierId = "w-pawn";
victory.crown.row = 6;
victory.crown.col = 0;
const victoryResult = moveCrownPiece(victory, "w-pawn", 7, 0);
assert.equal(victoryResult.winner, "w");
assert.equal(victory.winner, "w", "A carrier wins only on entering its knight start square");
assert.equal(moveCrownPiece(victory, "w-rook", 7, 3).reason, "gameOver");

const formerZone = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(formerZone, "w-pawn", 4, 1);
formerZone.crown.carrierId = "w-pawn";
const formerZoneResult = moveCrownPiece(formerZone, "w-pawn", 5, 1);
assert.equal(formerZoneResult.winner, null, "Entering the old 3x3 setup area must not end the match");

const stuckTurn = createState({ crownCell: { row: 3, col: 3 }, turn: "w" });
relocate(stuckTurn, "w-pawn", 7, 7);
relocate(stuckTurn, "w-knight", 6, 7);
relocate(stuckTurn, "w-rook", 7, 6);
stuckTurn.movedPieceIds = ["w-knight", "w-rook"];
const stuckResult = resolveCrownTurnIfStuck(stuckTurn);
assert.equal(stuckResult.turnEnded, true, "A side must not freeze when its final piece has no legal move");
assert.deepEqual(stuckResult.passedIds, ["w-pawn"]);
assert.equal(stuckTurn.turn, "b");
assert.deepEqual(stuckTurn.movedPieceIds, []);

const minimumRoll = rollCrownDice(() => 0);
const maximumRoll = rollCrownDice(() => 0.999999);
assert.deepEqual(minimumRoll, { values: [1, 1], total: 2 });
assert.deepEqual(maximumRoll, { values: [6, 6], total: 12 });
assert.equal(crownFirstPlayer(minimumRoll, maximumRoll), "b");
assert.equal(crownFirstPlayer(11, 3), "w");
assert.equal(crownFirstPlayer(7, 7), null, "Tied dice require a reroll");

console.log("Validated Crown Clash: movement, full-piece turns, captures, crown transfer, home victory, and dice.");
