import { createRoadPuzzleState, findRoadPuzzlePath, findRoadPuzzleRotationPlan, normalizeRotation } from "./royalRoadPuzzleLogic.js";

const DIR_BY_DELTA = Object.freeze({ "0,-1": "up", "1,0": "right", "0,1": "down", "-1,0": "left" });
const DIR_SET_TO_TILE = Object.freeze({
  "up": ["deadEnd", 0],
  "right": ["deadEnd", 1],
  "down": ["deadEnd", 2],
  "left": ["deadEnd", 3],
  "down,right": ["corner", 0],
  "down,left": ["corner", 1],
  "left,up": ["corner", 2],
  "right,up": ["corner", 3],
  "down,up": ["straight", 0],
  "left,right": ["straight", 1],
  "down,right,up": ["tee", 0],
  "down,left,right": ["tee", 1],
  "down,left,up": ["tee", 2],
  "left,right,up": ["tee", 3],
  "down,left,right,up": ["cross", 0],
});
const GOAL_OVERRIDE = Object.freeze({
  12: Object.freeze({ x: 6, y: 0 }),
  13: Object.freeze({ x: 5, y: 0 }),
  15: Object.freeze({ x: 5, y: 0 }),
  21: Object.freeze({ x: 7, y: 0 }),
  24: Object.freeze({ x: 8, y: 0 }),
});

function directionBetween(from, to) {
  return DIR_BY_DELTA[`${to.x - from.x},${to.y - from.y}`];
}

function routeTile(route, index, rotatable) {
  const point = route[index];
  const directions = [];
  if (route[index - 1]) directions.push(directionBetween(point, route[index - 1]));
  if (route[index + 1]) directions.push(directionBetween(point, route[index + 1]));
  if (directions.length === 1) {
    const vertical = directions[0] === "up" || directions[0] === "down";
    return { x: point.x, y: point.y, kind: "straight", rotation: vertical ? 0 : 1, solutionRotation: vertical ? 0 : 1, rotatable };
  }
  const key = [...directions].sort().join(",");
  const [kind, rotation] = DIR_SET_TO_TILE[key] || ["cross", 0];
  return { x: point.x, y: point.y, kind, rotation, solutionRotation: rotation, rotatable };
}

function addGraphEdge(graph, from, to) {
  const direction = directionBetween(from, to);
  if (!direction) return;
  const fromKey = `${from.x},${from.y}`;
  const toKey = `${to.x},${to.y}`;
  if (!graph.has(fromKey)) graph.set(fromKey, new Set());
  if (!graph.has(toKey)) graph.set(toKey, new Set());
  graph.get(fromKey).add(direction);
  graph.get(toKey).add({ up: "down", right: "left", down: "up", left: "right" }[direction]);
}

function deterministicIndex(id, step, length) {
  return Math.abs((id * 1103515245 + step * 12345 + step * step * 97) >>> 0) % length;
}

function tileFromDirections(x, y, directions, rotatable) {
  const key = [...directions].sort().join(",");
  const [kind, rotation] = DIR_SET_TO_TILE[key] || ["cross", 0];
  return {
    x, y, kind, rotation, solutionRotation: rotation,
    rotatable,
    solutionRelevant: true,
  };
}

function graphComponents(graph, width, height) {
  const components = [];
  const remaining = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) remaining.add(`${x},${y}`);
  }
  while (remaining.size) {
    const seed = remaining.values().next().value;
    const component = new Set([seed]);
    const queue = [seed];
    remaining.delete(seed);
    while (queue.length) {
      const key = queue.shift();
      const [x, y] = key.split(",").map(Number);
      for (const direction of graph.get(key) || []) {
        const [dx, dy] = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] }[direction];
        const nextKey = `${x + dx},${y + dy}`;
        if (!remaining.has(nextKey)) continue;
        remaining.delete(nextKey);
        component.add(nextKey);
        queue.push(nextKey);
      }
    }
    components.push(component);
  }
  return components;
}

function mergeGraphComponents(graph, id, width, height, firstStep) {
  let step = firstStep;
  while (true) {
    const components = graphComponents(graph, width, height);
    if (components.length <= 1) return step;
    const componentByKey = new Map();
    components.forEach((component, index) => component.forEach((key) => componentByKey.set(key, index)));
    const bridges = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        for (const [dx, dy] of [[1,0],[0,1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= width || ny >= height) continue;
          if (componentByKey.get(`${x},${y}`) !== componentByKey.get(`${nx},${ny}`)) {
            bridges.push({ from: { x, y }, to: { x: nx, y: ny } });
          }
        }
      }
    }
    const bridge = bridges[deterministicIndex(id, step, bridges.length)];
    addGraphEdge(graph, bridge.from, bridge.to);
    step += 1;
  }
}

function addGraphCycles(graph, id, width, height, firstStep, route, isMaze) {
  let step = firstStep;
  const target = isMaze
    ? Math.max(1, Math.min(3, Math.floor(width * height / 45) + 1))
    : Math.max(2, Math.min(12, Math.floor(width * height * 0.08)));
  const routeIndex = new Map(route.map((cell, index) => [`${cell.x},${cell.y}`, index]));
  const candidates = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (const [dx, dy, direction] of [[1,0,"right"],[0,1,"down"]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height || graph.get(`${x},${y}`)?.has(direction)) continue;
        if (isMaze) {
          const fromIndex = routeIndex.get(`${x},${y}`);
          const toIndex = routeIndex.get(`${nx},${ny}`);
          if (fromIndex != null && toIndex != null && Math.abs(fromIndex - toIndex) > 1) continue;
        }
        candidates.push({ from: { x, y }, to: { x: nx, y: ny } });
      }
    }
  }
  for (let count = 0; count < target && candidates.length; count += 1) {
    const index = deterministicIndex(id + 41, step, candidates.length);
    const [edge] = candidates.splice(index, 1);
    addGraphEdge(graph, edge.from, edge.to);
    step += 1;
  }
}

