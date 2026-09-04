import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canTraverseRoadPuzzle,
  createRoadPuzzleState,
  findRoadPuzzlePath,
  findRoadPuzzleRotationPlan,
  moveRoadPuzzlePlayer,
  normalizeRotation,
  roadPuzzleHint,
  rotateDirection,
  rotateRoadPuzzleTile,
  scoreRoadPuzzle,
  tileConnections,
} from "../src/royalRoadPuzzleLogic.js";
import { ROYAL_ROAD_PUZZLE_STAGES } from "../src/royalRoadPuzzleStages.js";

const puzzleSceneSource = fs.readFileSync(new URL("../src/scenes/RoyalRoadPuzzle.js", import.meta.url), "utf8");
assert.match(puzzleSceneSource, /fillTriangle\(/, "direct-move highlights must include directional triangles");
assert.match(puzzleSceneSource, /GOAL_VISUAL_OFFSET_Y = -CELL \* 0\.31/, "goal art must rise above its destination without escaping the frame");
assert.match(puzzleSceneSource, /GOAL_MASK_OVERFLOW_Y = PLAY_VIEW\.y - VIEW\.y/, "goal overflow must stop at the fixed outer frame");
assert.match(puzzleSceneSource, /fillRect\(\s*PLAY_VIEW\.x,\s*VIEW\.y,/, "goal art must remain visible only inside the outer frame");
assert.match(puzzleSceneSource, /maskShape\.fillStyle\([^\n]+\)\.fillRect\(PLAY_VIEW\.x, PLAY_VIEW\.y, PLAY_VIEW\.width, PLAY_VIEW\.height\)/, "the board mask must not expose board content above its frame");
assert.match(puzzleSceneSource, /this\.goalOverflowRoot\.setMask\(/, "goal overflow art must use its own mask");
assert.match(puzzleSceneSource, /this\.goalOverflowRoot\.add\(this\.goalOverflowView\)/, "only a duplicate of the goal art may render above the board");
assert.match(puzzleSceneSource, /this\.goalOverflowRoot\.setPosition\(this\.cameraOffset\.x, this\.cameraOffset\.y\)/, "goal overflow art must follow board camera movement");

assert.equal(ROYAL_ROAD_PUZZLE_STAGES.length, 24, "24 stages are required");
assert.equal(new Set(ROYAL_ROAD_PUZZLE_STAGES.map((stage) => stage.id)).size, 24, "stage ids must be unique");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.width >= 10 && stage.height >= 12), "large boards must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.filter((stage) => stage.type === "hybrid").length >= 5, "late hybrid stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.portal)), "portal stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.trap)), "trap stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.switch)), "switch stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.door)), "door stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.oneWay)), "one-way stages must exist");
assert(ROYAL_ROAD_PUZZLE_STAGES.some((stage) => stage.tiles.some((tile) => tile.special?.rotateTarget)), "rotation-trigger stages must exist");

assert.equal(rotateDirection("up", 1), "right");
assert.equal(rotateDirection("left", 1), "up");
assert.equal(normalizeRotation(-1), 3);
const turnTile = { kind: "corner", rotation: 0 };
const originalConnections = tileConnections(turnTile);
turnTile.rotation = 4;
assert.deepEqual(tileConnections(turnTile), originalConnections, "four rotations restore the tile");

function structuralGraphStats(stage) {
  const byKey = new Map(stage.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const visited = new Set();
  const queue = [`${stage.start.x},${stage.start.y}`];
  let directedEdges = 0;
  while (queue.length) {
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    const tile = byKey.get(key);
    const [x, y] = key.split(",").map(Number);
    const solvedTile = { ...tile, rotation: tile.solutionRotation };
    for (const direction of tileConnections(solvedTile)) {
      const delta = { up:[0,-1], right:[1,0], down:[0,1], left:[-1,0] }[direction];
      const neighbor = byKey.get(`${x + delta[0]},${y + delta[1]}`);
      if (!neighbor) continue;
      const opposite = { up:"down", right:"left", down:"up", left:"right" }[direction];
      if (!tileConnections({ ...neighbor, rotation: neighbor.solutionRotation }).includes(opposite)) continue;
      directedEdges += 1;
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(neighborKey)) queue.push(neighborKey);
    }
  }
  return { visited: visited.size, edges: directedEdges / 2 };
}

