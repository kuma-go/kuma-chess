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

function findKingSquare(game, color) {
  return game.board().flat().find((piece) => piece?.type === "k" && piece.color === color)?.square;
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

  const inactiveColor = game.turn() === "w" ? "b" : "w";
  const inactiveKing = findKingSquare(game, inactiveColor);
  if (inactiveKing && game.isAttacked(inactiveKing, game.turn())) {
    fail(puzzle, "the side that just moved left its own king in check");
  }
  if (game.isGameOver()) {
    fail(puzzle, "initial position is already game over");
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
  const isNewAdvancedPuzzle = puzzleIndex >= 64;
  for (const field of ["title", "prompt", "hint"]) {
    if (typeof puzzle[field] !== "string" || !puzzle[field].trim()) {
      fail(puzzle, `missing ${field}`);
    }
  }
  if (!Array.isArray(puzzle.tags) || puzzle.tags.length === 0) {
    fail(puzzle, "tags must be a non-empty array");
  }
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
  if (isNewAdvancedPuzzle && puzzle.solutionSteps.length < 3) {
    fail(puzzle, "new advanced puzzles must have at least two player moves");
  }
  if (isNewAdvancedPuzzle) {
    if (puzzle.source?.provider !== "lichess" || typeof puzzle.source?.puzzleId !== "string") {
      fail(puzzle, "new advanced puzzle is missing its Lichess source metadata");
    }
    if (!Number.isFinite(puzzle.source?.rating) || puzzle.source.rating < 1950) {
      fail(puzzle, "new advanced puzzle rating must be at least 1950");
    }
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
    if (stepIndex % 2 === 1 && choices.length !== 1) {
      fail(puzzle, `automatic response at step ${stepIndex + 1} must contain exactly one move`);
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

    if (isNewAdvancedPuzzle && stepIndex < puzzle.solutionSteps.length - 1 && game.isGameOver()) {
      fail(puzzle, `scripted line ends before step ${puzzle.solutionSteps.length}`);
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
    const normalizedTags = tags.map((tag) => String(tag).toLowerCase());
    const claimsMate = normalizedTags.some((tag) => tag.includes("mate"));
    if (claimsMate && !game.isCheckmate()) {
      fail(puzzle, "scripted line is tagged as mate but does not end in checkmate");
    }
    if (puzzleIndex >= 48 && normalizedTags.includes("capture") && !playerCaptured) {
      fail(puzzle, "advanced capture puzzle line does not include a player capture");
    }
    if (puzzleIndex >= 48 && normalizedTags.includes("promotion") && !playerPromoted) {
      fail(puzzle, "advanced promotion puzzle line does not include a player promotion");
    }
  }
}

const newPuzzles = PUZZLES.slice(24);
const advancedPuzzles = PUZZLES.slice(64);
const multiStepCount = PUZZLES.filter((puzzle) => puzzle.solutionSteps.length >= 3).length;
const longAdvancedCount = advancedPuzzles.filter((puzzle) => puzzle.solutionSteps.length >= 5).length;

if (PUZZLES.length !== 100) errors.push(`expected exactly 100 puzzles, found ${PUZZLES.length}`);
if (newPuzzles.length < 76) errors.push(`expected at least 76 localized puzzles, found ${newPuzzles.length}`);
if (advancedPuzzles.length !== 36) errors.push(`expected exactly 36 new advanced puzzles, found ${advancedPuzzles.length}`);
if (multiStepCount < 65) errors.push(`expected at least 65 multi-step puzzles, found ${multiStepCount}`);
if (longAdvancedCount < 30) errors.push(`expected at least 30 advanced puzzles with three or more player moves, found ${longAdvancedCount}`);

if (errors.length > 0) {
  console.error(`Puzzle validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${PUZZLES.length} puzzles (${newPuzzles.length} localized, ${multiStepCount} multi-step, ${longAdvancedCount} long advanced).`);
