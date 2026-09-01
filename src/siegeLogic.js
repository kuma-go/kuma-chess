export const SIEGE_BOARD_SIZE = 8;
export const SIEGE_COLORS = Object.freeze(["w", "b"]);
export const SIEGE_UNIT_TYPES = Object.freeze(["pawn", "knight", "bishop", "rook", "queen", "king"]);
export const SIEGE_AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ intervalMs: 1300, reserve: 35, pool: Object.freeze(["pawn", "pawn", "knight", "king", "bishop"]) }),
  normal: Object.freeze({ intervalMs: 800, reserve: 20, pool: Object.freeze(["pawn", "knight", "bishop", "rook", "queen", "king"]) }),
  hard: Object.freeze({ intervalMs: 480, reserve: 0, pool: Object.freeze(["pawn", "knight", "bishop", "rook", "queen", "king"]) }),
});

const DEFAULT_UNITS = Object.freeze({
  pawn: Object.freeze({
    cost: 40, hp: 80, attack: 12, moveSpeed: 1.25, attackIntervalMs: 800, range: 1,
    role: "swarm",
  }),
  knight: Object.freeze({
    cost: 100, hp: 180, attack: 28, moveSpeed: 1.65, attackIntervalMs: 900, range: 1,
    role: "charger", chargeEvery: 3, chargeMultiplier: 1.75, leapBlocked: true,
  }),
  bishop: Object.freeze({
    cost: 140, hp: 145, attack: 32, moveSpeed: 0.9, attackIntervalMs: 1050, range: 3,
    role: "ranged", piercingMultiplier: 0.35,
  }),
  rook: Object.freeze({
    cost: 180, hp: 430, attack: 35, moveSpeed: 0.65, attackIntervalMs: 1250, range: 1,
    role: "tank", siegeMultiplier: 1.8,
  }),
  queen: Object.freeze({
    cost: 240, hp: 230, attack: 42, moveSpeed: 1, attackIntervalMs: 700, range: 2,
    role: "dealer", splashMultiplier: 0.3,
  }),
  king: Object.freeze({
    cost: 80, hp: 320, attack: 22, moveSpeed: 0.8, attackIntervalMs: 950, range: 1,
    role: "support", auraRadius: 2, auraAttackMultiplier: 1.12,
  }),
});

export const DEFAULT_SIEGE_CONFIG = Object.freeze({
  boardSize: SIEGE_BOARD_SIZE,
  tickMs: 100,
  matchDurationMs: 180000,
  deploymentRows: 3,
  resource: Object.freeze({
    start: 800,
    ratePerSecond: 8,
    max: 2000,
    killRewardRate: 0.3,
    defenseSupply: Object.freeze({ thresholdRatio: 0.15, stepRatio: 0.15, perStep: 2, maxBonus: 6 }),
  }),
  castle: Object.freeze({ hp: 2000, columns: Object.freeze({ w: 3, b: 3 }) }),
  units: DEFAULT_UNITS,
  chest: Object.freeze({
    initial: true,
    respawnMs: 8000,
    buffDurationMs: 10000,
    healRadius: 2,
    healAmount: 55,
    effects: Object.freeze([
      "points50", "points100", "income1", "income2", "attack", "move", "attackSpeed",
      "heal", "freePawn", "nearestBoost", "portalReset",
    ]),
  }),
  portal: Object.freeze({ initial: true, respawnMs: 3500, minDistance: 3, castleExclusionDistance: 1 }),
  buffs: Object.freeze({ attackMultiplier: 1.2, moveMultiplier: 1.2, attackSpeedMultiplier: 1.2 }),
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, override) {
  if (!isObject(override)) return structuredClone(base);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(result[key])) result[key] = mergeConfig(result[key], value);
    else result[key] = structuredClone(value);
  }
  return result;
}

export function createSiegeConfig(overrides = {}) {
  const config = mergeConfig(DEFAULT_SIEGE_CONFIG, overrides);
  if (!Number.isInteger(config.boardSize) || config.boardSize < 4) throw new RangeError("boardSize must be at least 4.");
  if (!Number.isFinite(config.tickMs) || config.tickMs <= 0) throw new RangeError("tickMs must be positive.");
  for (const type of SIEGE_UNIT_TYPES) {
    const unit = config.units[type];
    if (!unit) throw new RangeError(`Missing unit config: ${type}`);
    for (const field of ["cost", "hp", "attack", "moveSpeed", "attackIntervalMs", "range"]) {
      if (!Number.isFinite(unit[field]) || unit[field] < 0) throw new RangeError(`Invalid ${type}.${field}.`);
    }
  }
  if (!Number.isFinite(config.resource.killRewardRate) || config.resource.killRewardRate < 0) {
    throw new RangeError("resource.killRewardRate must be non-negative.");
  }
  for (const field of ["thresholdRatio", "stepRatio", "perStep", "maxBonus"]) {
    if (!Number.isFinite(config.resource.defenseSupply?.[field]) || config.resource.defenseSupply[field] < 0) {
      throw new RangeError(`resource.defenseSupply.${field} must be non-negative.`);
    }
  }
  return config;
}