for (const stage of ROYAL_ROAD_PUZZLE_STAGES) {
  assert(["rotate", "maze", "hybrid"].includes(stage.type), `${stage.id}: valid type`);
  assert(stage.width >= 5 && stage.height >= 5, `${stage.id}: board size`);
  assert(stage.start.x >= 0 && stage.start.x < stage.width && stage.start.y >= 0 && stage.start.y < stage.height, `${stage.id}: start in range`);
  assert(stage.goal.x >= 0 && stage.goal.x < stage.width && stage.goal.y >= 0 && stage.goal.y < stage.height, `${stage.id}: goal in range`);
  for (const tile of stage.tiles) {
    assert(tile.x >= 0 && tile.x < stage.width && tile.y >= 0 && tile.y < stage.height, `${stage.id}: tile in range`);
    assert(["deadEnd", "straight", "corner", "tee", "cross"].includes(tile.kind), `${stage.id}: tile kind`);
  }
  assert.equal(stage.tiles.length, stage.width * stage.height, `${stage.id}: every board cell has a tile`);
  const graph = structuralGraphStats(stage);
  assert.equal(graph.visited, stage.tiles.length, `${stage.id}: every road belongs to one connected network`);
  const minimumEdges = stage.type === "maze" ? stage.tiles.length - 1 : stage.tiles.length + 1;
  assert(graph.edges >= minimumEdges, `${stage.id}: connected network includes alternate loops`);
  const solved = createRoadPuzzleState(stage);
  for (const tile of solved.tiles.values()) tile.rotation = tile.solutionRotation;
  const path = findRoadPuzzlePath(solved, stage.start, stage.goal);
  assert(path && path.length >= 2, `${stage.id}: solution path exists`);

  const initial = createRoadPuzzleState(stage);
  if (stage.type !== "maze") assert(!findRoadPuzzlePath(initial, stage.start, stage.goal), `${stage.id}: rotation puzzle is not already solved`);
  const hint = roadPuzzleHint(initial);
  assert(hint || stage.type === "maze", `${stage.id}: rotation or movement hint exists`);
  if (stage.type !== "maze") {
    const generalTiles = stage.tiles.filter((tile) => !tile.special?.fixed && !tile.special?.door);
    assert(generalTiles.every((tile) => tile.rotatable !== false), `${stage.id}: every general road tile can rotate`);
    for (const tile of generalTiles) {
      const tapState = createRoadPuzzleState(stage);
      assert(rotateRoadPuzzleTile(tapState, tile.x, tile.y).rotated, `${stage.id}: general tile ${tile.x},${tile.y} accepts rotation`);
    }
    const planState = createRoadPuzzleState(stage);
    const plan = findRoadPuzzleRotationPlan(planState);
    assert(plan, `${stage.id}: a reproducible rotation plan exists`);
    for (const tile of plan.path) {
      for (let turn = 0; turn < tile.turns; turn += 1) rotateRoadPuzzleTile(planState, tile.x, tile.y);
    }
    assert(findRoadPuzzlePath(planState), `${stage.id}: advertised rotation plan opens a real playable path`);
    assert(planState.rotations <= stage.stars.rotations, `${stage.id}: advertised plan meets the rotation target`);
    planState.moves = 0;
    assert.equal(scoreRoadPuzzle(planState), 3, `${stage.id}: advertised plan can earn three stars without hints or traps`);
    const rotatable = Array.from(initial.tiles.values()).find((tile) => tile.rotatable !== false);
    assert(rotatable, `${stage.id}: rotatable tile exists`);
    const before = rotatable.rotation;
    const result = rotateRoadPuzzleTile(initial, rotatable.x, rotatable.y);
    assert(result.rotated && rotatable.rotation === normalizeRotation(before + 1), `${stage.id}: tile rotates once`);
  }
}

const firstStage = ROYAL_ROAD_PUZZLE_STAGES[0];
const firstState = createRoadPuzzleState(firstStage);
assert.equal(firstStage.tiles.filter((tile) => tile.rotatable !== false).length, firstStage.tiles.length, "stage 1 lets players investigate every tile");
const firstPlan = findRoadPuzzleRotationPlan(firstState);
assert(firstPlan && firstPlan.cost > 0, "stage 1 has a reproducible rotation plan");
for (const tile of firstPlan.path) {
  for (let turn = 0; turn < tile.turns; turn += 1) rotateRoadPuzzleTile(firstState, tile.x, tile.y);
}
firstState.moves = firstStage.stars.moves;
assert.equal(firstState.rotations, firstStage.stars.rotations, "stage 1 target matches the playable clockwise plan");
assert(findRoadPuzzlePath(firstState), "stage 1 is solved after the advertised rotations");
assert.equal(scoreRoadPuzzle(firstState), 3, "stage 1 perfect play earns three stars");

const mazeStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.type === "maze");
const maze = createRoadPuzzleState(mazeStage);
const mazePath = findRoadPuzzlePath(maze);
assert(canTraverseRoadPuzzle(maze, mazePath[0], mazePath[1]), "first maze step is traversable");
assert(moveRoadPuzzlePlayer(maze, mazePath[1].x, mazePath[1].y).moved, "maze player moves to connected neighbor");
assert(!moveRoadPuzzlePlayer(maze, mazePath[1].x + 2, mazePath[1].y).moved, "maze player cannot jump");
for (const stage of ROYAL_ROAD_PUZZLE_STAGES.filter((candidate) => candidate.type === "maze")) {
  const mazeState = createRoadPuzzleState(stage);
  const branchCells = Array.from(mazeState.tiles.values()).filter((tile) => tileConnections(tile).length >= 3);
  const deadEnds = Array.from(mazeState.tiles.values()).filter((tile) => tileConnections(tile).length === 1);
  assert(branchCells.length >= 1, `${stage.id}: maze contains a real junction`);
  assert(deadEnds.length >= 2, `${stage.id}: maze contains meaningful dead ends`);
}

function mazeQuality(stage) {
  const state = createRoadPuzzleState(stage);
  for (const tile of state.tiles.values()) tile.special = {};
  const opposite = { up:"down", right:"left", down:"up", left:"right" };
  const delta = { up:[0,-1], right:[1,0], down:[0,1], left:[-1,0] };
  const adjacency = new Map();
  for (const tile of state.tiles.values()) {
    const neighbors = [];
    for (const direction of tileConnections(tile)) {
      const [dx, dy] = delta[direction];
      const neighbor = state.tiles.get(`${tile.x + dx},${tile.y + dy}`);
      if (neighbor && tileConnections(neighbor).includes(opposite[direction])) neighbors.push(`${neighbor.x},${neighbor.y}`);
    }
    adjacency.set(`${tile.x},${tile.y}`, neighbors);
  }
  const startKey = `${stage.start.x},${stage.start.y}`;
  const goalKey = `${stage.goal.x},${stage.goal.y}`;
  const previous = new Map([[startKey, null]]);
  const queue = [startKey];
  while (queue.length) {
    const key = queue.shift();
    for (const nextKey of adjacency.get(key) || []) {
      if (previous.has(nextKey)) continue;
      previous.set(nextKey, key);
      queue.push(nextKey);
    }
  }
  const path = [];
  for (let key = goalKey; key; key = previous.get(key)) path.push(key);
  path.reverse();
  const pathSet = new Set(path);
  const branchDepths = [];
  path.forEach((key, index) => {
    const pathNeighbors = new Set([path[index - 1], path[index + 1]].filter(Boolean));
    for (const nextKey of adjacency.get(key) || []) {
      if (pathNeighbors.has(nextKey) || pathSet.has(nextKey)) continue;
      let deepest = 1;
      const stack = [{ key: nextKey, parent: key, depth: 1 }];
      while (stack.length) {
        const current = stack.pop();
        deepest = Math.max(deepest, current.depth);
        for (const child of adjacency.get(current.key) || []) {
          if (child === current.parent || pathSet.has(child)) continue;
          stack.push({ key: child, parent: current.key, depth: current.depth + 1 });
        }
      }
      branchDepths.push(deepest);
    }
  });
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
      previousDirection = direction;
      straight = 1;
    }
    longestStraight = Math.max(longestStraight, straight);
  }
  let globalLongestStraight = 0;
  let horizontalEdges = 0;
  let verticalEdges = 0;
  for (let y = 0; y < stage.height; y += 1) {
    let run = 0;
    for (let x = 0; x < stage.width - 1; x += 1) {
      if (adjacency.get(`${x},${y}`)?.includes(`${x + 1},${y}`)) {
        run += 1;
        horizontalEdges += 1;
      } else run = 0;
      globalLongestStraight = Math.max(globalLongestStraight, run);
    }
  }
  for (let x = 0; x < stage.width; x += 1) {
    let run = 0;
    for (let y = 0; y < stage.height - 1; y += 1) {
      if (adjacency.get(`${x},${y}`)?.includes(`${x},${y + 1}`)) {
        run += 1;
        verticalEdges += 1;
      } else run = 0;
      globalLongestStraight = Math.max(globalLongestStraight, run);
    }
  }
  const sortedDepths = [...branchDepths].sort((left, right) => left - right);
  const deadEnds = Array.from(adjacency.values()).filter((neighbors) => neighbors.length === 1).length;
  return {
    moves: path.length - 1,
    pathJunctions: path.filter((key) => (adjacency.get(key)?.length || 0) >= 3).length,
    deepBranches: branchDepths.filter((depth) => depth >= 3).length,
    medianBranchDepth: sortedDepths[Math.floor(sortedDepths.length / 2)] || 0,
    deadEndRatio: deadEnds / stage.tiles.length,
    globalLongestStraight,
    orientationBias: Math.abs(horizontalEdges - verticalEdges) / Math.max(1, horizontalEdges + verticalEdges),
    turns,
    longestStraight,
  };
}

