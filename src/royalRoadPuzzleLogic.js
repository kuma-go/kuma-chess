export const ROAD_PUZZLE_DIRECTIONS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1, opposite: "down" }),
  right: Object.freeze({ dx: 1, dy: 0, opposite: "left" }),
  down: Object.freeze({ dx: 0, dy: 1, opposite: "up" }),
  left: Object.freeze({ dx: -1, dy: 0, opposite: "right" }),
});

export const ROAD_PUZZLE_TILE_DEFS = Object.freeze({
  deadEnd: Object.freeze({ connections: ["up"], texture: "tile_crossroad" }),
  straight: Object.freeze({ connections: ["up", "down"], texture: "tile_down_up" }),
  corner: Object.freeze({ connections: ["down", "right"], texture: "tile_down_right" }),
  tee: Object.freeze({ connections: ["up", "right", "down"], texture: "tile_crossroad" }),
  cross: Object.freeze({ connections: ["up", "right", "down", "left"], texture: "tile_crossroad" }),
});

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function normalizeRotation(value) {
  return ((Math.round(Number(value) || 0) % 4) + 4) % 4;
}

export function rotateDirection(direction, turns = 1) {
  const order = ["up", "right", "down", "left"];
  const index = order.indexOf(direction);
  return index < 0 ? direction : order[(index + normalizeRotation(turns)) % 4];
}

export function tileConnections(tile) {
  const def = ROAD_PUZZLE_TILE_DEFS[tile?.kind];
  if (!def) return [];
  return def.connections.map((direction) => rotateDirection(direction, tile.rotation));
}

export function cloneRoadPuzzleStage(stage) {
  return {
    ...stage,
    start: { ...stage.start },
    goal: { ...stage.goal },
    solutionPath: stage.solutionPath?.map((cell) => ({ ...cell })),
    stars: { ...(stage.stars || {}) },
    tiles: stage.tiles.map((tile) => ({
      ...tile,
      special: tile.special ? { ...tile.special } : null,
    })),
  };
}

export function createRoadPuzzleState(stage) {
  const copy = cloneRoadPuzzleStage(stage);
  return {
    stage: copy,
    tiles: new Map(copy.tiles.map((tile) => [cellKey(tile.x, tile.y), tile])),
    player: { ...copy.start },
    checkpoint: { ...copy.start },
    switches: {},
    rotations: 0,
    moves: 0,
    traps: 0,
    hints: 0,
    elapsedMs: 0,
    completed: false,
  };
}

export function getRoadPuzzleTile(state, x, y) {
  return state?.tiles?.get(cellKey(x, y)) || null;
}

export function rotateRoadPuzzleTile(state, x, y) {
  const tile = getRoadPuzzleTile(state, x, y);
  if (!tile || tile.rotatable === false || tile.special?.fixed || tile.special?.door) {
    return { rotated: false, tile };
  }
  tile.rotation = normalizeRotation(tile.rotation + 1);
  state.rotations += 1;
  return { rotated: true, tile };
}

function doorOpen(state, tile) {
  const switchId = tile?.special?.door;
  return !switchId || !!state.switches[switchId];
}

export function canTraverseRoadPuzzle(state, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const direction = Object.entries(ROAD_PUZZLE_DIRECTIONS)
    .find(([, value]) => value.dx === dx && value.dy === dy)?.[0];
  if (!direction) return false;
  const fromTile = getRoadPuzzleTile(state, from.x, from.y);
  const toTile = getRoadPuzzleTile(state, to.x, to.y);
  if (!fromTile || !toTile || !doorOpen(state, fromTile) || !doorOpen(state, toTile)) return false;
  if (fromTile.special?.oneWay && fromTile.special.oneWay !== direction) return false;
  if (toTile.special?.oneWay && (toTile.special.oneWayEntry || toTile.special.oneWay) !== direction) return false;
  const fromConnections = tileConnections(fromTile);
  const toConnections = tileConnections(toTile);
  return fromConnections.includes(direction)
    && toConnections.includes(ROAD_PUZZLE_DIRECTIONS[direction].opposite);
}

function pairedPortal(state, tile) {
  const portalId = tile?.special?.portal;
  if (!portalId) return null;
  return state.stage.tiles.find((candidate) => (
    candidate !== tile && candidate.special?.portal === portalId
  )) || null;
}

function applyArrival(state, tile) {
  const events = [];
  if (tile.special?.checkpoint) {
    state.checkpoint = { x: tile.x, y: tile.y };
    events.push({ type: "checkpoint", tile });
  }
  if (tile.special?.switch) {
    state.switches[tile.special.switch] = true;
    events.push({ type: "switch", id: tile.special.switch, tile });
  }
  if (tile.special?.rotateTarget) {
    const target = getRoadPuzzleTile(state, tile.special.rotateTarget.x, tile.special.rotateTarget.y);
    if (target) {
      target.rotation = normalizeRotation(target.rotation + (tile.special.rotateTarget.turns || 1));
      events.push({ type: "rotateTarget", tile: target });
    }
  }
  if (tile.special?.trap) {
    state.traps += 1;
    state.player = { ...state.checkpoint };
    events.push({ type: "trap", tile, destination: { ...state.player } });
    return events;
  }
  const portal = pairedPortal(state, tile);
  if (portal) {
    state.player = { x: portal.x, y: portal.y };
    events.push({ type: "portal", tile, destination: { ...state.player } });
  }
  return events;
}