function graphNeighborKeys(graph, key) {
  const [x, y] = key.split(",").map(Number);
  return Array.from(graph.get(key) || [], (direction) => {
    const [dx, dy] = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] }[direction];
    return `${x + dx},${y + dy}`;
  });
}

function graphPath(graph, start, goal) {
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  const previous = new Map([[startKey, null]]);
  const queue = [startKey];
  while (queue.length) {
    const key = queue.shift();
    if (key === goalKey) break;
    for (const nextKey of graphNeighborKeys(graph, key)) {
      if (previous.has(nextKey)) continue;
      previous.set(nextKey, key);
      queue.push(nextKey);
    }
  }
  if (!previous.has(goalKey)) return [];
  const result = [];
  for (let key = goalKey; key; key = previous.get(key)) result.push(key);
  return result.reverse();
}

function mazeBranchDepths(graph, path) {
  const pathSet = new Set(path);
  const depths = [];
  const visitBranch = (startKey, parentKey) => {
    let deepest = 1;
    const stack = [{ key: startKey, parent: parentKey, depth: 1 }];
    while (stack.length) {
      const current = stack.pop();
      deepest = Math.max(deepest, current.depth);
      for (const nextKey of graphNeighborKeys(graph, current.key)) {
        if (nextKey === current.parent || pathSet.has(nextKey)) continue;
        stack.push({ key: nextKey, parent: current.key, depth: current.depth + 1 });
      }
    }
    return deepest;
  };
  path.forEach((key, index) => {
    const adjacentPath = new Set([path[index - 1], path[index + 1]].filter(Boolean));
    for (const nextKey of graphNeighborKeys(graph, key)) {
      if (adjacentPath.has(nextKey) || pathSet.has(nextKey)) continue;
      depths.push(visitBranch(nextKey, key));
    }
  });
  return depths;
}

function mazePathShape(path) {
  let turns = 0;
  let longestStraight = 0;
  let straight = 0;
  let previousDirection = null;
  for (let index = 1; index < path.length; index += 1) {
    const [px, py] = path[index - 1].split(",").map(Number);
    const [x, y] = path[index].split(",").map(Number);
    const direction = `${x - px},${y - py}`;
    if (direction === previousDirection) straight += 1;
    else {
      if (previousDirection) turns += 1;
      straight = 1;
      previousDirection = direction;
    }
    longestStraight = Math.max(longestStraight, straight);
  }
  return { turns, longestStraight };
}

function deterministicHash(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function mazeGlobalShape(graph, width, height) {
  let longestStraight = 0;
  let horizontalEdges = 0;
  let verticalEdges = 0;
  for (let y = 0; y < height; y += 1) {
    let run = 0;
    for (let x = 0; x < width - 1; x += 1) {
      if (graph.get(`${x},${y}`)?.has("right")) {
        run += 1;
        horizontalEdges += 1;
      } else run = 0;
      longestStraight = Math.max(longestStraight, run);
    }
  }
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y < height - 1; y += 1) {
      if (graph.get(`${x},${y}`)?.has("down")) {
        run += 1;
        verticalEdges += 1;
      } else run = 0;
      longestStraight = Math.max(longestStraight, run);
    }
  }
  return {
    longestStraight,
    orientationBias: Math.abs(horizontalEdges - verticalEdges) / Math.max(1, horizontalEdges + verticalEdges),
  };
}

function mazeTargetProfile(width, height) {
  const cells = width * height;
  if (cells <= 30) return { minMoves: 10, maxMoves: 15, junctions: 2, deepBranches: 2, medianDepth: 2, maxStraight: 3 };
  if (cells <= 48) return { minMoves: 14, maxMoves: 20, junctions: 3, deepBranches: 3, medianDepth: 2, maxStraight: 4 };
  if (cells <= 63) return { minMoves: 17, maxMoves: 24, junctions: 4, deepBranches: 4, medianDepth: 3, maxStraight: 4 };
  if (cells <= 88) return { minMoves: 20, maxMoves: 28, junctions: 5, deepBranches: 5, medianDepth: 3, maxStraight: 4 };
  return { minMoves: 24, maxMoves: 32, junctions: 6, deepBranches: 7, medianDepth: 3, maxStraight: 4 };
}