export function siegeCastleCell(config, color) {
  if (!SIEGE_COLORS.includes(color)) return null;
  return {
    row: color === "w" ? config.boardSize - 1 : 0,
    col: config.castle.columns[color],
  };
}

export function isSiegeCell(config, cell) {
  return Number.isInteger(cell?.row)
    && Number.isInteger(cell?.col)
    && cell.row >= 0
    && cell.row < config.boardSize
    && cell.col >= 0
    && cell.col < config.boardSize;
}

export function isSiegeDeploymentCell(config, color, cell) {
  if (!isSiegeCell(config, cell) || !SIEGE_COLORS.includes(color)) return false;
  return color === "w"
    ? cell.row >= config.boardSize - config.deploymentRows
    : cell.row < config.deploymentRows;
}

function sameCell(a, b) {
  return a?.row === b?.row && a?.col === b?.col;
}

function cellKey(cell) {
  return `${cell.row},${cell.col}`;
}

function distance(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function normalizeSeed(seed) {
  const numeric = Number(seed);
  const value = Number.isFinite(numeric) ? numeric >>> 0 : 1;
  return value || 0x6d2b79f5;
}

export function nextSiegeRandom(state) {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x100000000;
}

function randomIndex(state, length) {
  return length > 0 ? Math.floor(nextSiegeRandom(state) * length) : -1;
}

function createPlayer(config) {
  return { points: config.resource.start };
}

export function createSiegeState({ config: configOverrides = {}, seed = 1, spawnObjects = true } = {}) {
  const config = createSiegeConfig(configOverrides);
  const state = {
    version: 1,
    config,
    rngState: normalizeSeed(seed),
    timeMs: 0,
    tick: 0,
    status: "running",
    winner: null,
    resultReason: null,
    nextUnitId: 1,
    nextBuffId: 1,
    players: { w: createPlayer(config), b: createPlayer(config) },
    castles: {},
    units: [],
    buffs: [],
    chest: null,
    chestRespawnAtMs: null,
    portals: [],
    portalGeneration: 0,
    portalRespawnAtMs: null,
    lastEvents: [],
  };
  for (const color of SIEGE_COLORS) {
    const cell = siegeCastleCell(config, color);
    state.castles[color] = { color, row: cell.row, col: cell.col, hp: config.castle.hp, maxHp: config.castle.hp };
  }
  if (spawnObjects && config.chest.initial) spawnSiegeChest(state);
  if (spawnObjects && config.portal.initial) regenerateSiegePortals(state);
  return state;
}

export function cloneSiegeState(state) {
  return structuredClone(state);
}

export function siegeUnitById(state, unitId) {
  return state.units.find((unit) => unit.id === unitId) || null;
}

export function siegeUnitAt(state, row, col, excludedId = null) {
  return state.units.find((unit) => unit.id !== excludedId && unit.row === row && unit.col === col) || null;
}

export function siegeEffectiveResourceRate(state, color) {
  if (!state?.players?.[color]) return 0;
  return state.config.resource.ratePerSecond + siegeDefenseSupplyRate(state, color) + state.buffs
    .filter((buff) => buff.color === color && buff.type === "incomeAdd")
    .reduce((total, buff) => total + buff.value, 0);
}

export function siegeDefenseSupplyRate(state, color) {
  if (!state?.castles?.[color]) return 0;
  const enemyColor = color === "w" ? "b" : "w";
  const ownCastle = state.castles[color];
  const enemyCastle = state.castles[enemyColor];
  const rule = state.config.resource.defenseSupply;
  const hpGapRatio = (enemyCastle.hp - ownCastle.hp) / ownCastle.maxHp;
  if (hpGapRatio < rule.thresholdRatio || rule.stepRatio <= 0) return 0;
  const steps = Math.floor((hpGapRatio - rule.thresholdRatio) / rule.stepRatio) + 1;
  return Math.min(rule.maxBonus, steps * rule.perStep);
}

export function siegeAvailableSpawnCells(state, color) {
  if (!SIEGE_COLORS.includes(color)) return [];
  const cells = [];
  for (let row = 0; row < state.config.boardSize; row += 1) {
    for (let col = 0; col < state.config.boardSize; col += 1) {
      const cell = { row, col };
      if (!isSiegeDeploymentCell(state.config, color, cell)) continue;
      if (SIEGE_COLORS.some((side) => sameCell(cell, state.castles[side]))) continue;
      if (siegeUnitAt(state, row, col)) continue;
      if (sameCell(cell, state.chest)) continue;
      if (state.portals.some((portal) => sameCell(cell, portal))) continue;
      cells.push(cell);
    }
  }
  return cells;
}

function unitCountByType(state, color, type) {
  return state.units.filter((unit) => unit.color === color && unit.type === type && unit.hp > 0).length;
}

function deploymentPressure(state, color, col) {
  const enemyColor = color === "w" ? "b" : "w";
  const enemyCastle = state.castles[color];
  return state.units.filter((unit) => (
    unit.color === enemyColor
    && unit.hp > 0
    && unit.col === col
    && distance(unit, enemyCastle) <= 4
  )).length;
}

function siegeAINoise(state, color, type, cell) {
  let value = (state.rngState ^ state.tick ^ (color === "w" ? 0x9e3779b9 : 0x85ebca6b)) >>> 0;
  const text = `${type}:${cell.row}:${cell.col}`;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 0x45d9f3b) >>> 0;
  }
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function chooseSiegeAIAction(state, color, difficulty = "normal") {
  if (!state || state.status !== "running" || !SIEGE_COLORS.includes(color)) return null;
  const profile = SIEGE_AI_DIFFICULTIES[difficulty] || SIEGE_AI_DIFFICULTIES.normal;
  const available = siegeAvailableSpawnCells(state, color);
  if (!available.length) return null;
  const points = state.players[color].points;
  const affordable = SIEGE_UNIT_TYPES.filter((type) => state.config.units[type].cost <= points - profile.reserve);
  if (!affordable.length) return null;

  const ownCastle = state.castles[color];
  const enemyColor = color === "w" ? "b" : "w";
  const threatDistance = difficulty === "hard" ? 6 : difficulty === "normal" ? 5 : 4;
  const threats = state.units.filter((unit) => (
    unit.color === enemyColor && unit.hp > 0 && distance(unit, ownCastle) <= threatDistance
  ));
  const counts = Object.fromEntries(SIEGE_UNIT_TYPES.map((type) => [type, unitCountByType(state, color, type)]));
  const desired = [];
  if (counts.king === 0) desired.push("king");
  if (threats.length >= 2) desired.push("rook", "queen", "bishop");
  if (counts.pawn < Math.max(2, Math.ceil(state.units.filter((unit) => unit.color === color).length * 0.3))) desired.push("pawn");
  if (counts.knight < 2) desired.push("knight");
  if (counts.bishop < 2) desired.push("bishop");
  if (difficulty !== "easy") desired.push("queen", "rook");
  desired.push(...profile.pool);

  const type = desired.find((candidate) => affordable.includes(candidate)) || affordable[0];
  const targetColumn = threats.length
    ? threats.sort((a, b) => distance(a, ownCastle) - distance(b, ownCastle))[0].col
    : state.castles[enemyColor].col;
  const backRow = color === "w" ? state.config.boardSize - 1 : 0;
  const frontRow = color === "w" ? state.config.boardSize - state.config.deploymentRows : state.config.deploymentRows - 1;
  const support = type === "king" || type === "bishop" || type === "rook";
  const preferredRow = support ? backRow : frontRow;
  const ranked = available.map((cell) => {
    let score = 0;
    score -= Math.abs(cell.col - targetColumn) * 8;
    score -= Math.abs(cell.row - preferredRow) * 5;
    score += deploymentPressure(state, color, cell.col) * (difficulty === "hard" ? 14 : 8);
    if (type === "king") {
      score += state.units.filter((unit) => unit.color === color && distance(unit, cell) <= 2).length * 7;
    }
    if (cell.col === ownCastle.col) score += threats.length ? 10 : 2;
    score += siegeAINoise(state, color, type, cell) * (difficulty === "easy" ? 24 : difficulty === "normal" ? 10 : 3);
    return { cell, score };
  }).sort((a, b) => b.score - a.score || a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  return { type, cell: ranked[0].cell, intervalMs: profile.intervalMs };
}

export function validateSiegeSummon(state, color, type, cell, { free = false } = {}) {
  if (!state || state.status !== "running") return { valid: false, reason: "gameOver" };
  if (!SIEGE_COLORS.includes(color)) return { valid: false, reason: "unknownColor" };
  const stats = state.config.units[type];
  if (!stats || !SIEGE_UNIT_TYPES.includes(type)) return { valid: false, reason: "unknownUnit" };
  if (!isSiegeCell(state.config, cell)) return { valid: false, reason: "outsideBoard" };
  if (!isSiegeDeploymentCell(state.config, color, cell)) return { valid: false, reason: "outsideDeployment" };
  if (SIEGE_COLORS.some((side) => sameCell(cell, state.castles[side]))) return { valid: false, reason: "castleOccupied" };
  if (siegeUnitAt(state, cell.row, cell.col)) return { valid: false, reason: "unitOccupied" };
  if (sameCell(cell, state.chest) || state.portals.some((portal) => sameCell(cell, portal))) {
    return { valid: false, reason: "objectOccupied" };
  }
  if (!free && state.players[color].points < stats.cost) return { valid: false, reason: "insufficientPoints" };
  return { valid: true, cost: free ? 0 : stats.cost };
}

function appendEvent(state, event, target = state.lastEvents) {
  const normalized = { tick: state.tick, timeMs: state.timeMs, ...event };
  target.push(normalized);
  return normalized;
}

export function summonSiegeUnit(state, color, type, cell, options = {}) {
  const validation = validateSiegeSummon(state, color, type, cell, options);
  if (!validation.valid) return validation;
  const stats = state.config.units[type];
  if (!options.free) state.players[color].points -= stats.cost;
  const unit = {
    id: `${color}-${type}-${state.nextUnitId++}`,
    color,
    type,
    row: cell.row,
    col: cell.col,
    hp: stats.hp,
    maxHp: stats.hp,
    attackCooldownMs: 0,
    moveProgress: 0,
    attacksMade: 0,
    targetId: null,
    lastAttackerId: null,
    previousCell: null,
  };
  state.units.push(unit);
  const event = appendEvent(state, { type: "unitSummoned", unitId: unit.id, color, unitType: type, row: cell.row, col: cell.col, cost: validation.cost });
  return { valid: true, unit, cost: validation.cost, event };
}

function activeBuffs(state, color, type, unitId = null) {
  return state.buffs.filter((buff) => (
    buff.color === color
    && buff.type === type
    && (buff.unitId === undefined || buff.unitId === null || buff.unitId === unitId)
  ));
}

function unitHasKingAura(state, unit) {
  if (unit.type === "king") return false;
  return state.units.some((ally) => (
    ally.color === unit.color
    && ally.type === "king"
    && ally.hp > 0
    && distance(ally, unit) <= state.config.units.king.auraRadius
  ));
}

export function siegeEffectiveUnitStats(state, unit) {
  const base = state.config.units[unit.type];
  const product = (type) => activeBuffs(state, unit.color, type, unit.id)
    .reduce((value, buff) => value * buff.multiplier, 1);
  const auraAttack = unitHasKingAura(state, unit) ? state.config.units.king.auraAttackMultiplier : 1;
  return {
    ...base,
    attack: base.attack * product("attackMultiplier") * auraAttack,
    moveSpeed: base.moveSpeed * product("moveMultiplier"),
    attackIntervalMs: base.attackIntervalMs / product("attackSpeedMultiplier"),
  };
}

function blockedObjectCells(state) {
  return new Set(SIEGE_COLORS.map((color) => cellKey(state.castles[color])));
}

function forwardDirection(color) {
  return color === "w" ? -1 : 1;
}

function movementCandidates(state, unit, occupied) {
  const direction = forwardDirection(unit.color);
  const enemyColor = unit.color === "w" ? "b" : "w";
  const enemyCastle = state.castles[enemyColor];
  const towardCastle = Math.sign(enemyCastle.col - unit.col);
  if (unit.row === enemyCastle.row) {
    const candidates = [];
    if (towardCastle !== 0) candidates.push({ row: unit.row, col: unit.col + towardCastle });
    return candidates;
  }
  const front = { row: unit.row + direction, col: unit.col };
  const candidates = [front];
  const fallbackSide = towardCastle === 0
    ? (((unit.id.length + state.tick) % 2) === 0 ? -1 : 1)
    : -towardCastle;
  const sideOffsets = towardCastle === 0 ? [fallbackSide, -fallbackSide] : [towardCastle, fallbackSide];
  for (const offset of sideOffsets) candidates.push({ row: unit.row + direction, col: unit.col + offset });
  for (const offset of sideOffsets) candidates.push({ row: unit.row, col: unit.col + offset });
  if (state.config.units[unit.type].leapBlocked && occupied.has(cellKey(front))) {
    candidates.push({ row: unit.row + direction * 2, col: unit.col });
  }
  return candidates;
}

function chooseMovement(state, unit, occupied, reserved) {
  const blocked = blockedObjectCells(state);
  const enemyColor = unit.color === "w" ? "b" : "w";
  const enemyCastle = state.castles[enemyColor];
  const direction = forwardDirection(unit.color);
  const candidates = movementCandidates(state, unit, occupied).filter((cell) => {
    const key = cellKey(cell);
    return isSiegeCell(state.config, cell)
      && !blocked.has(key)
      && !occupied.has(key)
      && !reserved.has(key);
  });
  const score = (cell) => {
    const friendlyAhead = state.units.filter((other) => (
      other.id !== unit.id
      && other.color === unit.color
      && other.col === cell.col
      && (other.row - cell.row) * direction > 0
      && Math.abs(other.row - cell.row) <= 3
    )).length;
    const backtrack = sameCell(cell, unit.previousCell) ? 1 : 0;
    const lateral = cell.row === unit.row ? 1 : 0;
    const straightAdvance = cell.col === unit.col && cell.row !== unit.row ? 1 : 0;
    return -distance(cell, enemyCastle) * 20
      - friendlyAhead * 10
      - backtrack * 60
      - lateral * 4
      + straightAdvance * 30
      - Math.abs(cell.col - enemyCastle.col) * 2;
  };
  return candidates.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col)[0] || null;
}

