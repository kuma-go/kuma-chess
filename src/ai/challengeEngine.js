const PIECE_VALUES = Object.freeze({ p: 100, n: 320, b: 335, r: 500, q: 920, k: 0 });
const MATE_SCORE = 1_000_000;
const SEARCH_ABORT = Symbol("challenge-search-abort");
const OPENING_BOOK = Object.freeze({
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": "e2e4",
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -": "c7c5",
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -": "g8f6",
  "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -": "d7d5",
  "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -": "e7e5",
});

function moveKey(move) {
  return `${move?.from || ""}${move?.to || ""}${move?.promotion || ""}`;
}

function movePayload(move) {
  const payload = { from: move.from, to: move.to };
  if (move.promotion) payload.promotion = move.promotion;
  else if (String(move.flags || "").includes("p")) payload.promotion = "q";
  return payload;
}

function positionKey(chess) {
  return chess.fen().split(" ").slice(0, 4).join(" ");
}

function openingBookMove(chess) {
  const key = OPENING_BOOK[positionKey(chess)];
  if (!key) return null;
  const legal = chess.moves({ verbose: true }).find((move) => moveKey(move) === key);
  return legal ? movePayload(legal) : null;
}

function centerDistance(row, col) {
  return Math.abs(3.5 - row) + Math.abs(3.5 - col);
}

function positionalValue(piece, row, col, endgame) {
  const distance = centerDistance(row, col);
  const advance = piece.color === "w" ? Math.max(0, 6 - row) : Math.max(0, row - 1);
  switch (piece.type) {
    case "p": return advance * 9 - Math.abs(3.5 - col) * 3;
    case "n": return 34 - distance * 11;
    case "b": return 24 - distance * 5;
    case "r": return 8 - Math.abs(3.5 - col) * 2 + (advance >= 5 ? 18 : 0);
    case "q": return 12 - distance * 3;
    case "k": return endgame ? 42 - distance * 10 : distance * 9;
    default: return 0;
  }
}

function pawnStructureScore(board, color) {
  const pawnsByFile = Array.from({ length: 8 }, () => []);
  const enemyPawns = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece?.type !== "p") continue;
      if (piece.color === color) pawnsByFile[col].push(row);
      else enemyPawns.push({ row, col });
    }
  }

  let score = 0;
  for (let file = 0; file < 8; file += 1) {
    const pawns = pawnsByFile[file];
    if (pawns.length > 1) score -= (pawns.length - 1) * 18;
    if (pawns.length && !pawnsByFile[file - 1]?.length && !pawnsByFile[file + 1]?.length) {
      score -= pawns.length * 13;
    }
    for (const row of pawns) {
      const passed = !enemyPawns.some((enemy) => (
        Math.abs(enemy.col - file) <= 1
        && (color === "w" ? enemy.row < row : enemy.row > row)
      ));
      if (passed) {
        const advance = color === "w" ? 6 - row : row - 1;
        score += 18 + Math.max(0, advance) * 12;
      }
    }
  }
  return score;
}

function kingSafetyScore(board, color, endgame) {
  if (endgame) return 0;
  let king = null;
  for (let row = 0; row < 8 && !king; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece?.type === "k" && piece.color === color) king = { row, col };
    }
  }
  if (!king) return -MATE_SCORE;

  let score = (king.col <= 2 || king.col >= 6) ? 28 : -8;
  const pawnRow = king.row + (color === "w" ? -1 : 1);
  for (let col = king.col - 1; col <= king.col + 1; col += 1) {
    if (pawnRow < 0 || pawnRow > 7 || col < 0 || col > 7) continue;
    const piece = board[pawnRow][col];
    score += piece?.type === "p" && piece.color === color ? 12 : -7;
  }
  return score;
}