function buildPerfectMazeGraph(id, width, height, start, goal) {
  const cells = width * height;
  const profile = mazeTargetProfile(width, height);
  const desiredMoves = Math.round((profile.minMoves + profile.maxMoves) / 2);
  let best = null;
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const graph = new Map();
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) graph.set(`${x},${y}`, new Set());
    const startKey = `${start.x},${start.y}`;
    const active = [{ ...start }];
    const visited = new Set([startKey]);
    const arrival = new Map([[startKey, { direction: null, run: 0 }]]);
    let step = 0;
    while (active.length) {
      const seed = id * 1009 + attempt * 9176 + step * 37 + 31;
      const useNewest = deterministicHash(seed, step) % 100 < 55;
      const activeIndex = useNewest ? active.length - 1 : deterministicHash(seed + 17, step + 1) % active.length;
      const current = active[activeIndex];
      const currentKey = `${current.x},${current.y}`;
      const candidates = [
        { x: current.x, y: current.y - 1, direction: "up" },
        { x: current.x + 1, y: current.y, direction: "right" },
        { x: current.x, y: current.y + 1, direction: "down" },
        { x: current.x - 1, y: current.y, direction: "left" },
      ].filter((cell) => (
        cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height
        && !visited.has(`${cell.x},${cell.y}`)
      ));
      if (!candidates.length) {
        active.splice(activeIndex, 1);
        step += 1;
        continue;
      }
      const previous = arrival.get(currentKey);
      const reduced = previous?.run >= 3
        ? candidates.filter((candidate) => candidate.direction !== previous.direction)
        : candidates;
      const choices = reduced.length ? reduced : candidates;
      const next = choices[deterministicHash(seed + 53, step + 2) % choices.length];
      addGraphEdge(graph, current, next);
      const nextKey = `${next.x},${next.y}`;
      visited.add(nextKey);
      arrival.set(nextKey, {
        direction: next.direction,
        run: next.direction === previous?.direction ? previous.run + 1 : 1,
      });
      active.push({ x: next.x, y: next.y });
      step += 1;
    }
    const path = graphPath(graph, start, goal);
    const branches = mazeBranchDepths(graph, path);
    const junctions = path.filter((key) => (graph.get(key)?.size || 0) >= 3).length;
    const deepBranches = branches.filter((depth) => depth >= 3).length;
    const deadEnds = Array.from(graph.values()).filter((directions) => directions.size === 1).length;
    const sortedBranches = [...branches].sort((left, right) => left - right);
    const medianDepth = sortedBranches.length ? sortedBranches[Math.floor(sortedBranches.length / 2)] : 0;
    const { turns } = mazePathShape(path);
    const shape = mazeGlobalShape(graph, width, height);
    const moves = path.length - 1;
    const deadEndRatio = deadEnds / cells;
    const valid = moves >= profile.minMoves
      && moves <= profile.maxMoves
      && junctions >= profile.junctions
      && deepBranches >= profile.deepBranches
      && medianDepth >= profile.medianDepth
      && shape.longestStraight <= profile.maxStraight
      && shape.orientationBias <= 0.18
      && deadEndRatio >= 0.15
      && deadEndRatio <= 0.32;
    const score = Math.abs(moves - desiredMoves) * 4
      + Math.max(0, profile.junctions - junctions) * 26
      + Math.max(0, profile.deepBranches - deepBranches) * 24
      + Math.max(0, profile.medianDepth - medianDepth) * 20
      + Math.max(0, shape.longestStraight - profile.maxStraight) * 18
      + Math.max(0, shape.orientationBias - 0.18) * 120
      + Math.max(0, 0.15 - deadEndRatio) * 120
      + Math.max(0, deadEndRatio - 0.32) * 120
      - Math.min(turns, 12) * 1.5
      - Math.min(deadEnds, Math.round(cells * 0.3)) * 0.35;
    if (!best || (valid && !best.valid) || (valid === best.valid && score < best.score)) best = { graph, score, valid };
  }
  return best.graph;
}

function buildFullBoardGraph(id, width, height, route, sourceTiles, rotatable, isMaze, goal) {
  if (isMaze) {
    const graph = buildPerfectMazeGraph(id, width, height, route[0], goal);
    const tiles = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = `${x},${y}`;
        tiles.push(tileFromDirections(x, y, graph.get(key) || new Set(["up"]), false));
      }
    }
    return tiles;
  }
  const graph = new Map();
  const routeIndex = new Map(route.map((cell, index) => [`${cell.x},${cell.y}`, index]));
  route.slice(1).forEach((cell, index) => addGraphEdge(graph, route[index], cell));

  const sourceByKey = new Map(sourceTiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  for (const tile of sourceTiles) {
    const from = { x: tile.x, y: tile.y };
    if (!graph.has(`${tile.x},${tile.y}`)) graph.set(`${tile.x},${tile.y}`, new Set());
    for (const direction of ["up", "right", "down", "left"]) {
      const delta = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }[direction];
      const to = { x: tile.x + delta[0], y: tile.y + delta[1] };
      const neighbor = sourceByKey.get(`${to.x},${to.y}`);
      if (!neighbor) continue;
      if (isMaze) {
        const fromIndex = routeIndex.get(`${from.x},${from.y}`);
        const toIndex = routeIndex.get(`${to.x},${to.y}`);
        if (fromIndex != null && toIndex != null && Math.abs(fromIndex - toIndex) > 1) continue;
      }
      const sourceConnections = (() => {
        const base = { deadEnd: ["up"], straight: ["up", "down"], corner: ["down", "right"], tee: ["up", "right", "down"], cross: ["up", "right", "down", "left"] }[tile.kind] || [];
        return base.map((entry) => ["up", "right", "down", "left"][( ["up", "right", "down", "left"].indexOf(entry) + normalizeRotation(tile.solutionRotation ?? tile.rotation)) % 4]);
      })();
      const neighborConnections = (() => {
        const base = { deadEnd: ["up"], straight: ["up", "down"], corner: ["down", "right"], tee: ["up", "right", "down"], cross: ["up", "right", "down", "left"] }[neighbor.kind] || [];
        return base.map((entry) => ["up", "right", "down", "left"][( ["up", "right", "down", "left"].indexOf(entry) + normalizeRotation(neighbor.solutionRotation ?? neighbor.rotation)) % 4]);
      })();
      const opposite = { up: "down", right: "left", down: "up", left: "right" }[direction];
      if (sourceConnections.includes(direction) && neighborConnections.includes(opposite)) {
        addGraphEdge(graph, from, to);
      }
    }
  }

  const visited = new Set(graph.keys());
  let step = 0;
  while (visited.size < width * height) {
    const frontier = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const neighbor = { x: x + dx, y: y + dy };
          if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
          if (visited.has(`${neighbor.x},${neighbor.y}`)) frontier.push({ cell: { x, y }, neighbor });
        }
      }
    }
    if (!frontier.length) break;
    const selected = frontier[deterministicIndex(id, step, frontier.length)];
    addGraphEdge(graph, selected.neighbor, selected.cell);
    visited.add(`${selected.cell.x},${selected.cell.y}`);
    step += 1;
  }
  step = mergeGraphComponents(graph, id, width, height, step);
  addGraphCycles(graph, id, width, height, step, route, isMaze);

  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      tiles.push(tileFromDirections(x, y, graph.get(key) || new Set(["up"]), rotatable));
    }
  }
  return tiles;
}