for (const stage of ROYAL_ROAD_PUZZLE_STAGES.filter((candidate) => candidate.type === "maze")) {
  const quality = mazeQuality(stage);
  const cells = stage.width * stage.height;
  const profile = cells <= 30
    ? { minMoves:10, maxMoves:15, junctions:2, deepBranches:2, medianDepth:2, maxStraight:3 }
    : cells <= 48
      ? { minMoves:14, maxMoves:20, junctions:3, deepBranches:3, medianDepth:2, maxStraight:4 }
      : cells <= 63
        ? { minMoves:17, maxMoves:24, junctions:4, deepBranches:4, medianDepth:3, maxStraight:4 }
        : cells <= 88
          ? { minMoves:20, maxMoves:28, junctions:5, deepBranches:5, medianDepth:3, maxStraight:4 }
          : { minMoves:24, maxMoves:32, junctions:6, deepBranches:7, medianDepth:3, maxStraight:4 };
  assert(quality.moves >= profile.minMoves, `${stage.id}: solution requires meaningful navigation`);
  assert(quality.moves <= profile.maxMoves, `${stage.id}: solution avoids repetitive walking`);
  assert(quality.pathJunctions >= profile.junctions, `${stage.id}: solution crosses real choices`);
  assert(quality.deepBranches >= profile.deepBranches, `${stage.id}: maze contains enough deep wrong turns`);
  assert(quality.medianBranchDepth >= profile.medianDepth, `${stage.id}: wrong turns are not trivial one-cell stubs`);
  assert(quality.turns >= Math.ceil(quality.moves * 0.5), `${stage.id}: solution is visually winding`);
  assert(quality.globalLongestStraight <= profile.maxStraight, `${stage.id}: no laborious straight corridor dominates the board`);
  assert(quality.orientationBias <= 0.18, `${stage.id}: horizontal and vertical passages stay balanced`);
  assert(quality.deadEndRatio >= 0.15 && quality.deadEndRatio <= 0.32, `${stage.id}: dead-end density stays readable`);

  const playablePath = findRoadPuzzlePath(createRoadPuzzleState(stage));
  const actualMoves = playablePath.slice(1).reduce((moves, cell, index) => {
    const previousCell = playablePath[index];
    return moves + (Math.abs(cell.x - previousCell.x) + Math.abs(cell.y - previousCell.y) === 1 ? 1 : 0);
  }, 0);
  assert.equal(stage.stars.moves, actualMoves, `${stage.id}: crown move target matches the playable shortest path`);
}

const scoreStage = ROYAL_ROAD_PUZZLE_STAGES[0];
const perfect = createRoadPuzzleState(scoreStage);
perfect.rotations = scoreStage.stars.rotations;
perfect.moves = scoreStage.stars.moves;
assert.equal(scoreRoadPuzzle(perfect), 3, "perfect run earns three crowns");
perfect.hints = 1;
assert.equal(scoreRoadPuzzle(perfect), 2, "hint use removes the third star");
perfect.rotations += 10;
assert.equal(scoreRoadPuzzle(perfect), 1, "inefficient run still clears with one star");

const fixedStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.tiles.some((tile) => tile.special?.fixed));
const fixedState = createRoadPuzzleState(fixedStage);
const fixedTile = Array.from(fixedState.tiles.values()).find((tile) => tile.special?.fixed);
assert.equal(rotateRoadPuzzleTile(fixedState, fixedTile.x, fixedTile.y).rotated, false, "fixed tiles reject rotation");

