import { createHash } from "node:crypto";
import { Chess } from "chess.js";

export const INITIAL_RATING = 1000;
export const ELO_K_FACTOR = 32;

function boundedText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function validResult(value) {
  return ["w_win", "b_win", "draw"].includes(value);
}

export function publicLeaderboardId(uid) {
  return createHash("sha256")
    .update(`kuma-leaderboard-v1:${boundedText(uid, 128)}`)
    .digest("hex")
    .slice(0, 32);
}

export function currentWeeklySeasonId(value = Date.now()) {
  const source = value instanceof Date ? value.getTime() : Number(value);
  const shifted = new Date((Number.isFinite(source) ? source : Date.now()) + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `weekly-${year}-W${String(week).padStart(2, "0")}`;
}

export function calculateEloPair(whiteRating, blackRating, whiteScore) {
  const white = Number.isFinite(Number(whiteRating)) ? Number(whiteRating) : INITIAL_RATING;
  const black = Number.isFinite(Number(blackRating)) ? Number(blackRating) : INITIAL_RATING;
  const score = Math.min(1, Math.max(0, Number(whiteScore)));
  const expectedWhite = 1 / (1 + (10 ** ((black - white) / 400)));
  const delta = Math.round(ELO_K_FACTOR * (score - expectedWhite));
  return Object.freeze({
    white: Math.max(100, Math.round(white + delta)),
    black: Math.max(100, Math.round(black - delta)),
    delta,
  });
}

function replayMoves(moves) {
  const game = new Chess();
  for (const encoded of moves) {
    const move = boundedText(encoded, 5).toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
    try {
      if (!game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })) return null;
    } catch (_error) {
      return null;
    }
  }
  return game;
}

export function verifyFinishedRoom(room, actorUid = "") {
  const whiteUid = boundedText(room?.whiteUid, 128);
  const blackUid = boundedText(room?.blackUid, 128);
  const result = boundedText(room?.result, 16);
  const reason = boundedText(room?.reason, 20);
  const moves = Array.isArray(room?.moves) ? room.moves : [];
  if (room?.status !== "finished" || !whiteUid || !blackUid || whiteUid === blackUid) {
    return Object.freeze({ valid: false, reason: "invalid-players" });
  }
  if (!validResult(result) || !["checkmate", "draw", "resign"].includes(reason)) {
    return Object.freeze({ valid: false, reason: "invalid-result" });
  }

  const game = replayMoves(moves);
  if (!game || boundedText(room?.fen, 120) !== game.fen()) {
    return Object.freeze({ valid: false, reason: "invalid-game-history" });
  }

  const winnerUid = result === "w_win" ? whiteUid : result === "b_win" ? blackUid : "";
  const loserUid = result === "w_win" ? blackUid : result === "b_win" ? whiteUid : "";
  if (reason === "checkmate") {
    const expectedResult = game.turn() === "w" ? "b_win" : "w_win";
    if (!game.isCheckmate() || result !== expectedResult || actorUid !== winnerUid) {
      return Object.freeze({ valid: false, reason: "invalid-checkmate" });
    }
  } else if (reason === "draw") {
    if (!game.isDraw() || result !== "draw" || ![whiteUid, blackUid].includes(actorUid)) {
      return Object.freeze({ valid: false, reason: "invalid-draw" });
    }
  } else if (result === "draw" || actorUid !== loserUid) {
    return Object.freeze({ valid: false, reason: "invalid-resignation" });
  }

  return Object.freeze({
    valid: true,
    whiteUid,
    blackUid,
    winnerUid,
    loserUid,
    whiteScore: result === "w_win" ? 1 : result === "b_win" ? 0 : 0.5,
    result,
    reason,
    moveCount: moves.length,
  });
}

export function playerPublicProfile(room, uid) {
  const isHost = room.hostUid === uid;
  const avatar = (isHost ? room.hostAvatar : room.guestAvatar) || {};
  return Object.freeze({
    displayName: boundedText(isHost ? room.hostName : room.guestName, 16) || "Player",
    avatar: Object.freeze({
      portraitId: boundedText(avatar.portraitId, 40) || "portrait-basic-01",
      frameId: boundedText(avatar.frameId, 40) || "frame-basic-01",
    }),
  });
}

export function nextLeaderboardEntry(source, profile, outcome, rating, playTimeSeconds) {
  const current = source && typeof source === "object" ? source : {};
  const wins = Math.max(0, Number(current.wins) || 0) + (outcome === 1 ? 1 : 0);
  const losses = Math.max(0, Number(current.losses) || 0) + (outcome === 0 ? 1 : 0);
  const draws = Math.max(0, Number(current.draws) || 0) + (outcome === 0.5 ? 1 : 0);
  return {
    schemaVersion: 1,
    displayName: profile.displayName,
    avatar: profile.avatar,
    score: rating,
    wins,
    losses,
    draws,
    played: wins + losses + draws,
    playTimeSeconds: Math.max(0, Number(current.playTimeSeconds) || 0)
      + Math.min(21600, Math.max(0, Math.floor(Number(playTimeSeconds) || 0))),
  };
}
