import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SIEGE_CONFIG,
  SIEGE_AI_DIFFICULTIES,
  SIEGE_UNIT_TYPES,
  applySiegeChestEffect,
  chooseSiegeAIAction,
  cloneSiegeState,
  createSiegeState,
  isSiegeDeploymentCell,
  regenerateSiegePortals,
  siegeAvailableSpawnCells,
  siegeDefenseSupplyRate,
  siegeEffectiveResourceRate,
  siegeEffectiveUnitStats,
  siegeUnitById,
  summonSiegeUnit,
  tickSiege,
  validateSiegeSummon,
} from "../src/siegeLogic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pieceSelectAI = fs.readFileSync(path.join(root, "src/scenes/PieceSelectAI.js"), "utf8");
const siegeScene = fs.readFileSync(path.join(root, "src/scenes/KingdomSiege.js"), "utf8");

assert.doesNotMatch(pieceSelectAI, /targetScene !== "KingdomSiege"/, "Siege difficulty cards show the shared AI win rewards");
assert.doesNotMatch(siegeScene, /reward:\s*\{\s*awarded:\s*false/, "Siege AI wins use the shared once-only coin reward");

const createTestState = (overrides = {}, options = {}) => createSiegeState({
  seed: options.seed ?? 42,
  spawnObjects: options.spawnObjects ?? false,
  config: {
    tickMs: 100,
    matchDurationMs: 180000,
    ...overrides,
  },
});

assert.deepEqual(Object.keys(DEFAULT_SIEGE_CONFIG.units), SIEGE_UNIT_TYPES);
for (const type of SIEGE_UNIT_TYPES) {
  const unit = DEFAULT_SIEGE_CONFIG.units[type];
  assert.equal(unit.cost > 0, true, `${type} has a data-driven price`);
  assert.equal(unit.hp > 0, true, `${type} has data-driven HP`);
  assert.equal(unit.attack > 0, true, `${type} has data-driven damage`);
  assert.equal(unit.moveSpeed > 0, true, `${type} has data-driven movement`);
  assert.equal(unit.attackIntervalMs > 0, true, `${type} has a data-driven attack interval`);
  assert.equal(unit.range > 0, true, `${type} has data-driven range`);
}

const deterministicA = createSiegeState({ seed: 9876 });
const deterministicB = createSiegeState({ seed: 9876 });
assert.deepEqual(deterministicA.chest, deterministicB.chest, "A seed reproduces the chest position");
assert.deepEqual(deterministicA.portals, deterministicB.portals, "A seed reproduces the portal pair");
assert.deepEqual(tickSiege(deterministicA, 25), tickSiege(deterministicB, 25), "Seeded tick evolution is deterministic");

const resources = createTestState();
tickSiege(resources, 10);
assert.equal(resources.players.w.points, 808);
assert.equal(resources.players.b.points, 808, "Both players gain resources independently and equally");
resources.players.w.points = 1999.5;
tickSiege(resources, 10);
assert.equal(resources.players.w.points, 2000, "Resources respect the configured cap");

const defenseSupply = createTestState();
defenseSupply.castles.w.hp = 1700;
assert.equal(siegeDefenseSupplyRate(defenseSupply, "w"), 2, "A 15% castle HP deficit starts defense supply");
defenseSupply.castles.w.hp = 1400;
assert.equal(siegeDefenseSupplyRate(defenseSupply, "w"), 4, "Defense supply scales with a larger HP deficit");
defenseSupply.castles.w.hp = 800;
assert.equal(siegeDefenseSupplyRate(defenseSupply, "w"), 6, "Defense supply is capped");
assert.equal(siegeDefenseSupplyRate(defenseSupply, "b"), 0, "The leading side receives no defense supply");

assert.equal(
  SIEGE_AI_DIFFICULTIES.hard.intervalMs < SIEGE_AI_DIFFICULTIES.normal.intervalMs
    && SIEGE_AI_DIFFICULTIES.normal.intervalMs < SIEGE_AI_DIFFICULTIES.easy.intervalMs,
  true,
  "Higher AI difficulties summon more frequently",
);

for (const difficulty of Object.keys(SIEGE_AI_DIFFICULTIES)) {
  const aiState = createTestState({}, { seed: 20260814 });
  const rngBefore = aiState.rngState;
  const firstAction = chooseSiegeAIAction(aiState, "b", difficulty);
  const secondAction = chooseSiegeAIAction(aiState, "b", difficulty);
  assert.deepEqual(firstAction, secondAction, `${difficulty} AI decisions are deterministic for one state`);
  assert.equal(aiState.rngState, rngBefore, `${difficulty} AI does not consume gameplay RNG`);
  assert.equal(validateSiegeSummon(aiState, "b", firstAction.type, firstAction.cell).valid, true);
}

const poorAI = createTestState();
poorAI.players.b.points = 0;
assert.equal(chooseSiegeAIAction(poorAI, "b", "hard"), null, "AI waits when it cannot afford a unit");

const pressuredAI = createTestState({ resource: { start: 2000, max: 2000 } });
const invader = summonSiegeUnit(pressuredAI, "w", "queen", { row: 5, col: 7 }).unit;
invader.row = 2;
const defense = chooseSiegeAIAction(pressuredAI, "b", "hard");
assert.equal(defense.cell.col, 7, "Hard AI reinforces the column threatening its castle");

const fullZoneAI = createTestState({ resource: { start: 100000, max: 100000 } });
for (const cell of [...siegeAvailableSpawnCells(fullZoneAI, "b")]) {
  assert.equal(summonSiegeUnit(fullZoneAI, "b", "pawn", cell).valid, true);
}
assert.equal(chooseSiegeAIAction(fullZoneAI, "b", "normal"), null, "AI waits when its deployment zone is full");

const placement = createTestState();
assert.equal(isSiegeDeploymentCell(placement.config, "w", { row: 5, col: 0 }), true);
assert.equal(isSiegeDeploymentCell(placement.config, "w", { row: 4, col: 0 }), false);
assert.equal(isSiegeDeploymentCell(placement.config, "b", { row: 2, col: 0 }), true);
assert.equal(isSiegeDeploymentCell(placement.config, "b", { row: 3, col: 0 }), false);
assert.equal(validateSiegeSummon(placement, "w", "pawn", { row: 4, col: 0 }).reason, "outsideDeployment");
assert.equal(validateSiegeSummon(placement, "w", "pawn", { row: 7, col: 3 }).reason, "castleOccupied");
placement.players.w.points = 0;
assert.equal(validateSiegeSummon(placement, "w", "queen", { row: 7, col: 0 }).reason, "insufficientPoints");
placement.players.w.points = 600;
const firstPawn = summonSiegeUnit(placement, "w", "pawn", { row: 7, col: 0 });
assert.equal(firstPawn.valid, true);
assert.equal(firstPawn.cost, 40);
assert.equal(placement.players.w.points, 560);
assert.equal(validateSiegeSummon(placement, "w", "knight", { row: 7, col: 0 }).reason, "unitOccupied");
assert.equal(siegeAvailableSpawnCells(placement, "w").some(({ row, col }) => row === 7 && col === 0), false);

const reroute = createTestState({ units: { pawn: { moveSpeed: 10 } } });
const reroutingPawn = summonSiegeUnit(reroute, "w", "pawn", { row: 5, col: 3 }).unit;
for (const col of [2, 3, 4]) {
  const blocker = summonSiegeUnit(reroute, "w", "pawn", { row: 6, col }).unit;
  blocker.row = 4;
}
tickSiege(reroute, 1);
assert.equal(reroutingPawn.row, 5, "A unit does not push into a blocked friendly line");
assert.notEqual(reroutingPawn.col, 3, "A blocked unit uses an open side lane instead of waiting in line");

const allUnits = createTestState({ resource: { start: 2000, max: 2000 } });
const allUnitCells = [
  { row: 7, col: 0 }, { row: 7, col: 1 }, { row: 7, col: 2 },
  { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 },
];
for (let index = 0; index < SIEGE_UNIT_TYPES.length; index += 1) {
  const result = summonSiegeUnit(allUnits, "w", SIEGE_UNIT_TYPES[index], allUnitCells[index]);
  assert.equal(result.valid, true, `${SIEGE_UNIT_TYPES[index]} can be summoned`);
  assert.equal(result.unit.hp, allUnits.config.units[SIEGE_UNIT_TYPES[index]].hp);
}

const movement = createTestState({
  units: { pawn: { moveSpeed: 10, attack: 1, attackIntervalMs: 1000 } },
});
movement.players.w.points = 100;
const mover = summonSiegeUnit(movement, "w", "pawn", { row: 6, col: 2 }).unit;
tickSiege(movement, 1);
assert.deepEqual({ row: mover.row, col: mover.col }, { row: 5, col: 2 }, "An idle white unit automatically advances toward black");

const knightLeap = createTestState({
  units: { knight: { moveSpeed: 10 }, pawn: { moveSpeed: 0 } },
});
const leapingKnight = summonSiegeUnit(knightLeap, "w", "knight", { row: 6, col: 2 }).unit;
summonSiegeUnit(knightLeap, "w", "pawn", { row: 5, col: 2 });
tickSiege(knightLeap, 1);
assert.deepEqual(
  { row: leapingKnight.row, col: leapingKnight.col },
  { row: 4, col: 2 },
  "Knight leaps two rows only when a piece blocks the forward cell",
);

const knightChest = createTestState({ units: { knight: { moveSpeed: 10 } } });
const collectingKnight = summonSiegeUnit(knightChest, "w", "knight", { row: 6, col: 2 }).unit;
knightChest.chest = { row: 5, col: 2 };
const knightChestEvents = tickSiege(knightChest, 1).events;
assert.deepEqual(
  { row: collectingKnight.row, col: collectingKnight.col },
  { row: 5, col: 2 },
  "Knight enters an item chest cell instead of leaping over it",
);
assert.equal(knightChestEvents.some((event) => event.type === "chestCollected"), true);

const endRankRouting = createTestState({
  units: { pawn: { moveSpeed: 10, attack: 1, attackIntervalMs: 1000 } },
});
endRankRouting.players.w.points = 100;
const routedPawn = summonSiegeUnit(endRankRouting, "w", "pawn", { row: 6, col: 0 }).unit;
routedPawn.row = 0;
tickSiege(endRankRouting, 1);
assert.deepEqual(
  { row: routedPawn.row, col: routedPawn.col },
  { row: 0, col: 1 },
  "A unit on the enemy end rank routes sideways toward the castle instead of stalling",
);

const combat = createTestState({
  units: {
    pawn: { hp: 20, attack: 20, moveSpeed: 0, attackIntervalMs: 100, range: 1 },
  },
});
combat.players.w.points = 100;
combat.players.b.points = 100;
const whiteFighter = summonSiegeUnit(combat, "w", "pawn", { row: 5, col: 2 }).unit;
const blackFighter = summonSiegeUnit(combat, "b", "pawn", { row: 2, col: 2 }).unit;
blackFighter.row = 4;
const combatEvents = tickSiege(combat, 1).events;
assert.equal(siegeUnitById(combat, whiteFighter.id), null);
assert.equal(siegeUnitById(combat, blackFighter.id), null, "Attacks resolve simultaneously without side-order advantage");
assert.equal(combatEvents.filter((event) => event.type === "unitDied").length, 2);
assert.equal(combat.players.w.points, 70.8, "A simultaneous kill grants White one unit reward");
assert.equal(combat.players.b.points, 70.8, "A simultaneous kill grants Black one unit reward");
assert.equal(combatEvents.filter((event) => event.type === "unitDied").every((event) => event.reward === 10), true);
const combatAttackEvents = combatEvents.filter((event) => event.type === "unitAttacked");
assert.equal(combatAttackEvents.every((event) => event.attackerType === "pawn"), true);
assert.deepEqual(new Set(combatAttackEvents.map((event) => event.attackerColor)), new Set(["w", "b"]));
assert.equal(combatAttackEvents.every((event) => event.attackerCell && event.targetCell), true);
assert.equal(combatAttackEvents.every((event) => event.effectRole === "primary"), true);

for (const type of SIEGE_UNIT_TYPES) {
  const effectContract = createTestState({
    resource: { start: 2000, max: 2000 },
    units: {
      [type]: { moveSpeed: 0, attackIntervalMs: 100, range: 3 },
      pawn: { hp: 1000, moveSpeed: 0, attackIntervalMs: 1000 },
    },
  });
  const attacker = summonSiegeUnit(effectContract, "w", type, { row: 5, col: 1 }).unit;
  const effectTarget = summonSiegeUnit(effectContract, "b", "pawn", { row: 2, col: 1 }).unit;
  effectTarget.row = 4;
  const attackEvent = tickSiege(effectContract, 1).events.find((event) => (
    event.type === "unitAttacked" && event.attackerId === attacker.id
  ));
  assert.equal(attackEvent?.attackerType, type, `${type} attacks carry their effect type`);
  assert.equal(attackEvent?.attackerColor, "w", `${type} attacks carry their side color`);
  assert.deepEqual(attackEvent?.attackerCell, { row: 5, col: 1 });
  assert.deepEqual(attackEvent?.targetCell, { row: 4, col: 1 });
  assert.equal(attackEvent?.effectRole, "primary");
}

const ranged = createTestState({ resource: { start: 1000, max: 1000 } });
const bishop = summonSiegeUnit(ranged, "w", "bishop", { row: 5, col: 1 }).unit;
const distantPawn = summonSiegeUnit(ranged, "b", "pawn", { row: 2, col: 1 }).unit;
tickSiege(ranged, 1);
assert.equal(distantPawn.hp < distantPawn.maxHp, true, "Bishop attacks at its configured long range");
assert.equal(bishop.row, 5, "A ranged unit holds position while attacking");

const knightCadence = createTestState({
  resource: { start: 1000, max: 1000 },
  units: {
    knight: { moveSpeed: 0, attack: 1, attackIntervalMs: 100, range: 1, chargeEvery: 3 },
    pawn: { hp: 1000, moveSpeed: 0, attackIntervalMs: 1000 },
  },
});
const cadenceKnight = summonSiegeUnit(knightCadence, "w", "knight", { row: 5, col: 2 }).unit;
const cadenceTarget = summonSiegeUnit(knightCadence, "b", "pawn", { row: 2, col: 2 }).unit;
cadenceTarget.row = 4;
const knightSpecials = [];
for (let index = 0; index < 3; index += 1) {
  knightSpecials.push(tickSiege(knightCadence, 1).events.find((event) => (
    event.type === "unitAttacked" && event.attackerId === cadenceKnight.id
  ))?.special ?? null);
}
assert.deepEqual(knightSpecials, [null, null, "charge"], "Knight charge triggers on every third attack");

const aura = createTestState({ resource: { start: 1000, max: 1000 } });
const auraPawn = summonSiegeUnit(aura, "w", "pawn", { row: 6, col: 1 }).unit;
const baseAttack = siegeEffectiveUnitStats(aura, auraPawn).attack;
summonSiegeUnit(aura, "w", "king", { row: 7, col: 1 });
assert.equal(siegeEffectiveUnitStats(aura, auraPawn).attack > baseAttack, true, "A nearby King applies one support aura");
summonSiegeUnit(aura, "w", "king", { row: 7, col: 2 });
assert.equal(
  siegeEffectiveUnitStats(aura, auraPawn).attack,
  baseAttack * aura.config.units.king.auraAttackMultiplier,
  "King auras do not stack",
);

const castleAttack = createTestState({
  resource: { start: 1000, max: 1000 },
  units: { rook: { moveSpeed: 0, attack: 50, attackIntervalMs: 100, range: 1, siegeMultiplier: 2 } },
});
const rook = summonSiegeUnit(castleAttack, "w", "rook", { row: 5, col: 3 }).unit;
rook.row = 1;
const hpBefore = castleAttack.castles.b.hp;
const castleEvents = tickSiege(castleAttack, 1).events;
assert.equal(castleAttack.castles.b.hp, hpBefore - 100, "Rook applies its configured castle damage bonus");
const castleEffectEvent = castleEvents.find((event) => event.type === "unitAttacked" && event.targetKind === "castle");
assert.equal(castleEffectEvent?.attackerType, "rook");
assert.deepEqual(castleEffectEvent?.targetCell, { row: 0, col: 3 });
assert.equal(castleEffectEvent?.effectRole, "primary");

const destruction = createTestState({
  resource: { start: 1000, max: 1000 },
  castle: { hp: 40 },
  units: { pawn: { moveSpeed: 0, attack: 50, attackIntervalMs: 100, range: 1 } },
});
const finisher = summonSiegeUnit(destruction, "w", "pawn", { row: 5, col: 3 }).unit;
finisher.row = 1;
tickSiege(destruction, 1);
assert.equal(destruction.status, "finished");
assert.equal(destruction.winner, "w");
assert.equal(destruction.resultReason, "castleDestroyed");

const timeout = createTestState({ matchDurationMs: 500 });
timeout.castles.b.hp = 450;
tickSiege(timeout, 5);
assert.equal(timeout.status, "finished");
assert.equal(timeout.winner, "w", "Higher remaining castle HP wins at three-minute timeout");
assert.equal(timeout.resultReason, "timeout");
const draw = createTestState({ matchDurationMs: 100 });
tickSiege(draw, 1);
assert.equal(draw.winner, "draw", "Equal castle HP produces a deterministic draw");

const chest = createTestState({
  resource: { start: 300, ratePerSecond: 2, max: 1000 },
  chest: { buffDurationMs: 500 },
});
assert.equal(chest.config.chest.respawnMs, 8000, "Item chests return after eight seconds");
assert.equal(applySiegeChestEffect(chest, "w", "points50").valid, true);
assert.equal(chest.players.w.points, 350);
applySiegeChestEffect(chest, "w", "income2");
assert.equal(siegeEffectiveResourceRate(chest, "w"), 4);
assert.equal(siegeEffectiveResourceRate(chest, "b"), 2);
tickSiege(chest, 4);
assert.equal(siegeEffectiveResourceRate(chest, "w"), 4);
tickSiege(chest, 1);
assert.equal(siegeEffectiveResourceRate(chest, "w"), 2, "Timed income buff expires exactly on its deterministic tick");
assert.equal(chest.lastEvents.some((event) => event.type === "buffExpired"), true);

const freePawn = createTestState({ resource: { start: 0, max: 600 } });
const pointsBeforeFreePawn = freePawn.players.w.points;
const freeResult = applySiegeChestEffect(freePawn, "w", "freePawn");
assert.equal(freeResult.valid, true);
assert.equal(freePawn.units.filter((unit) => unit.color === "w" && unit.type === "pawn").length, 1);
assert.equal(freePawn.players.w.points, pointsBeforeFreePawn, "Free Pawn does not spend crown points");

const portal = createTestState({
  resource: { start: 100, max: 100 },
  portal: { respawnMs: 300, minDistance: 3 },
  units: { pawn: { moveSpeed: 10, attack: 1, attackIntervalMs: 1000, range: 1 } },
});
const traveler = summonSiegeUnit(portal, "w", "pawn", { row: 6, col: 0 }).unit;
portal.portals = [{ row: 5, col: 0 }, { row: 2, col: 6 }];
portal.portalGeneration = 1;
const teleportEvents = tickSiege(portal, 1).events;
assert.deepEqual({ row: traveler.row, col: traveler.col }, { row: 2, col: 6 });
assert.equal(portal.portals.length, 0, "A used portal pair is consumed once");
assert.equal(teleportEvents.some((event) => event.type === "unitTeleported"), true);
tickSiege(portal, 2);
assert.equal(portal.portals.length, 0);
tickSiege(portal, 1);
assert.equal(portal.portals.length, 2, "A consumed pair regenerates on the configured deterministic tick");
assert.equal(portal.portalGeneration, 2);
for (const cell of portal.portals) {
  assert.equal(Math.abs(cell.row - portal.castles.w.row) + Math.abs(cell.col - portal.castles.w.col) > 1, true);
  assert.equal(Math.abs(cell.row - portal.castles.b.row) + Math.abs(cell.col - portal.castles.b.col) > 1, true);
}

const resetPortals = createTestState({}, { seed: 7 });
const firstPair = regenerateSiegePortals(resetPortals);
const firstGeneration = resetPortals.portalGeneration;
const secondPair = applySiegeChestEffect(resetPortals, "w", "portalReset").detail.cells;
assert.equal(resetPortals.portalGeneration, firstGeneration + 1);
assert.equal(secondPair.length, 2);
assert.notDeepEqual(secondPair, firstPair, "Portal reset consumes deterministic RNG and creates a new pair");

const cloned = cloneSiegeState(portal);
cloned.players.w.points = 0;
assert.notEqual(cloned.players.w.points, portal.players.w.points, "State clones are independent for scene simulation/preview");

console.log("Validated Kingdom Siege: config, resources, six summons, deterministic movement/combat, castles, timeout, chests, buffs, and portals.");
