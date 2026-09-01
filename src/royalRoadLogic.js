export const ROAD_ROWS = 12;
export const ROAD_COLS = 3;
export const ROAD_BASE_INTERVAL_MS = 3000;

export const ROAD_TILE_DEFS = Object.freeze({
  straight: Object.freeze({ id: "straight", movement: "forward", effect: "normal", texture: "tile_down_up" }),
  left: Object.freeze({ id: "left", movement: "turn", deltaCol: -1, effect: "normal", texture: "tile_down_left" }),
  right: Object.freeze({ id: "right", movement: "turn", deltaCol: 1, effect: "normal", texture: "tile_down_right" }),
  resumeLeft: Object.freeze({ id: "resumeLeft", movement: "resume", lateral: -1, effect: "normal", texture: "tile_right_up" }),
  resumeRight: Object.freeze({ id: "resumeRight", movement: "resume", lateral: 1, effect: "normal", texture: "tile_left_up" }),
  crossroad: Object.freeze({ id: "crossroad", movement: "universal", effect: "normal", texture: "tile_crossroad" }),
  speed: Object.freeze({ id: "speed", movement: "forward", effect: "speed", texture: "tile_down_up_speed" }),
  bomb: Object.freeze({ id: "bomb", movement: "universal", effect: "bomb", texture: "tile_bomb" }),
  spike: Object.freeze({ id: "spike", movement: "universal", effect: "spike", texture: "tile_spike" }),
  trap: Object.freeze({ id: "trap", movement: "universal", effect: "trap", texture: "tile_trap" }),
});

export const ROAD_TILE_BAG = Object.freeze([
  "straight", "straight", "straight", "straight",
  "left", "left", "right", "right",
  "crossroad", "crossroad",
  "speed", "bomb", "spike", "trap",
]);

export function roadDirection(color) {
  return color === "b" ? 1 : -1;
}

export function roadGoalRow(color) {
  return color === "b" ? ROAD_ROWS - 1 : 0;
}

export function roadVisualTileId(tileId, fromBottom = true) {
  if (fromBottom) return tileId;
  if (tileId === "left") return "right";
  if (tileId === "right") return "left";
  if (tileId === "resumeLeft") return "resumeRight";
  if (tileId === "resumeRight") return "resumeLeft";
  return tileId;
}

export function createRoadSide(color) {
  const startRow = color === "b" ? 0 : ROAD_ROWS - 1;
  const direction = roadDirection(color);
  return {
    color,
    route: [
      { row: startRow, col: 1, type: "start", effect: "normal", triggered: true },
      { row: startRow + direction, col: 1, type: "straight", effect: "normal", triggered: true },
    ],
    endpoint: { row: startRow + direction * 2, col: 1 },
    lateral: 0,
    kingIndex: 1,
    lastEffect: null,
  };
}

export function getRoadPlacement(side, tileId) {
  const tile = ROAD_TILE_DEFS[tileId];
  if (!side || !tile) return { valid: false, reason: "unknown" };
  const { row, col } = side.endpoint;
  if (row < 0 || row >= ROAD_ROWS || col < 0 || col >= ROAD_COLS) {
    return { valid: false, reason: "finished" };
  }
  const goal = row === roadGoalRow(side.color);
  const universal = tile.movement === "universal";
  if (side.lateral) {
    if (!universal && (tile.movement !== "resume" || tile.lateral !== side.lateral)) {
      return { valid: false, reason: "mustResume" };
    }
  } else if (tile.movement === "resume") {
    return { valid: false, reason: "notLateral" };
  }
  if (goal && tile.movement === "turn") return { valid: false, reason: "goal" };

  const nextCol = tile.movement === "turn" ? col + tile.deltaCol : col;
  if (nextCol < 0 || nextCol >= ROAD_COLS) return { valid: false, reason: "edge" };

  return {
    valid: true,
    tile: {
      row,
      col,
      type: tile.id,
      effect: tile.effect,
      triggered: false,
    },
    nextEndpoint: {
      row: tile.movement === "turn" ? row : row + roadDirection(side.color),
      col: nextCol,
    },
    nextLateral: tile.movement === "turn" ? tile.deltaCol : 0,
  };
}

export function placeRoadTile(side, tileId) {
  const placement = getRoadPlacement(side, tileId);
  if (!placement.valid) return placement;
  side.route.push(placement.tile);
  side.endpoint = placement.nextEndpoint;
  side.lateral = placement.nextLateral;
  return placement;
}

export function advanceRoadKing(side) {
  side.lastEffect = null;
  const next = side.route[side.kingIndex + 1];
  if (!next) return { moved: false, effect: null };
  side.kingIndex += 1;
  if (!next.triggered) {
    next.triggered = true;
    side.lastEffect = next.effect === "normal" ? null : next.effect;
  }
  return { moved: true, effect: side.lastEffect };
}

export function createRoadClock(baseMs = ROAD_BASE_INTERVAL_MS) {
  return {
    baseMs,
    remainingMs: baseMs,
    totalMs: baseMs,
    selectedTarget: null,
    skipCurrent: false,
    skipTurns: 0,
    speedTurns: 0,
    nextDelayMs: 0,
    cycle: 1,
  };
}

export function applyRoadClockEffect(clock, effect) {
  if (!clock) return;
  if (effect === "bomb") clock.nextDelayMs += 1000;
  if (effect === "spike") clock.nextDelayMs += 500;
  if (effect === "trap") clock.skipTurns += 1;
  if (effect === "speed") clock.speedTurns = Math.max(clock.speedTurns, 3);
}

export function beginNextRoadInterval(clock) {
  const speedActive = clock.speedTurns > 0;
  const durationMs = Math.max(500, clock.baseMs * (speedActive ? 0.5 : 1) + clock.nextDelayMs);
  const skipCurrent = clock.skipTurns > 0;
  if (speedActive) clock.speedTurns -= 1;
  if (skipCurrent) clock.skipTurns -= 1;
  clock.nextDelayMs = 0;
  clock.totalMs = durationMs;
  clock.remainingMs = durationMs;
  clock.selectedTarget = null;
  clock.skipCurrent = skipCurrent;
  clock.cycle += 1;
  return { durationMs, skipCurrent };
}

export function roadKingCell(side) {
  return side.route[side.kingIndex] || side.route[0];
}

export function roadRemainingTiles(side) {
  return Math.abs(roadGoalRow(side.color) - roadKingCell(side).row);
}

export function roadWinner(sides) {
  const finished = ["w", "b"].filter((color) => roadKingCell(sides[color]).row === roadGoalRow(color));
  return finished.length === 1 ? finished[0] : finished.length === 2 ? "draw" : null;
}

export function cloneRoadSide(side) {
  return {
    ...side,
    route: side.route.map((tile) => ({ ...tile })),
    endpoint: { ...side.endpoint },
  };
}