function chooseCombatTarget(state, unit, stats) {
  const enemies = state.units.filter((candidate) => candidate.color !== unit.color && candidate.hp > 0);
  const inRange = enemies.filter((enemy) => distance(unit, enemy) <= stats.range);
  const retaliate = inRange.find((enemy) => enemy.id === unit.lastAttackerId);
  if (retaliate) return retaliate;
  const current = inRange.find((enemy) => enemy.id === unit.targetId);
  if (current) return current;
  inRange.sort((a, b) => distance(unit, a) - distance(unit, b) || a.hp - b.hp || a.id.localeCompare(b.id));
  return inRange[0] || null;
}

function canAttackCastle(state, unit, stats) {
  const enemyColor = unit.color === "w" ? "b" : "w";
  return distance(unit, state.castles[enemyColor]) <= stats.range;
}

function moveUnits(state, events, deltaMs) {
  const occupied = new Set(state.units.map(cellKey));
  const reserved = new Set();
  const sorted = [...state.units].sort((a, b) => a.id.localeCompare(b.id));
  for (const unit of sorted) {
    const stats = siegeEffectiveUnitStats(state, unit);
    if (chooseCombatTarget(state, unit, stats) || canAttackCastle(state, unit, stats)) continue;
    unit.moveProgress += stats.moveSpeed * deltaMs / 1000;
    let steps = Math.min(2, Math.floor(unit.moveProgress));
    while (steps > 0) {
      occupied.delete(cellKey(unit));
      const destination = chooseMovement(state, unit, occupied, reserved);
      if (!destination) {
        occupied.add(cellKey(unit));
        unit.moveProgress = Math.min(unit.moveProgress, 0.99);
        break;
      }
      const from = { row: unit.row, col: unit.col };
      unit.previousCell = from;
      unit.row = destination.row;
      unit.col = destination.col;
      unit.moveProgress -= 1;
      occupied.add(cellKey(unit));
      reserved.add(cellKey(unit));
      appendEvent(state, { type: "unitMoved", unitId: unit.id, from, to: { ...destination } }, events);
      resolvePortalForUnit(state, unit, events, occupied);
      resolveChestForUnit(state, unit, events);
      steps -= 1;
    }
  }
}

