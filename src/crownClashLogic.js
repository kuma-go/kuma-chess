export const CROWN_BOARD_SIZE = 8;

export const CROWN_CENTER_CELLS = Object.freeze([
  Object.freeze({ row: 3, col: 3 }),
  Object.freeze({ row: 3, col: 4 }),
  Object.freeze({ row: 4, col: 3 }),
  Object.freeze({ row: 4, col: 4 }),
]);

export const CROWN_ALLOWED_CELLS = Object.freeze(
  CROWN_CENTER_CELLS.filter(({ row, col }) => (row + col) % 2 === 0),
);

export const CROWN_START_CELLS = Object.freeze({
  w: Object.freeze({
    knight: Object.freeze({ row: 7, col: 0 }),
    rook: Object.freeze({ row: 7, col: 1 }),
    pawn: Object.freeze({ row: 6, col: 0 }),
  }),
  b: Object.freeze({
    knight: Object.freeze({ row: 0, col: 7 }),
    rook: Object.freeze({ row: 0, col: 6 }),
    pawn: Object.freeze({ row: 1, col: 7 }),
  }),
});

const COLORS = Object.freeze(["w", "b"]);
const PIECE_TYPES = Object.freeze(["knight", "rook", "pawn"]);
const PAWN_DELTAS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 0]),
  Object.freeze([0, -1]),
]);
const KNIGHT_DELTAS = Object.freeze([
  Object.freeze([-2, -1]),
  Object.freeze([-2, 1]),
  Object.freeze([-1, -2]),
  Object.freeze([-1, 2]),
  Object.freeze([1, -2]),
  Object.freeze([1, 2]),
  Object.freeze([2, -1]),
  Object.freeze([2, 1]),
]);
const ROOK_DELTAS = Object.freeze([
  Object.freeze([-1, 0]),
  Object.freeze([-2, 0]),
  Object.freeze([0, 1]),
  Object.freeze([0, 2]),
  Object.freeze([1, 0]),
  Object.freeze([2, 0]),
  Object.freeze([0, -1]),
  Object.freeze([0, -2]),
]);

function isColor(color) {
  return COLORS.includes(color);
}

function isCell(cell) {
  return Number.isInteger(cell?.row)
    && Number.isInteger(cell?.col)
    && cell.row >= 0
    && cell.row < CROWN_BOARD_SIZE
    && cell.col >= 0
    && cell.col < CROWN_BOARD_SIZE;
}

function sameCell(a, b) {
  return a?.row === b?.row && a?.col === b?.col;
}

function createPiece(color, type) {
  const start = CROWN_START_CELLS[color][type];
  return {
    id: `${color}-${type}`,
    color,
    type,
    row: start.row,
    col: start.col,
    start: { ...start },
  };
}

export function chooseCrownCell(random = Math.random) {
  const sample = Number(random());
  const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
  const cell = CROWN_ALLOWED_CELLS[Math.floor(normalized * CROWN_ALLOWED_CELLS.length)];
  return { ...cell };
}

export function createCrownClashState({ crownCell = null, turn = null, random = Math.random } = {}) {
  const selectedCrownCell = crownCell ? { ...crownCell } : chooseCrownCell(random);
  if (!CROWN_ALLOWED_CELLS.some((cell) => sameCell(cell, selectedCrownCell))) {
    throw new RangeError("The crown must start on a white center cell.");
  }
  if (turn !== null && !isColor(turn)) {
    throw new RangeError("The opening turn must be 'w', 'b', or null.");
  }

  const state = {
    turn,
    movedPieceIds: [],
    winner: null,
    teleportGeneration: 0,
    teleports: [],
    crown: {
      row: selectedCrownCell.row,
      col: selectedCrownCell.col,
      carrierId: null,
    },
    pieces: COLORS.flatMap((color) => PIECE_TYPES.map((type) => createPiece(color, type))),
  };
  regenerateCrownTeleports(state, random);
  return state;
}

export function cloneCrownClashState(state) {
  return {
    ...state,
    movedPieceIds: [...state.movedPieceIds],
    crown: { ...state.crown },
    teleports: state.teleports.map((cell) => ({ ...cell })),
    pieces: state.pieces.map((piece) => ({ ...piece, start: { ...piece.start } })),
  };
}

export function crownPieceById(state, pieceId) {
  return state?.pieces?.find((piece) => piece.id === pieceId) || null;
}

export function crownPieceAt(state, row, col, excludedId = null) {
  return state?.pieces?.find((piece) => (
    piece.id !== excludedId && piece.row === row && piece.col === col
  )) || null;
}

export function isCrownHomeCell(color, row, col) {
  if (!isColor(color) || !isCell({ row, col })) return false;
  return sameCell({ row, col }, CROWN_START_CELLS[color].knight);
}