function buildStage({
  id, type, width, height, route, title, feature = "", scramble = [], specials = [], branches = [],
  stars = {}, movementMode = type === "rotate" ? "auto" : "manual", cameraStart = null, goal = null,
}) {
  const rotatableByDefault = type !== "maze";
  const tiles = route.map((_, index) => routeTile(route, index, rotatableByDefault));
  const byKey = new Map(tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  for (const branch of branches) {
    const tile = { ...branch, rotation: normalizeRotation(branch.rotation), solutionRotation: normalizeRotation(branch.solutionRotation ?? branch.rotation), rotatable: branch.rotatable ?? false };
    byKey.set(`${tile.x},${tile.y}`, tile);
  }
  if (id === 24) {
    const finalRoute = [
      { x: 8, y: 7 }, { x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 },
      { x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 },
      { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 },
      { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 },
    ];
    finalRoute.forEach((_, index) => {
      const tile = routeTile(finalRoute, index, true);
      byKey.set(`${tile.x},${tile.y}`, tile);
    });
    const trap = { x: 5, y: 4, kind: "cross", rotation: 0, solutionRotation: 0, rotatable: false, special: { trap: "checkpoint" } };
    byKey.set(`${trap.x},${trap.y}`, trap);
  }
  const authoredTiles = Array.from(byKey.values());
  const authoredSpecials = new Map(authoredTiles.filter((tile) => tile.special).map((tile) => [`${tile.x},${tile.y}`, tile.special]));
  const stageGoal = goal || GOAL_OVERRIDE[id] || route[route.length - 1];
  const fullBoardTiles = buildFullBoardGraph(id, width, height, route, authoredTiles, type !== "maze", type === "maze", stageGoal);
  byKey.clear();
  for (const tile of fullBoardTiles) {
    const directSpecial = authoredSpecials.get(`${tile.x},${tile.y}`);
    if (directSpecial && !(type === "maze" && directSpecial.trap)) tile.special = { ...directSpecial };
    byKey.set(`${tile.x},${tile.y}`, tile);
  }
  let resolvedSpecials = specials;
  let directionGuide = route;
  if (type === "maze") {
    const guideStage = {
      id: `road-puzzle-guide-${id}`,
      type,
      width,
      height,
      start: { ...route[0] },
      goal: { ...stageGoal },
      stars: {},
      tiles: Array.from(byKey.values()),
    };
    const guidePath = findRoadPuzzlePath(createRoadPuzzleState(guideStage), guideStage.start, guideStage.goal) || route;
    directionGuide = guidePath;
    const used = new Set(authoredSpecials.keys());
    specials.forEach((special) => {
      if (!special.data?.portal && !special.data?.oneWay && !special.data?.checkpoint) used.add(`${special.x},${special.y}`);
    });
    const reservePathCell = (fraction, predicate = () => true) => {
      const minimum = Math.min(2, Math.max(0, guidePath.length - 1));
      const maximum = Math.max(minimum, guidePath.length - 3);
      const target = Math.max(minimum, Math.min(maximum, Math.round((guidePath.length - 1) * fraction)));
      for (let offset = 0; offset < guidePath.length; offset += 1) {
        for (const index of [target + offset, target - offset]) {
          if (index < minimum || index > maximum) continue;
          const cell = guidePath[index];
          const key = `${cell.x},${cell.y}`;
          if (used.has(key) || !predicate(cell)) continue;
          used.add(key);
          return cell;
        }
      }
      return guidePath[target];
    };
    const portalSpecials = specials.filter((special) => special.data?.portal);
    const oneWaySpecials = specials.filter((special) => special.data?.oneWay);
    const checkpointSpecials = specials.filter((special) => special.data?.checkpoint);
    const remapped = new Map();
    let firstPortalCell = null;
    portalSpecials.forEach((special, index) => {
      const fractions = portalSpecials.length === 2 ? [0.38, 0.62] : [0.3, 0.5, 0.7];
      const cell = reservePathCell(
        fractions[index] ?? (index + 1) / (portalSpecials.length + 1),
        (candidate) => !firstPortalCell || Math.abs(candidate.x - firstPortalCell.x) + Math.abs(candidate.y - firstPortalCell.y) >= 3
      );
      if (!firstPortalCell) firstPortalCell = cell;
      remapped.set(special, cell);
    });
    oneWaySpecials.forEach((special, index) => {
      remapped.set(special, reservePathCell(0.2 + (0.6 * (index + 1)) / (oneWaySpecials.length + 1)));
    });
    checkpointSpecials.forEach((special, index) => {
      remapped.set(special, reservePathCell(0.3 + (0.4 * (index + 1)) / (checkpointSpecials.length + 1)));
    });
    resolvedSpecials = specials.map((special) => {
      const cell = remapped.get(special);
      return cell ? { ...special, x: cell.x, y: cell.y } : special;
    });
  }
  for (const special of resolvedSpecials) {
    const tile = byKey.get(`${special.x},${special.y}`);
    if (tile) tile.special = { ...(tile.special || {}), ...special.data };
  }
  if (type === "maze") {
    const guideSet = new Set(directionGuide.map((cell) => `${cell.x},${cell.y}`));
    const trapSpecials = Array.from(authoredSpecials.values()).filter((special) => special?.trap);
    const trapCandidates = Array.from(byKey.values()).filter((tile) => (
      tile.kind === "deadEnd"
      && !guideSet.has(`${tile.x},${tile.y}`)
      && !tile.special
    ));
    trapSpecials.forEach((special, index) => {
      if (!trapCandidates.length) return;
      const candidateIndex = deterministicIndex(id + 211, index, trapCandidates.length);
      const [tile] = trapCandidates.splice(candidateIndex, 1);
      tile.special = { ...special };
    });
  }
  for (const tile of byKey.values()) {
    if (!tile.special?.oneWay) continue;
    const routeIndex = directionGuide.findIndex((point) => point.x === tile.x && point.y === tile.y);
    if (routeIndex >= 0 && directionGuide[routeIndex + 1]) {
      if (directionGuide[routeIndex - 1]) tile.special.oneWayEntry = directionBetween(directionGuide[routeIndex - 1], directionGuide[routeIndex]);
      tile.special.oneWay = directionBetween(directionGuide[routeIndex], directionGuide[routeIndex + 1]);
    } else if (id === 24) {
      const finalRoute = [
        { x: 8, y: 7 }, { x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 },
        { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 },
      ];
      const finalIndex = finalRoute.findIndex((point) => point.x === tile.x && point.y === tile.y);
      if (finalIndex >= 0 && finalRoute[finalIndex + 1]) {
        if (finalRoute[finalIndex - 1]) tile.special.oneWayEntry = directionBetween(finalRoute[finalIndex - 1], finalRoute[finalIndex]);
        tile.special.oneWay = directionBetween(finalRoute[finalIndex], finalRoute[finalIndex + 1]);
      }
    }
  }
  const authoredScramble = new Map(scramble.map(([x, y, turns = 1]) => [`${x},${y}`, turns]));
  if (type !== "maze") {
    for (const tile of byKey.values()) {
      if (tile.special?.fixed || tile.special?.door) {
        tile.rotatable = false;
        tile.rotation = tile.solutionRotation;
        continue;
      }
      tile.rotatable = true;
      const key = `${tile.x},${tile.y}`;
      const turns = authoredScramble.has(key)
        ? authoredScramble.get(key)
        : (tile.kind === "cross" ? 0 : deterministicIndex(id + 17, tile.y * width + tile.x + 29, 4));
      tile.rotation = normalizeRotation(tile.solutionRotation + turns);
    }
  }
  const stageDraft = {
    id: `road-puzzle-${String(id).padStart(2, "0")}`,
    number: id,
    type,
    movementMode,
    width,
    height,
    title,
    feature,
    start: { ...route[0] },
    goal: { ...stageGoal },
    cameraStart,
    stars: { rotations: 0, moves: route.length - 1, ...stars },
    tiles: Array.from(byKey.values()),
  };
  const solvedState = createRoadPuzzleState(stageDraft);
  for (const tile of solvedState.tiles.values()) tile.rotation = tile.solutionRotation;
  stageDraft.solutionPath = findRoadPuzzlePath(solvedState, stageDraft.start, stageDraft.goal) || route.map((cell) => ({ ...cell }));
  if (stars.moves == null) {
    stageDraft.stars.moves = stageDraft.solutionPath.slice(1).reduce((moves, cell, index) => {
      const previous = stageDraft.solutionPath[index];
      return moves + (Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y) === 1 ? 1 : 0);
    }, 0);
  }
  if (type !== "maze") {
    let plan = findRoadPuzzleRotationPlan(createRoadPuzzleState(stageDraft));
    for (let attempt = 0; plan?.cost === 0 && attempt < stageDraft.tiles.length; attempt += 1) {
      const candidates = plan.path.filter(({ x, y }) => {
        const tile = byKey.get(`${x},${y}`);
        return tile?.rotatable !== false && tile.kind !== "cross";
      });
      const target = candidates[deterministicIndex(id + 73, attempt, candidates.length)]
        || stageDraft.tiles.find((tile) => tile.rotatable !== false && tile.kind !== "cross");
      if (!target) break;
      const tile = byKey.get(`${target.x},${target.y}`);
      tile.rotation = normalizeRotation(tile.rotation + 1);
      plan = findRoadPuzzleRotationPlan(createRoadPuzzleState(stageDraft));
    }
    stageDraft.stars.rotations = Math.max(1, plan?.cost || 1);
  }
  stageDraft.solutionPath = Object.freeze(stageDraft.solutionPath.map((cell) => Object.freeze({ ...cell })));
  stageDraft.tiles = Object.freeze(stageDraft.tiles.map((tile) => Object.freeze(tile)));
  stageDraft.stars = Object.freeze(stageDraft.stars);
  return Object.freeze(stageDraft);
}