function attackDamage(state, unit, targetKind) {
  const stats = siegeEffectiveUnitStats(state, unit);
  let damage = stats.attack;
  let special = null;
  if (unit.type === "knight" && (unit.attacksMade + 1) % stats.chargeEvery === 0) {
    damage *= stats.chargeMultiplier;
    special = "charge";
  }
  if (unit.type === "rook" && targetKind === "castle") {
    damage *= stats.siegeMultiplier;
    special = "siege";
  }
  return { damage, special, stats };
}

function collectAttackIntents(state) {
  const intents = [];
  for (const unit of [...state.units].sort((a, b) => a.id.localeCompare(b.id))) {
    if (unit.attackCooldownMs > 0) continue;
    const effective = siegeEffectiveUnitStats(state, unit);
    const target = chooseCombatTarget(state, unit, effective);
    if (target) {
      const attack = attackDamage(state, unit, "unit");
      intents.push({ attacker: unit, targetKind: "unit", targetId: target.id, ...attack });
      unit.targetId = target.id;
      unit.attacksMade += 1;
      unit.attackCooldownMs = attack.stats.attackIntervalMs;
      continue;
    }
    if (canAttackCastle(state, unit, effective)) {
      const targetColor = unit.color === "w" ? "b" : "w";
      const attack = attackDamage(state, unit, "castle");
      intents.push({ attacker: unit, targetKind: "castle", targetColor, ...attack });
      unit.targetId = null;
      unit.attacksMade += 1;
      unit.attackCooldownMs = attack.stats.attackIntervalMs;
    } else {
      unit.targetId = null;
    }
  }
  return intents;
}

