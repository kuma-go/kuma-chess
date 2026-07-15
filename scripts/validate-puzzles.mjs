import { Chess, validateFen } from "../src/vendor-chess.js";
import { PUZZLES } from "../src/puzzles.js";

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const errors = [];
const ids = new Set();
const positions = new Map();
const colorSwapPositions = new Map();

function fail(puzzle, message) {
  errors.push(`${puzzle?.id || "<unknown>"}: ${message}`);
}

function applyUci(game, uci) {
  return game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
}

function positionKey(fen) {
  return fen.split(/\s+/).slice(0, 4).join(" ");
}

function colorSwapPositionKey(fen) {
  const [board, turn, castling, ep] = fen.split(/\s+/);
  const swappedBoard = board.split("/").reverse().map((row) => (
    [...row].map((char) => {
      if (!/[a-z]/i.test(char)) return char;
      return char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
    }).join("")
  )).join("/");
  const swappedCastling = castling === "-"
    ? "-"
    : ["K", "Q", "k", "q"].filter((right) => {
        const source = right === right.toUpperCase() ? right.toLowerCase() : right.toUpperCase();
        return castling.includes(source);
      }).join("") || "-";
  const swappedEp = ep === "-" ? "-" : `${ep[0]}${9 - Number(ep[1])}`;
  return `${swappedBoard} ${turn === "w" ? "b" : "w"} ${swappedCastling} ${swappedEp}`;
}

for (const puzzle of PUZZLES) {
  if (!puzzle?.id || typeof puzzle.id !== "string") {
    fail(puzzle, "missing string id");
    continue;
  }
  if (ids.has(puzzle.id)) fail(puzzle, "duplicate id");
  ids.add(puzzle.id);

  const fenResult = validateFen(puzzle.fen);
  if (!fenResult.ok) {
    fail(puzzle, `invalid FEN: ${fenResult.error}`);
    continue;
  }

  const key = positionKey(puzzle.fen);
  if (positions.has(key)) {
    fail(puzzle, `duplicates the position used by ${positions.get(key)}`);
  } else {
    positions.set(key, puzzle.id);
  }
  const transformedKey = colorSwapPositionKey(puzzle.fen);
  if (colorSwapPositions.has(key)) {
    fail(puzzle, `is a color-swapped position of ${colorSwapPositions.get(key)}`);
  }
  if (!colorSwapPositions.has(transformedKey)) colorSwapPositions.set(transformedKey, puzzle.id);

  let game;
  try {
    game = new Chess(puzzle.fen);
  } catch (error) {
    fail(puzzle, `FEN could not be loaded: ${error.message}`);
    continue;
  }

  if (!['w', 'b'].includes(puzzle.playerColor)) {
    fail(puzzle, `invalid playerColor: ${puzzle.playerColor}`);
    continue;
  }
  if (game.turn() !== puzzle.playerColor) {
    fail(puzzle, `initial turn is ${game.turn()}, expected ${puzzle.playerColor}`);
  }
  if (!Array.isArray(puzzle.solutionSteps) || puzzle.solutionSteps.length === 0) {
    fail(puzzle, "solutionSteps must be a non-empty array");
    continue;
  }

  const puzzleIndex = PUZZLES.indexOf(puzzle);
  if (puzzleIndex >= 24) {
    for (const language of ["en", "ja"]) {
      for (const field of ["title", "prompt", "hint"]) {
        if (typeof puzzle.localized?.[language]?.[field] !== "string" || !puzzle.localized[language][field].trim()) {
          fail(puzzle, `missing localized.${language}.${field}`);
        }
      }
    }
  }
  if (puzzle.solutionSteps.length % 2 === 0) {
    fail(puzzle, "solutionSteps must end with a player move");
  }

  let playerCaptured = false;
  let playerPromoted = false;
  let lineCompleted = true;

  for (let stepIndex = 0; stepIndex < puzzle.solutionSteps.length; stepIndex += 1) {
    const choices = puzzle.solutionSteps[stepIndex];
    const expectedTurn = stepIndex % 2 === 0
      ? puzzle.playerColor
      : puzzle.playerColor === "w" ? "b" : "w";

    if (game.turn() !== expectedTurn) {
      fail(puzzle, `step ${stepIndex + 1} turn is ${game.turn()}, expected ${expectedTurn}`);
      lineCompleted = false;
      break;
    }
    if (!Array.isArray(choices) || choices.length === 0) {
      fail(puzzle, `step ${stepIndex + 1} has no UCI choices`);
      lineCompleted = false;
      break;
    }

    const positionFen = game.fen();
    for (const uci of choices) {
      if (typeof uci !== "string" || !UCI_PATTERN.test(uci)) {
        fail(puzzle, `step ${stepIndex + 1} has malformed UCI: ${String(uci)}`);
        continue;
      }
      try {
        const branch = new Chess(positionFen);
        applyUci(branch, uci);
      } catch (error) {
        fail(puzzle, `step ${stepIndex + 1} move ${uci} is illegal: ${error.message}`);
      }
    }

    const selected = choices[0];
    if (typeof selected !== "string" || !UCI_PATTERN.test(selected)) break;
    try {
      const move = applyUci(game, selected);
      if (stepIndex % 2 === 0) {
        playerCaptured ||= !!move?.captured;
        playerPromoted ||= !!move?.promotion;
      }
    } catch (error) {
      lineCompleted = false;
      break;
    }

    if (stepIndex % 2 === 1 && game.turn() !== puzzle.playerColor) {
      fail(puzzle, `after automatic response ${selected}, turn did not return to player`);
      break;
    }
  }

  if (lineCompleted) {
    const tags = Array.isArray(puzzle.tags) ? puzzle.tags : [];
    const claimsMate = tags.some((tag) => tag.includes("mate"));
    if (claimsMate && !game.isCheckmate()) {
      fail(puzzle, "scripted line is tagged as mate but does not end in checkmate");
    }
    if (puzzleIndex >= 48 && tags.includes("capture") && !playerCaptured) {
      fail(puzzle, "advanced capture puzzle line does not include a player capture");
    }
    if (puzzleIndex >= 48 && tags.includes("promotion") && !playerPromoted) {
      fail(puzzle, "advanced promotion puzzle line does not include a player promotion");
    }
  }
}

const newPuzzles = PUZZLES.slice(24);
const multiStepCount = PUZZLES.filter((puzzle) => puzzle.solutionSteps.length >= 3).length;

if (PUZZLES.length !== 64) errors.push(`expected exactly 64 puzzles, found ${PUZZLES.length}`);
if (newPuzzles.length < 40) errors.push(`expected at least 40 localized puzzles, found ${newPuzzles.length}`);
if (multiStepCount < 20) errors.push(`expected at least 20 multi-step puzzles, found ${multiStepCount}`);

if (errors.length > 0) {
  console.error(`Puzzle validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${PUZZLES.length} puzzles (${newPuzzles.length} localized, ${multiStepCount} multi-step).`);