export function crownHomeCells(color) {
  if (!isColor(color)) return [];
  return [{ ...CROWN_START_CELLS[color].knight }];
}

export function regenerateCrownTeleports(state, random = Math.random) {
  if (!state) return [];
  const blocked = new Set(state.pieces.map((piece) => `${piece.row},${piece.col}`));
  blocked.add(`${CROWN_START_CELLS.w.knight.row},${CROWN_START_CELLS.w.knight.col}`);
  blocked.add(`${CROWN_START_CELLS.b.knight.row},${CROWN_START_CELLS.b.knight.col}`);
  if (!state.crown.carrierId) blocked.add(`${state.crown.row},${state.crown.col}`);

  const candidates = [];
  for (let row = 0; row < CROWN_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CROWN_BOARD_SIZE; col += 1) {
      if (!blocked.has(`${row},${col}`)) candidates.push({ row, col });
    }
  }
  if (candidates.length < 2) {
    state.teleports = [];
    return [];
  }

  const pickIndex = (length) => {
    const sample = Number(random());
    const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
    return Math.floor(normalized * length);
  };
  const first = candidates.splice(pickIndex(candidates.length), 1)[0];
  const distant = candidates.filter((cell) => (
    Math.abs(cell.row - first.row) + Math.abs(cell.col - first.col) >= 3
  ));
  const pool = distant.length ? distant : candidates;
  const second = pool[pickIndex(pool.length)];
  state.teleports = [{ ...first }, { ...second }];
  state.teleportGeneration = (state.teleportGeneration || 0) + 1;
  return state.teleports.map((cell) => ({ ...cell }));
}

function crownResetCells(color) {
  const cells = [];
  for (let row = 0; row < CROWN_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CROWN_BOARD_SIZE; col += 1) {
      const inResetZone = color === "w"
        ? row >= 5 && col <= 2
        : row <= 2 && col >= 5;
      if (inResetZone) cells.push({ row, col });
    }
  }
  return cells;
}

export function setCrownClashTurn(state, color) {
  if (!state || state.winner || !isColor(color)) return false;
  state.turn = color;
  state.movedPieceIds = [];
  return true;
}

function movementDeltas(type) {
  if (type === "pawn") return PAWN_DELTAS;
  if (type === "knight") return KNIGHT_DELTAS;
  if (type === "rook") return ROOK_DELTAS;
  return [];
}

function rookPathIsClear(state, piece, destination) {
  const distance = Math.abs(destination.row - piece.row) + Math.abs(destination.col - piece.col);
  if (distance <= 1) return true;
  const middleRow = piece.row + (destination.row - piece.row) / 2;
  const middleCol = piece.col + (destination.col - piece.col) / 2;
  return !crownPieceAt(state, middleRow, middleCol, piece.id);
}

export function crownLegalMoves(state, pieceId) {
  const piece = crownPieceById(state, pieceId);
  if (!piece || state.winner || !state.turn || piece.color !== state.turn) return [];
  if (state.movedPieceIds.includes(piece.id)) return [];

  return movementDeltas(piece.type).flatMap(([deltaRow, deltaCol]) => {
    const destination = { row: piece.row + deltaRow, col: piece.col + deltaCol };
    if (!isCell(destination)) return [];
    if (piece.type === "rook" && !rookPathIsClear(state, piece, destination)) return [];
    const occupant = crownPieceAt(state, destination.row, destination.col, piece.id);
    if (occupant?.color === piece.color) return [];
    return [{
      ...destination,
      captureId: occupant?.id || null,
    }];
  });
}

function nearestEmptyHomeCell(state, piece) {
  const candidates = crownResetCells(piece.color)
    .filter((cell) => !crownPieceAt(state, cell.row, cell.col, piece.id))
    .sort((a, b) => {
      const aDistance = Math.abs(a.row - piece.start.row) + Math.abs(a.col - piece.start.col);
      const bDistance = Math.abs(b.row - piece.start.row) + Math.abs(b.col - piece.start.col);
      return aDistance - bDistance || a.row - b.row || a.col - b.col;
    });
  return candidates[0] || null;
}

function returnCapturedPieceHome(state, piece) {
  const destination = crownPieceAt(state, piece.start.row, piece.start.col, piece.id)
    ? nearestEmptyHomeCell(state, piece)
    : piece.start;
  if (!destination) return null;
  piece.row = destination.row;
  piece.col = destination.col;
  return { ...destination };
}