function secondaryTargets(state, intent, primary) {
  if (intent.attacker.type === "queen") {
    return state.units.filter((unit) => (
      unit.id !== primary.id && unit.color === primary.color && distance(unit, primary) === 1
    )).map((unit) => ({ unit, damage: intent.damage * intent.stats.splashMultiplier, special: "splash" }));
  }
  if (intent.attacker.type === "bishop") {
    const rowDirection = Math.sign(primary.row - intent.attacker.row);
    const colDirection = Math.sign(primary.col - intent.attacker.col);
    const behind = state.units.find((unit) => (
      unit.color === primary.color
      && unit.id !== primary.id
      && unit.row === primary.row + rowDirection
      && unit.col === primary.col + colDirection
    ));
    return behind ? [{ unit: behind, damage: intent.damage * intent.stats.piercingMultiplier, special: "pierce" }] : [];
  }
  return [];
}

function resolveAttacks(state, intents, events) {
  const unitDamage = new Map();
  const castleDamage = new Map();
  const sources = new Map();
  const addUnitDamage = (target, amount, attackerId) => {
    unitDamage.set(target.id, (unitDamage.get(target.id) || 0) + amount);
    sources.set(target.id, attackerId);
  };
  for (const intent of intents) {
    if (intent.targetKind === "castle") {
      castleDamage.set(intent.targetColor, (castleDamage.get(intent.targetColor) || 0) + intent.damage);
      appendEvent(state, {
        type: "unitAttacked",
        attackerId: intent.attacker.id,
        attackerType: intent.attacker.type,
        attackerColor: intent.attacker.color,
        attackerCell: { row: intent.attacker.row, col: intent.attacker.col },
        targetKind: "castle",
        targetColor: intent.targetColor,
        targetCell: { row: state.castles[intent.targetColor].row, col: state.castles[intent.targetColor].col },
        damage: intent.damage,
        special: intent.special,
        effectRole: "primary",
      }, events);
      continue;
    }
    const target = siegeUnitById(state, intent.targetId);
    if (!target || target.hp <= 0) continue;
    addUnitDamage(target, intent.damage, intent.attacker.id);
    appendEvent(state, {
      type: "unitAttacked",
      attackerId: intent.attacker.id,
      attackerType: intent.attacker.type,
      attackerColor: intent.attacker.color,
      attackerCell: { row: intent.attacker.row, col: intent.attacker.col },
      targetKind: "unit",
      targetId: target.id,
      targetCell: { row: target.row, col: target.col },
      damage: intent.damage,
      special: intent.special,
      effectRole: "primary",
    }, events);
    for (const secondary of secondaryTargets(state, intent, target)) {
      addUnitDamage(secondary.unit, secondary.damage, intent.attacker.id);
      appendEvent(state, {
        type: "unitAttacked",
        attackerId: intent.attacker.id,
        attackerType: intent.attacker.type,
        attackerColor: intent.attacker.color,
        attackerCell: { row: intent.attacker.row, col: intent.attacker.col },
        targetKind: "unit",
        targetId: secondary.unit.id,
        targetCell: { row: secondary.unit.row, col: secondary.unit.col },
        damage: secondary.damage,
        special: secondary.special,
        effectRole: "secondary",
      }, events);
    }
  }
  for (const [unitId, amount] of unitDamage) {
    const unit = siegeUnitById(state, unitId);
    if (!unit) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    unit.lastAttackerId = sources.get(unitId) || null;
  }
  const dead = state.units.filter((unit) => unit.hp <= 0);
  if (dead.length) {
    const unitsById = new Map(state.units.map((unit) => [unit.id, unit]));
    const deadIds = new Set(dead.map((unit) => unit.id));
    state.units = state.units.filter((unit) => !deadIds.has(unit.id));
    for (const unit of dead) {
      const killer = unitsById.get(unit.lastAttackerId);
      let reward = 0;
      if (killer && killer.color !== unit.color) {
        const rewardValue = Math.max(5, Math.round(
          state.config.units[unit.type].cost * state.config.resource.killRewardRate / 5,
        ) * 5);
        const before = state.players[killer.color].points;
        state.players[killer.color].points = Math.min(state.config.resource.max, before + rewardValue);
        reward = state.players[killer.color].points - before;
      }
      appendEvent(state, {
        type: "unitDied",
        unitId: unit.id,
        color: unit.color,
        unitType: unit.type,
        row: unit.row,
        col: unit.col,
        killerId: killer?.id || null,
        killerColor: killer?.color || null,
        reward,
      }, events);
    }
    for (const unit of state.units) {
      if (deadIds.has(unit.targetId)) unit.targetId = null;
      if (deadIds.has(unit.lastAttackerId)) unit.lastAttackerId = null;
    }
  }
  for (const [color, amount] of castleDamage) {
    const castle = state.castles[color];
    castle.hp = Math.max(0, castle.hp - amount);
    appendEvent(state, { type: "castleDamaged", color, damage: amount, hp: castle.hp }, events);
  }
}

