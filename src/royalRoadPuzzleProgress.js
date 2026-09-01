import { grantCoinsOnce } from "./playerState.js?v=20260902-profile81";
import { readJsonFromStorage, writeJsonToStorage } from "./storage.js?v=20260902-profile81";

export const ROYAL_ROAD_PUZZLE_PROGRESS_KEY = "kumaChessRoyalRoadPuzzleV1";
export const ROYAL_ROAD_PUZZLE_PROGRESS_BACKUP_KEY = "kumaChessRoyalRoadPuzzleBackupV1";
export const ROYAL_ROAD_PUZZLE_REWARD = 3;

function emptyProgress() {
  return { version: 1, records: {} };
}

function normalizeRecord(value) {
  return {
    cleared: !!value?.cleared,
    stars: Math.max(0, Math.min(3, Math.floor(Number(value?.stars) || 0))),
    bestRotations: Number.isFinite(Number(value?.bestRotations)) ? Math.max(0, Number(value.bestRotations)) : null,
    bestMoves: Number.isFinite(Number(value?.bestMoves)) ? Math.max(0, Number(value.bestMoves)) : null,
    bestTimeMs: Number.isFinite(Number(value?.bestTimeMs)) ? Math.max(0, Number(value.bestTimeMs)) : null,
  };
}

function normalizeProgress(value) {
  const next = emptyProgress();
  const records = value?.records && typeof value.records === "object" ? value.records : {};
  for (const [id, record] of Object.entries(records)) next.records[id] = normalizeRecord(record);
  return next;
}

export function readRoyalRoadPuzzleProgress() {
  const saved = readJsonFromStorage([
    ROYAL_ROAD_PUZZLE_PROGRESS_KEY,
    ROYAL_ROAD_PUZZLE_PROGRESS_BACKUP_KEY,
  ], emptyProgress());
  const progress = normalizeProgress(saved.value);
  const serialized = JSON.stringify(progress);
  if (saved.recovered || (saved.key && serialized !== saved.raw)) {
    writeJsonToStorage([
      ROYAL_ROAD_PUZZLE_PROGRESS_KEY,
      ROYAL_ROAD_PUZZLE_PROGRESS_BACKUP_KEY,
    ], progress);
  }
  return progress;
}

export function getRoyalRoadPuzzleUnlockCount(stages) {
  const progress = readRoyalRoadPuzzleProgress();
  let count = 1;
  for (let index = 0; index < stages.length; index += 1) {
    if (!progress.records[stages[index].id]?.cleared) break;
    count = index + 2;
  }
  return Math.max(1, Math.min(stages.length, count));
}

export function saveRoyalRoadPuzzleClear(stageId, result) {
  const progress = readRoyalRoadPuzzleProgress();
  const previous = normalizeRecord(progress.records[stageId]);
  const next = {
    cleared: true,
    stars: Math.max(previous.stars, Math.max(1, Math.min(3, result.stars || 1))),
    bestRotations: previous.bestRotations == null ? result.rotations : Math.min(previous.bestRotations, result.rotations),
    bestMoves: previous.bestMoves == null ? result.moves : Math.min(previous.bestMoves, result.moves),
    bestTimeMs: previous.bestTimeMs == null ? result.timeMs : Math.min(previous.bestTimeMs, result.timeMs),
  };
  progress.records[stageId] = next;
  writeJsonToStorage([
    ROYAL_ROAD_PUZZLE_PROGRESS_KEY,
    ROYAL_ROAD_PUZZLE_PROGRESS_BACKUP_KEY,
  ], progress);
  const reward = grantCoinsOnce(`road-puzzle:first-clear:${stageId}:v1`, ROYAL_ROAD_PUZZLE_REWARD);
  return { record: next, firstClear: reward.awarded, reward };
}