const p = (x, y) => ({ x, y });

function expandRoute(points) {
  const route = [{ ...points[0] }];
  for (const target of points.slice(1)) {
    const current = route[route.length - 1];
    if (current.x !== target.x && current.y !== target.y) throw new Error("Road route segments must be orthogonal");
    const dx = Math.sign(target.x - current.x);
    const dy = Math.sign(target.y - current.y);
    let x = current.x;
    let y = current.y;
    while (x !== target.x || y !== target.y) {
      x += dx;
      y += dy;
      route.push(p(x, y));
    }
  }
  return route;
}

const MAZE_12_ROUTE = expandRoute([p(1,9),p(0,9),p(0,8),p(7,8),p(7,7),p(0,7),p(0,6),p(7,6),p(7,5),p(0,5),p(0,4),p(3,4),p(3,3),p(7,3),p(7,2),p(0,2),p(0,1),p(6,1),p(6,0)]);
const MAZE_14_ROUTE = [
  p(1,10),p(0,10),p(0,9),p(1,9),p(2,9),p(2,10),p(3,10),p(4,10),p(4,9),p(5,9),p(6,9),p(7,9),
  p(7,8),p(6,8),p(5,8),p(4,8),p(3,8),p(3,7),p(2,7),p(1,7),p(0,7),p(0,6),p(1,6),p(2,6),
  p(3,6),p(4,6),p(5,6),p(6,6),p(6,5),p(5,5),p(4,5),p(3,5),p(2,5),p(1,5),p(1,4),p(2,4),
  p(3,4),p(4,4),p(5,4),p(6,4),p(7,4),p(7,3),p(6,3),p(5,3),p(4,3),p(3,3),p(2,3),p(1,3),
  p(1,2),p(2,2),p(3,2),p(4,2),p(5,2),p(5,1),p(5,0),
];
const MAZE_15_ROUTE = expandRoute([p(2,10),p(0,10),p(0,9),p(7,9),p(7,8),p(0,8),p(0,7),p(7,7),p(7,6),p(3,6),p(3,5),p(7,5),p(7,4),p(0,4),p(0,3),p(7,3),p(7,2),p(0,2),p(0,1),p(5,1),p(5,0)]);
const MAZE_16_ROUTE = expandRoute([p(1,10),p(8,10),p(8,8),p(0,8),p(0,6),p(8,6),p(8,4),p(0,4),p(0,2),p(5,2),p(5,0)]);
const MAZE_18_ROUTE = expandRoute([p(1,11),p(8,11),p(8,9),p(0,9),p(0,7),p(8,7),p(8,5),p(0,5),p(0,3),p(8,3),p(8,1),p(7,1),p(7,0)]);
const MAZE_19_ROUTE = expandRoute([p(2,11),p(0,11),p(0,9),p(8,9),p(8,7),p(0,7),p(0,5),p(8,5),p(8,3),p(0,3),p(0,1),p(5,1),p(5,0)]);