export function moveRoadPuzzlePlayer(state, x, y) {
  if (!state || state.completed) return { moved: false, events: [] };
  const destination = { x, y };
  if (!canTraverseRoadPuzzle(state, state.player, destination)) {
    return { moved: false, events: [] };
  }
  state.player = destination;
  state.moves += 1;
  const tile = getRoadPuzzleTile(state, x, y);
  const events = applyArrival(state, tile);
  state.completed = state.player.x === state.stage.goal.x && state.player.y === state.stage.goal.y;
  if (state.completed) events.push({ type: "goal", tile: getRoadPuzzleTile(state, state.player.x, state.player.y) });
  return { moved: true, events, player: { ...state.player } };
}

export function roadPuzzleNeighbors(state, position = state.player) {
  return Object.values(ROAD_PUZZLE_DIRECTIONS)
    .map(({ dx, dy }) => ({ x: position.x + dx, y: position.y + dy }))
    .filter((cell) => canTraverseRoadPuzzle(state, position, cell));
}

function applyVirtualArrival(state, position, switches, checkpoint, rotations) {
  const tile = getRoadPuzzleTile(state, position.x, position.y);
  const nextSwitches = { ...switches };
  const nextRotations = { ...rotations };
  let nextCheckpoint = { ...checkpoint };
  let nextPosition = { ...position };
  if (tile?.special?.switch) nextSwitches[tile.special.switch] = true;
  if (tile?.special?.checkpoint) nextCheckpoint = { ...position };
  if (tile?.special?.rotateTarget) {
    const target = getRoadPuzzleTile(state, tile.special.rotateTarget.x, tile.special.rotateTarget.y);
    if (target) {
      nextRotations[cellKey(target.x, target.y)] = normalizeRotation(target.rotation + (tile.special.rotateTarget.turns || 1));
    }
  }
  if (tile?.special?.trap) nextPosition = { ...nextCheckpoint };
  const portal = pairedPortal(state, tile);
  if (portal && !tile?.special?.trap) nextPosition = { x: portal.x, y: portal.y };
  return { position: nextPosition, switches: nextSwitches, checkpoint: nextCheckpoint, rotations: nextRotations };
}

