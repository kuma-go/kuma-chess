import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger, setGlobalOptions } from "firebase-functions";
import { onDocumentUpdatedWithAuthContext } from "firebase-functions/v2/firestore";
import {
  calculateEloPair,
  currentWeeklySeasonId,
  INITIAL_RATING,
  nextLeaderboardEntry,
  playerPublicProfile,
  publicLeaderboardId,
  verifyFinishedRoom,
} from "./ranking.js";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

function timestampMillis(value) {
  const millis = value?.toMillis?.();
  return Number.isFinite(millis) ? millis : 0;
}

function roundPlayTimeSeconds(room) {
  const startedAt = timestampMillis(room.roundStartedAt) || timestampMillis(room.createdAt);
  const endedAt = timestampMillis(room.updatedAt);
  if (!startedAt || endedAt < startedAt) return 0;
  return Math.min(21600, Math.floor((endedAt - startedAt) / 1000));
}

function ratingOf(snapshot) {
  const score = Number(snapshot.data()?.score);
  return Number.isFinite(score) ? score : INITIAL_RATING;
}

export const updateOnlineLeaderboards = onDocumentUpdatedWithAuthContext(
  "onlineRooms/{code}",
  async (event) => {
    const before = event.data?.before?.data() || {};
    const room = event.data?.after?.data() || {};
    const round = Math.max(1, Math.floor(Number(room.round) || 1));
    if (room.status !== "finished" || (before.status === "finished" && Number(before.round) === round)) return;

    const verified = verifyFinishedRoom(room, event.authId || "");
    if (!verified.valid) {
      logger.warn("Rejected unverified online result", {
        code: event.params.code,
        round,
        verificationReason: verified.reason,
      });
      return;
    }

    const db = getFirestore();
    const eventId = `${event.params.code}-${round}`;
    const claimRef = db.doc(`rankingEvents/${eventId}`);
    const weeklySeason = currentWeeklySeasonId(timestampMillis(room.updatedAt) || Date.now());
    const whiteEntryId = publicLeaderboardId(verified.whiteUid);
    const blackEntryId = publicLeaderboardId(verified.blackUid);
    const whiteProfile = playerPublicProfile(room, verified.whiteUid);
    const blackProfile = playerPublicProfile(room, verified.blackUid);
    const playTimeSeconds = roundPlayTimeSeconds(room);
    const periods = [weeklySeason, "all-time"];

    await db.runTransaction(async (transaction) => {
      const entryRefs = periods.flatMap((season) => [
        db.doc(`leaderboards/${season}/entries/${whiteEntryId}`),
        db.doc(`leaderboards/${season}/entries/${blackEntryId}`),
      ]);
      const identityRefs = [
        db.doc(`users/${verified.whiteUid}/ranking/identity`),
        db.doc(`users/${verified.blackUid}/ranking/identity`),
      ];
      const snapshots = await Promise.all([
        transaction.get(claimRef),
        ...entryRefs.map((ref) => transaction.get(ref)),
      ]);
      if (snapshots[0].exists) return;

      periods.forEach((season, periodIndex) => {
        const whiteSnapshot = snapshots[1 + periodIndex * 2];
        const blackSnapshot = snapshots[2 + periodIndex * 2];
        const ratings = calculateEloPair(
          ratingOf(whiteSnapshot),
          ratingOf(blackSnapshot),
          verified.whiteScore,
        );
        transaction.set(entryRefs[periodIndex * 2], {
          ...nextLeaderboardEntry(
            whiteSnapshot.data(), whiteProfile, verified.whiteScore, ratings.white, playTimeSeconds,
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(entryRefs[periodIndex * 2 + 1], {
          ...nextLeaderboardEntry(
            blackSnapshot.data(), blackProfile, 1 - verified.whiteScore, ratings.black, playTimeSeconds,
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      transaction.set(identityRefs[0], {
        schemaVersion: 1,
        entryId: whiteEntryId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(identityRefs[1], {
        schemaVersion: 1,
        entryId: blackEntryId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(claimRef, {
        schemaVersion: 1,
        roomCode: event.params.code,
        round,
        result: verified.result,
        reason: verified.reason,
        weeklySeason,
        processedAt: FieldValue.serverTimestamp(),
      });
    });

    logger.info("Ranked online result", { code: event.params.code, round, weeklySeason });
  },
);