export const ROYAL_ROAD_PUZZLE_STAGES = Object.freeze([
  buildStage({ id: 1, type: "rotate", width: 5, height: 5, title: "첫 번째 모퉁이", feature: "탭하여 길 회전", route: [p(2,4),p(2,3),p(2,2),p(3,2),p(3,1),p(3,0)], scramble: [[2,2,1],[3,2,2]] }),
  buildStage({ id: 2, type: "rotate", width: 5, height: 6, title: "두 번 꺾는 길", feature: "직선과 코너", route: [p(1,5),p(1,4),p(2,4),p(2,3),p(2,2),p(3,2),p(3,1),p(3,0)], scramble: [[1,4,1],[2,4,1],[2,2,2],[3,2,3]] }),
  buildStage({ id: 3, type: "maze", width: 5, height: 6, title: "갈림길 산책", feature: "인접한 길을 탭해 이동", route: [p(2,5),p(1,5),p(0,5),p(0,4),p(0,3),p(1,3),p(2,3),p(2,4),p(3,4),p(4,4),p(4,3),p(4,2),p(3,2),p(2,2),p(1,2),p(1,1),p(2,1),p(3,1),p(3,0)] }),
  buildStage({ id: 4, type: "rotate", width: 6, height: 7, title: "지그재그 정원", feature: "회전 횟수 계획", route: [p(1,6),p(1,5),p(2,5),p(2,4),p(3,4),p(3,3),p(4,3),p(4,2),p(3,2),p(3,1),p(3,0)], scramble: [[1,5,1],[2,5,2],[2,4,3],[3,4,1],[3,3,2],[4,3,1],[4,2,3],[3,2,1]] }),
  buildStage({ id: 5, type: "rotate", width: 6, height: 7, title: "고정된 광장", feature: "황금 테두리는 고정", route: [p(2,6),p(2,5),p(1,5),p(1,4),p(2,4),p(3,4),p(3,3),p(3,2),p(4,2),p(4,1),p(4,0)], scramble: [[2,5,1],[1,4,3],[3,4,1],[3,2,2]], specials: [{x:2,y:4,data:{fixed:true}},{x:3,y:3,data:{fixed:true}}] }),
  buildStage({ id: 6, type: "maze", width: 6, height: 8, title: "정원의 막다른 길", feature: "길을 살피고 이동", route: [p(3,7),p(2,7),p(1,7),p(1,6),p(1,5),p(2,5),p(3,5),p(4,5),p(4,6),p(5,6),p(5,5),p(5,4),p(4,4),p(3,4),p(2,4),p(1,4),p(0,4),p(0,3),p(0,2),p(1,2),p(2,2),p(2,3),p(3,3),p(4,3),p(4,2),p(5,2),p(5,1),p(4,1),p(4,0)] }),
  buildStage({ id: 7, type: "rotate", width: 6, height: 8, title: "교차로의 선택", feature: "교차로와 복수 경로", route: [p(1,7),p(1,6),p(2,6),p(2,5),p(2,4),p(3,4),p(4,4),p(4,3),p(4,2),p(3,2),p(3,1),p(3,0)], scramble: [[1,6,2],[2,6,1],[2,4,3],[4,4,2],[4,2,1],[3,2,2]], branches: [{x:3,y:3,kind:"cross",rotation:0,rotatable:false}] }),
  buildStage({ id: 8, type: "maze", width: 7, height: 9, title: "긴 회랑", feature: "보드를 드래그해 탐색", route: [p(1,8),p(0,8),p(0,7),p(1,7),p(2,7),p(2,8),p(3,8),p(4,8),p(4,7),p(5,7),p(6,7),p(6,6),p(5,6),p(4,6),p(3,6),p(3,5),p(2,5),p(1,5),p(0,5),p(0,4),p(1,4),p(2,4),p(3,4),p(4,4),p(5,4),p(6,4),p(6,3),p(5,3),p(4,3),p(3,3),p(2,3),p(1,3),p(1,2),p(2,2),p(3,2),p(4,2),p(5,2),p(5,1),p(5,0)] }),
  buildStage({ id: 9, type: "rotate", width: 7, height: 9, title: "큰 정원의 굴곡", feature: "가로·세로 스크롤", route: [p(1,8),p(1,7),p(2,7),p(2,6),p(3,6),p(4,6),p(4,5),p(5,5),p(5,4),p(4,4),p(3,4),p(3,3),p(2,3),p(2,2),p(3,2),p(4,2),p(4,1),p(4,0)], scramble: [[1,7,1],[2,7,2],[2,6,1],[4,6,3],[5,5,2],[5,4,1],[3,4,3],[2,3,2],[2,2,1],[4,2,3]] }),
  buildStage({ id: 10, type: "maze", width: 8, height: 10, title: "왕실 수목원", feature: "넓은 미로", route: [p(1,9),p(0,9),p(0,8),p(1,8),p(2,8),p(2,9),p(3,9),p(4,9),p(4,8),p(5,8),p(6,8),p(7,8),p(7,7),p(6,7),p(5,7),p(4,7),p(3,7),p(2,7),p(1,7),p(0,7),p(0,6),p(1,6),p(2,6),p(3,6),p(4,6),p(5,6),p(6,6),p(6,5),p(5,5),p(4,5),p(3,5),p(2,5),p(1,5),p(1,4),p(2,4),p(3,4),p(4,4),p(5,4),p(6,4),p(7,4),p(7,3),p(6,3),p(5,3),p(4,3),p(3,3),p(2,3),p(1,3),p(1,2),p(2,2),p(3,2),p(4,2),p(5,2),p(6,2),p(6,1),p(6,0)] }),
  buildStage({ id: 11, type: "rotate", width: 8, height: 10, title: "움직이는 회랑", feature: "긴 길의 순서를 계획", route: [p(2,9),p(2,8),p(1,8),p(1,7),p(2,7),p(3,7),p(3,6),p(4,6),p(5,6),p(5,5),p(6,5),p(6,4),p(5,4),p(4,4),p(4,3),p(3,3),p(3,2),p(4,2),p(5,2),p(5,1),p(5,0)], scramble: [[2,8,1],[1,8,1],[1,7,2],[3,7,1],[3,6,3],[5,6,2],[6,5,3],[6,4,1],[4,4,2],[3,3,1],[3,2,3],[5,2,2]] }),
  buildStage({ id: 12, type: "maze", width: 8, height: 10, title: "별빛 문", feature: "포탈", route: MAZE_12_ROUTE, specials: [{x:0,y:4,data:{portal:"blue"}},{x:0,y:2,data:{portal:"blue"}}] }),
  buildStage({ id: 13, type: "rotate", width: 8, height: 10, title: "회전하는 포탈", feature: "길 연결과 포탈", route: [p(1,9),p(1,8),p(2,8),p(2,7),p(3,7)], branches: [routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],0,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],1,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],2,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],3,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],4,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],5,true),routeTile([p(5,4),p(5,3),p(4,3),p(4,2),p(5,2),p(5,1),p(5,0)],6,true)], scramble:[[1,8,1],[2,8,2],[5,3,1],[4,3,3],[4,2,2]], specials:[{x:3,y:7,data:{portal:"blue"}},{x:5,y:4,data:{portal:"blue"}}], movementMode:"auto", stars:{moves:11} }),
  buildStage({ id: 14, type: "maze", width: 8, height: 11, title: "화살표 정원", feature: "일방통행", route: MAZE_14_ROUTE, specials: [{x:1,y:9,data:{oneWay:"right"}},{x:3,y:8,data:{oneWay:"down"}},{x:2,y:7,data:{oneWay:"left"}},{x:3,y:6,data:{oneWay:"right"}},{x:4,y:5,data:{oneWay:"left"}},{x:3,y:4,data:{oneWay:"right"}}] }),
  buildStage({ id: 15, type: "maze", width: 8, height: 11, title: "고정석과 별빛", feature: "포탈·고정 길", route: MAZE_15_ROUTE, specials:[{x:3,y:6,data:{portal:"gold"}},{x:6,y:5,data:{portal:"gold"}},{x:4,y:4,data:{fixed:true}}] }),
  buildStage({ id: 16, type: "maze", width: 9, height: 11, title: "가시 정원의 우회", feature: "함정과 체크포인트", route: MAZE_16_ROUTE, specials:[{x:0,y:6,data:{checkpoint:true}},{x:8,y:4,data:{checkpoint:true}}], branches:[{x:4,y:9,kind:"cross",rotation:0,special:{trap:"checkpoint"}},{x:4,y:5,kind:"cross",rotation:0,special:{trap:"checkpoint"}}] }),
  buildStage({ id: 17, type: "rotate", width: 9, height: 11, title: "제한된 회전", feature: "최적 회전 도전", route: [p(2,10),p(2,9),p(1,9),p(1,8),p(2,8),p(3,8),p(3,7),p(4,7),p(5,7),p(5,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(3,4),p(3,3),p(4,3),p(5,3),p(5,2),p(6,2),p(6,1),p(6,0)], scramble:[[2,9,1],[1,9,2],[1,8,1],[3,8,3],[3,7,1],[5,7,2],[6,6,1],[6,5,3],[4,5,2],[3,4,1],[3,3,3],[5,3,2],[6,2,1]] }),
  buildStage({ id: 18, type: "maze", width: 9, height: 12, title: "두 개의 덫", feature: "체크포인트 활용", route: MAZE_18_ROUTE, specials:[{x:0,y:7,data:{checkpoint:true}},{x:8,y:3,data:{checkpoint:true}}], branches:[{x:5,y:8,kind:"cross",rotation:0,special:{trap:"checkpoint"}},{x:5,y:4,kind:"cross",rotation:0,special:{trap:"checkpoint"}}] }),
  buildStage({ id: 19, type: "maze", width: 9, height: 12, title: "거꾸로 흐르는 길", feature: "일방통행·함정", route: MAZE_19_ROUTE, specials:[{x:2,y:9,data:{oneWay:"right"}},{x:8,y:8,data:{oneWay:"down"}},{x:5,y:7,data:{oneWay:"left"}},{x:0,y:6,data:{oneWay:"down"}},{x:4,y:5,data:{oneWay:"right"}},{x:8,y:4,data:{oneWay:"down"}},{x:5,y:3,data:{oneWay:"left"}},{x:0,y:2,data:{oneWay:"down"}}], branches:[{x:4,y:8,kind:"cross",rotation:0,special:{trap:"start"}}] }),
  buildStage({ id: 20, type: "hybrid", width: 9, height: 12, title: "열리는 왕실 문", feature: "회전·이동·스위치", route: [p(1,11),p(1,10),p(2,10),p(2,9),p(3,9),p(3,8),p(4,8),p(4,7),p(5,7),p(5,6),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(6,2),p(6,1),p(6,0)], scramble:[[2,10,1],[3,9,2],[4,8,1],[5,7,3],[5,5,1],[4,4,2],[5,3,1]], specials:[{x:4,y:7,data:{switch:"amber"}},{x:4,y:3,data:{door:"amber"}}] }),
  buildStage({ id: 21, type: "hybrid", width: 10, height: 12, title: "문 너머의 포탈", feature: "스위치·문·포탈", route: [p(1,11),p(1,10),p(2,10),p(3,10),p(3,9),p(3,8),p(4,8),p(5,8)], branches:[routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],0,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],1,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],2,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],3,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],4,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],5,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],6,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],7,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],8,true),routeTile([p(7,5),p(7,4),p(6,4),p(6,3),p(5,3),p(5,2),p(6,2),p(7,2),p(7,1),p(7,0)],9,true)], scramble:[[1,10,1],[3,10,2],[3,8,1],[7,4,2],[6,3,1],[5,2,3],[7,2,1]], specials:[{x:4,y:8,data:{switch:"blue"}},{x:5,y:8,data:{portal:"violet"}},{x:7,y:5,data:{portal:"violet"}},{x:6,y:3,data:{door:"blue"}}], stars:{moves:17} }),
  buildStage({ id: 22, type: "hybrid", width: 10, height: 13, title: "회전 장치", feature: "밟으면 길이 회전", route: [p(2,12),p(2,11),p(1,11),p(1,10),p(2,10),p(3,10),p(3,9),p(4,9),p(5,9),p(5,8),p(5,7),p(6,7),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(6,2),p(7,2),p(7,1),p(7,0)], scramble:[[2,11,1],[1,11,2],[1,10,1],[3,10,3],[3,9,1],[5,9,2],[5,7,3],[6,7,1],[6,5,2],[4,5,1],[4,3,3],[6,3,2],[7,2,1]], specials:[{x:5,y:8,data:{rotateTarget:{x:4,y:4,turns:1}}}], stars:{moves:23} }),
  buildStage({ id: 23, type: "hybrid", width: 10, height: 13, title: "세 갈래 왕도", feature: "함정·스위치·일방통행", route: [p(1,12),p(1,11),p(2,11),p(3,11),p(3,10),p(4,10),p(5,10),p(5,9),p(5,8),p(4,8),p(3,8),p(3,7),p(3,6),p(4,6),p(5,6),p(6,6),p(6,5),p(6,4),p(5,4),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)], scramble:[[1,11,1],[3,11,3],[3,10,1],[5,10,2],[5,8,3],[3,8,1],[3,6,2],[6,6,1],[6,4,3],[5,3,1],[7,3,2],[8,2,1]], specials:[{x:4,y:10,data:{checkpoint:true}},{x:4,y:6,data:{switch:"sun"}},{x:7,y:3,data:{door:"sun"}},{x:6,y:4,data:{oneWay:"left"}}], branches:[{x:4,y:9,kind:"cross",rotation:0,special:{trap:"checkpoint"}},{x:4,y:7,kind:"cross",rotation:0,special:{trap:"checkpoint"}}] }),
  buildStage({ id: 24, type: "hybrid", width: 10, height: 14, title: "왕국의 마지막 길", feature: "모든 규칙의 결합", route: [p(1,13),p(1,12),p(2,12),p(3,12),p(3,11),p(4,11),p(5,11),p(5,10),p(6,10)], branches:[routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],0,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],1,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],2,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],3,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],4,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],5,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],6,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],7,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],8,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],9,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],10,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],11,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],12,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],13,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],14,true),routeTile([p(8,7),p(8,6),p(7,6),p(6,6),p(6,5),p(5,5),p(4,5),p(4,4),p(4,3),p(5,3),p(6,3),p(7,3),p(7,2),p(8,2),p(8,1),p(8,0)],15,true)], scramble:[[1,12,1],[3,12,2],[3,11,1],[5,11,3],[8,6,1],[7,6,2],[6,5,3],[4,5,1],[4,3,2],[6,3,1],[7,2,3],[8,2,1]], specials:[{x:4,y:11,data:{switch:"moon",checkpoint:true}},{x:6,y:10,data:{portal:"royal"}},{x:8,y:7,data:{portal:"royal"}},{x:6,y:5,data:{door:"moon"}},{x:5,y:3,data:{oneWay:"right"}}], branches:[{x:5,y:4,kind:"cross",rotation:0,special:{trap:"checkpoint"}}], stars:{moves:24} }),
]);

export function getRoyalRoadPuzzleStage(index) {
  const safe = Math.max(0, Math.min(ROYAL_ROAD_PUZZLE_STAGES.length - 1, Number(index) || 0));
  return ROYAL_ROAD_PUZZLE_STAGES[safe];
}