export function evaluateChallengePosition(chess, perspectiveColor, ply = 0) {
  if (chess.isCheckmate()) {
    return chess.turn() === perspectiveColor ? -MATE_SCORE + ply : MATE_SCORE - ply;
  }
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let nonPawnMaterial = 0;
  const bishops = { w: 0, b: 0 };
  for (const row of board) {
    for (const piece of row) {
      if (piece && !["p", "k"].includes(piece.type)) nonPawnMaterial += PIECE_VALUES[piece.type] || 0;
    }
  }
  const endgame = nonPawnMaterial <= 2600;
  let score = 0;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece) continue;
      if (piece.type === "b") bishops[piece.color] += 1;
      const value = (PIECE_VALUES[piece.type] || 0) + positionalValue(piece, row, col, endgame);
      score += piece.color === perspectiveColor ? value : -value;
    }
  }

  const opponent = perspectiveColor === "w" ? "b" : "w";
  if (bishops[perspectiveColor] >= 2) score += 32;
  if (bishops[opponent] >= 2) score -= 32;
  score += pawnStructureScore(board, perspectiveColor) - pawnStructureScore(board, opponent);
  score += kingSafetyScore(board, perspectiveColor, endgame) - kingSafetyScore(board, opponent, endgame);
  if (chess.isCheck()) score += chess.turn() === perspectiveColor ? -55 : 55;
  score += chess.turn() === perspectiveColor ? 8 : -8;
  return score;
}

function shouldAbort(context) {
  context.nodes += 1;
  if ((context.nodes & 255) !== 0) return false;
  return context.nodes >= context.nodeLimit || Date.now() >= context.deadline;
}

function orderScore(move, context, ply, preferredKey) {
  const key = moveKey(move);
  let score = key === preferredKey ? 5_000_000 : 0;
  if (move.captured) score += (PIECE_VALUES[move.captured] || 0) * 20 - (PIECE_VALUES[move.piece] || 0);
  if (move.promotion) score += (PIECE_VALUES[move.promotion] || 0) * 12;
  if (String(move.san || "").includes("#")) score += 4_000_000;
  else if (String(move.san || "").includes("+")) score += 18_000;
  if (context.killers[ply]?.includes(key)) score += 9_000;
  score += context.history.get(key) || 0;
  return score;
}

function orderedMoves(chess, context, ply, preferredKey = "", tacticalOnly = false) {
  return chess.moves({ verbose: true })
    .filter((move) => !tacticalOnly || move.captured || move.promotion)
    .sort((a, b) => {
      const difference = orderScore(b, context, ply, preferredKey) - orderScore(a, context, ply, preferredKey);
      return difference || moveKey(a).localeCompare(moveKey(b));
    });
}

function rememberQuietCutoff(context, move, depth, ply) {
  if (move.captured || move.promotion) return;
  const key = moveKey(move);
  const killers = context.killers[ply] || [];
  context.killers[ply] = [key, ...killers.filter((item) => item !== key)].slice(0, 2);
  context.history.set(key, (context.history.get(key) || 0) + depth * depth);
}

function quiescence(chess, alpha, beta, perspectiveColor, context, ply, remaining = 3) {
  if (shouldAbort(context)) throw SEARCH_ABORT;
  const maximizing = chess.turn() === perspectiveColor;
  const staticScore = evaluateChallengePosition(chess, perspectiveColor, ply);
  const inCheck = chess.isCheck();
  let best = inCheck ? (maximizing ? -Infinity : Infinity) : staticScore;
  if (remaining <= 0 || chess.isGameOver()) return staticScore;

  if (!inCheck) {
    if (maximizing) {
      if (best >= beta) return best;
      alpha = Math.max(alpha, best);
    } else {
      if (best <= alpha) return best;
      beta = Math.min(beta, best);
    }
  }

  const moves = orderedMoves(chess, context, ply, "", !inCheck);
  for (const move of moves) {
    let made = null;
    try { made = chess.move(movePayload(move)); } catch (error) { made = null; }
    if (!made) continue;
    const score = quiescence(chess, alpha, beta, perspectiveColor, context, ply + 1, remaining - 1);
    chess.undo();
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }
  return best;
}