function finishSiegeMatch(state, winner, reason, events) {
  if (state.status !== "running") return;
  state.status = "finished";
  state.winner = winner;
  state.resultReason = reason;
  appendEvent(state, { type: "matchEnded", winner, reason }, events);
}

function checkSiegeResult(state, events) {
  const destroyed = SIEGE_COLORS.filter((color) => state.castles[color].hp <= 0);
  if (destroyed.length) {
    const winner = destroyed.length === 2 ? "draw" : destroyed[0] === "w" ? "b" : "w";
    finishSiegeMatch(state, winner, "castleDestroyed", events);
    return;
  }
  if (state.timeMs < state.config.matchDurationMs) return;
  const whiteHp = state.castles.w.hp;
  const blackHp = state.castles.b.hp;
  const winner = whiteHp === blackHp ? "draw" : whiteHp > blackHp ? "w" : "b";
  finishSiegeMatch(state, winner, "timeout", events);
}

function objectSpawnCandidates(state, { portals = false } = {}) {
  const blocked = new Set(state.units.map(cellKey));
  for (const color of SIEGE_COLORS) blocked.add(cellKey(state.castles[color]));
  if (state.chest) blocked.add(cellKey(state.chest));
  for (const portal of state.portals) blocked.add(cellKey(portal));
  const candidates = [];
  for (let row = 0; row < state.config.boardSize; row += 1) {
    for (let col = 0; col < state.config.boardSize; col += 1) {
      const cell = { row, col };
      if (blocked.has(cellKey(cell))) continue;
      if (!portals && (row === 0 || row === state.config.boardSize - 1)) continue;
      if (portals && SIEGE_COLORS.some((color) => (
        distance(cell, state.castles[color]) <= state.config.portal.castleExclusionDistance
      ))) continue;
      candidates.push(cell);
    }
  }
  return candidates;
}