const oneWayState = createRoadPuzzleState({
  id: "one-way-test", type: "maze", width: 1, height: 3, start: { x: 0, y: 2 }, goal: { x: 0, y: 0 }, stars: {},
  tiles: [
    { x: 0, y: 0, kind: "straight", rotation: 0, solutionRotation: 0, rotatable: false },
    { x: 0, y: 1, kind: "straight", rotation: 0, solutionRotation: 0, rotatable: false, special: { oneWay: "up", oneWayEntry: "up" } },
    { x: 0, y: 2, kind: "straight", rotation: 0, solutionRotation: 0, rotatable: false },
  ],
});
assert(canTraverseRoadPuzzle(oneWayState, { x: 0, y: 2 }, { x: 0, y: 1 }), "one-way allows entry in arrow direction");
assert(canTraverseRoadPuzzle(oneWayState, { x: 0, y: 1 }, { x: 0, y: 0 }), "one-way allows exit in arrow direction");
assert(!canTraverseRoadPuzzle(oneWayState, { x: 0, y: 0 }, { x: 0, y: 1 }), "one-way blocks reverse entry");
assert(!canTraverseRoadPuzzle(oneWayState, { x: 0, y: 1 }, { x: 0, y: 2 }), "one-way blocks reverse exit");

const portalStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.tiles.some((tile) => tile.special?.portal));
const portalState = createRoadPuzzleState(portalStage);
const portalPath = findRoadPuzzlePath(portalState);
const portalEntryIndex = portalPath.findIndex((cell, index) => index > 0 && Math.abs(cell.x - portalPath[index - 1].x) + Math.abs(cell.y - portalPath[index - 1].y) > 1);
assert(portalEntryIndex > 0, "portal path contains a teleport jump");

const trapStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.tiles.some((tile) => tile.special?.trap));
const trapState = createRoadPuzzleState(trapStage);
const trapTile = Array.from(trapState.tiles.values()).find((tile) => tile.special?.trap);
const adjacentTrapSource = Object.values({ up:[0,1], right:[-1,0], down:[0,-1], left:[1,0] })
  .map(([dx, dy]) => ({ x: trapTile.x + dx, y: trapTile.y + dy }))
  .find((cell) => canTraverseRoadPuzzle(trapState, cell, trapTile));
if (adjacentTrapSource) {
  trapState.player = adjacentTrapSource;
  const trapped = moveRoadPuzzlePlayer(trapState, trapTile.x, trapTile.y);
  assert(trapped.events.some((event) => event.type === "trap"), "trap emits its state transition");
  assert.deepEqual(trapState.player, trapState.checkpoint, "trap returns to the checkpoint");
}

const switchStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.tiles.some((tile) => tile.special?.switch));
const switchState = createRoadPuzzleState(switchStage);
for (const tile of switchState.tiles.values()) tile.rotation = tile.solutionRotation;
const switchTile = Array.from(switchState.tiles.values()).find((tile) => tile.special?.switch);
const switchPath = findRoadPuzzlePath(switchState, switchStage.start, switchTile);
for (const step of switchPath.slice(1)) moveRoadPuzzlePlayer(switchState, step.x, step.y);
assert(switchState.switches[switchTile.special.switch], "switch opens its linked state");
const doorTile = Array.from(switchState.tiles.values()).find((tile) => tile.special?.door === switchTile.special.switch);
assert(doorTile && findRoadPuzzlePath(switchState, switchState.player, switchStage.goal), "opened door participates in pathfinding");

const triggerStage = ROYAL_ROAD_PUZZLE_STAGES.find((stage) => stage.tiles.some((tile) => tile.special?.rotateTarget));
const triggerState = createRoadPuzzleState(triggerStage);
for (const tile of triggerState.tiles.values()) tile.rotation = tile.solutionRotation;
const triggerTile = Array.from(triggerState.tiles.values()).find((tile) => tile.special?.rotateTarget);
const targetTile = triggerState.tiles.get(`${triggerTile.special.rotateTarget.x},${triggerTile.special.rotateTarget.y}`);
const targetBefore = targetTile.rotation;
const triggerPath = findRoadPuzzlePath(triggerState, triggerStage.start, triggerTile);
for (const step of triggerPath.slice(1)) moveRoadPuzzlePlayer(triggerState, step.x, step.y);
assert.equal(targetTile.rotation, normalizeRotation(targetBefore + (triggerTile.special.rotateTarget.turns || 1)), "rotation trigger rotates its target");
assert.equal(triggerState.rotations, 0, "trigger rotations do not count as player rotations");

console.log("Royal Road Puzzle validation passed.");