export function findRoadPuzzlePath(state, start = state.player, goal = state.stage.goal) {
  const queue = [{ position: { ...start }, switches: { ...state.switches }, checkpoint: { ...state.checkpoint }, rotations: {}, path: [{ ...start }] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const switchKey = Object.keys(current.switches).filter((id) => current.switches[id]).sort().join("|");
    const rotationKey = Object.entries(current.rotations).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("|");
    const visitKey = `${cellKey(current.position.x, current.position.y)}:${switchKey}:${cellKey(current.checkpoint.x, current.checkpoint.y)}:${rotationKey}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    if (current.position.x === goal.x && current.position.y === goal.y) return current.path;
    const virtualTiles = new Map(state.tiles);
    for (const [key, rotation] of Object.entries(current.rotations)) {
      const tile = state.tiles.get(key);
      if (tile) virtualTiles.set(key, { ...tile, rotation });
    }
    const proxy = { ...state, tiles: virtualTiles, player: current.position, switches: current.switches, checkpoint: current.checkpoint };
    for (const neighbor of roadPuzzleNeighbors(proxy, current.position)) {
      const arrival = applyVirtualArrival(proxy, neighbor, current.switches, current.checkpoint, current.rotations);
      queue.push({
        ...arrival,
        path: [...current.path, { ...neighbor }, ...(arrival.position.x !== neighbor.x || arrival.position.y !== neighbor.y ? [{ ...arrival.position }] : [])],
      });
    }
  }
  return null;
}

export function roadPuzzleIsSolved(state) {
  return !!findRoadPuzzlePath(state, state.stage.start, state.stage.goal);
}

export function findRoadPuzzleRotationPlan(state) {
  if (!state?.stage || !state?.tiles) return null;
  if (state.stage.type === "rotate") {
    const startKey = cellKey(state.stage.start.x, state.stage.start.y);
    const goalKey = cellKey(state.stage.goal.x, state.stage.goal.y);
    const costs = new Map();
    const previous = new Map();
    const queue = [];
    const turnsFor = (tile) => (
      !tile || tile.rotatable === false || tile.kind === "cross"
        ? 0
        : normalizeRotation(tile.solutionRotation - tile.rotation)
    );
    const startTile = getRoadPuzzleTile(state, state.stage.start.x, state.stage.start.y);
    if (!startTile) return null;
    costs.set(startKey, turnsFor(startTile));
    queue.push({ key: startKey, cost: costs.get(startKey) });
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (costs.get(current.key) !== current.cost) continue;
      if (current.key === goalKey) {
        const keys = [];
        let key = current.key;
        while (key) {
          keys.unshift(key);
          key = previous.get(key);
        }
        const path = keys.map((entry) => {
          const [x, y] = entry.split(",").map(Number);
          return { x, y, turns: turnsFor(getRoadPuzzleTile(state, x, y)) };
        });
        return { cost: current.cost, path };
      }
      const [x, y] = current.key.split(",").map(Number);
      const tile = getRoadPuzzleTile(state, x, y);
      const solvedConnections = tileConnections({ ...tile, rotation: tile.solutionRotation });
      for (const direction of solvedConnections) {
        const delta = ROAD_PUZZLE_DIRECTIONS[direction];
        const neighbor = getRoadPuzzleTile(state, x + delta.dx, y + delta.dy);
        if (!neighbor) continue;
        const neighborConnections = tileConnections({ ...neighbor, rotation: neighbor.solutionRotation });
        if (!neighborConnections.includes(delta.opposite)) continue;
        const neighborKey = cellKey(neighbor.x, neighbor.y);
        const nextCost = current.cost + turnsFor(neighbor);
        if (costs.has(neighborKey) && costs.get(neighborKey) <= nextCost) continue;
        costs.set(neighborKey, nextCost);
        previous.set(neighborKey, current.key);
        queue.push({ key: neighborKey, cost: nextCost });
      }
    }
    return null;
  }
  if (state.stage.solutionPath?.length) {
    const seen = new Set();
    const path = state.stage.solutionPath.map((cell) => {
      const key = cellKey(cell.x, cell.y);
      const tile = getRoadPuzzleTile(state, cell.x, cell.y);
      const turns = seen.has(key) || !tile || tile.rotatable === false || tile.kind === "cross"
        ? 0
        : normalizeRotation(tile.solutionRotation - tile.rotation);
      seen.add(key);
      return { ...cell, turns };
    });
    return { cost: path.reduce((sum, cell) => sum + cell.turns, 0), path };
  }
  const start = state.stage.start;
  const goal = state.stage.goal;
  const queue = [];
  const costs = new Map();
  const previous = new Map();
  const stateKey = (x, y, turns) => `${x},${y},${turns}`;
  const push = (node, cost, fromKey = null) => {
    const key = stateKey(node.x, node.y, node.turns);
    if (costs.has(key) && costs.get(key) <= cost) return;
    costs.set(key, cost);
    previous.set(key, fromKey);
    queue.push({ ...node, cost, key });
  };
  const startTile = getRoadPuzzleTile(state, start.x, start.y);
  if (!startTile) return null;
  const startOptions = startTile.rotatable === false ? [0] : [0, 1, 2, 3];
  for (const turns of startOptions) push({ ...start, turns }, turns);

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (costs.get(current.key) !== current.cost) continue;
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let key = current.key;
      while (key) {
        const [x, y, turns] = key.split(",").map(Number);
        path.unshift({ x, y, turns });
        key = previous.get(key);
      }
      return { cost: current.cost, path };
    }
    const tile = getRoadPuzzleTile(state, current.x, current.y);
    const currentConnections = tileConnections({ ...tile, rotation: normalizeRotation(tile.rotation + current.turns) });
    for (const direction of currentConnections) {
      const delta = ROAD_PUZZLE_DIRECTIONS[direction];
      const nx = current.x + delta.dx;
      const ny = current.y + delta.dy;
      const neighbor = getRoadPuzzleTile(state, nx, ny);
      if (!neighbor || neighbor.special?.door) continue;
      const options = neighbor.rotatable === false ? [0] : [0, 1, 2, 3];
      for (const turns of options) {
        const connections = tileConnections({ ...neighbor, rotation: normalizeRotation(neighbor.rotation + turns) });
        if (!connections.includes(delta.opposite)) continue;
        push({ x: nx, y: ny, turns }, current.cost + turns, current.key);
      }
    }
  }
  return null;
}

export function roadPuzzleHint(state) {
  const currentPath = findRoadPuzzlePath(state);
  if (state.stage.type === "hybrid" && currentPath?.[1]) {
    return { type: "move", ...currentPath[1] };
  }
  if (state.stage.type !== "maze") {
    const plan = findRoadPuzzleRotationPlan(state);
    const target = plan?.path.find((tile) => tile.turns > 0);
    if (target) return { type: "rotate", x: target.x, y: target.y };
  }
  return currentPath?.[1] ? { type: "move", ...currentPath[1] } : null;
}

export function scoreRoadPuzzle(state) {
  const stars = state.stage.stars || {};
  let score = 1;
  const efficient = (stars.rotations == null || state.rotations <= stars.rotations)
    && (stars.moves == null || state.moves <= stars.moves)
    && (stars.timeMs == null || state.elapsedMs <= stars.timeMs);
  if (efficient) score += 1;
  if (efficient && state.hints === 0 && state.traps === 0) score += 1;
  return Math.max(1, Math.min(3, score));
}