export function spawnSiegeChest(state) {
  if (!state || state.status !== "running") return null;
  const candidates = objectSpawnCandidates(state);
  if (!candidates.length) return null;
  const cell = candidates[randomIndex(state, candidates.length)];
  state.chest = { ...cell };
  state.chestRespawnAtMs = null;
  appendEvent(state, { type: "chestSpawned", cell: { ...cell } });
  return { ...cell };
}

export function regenerateSiegePortals(state) {
  if (!state || state.status !== "running") return [];
  state.portals = [];
  const candidates = objectSpawnCandidates(state, { portals: true });
  if (candidates.length < 2) return [];
  const first = candidates.splice(randomIndex(state, candidates.length), 1)[0];
  const distant = candidates.filter((cell) => distance(first, cell) >= state.config.portal.minDistance);
  const pool = distant.length ? distant : candidates;
  const second = pool[randomIndex(state, pool.length)];
  state.portals = [{ ...first }, { ...second }];
  state.portalGeneration += 1;
  state.portalRespawnAtMs = null;
  appendEvent(state, { type: "portalsSpawned", generation: state.portalGeneration, cells: structuredClone(state.portals) });
  return structuredClone(state.portals);
}

function addBuff(state, buff, events) {
  const entry = {
    id: `buff-${state.nextBuffId++}`,
    startedAtMs: state.timeMs,
    expiresAtMs: state.timeMs + state.config.chest.buffDurationMs,
    ...buff,
  };
  state.buffs.push(entry);
  appendEvent(state, { type: "buffApplied", buff: { ...entry } }, events);
  return entry;
}

function nearestFriendlyUnit(state, color, cell) {
  return state.units
    .filter((unit) => unit.color === color)
    .sort((a, b) => distance(a, cell) - distance(b, cell) || a.id.localeCompare(b.id))[0] || null;
}

export function applySiegeChestEffect(state, color, effectId, { collectorUnitId = null, events = state.lastEvents } = {}) {
  if (!state?.players?.[color] || !state.config.chest.effects.includes(effectId)) {
    return { valid: false, reason: "unknownEffect" };
  }
  const collector = collectorUnitId ? siegeUnitById(state, collectorUnitId) : null;
  let detail = null;
  if (effectId === "points50" || effectId === "points100") {
    const amount = effectId === "points50" ? 50 : 100;
    const before = state.players[color].points;
    state.players[color].points = Math.min(state.config.resource.max, before + amount);
    detail = { amount: state.players[color].points - before };
  } else if (effectId === "income1" || effectId === "income2") {
    detail = addBuff(state, { color, type: "incomeAdd", value: effectId === "income1" ? 1 : 2 }, events);
  } else if (effectId === "attack") {
    detail = addBuff(state, { color, type: "attackMultiplier", multiplier: state.config.buffs.attackMultiplier }, events);
  } else if (effectId === "move") {
    detail = addBuff(state, { color, type: "moveMultiplier", multiplier: state.config.buffs.moveMultiplier }, events);
  } else if (effectId === "attackSpeed") {
    detail = addBuff(state, { color, type: "attackSpeedMultiplier", multiplier: state.config.buffs.attackSpeedMultiplier }, events);
  } else if (effectId === "heal") {
    const center = collector || state.castles[color];
    const healed = [];
    for (const unit of state.units) {
      if (unit.color !== color || distance(unit, center) > state.config.chest.healRadius) continue;
      const amount = Math.min(state.config.chest.healAmount, unit.maxHp - unit.hp);
      if (amount <= 0) continue;
      unit.hp += amount;
      healed.push({ unitId: unit.id, amount });
    }
    detail = { healed };
  } else if (effectId === "freePawn") {
    const cells = siegeAvailableSpawnCells(state, color);
    const cell = cells.length ? cells[randomIndex(state, cells.length)] : null;
    detail = cell ? summonSiegeUnit(state, color, "pawn", cell, { free: true }) : { valid: false, reason: "noSpawnCell" };
  } else if (effectId === "nearestBoost") {
    const target = nearestFriendlyUnit(state, color, collector || state.castles[color]);
    detail = target
      ? addBuff(state, { color, unitId: target.id, type: "attackMultiplier", multiplier: 1.3 }, events)
      : null;
  } else if (effectId === "portalReset") {
    detail = { cells: regenerateSiegePortals(state) };
  }
  appendEvent(state, { type: "chestEffectApplied", color, effectId, collectorUnitId, detail }, events);
  return { valid: true, effectId, detail };
}