export function moveCrownPiece(state, pieceId, row, col, random = Math.random) {
  if (!state || state.winner) return { valid: false, reason: "gameOver" };
  if (!state.turn) return { valid: false, reason: "notStarted" };
  const piece = crownPieceById(state, pieceId);
  if (!piece) return { valid: false, reason: "unknownPiece" };
  if (piece.color !== state.turn) return { valid: false, reason: "wrongTurn" };
  if (state.movedPieceIds.includes(piece.id)) return { valid: false, reason: "alreadyMoved" };

  const move = crownLegalMoves(state, pieceId).find((candidate) => (
    candidate.row === row && candidate.col === col
  ));
  if (!move) return { valid: false, reason: "illegalMove" };

  const captured = move.captureId ? crownPieceById(state, move.captureId) : null;
  const capturedIds = [];
  const capturedReturnCells = [];
  let capturedHadCrown = false;
  piece.row = row;
  piece.col = col;

  const capturePiece = (target) => {
    if (!target) return;
    if (state.crown.carrierId === target.id) capturedHadCrown = true;
    capturedIds.push(target.id);
    capturedReturnCells.push(returnCapturedPieceHome(state, target));
  };
  capturePiece(captured);

  let teleported = false;
  let teleportFrom = null;
  let teleportTo = null;
  let teleportsRegenerated = false;
  const teleportIndex = state.teleports.findIndex((cell) => cell.row === row && cell.col === col);
  if (teleportIndex >= 0) {
    const exit = state.teleports[teleportIndex === 0 ? 1 : 0];
    const exitOccupant = crownPieceAt(state, exit.row, exit.col, piece.id);
    if (!exitOccupant || exitOccupant.color !== piece.color) {
      teleportFrom = { row, col };
      teleportTo = { ...exit };
      capturePiece(exitOccupant);
      piece.row = exit.row;
      piece.col = exit.col;
      row = exit.row;
      col = exit.col;
      teleported = true;
      state.teleports = [];
      regenerateCrownTeleports(state, random);
      teleportsRegenerated = true;
    }
  }

  let crownPicked = false;
  let crownStolen = false;
  if (capturedHadCrown) {
    state.crown.carrierId = piece.id;
    crownStolen = true;
  } else if (!state.crown.carrierId && state.crown.row === row && state.crown.col === col) {
    state.crown.carrierId = piece.id;
    crownPicked = true;
  }
  if (state.crown.carrierId === piece.id) {
    state.crown.row = row;
    state.crown.col = col;
  }

  state.movedPieceIds.push(piece.id);
  if (state.crown.carrierId === piece.id && isCrownHomeCell(piece.color, row, col)) {
    state.winner = piece.color;
  }

  const turnEnded = !state.winner
    && state.pieces
      .filter((candidate) => candidate.color === state.turn)
      .every((candidate) => state.movedPieceIds.includes(candidate.id));
  if (turnEnded) {
    state.turn = state.turn === "w" ? "b" : "w";
    state.movedPieceIds = [];
  }

  return {
    valid: true,
    pieceId: piece.id,
    row,
    col,
    capturedId: capturedIds[0] || null,
    capturedIds,
    capturedReturnCell: capturedReturnCells[0] || null,
    capturedReturnCells,
    crownPicked,
    crownStolen,
    teleported,
    teleportFrom,
    teleportTo,
    teleportsRegenerated,
    winner: state.winner,
    turnEnded,
    nextTurn: state.turn,
  };
}

export function resolveCrownTurnIfStuck(state) {
  if (!state || state.winner || !state.turn) {
    return { turnEnded: false, passedIds: [], nextTurn: state?.turn ?? null };
  }

  const remaining = state.pieces.filter((piece) => (
    piece.color === state.turn && !state.movedPieceIds.includes(piece.id)
  ));
  if (!remaining.length || remaining.some((piece) => crownLegalMoves(state, piece.id).length > 0)) {
    return { turnEnded: false, passedIds: [], nextTurn: state.turn };
  }

  const passedIds = remaining.map((piece) => piece.id);
  state.movedPieceIds.push(...passedIds);
  state.turn = state.turn === "w" ? "b" : "w";
  state.movedPieceIds = [];
  return { turnEnded: true, passedIds, nextTurn: state.turn };
}

export function rollCrownDice(random = Math.random) {
  const die = () => {
    const sample = Number(random());
    const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
    return Math.floor(normalized * 6) + 1;
  };
  const values = [die(), die()];
  return { values, total: values[0] + values[1] };
}

export function crownFirstPlayer(whiteRoll, blackRoll) {
  const total = (roll) => typeof roll === "number" ? roll : roll?.total;
  const whiteTotal = total(whiteRoll);
  const blackTotal = total(blackRoll);
  if (!Number.isFinite(whiteTotal) || !Number.isFinite(blackTotal)) return null;
  if (whiteTotal === blackTotal) return null;
  return whiteTotal > blackTotal ? "w" : "b";
}