function alphaBeta(chess, depth, alpha, beta, perspectiveColor, context, ply) {
  if (shouldAbort(context)) throw SEARCH_ABORT;
  if (chess.isGameOver()) return evaluateChallengePosition(chess, perspectiveColor, ply);
  if (depth <= 0) return quiescence(chess, alpha, beta, perspectiveColor, context, ply);

  const key = positionKey(chess);
  const cached = context.table.get(key);
  const originalAlpha = alpha;
  const originalBeta = beta;
  if (cached && cached.depth >= depth) {
    if (cached.bound === "exact") return cached.score;
    if (cached.bound === "lower") alpha = Math.max(alpha, cached.score);
    if (cached.bound === "upper") beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  const maximizing = chess.turn() === perspectiveColor;
  let best = maximizing ? -Infinity : Infinity;
  let bestMoveKey = "";
  const moves = orderedMoves(chess, context, ply, cached?.bestMoveKey || "");
  for (const move of moves) {
    let made = null;
    try { made = chess.move(movePayload(move)); } catch (error) { made = null; }
    if (!made) continue;
    const score = alphaBeta(chess, depth - 1, alpha, beta, perspectiveColor, context, ply + 1);
    chess.undo();

    if ((maximizing && score > best) || (!maximizing && score < best)) {
      best = score;
      bestMoveKey = moveKey(move);
    }
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta) {
      rememberQuietCutoff(context, move, depth, ply);
      break;
    }
  }

  if (!Number.isFinite(best)) best = evaluateChallengePosition(chess, perspectiveColor, ply);
  const bound = best <= originalAlpha ? "upper" : best >= originalBeta ? "lower" : "exact";
  context.table.set(key, { depth, score: best, bound, bestMoveKey });
  return best;
}

export function chooseChallengeMove(chess, perspectiveColor, options = {}) {
  const legalMoves = chess.moves({ verbose: true });
  if (!legalMoves.length) return { move: null, depth: 0, nodes: 0, score: 0, elapsedMs: 0 };

  const bookMove = options.useBook === false ? null : openingBookMove(chess);
  if (bookMove) {
    return { move: bookMove, depth: 0, nodes: 0, score: 0, elapsedMs: 0, book: true };
  }

  const startedAt = Date.now();
  const context = {
    rootFen: chess.fen(),
    deadline: startedAt + Math.max(50, Number(options.timeMs) || 1200),
    nodeLimit: Math.max(1000, Number(options.nodeLimit) || 180000),
    nodes: 0,
    table: new Map(),
    killers: [],
    history: new Map(),
  };
  const maxDepth = Math.max(1, Math.min(8, Number(options.maxDepth) || 6));
  let completedDepth = 0;
  let bestMove = legalMoves.slice().sort((a, b) => moveKey(a).localeCompare(moveKey(b)))[0];
  let bestScore = -Infinity;
  let preferredKey = moveKey(bestMove);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    let iterationMove = null;
    let iterationScore = -Infinity;
    let rootAlpha = -Infinity;
    let complete = true;
    const roots = orderedMoves(chess, context, 0, preferredKey);
    try {
      for (const root of roots) {
        if (Date.now() >= context.deadline || context.nodes >= context.nodeLimit) throw SEARCH_ABORT;
        let made = null;
        try { made = chess.move(movePayload(root)); } catch (error) { made = null; }
        if (!made) continue;
        const score = alphaBeta(chess, depth - 1, rootAlpha, Infinity, perspectiveColor, context, 1);
        chess.undo();
        if (score > iterationScore || (score === iterationScore && moveKey(root) < moveKey(iterationMove))) {
          iterationScore = score;
          iterationMove = root;
        }
        rootAlpha = Math.max(rootAlpha, score);
      }
    } catch (error) {
      if (error !== SEARCH_ABORT) throw error;
      complete = false;
      while (chess.fen() !== context.rootFen && chess.history().length) chess.undo();
    }
    if (!complete || !iterationMove) break;
    bestMove = iterationMove;
    bestScore = iterationScore;
    preferredKey = moveKey(bestMove);
    completedDepth = depth;
    if (Math.abs(bestScore) >= MATE_SCORE - 100) break;
  }

  return {
    move: bestMove ? movePayload(bestMove) : null,
    depth: completedDepth,
    nodes: context.nodes,
    score: Number.isFinite(bestScore) ? bestScore : 0,
    elapsedMs: Date.now() - startedAt,
  };
}