function resolveChestForUnit(state, unit, events) {
  if (!state.chest || !sameCell(state.chest, unit)) return false;
  const cell = { ...state.chest };
  state.chest = null;
  state.chestRespawnAtMs = state.timeMs + state.config.chest.respawnMs;
  const effects = state.config.chest.effects;
  const effectId = effects[randomIndex(state, effects.length)];
  appendEvent(state, { type: "chestCollected", unitId: unit.id, color: unit.color, cell, effectId }, events);
  applySiegeChestEffect(state, unit.color, effectId, { collectorUnitId: unit.id, events });
  return true;
}

function resolvePortalForUnit(state, unit, events, occupied) {
  const entranceIndex = state.portals.findIndex((portal) => sameCell(portal, unit));
  if (entranceIndex < 0) return false;
  const entrance = state.portals[entranceIndex];
  const exit = state.portals[entranceIndex === 0 ? 1 : 0];
  if (!exit || siegeUnitAt(state, exit.row, exit.col, unit.id)) return false;
  occupied.delete(cellKey(unit));
  unit.row = exit.row;
  unit.col = exit.col;
  occupied.add(cellKey(unit));
  state.portals = [];
  state.portalRespawnAtMs = state.timeMs + state.config.portal.respawnMs;
  appendEvent(state, { type: "unitTeleported", unitId: unit.id, from: { ...entrance }, to: { ...exit } }, events);
  appendEvent(state, { type: "portalsConsumed", generation: state.portalGeneration }, events);
  resolveChestForUnit(state, unit, events);
  return true;
}

function expireBuffs(state, events) {
  const expired = state.buffs.filter((buff) => buff.expiresAtMs <= state.timeMs);
  if (!expired.length) return;
  const expiredIds = new Set(expired.map((buff) => buff.id));
  state.buffs = state.buffs.filter((buff) => !expiredIds.has(buff.id));
  for (const buff of expired) appendEvent(state, { type: "buffExpired", buffId: buff.id, color: buff.color, buffType: buff.type }, events);
}

function updateTimedSpawns(state) {
  if (!state.chest && state.chestRespawnAtMs !== null && state.timeMs >= state.chestRespawnAtMs) spawnSiegeChest(state);
  if (!state.portals.length && state.portalRespawnAtMs !== null && state.timeMs >= state.portalRespawnAtMs) regenerateSiegePortals(state);
}

function advanceOneSiegeTick(state, events) {
  if (state.status !== "running") return;
  const deltaMs = state.config.tickMs;
  state.timeMs += deltaMs;
  state.tick += 1;
  expireBuffs(state, events);
  for (const color of SIEGE_COLORS) {
    const next = state.players[color].points + siegeEffectiveResourceRate(state, color) * deltaMs / 1000;
    state.players[color].points = Math.min(state.config.resource.max, Math.round(next * 1000) / 1000);
  }
  updateTimedSpawns(state);
  for (const unit of state.units) unit.attackCooldownMs = Math.max(0, unit.attackCooldownMs - deltaMs);
  moveUnits(state, events, deltaMs);
  const intents = collectAttackIntents(state);
  resolveAttacks(state, intents, events);
  checkSiegeResult(state, events);
}

export function tickSiege(state, tickCount = 1) {
  if (!state) throw new TypeError("A siege state is required.");
  if (!Number.isInteger(tickCount) || tickCount < 0) throw new RangeError("tickCount must be a non-negative integer.");
  const events = [];
  state.lastEvents = events;
  for (let index = 0; index < tickCount && state.status === "running"; index += 1) {
    advanceOneSiegeTick(state, events);
  }
  return { state, events };
}
