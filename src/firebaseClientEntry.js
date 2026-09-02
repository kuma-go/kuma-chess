import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { FIREBASE_CONFIG } from "./firebaseConfig.js";
import {
  createOnlineRoomCode,
  normalizeOnlineMove,
  normalizeOnlineRoomCode,
  ONLINE_INITIAL_FEN,
} from "./onlineRoom.js";

const CLOUD_SCHEMA_VERSION = 1;
const PROFILE_STATE_KEY = "kumaChessProfileState";
const PLAYER_STATE_KEY = "kumaChessPlayerState";
const PUZZLE_PROGRESS_KEY = "kumaChessPuzzleClears";
const MEDAL_STATE_KEY = "kumaChessMedalsV1";
const CLOUD_EVENT = "kuma-cloud-state-changed";
const SYNC_DELAY_MS = 900;
const RESULT_KEYS = Object.freeze(["wins", "losses", "draws", "played"]);
const AI_DIFFICULTIES = Object.freeze(["easy", "normal", "hard", "challenge"]);
const MINI_GAME_IDS = Object.freeze(["tug", "crown", "road", "road-puzzle", "siege"]);
const ONLINE_ROOM_COLLECTION = "onlineRooms";

let auth = null;
let database = null;
let activeUser = null;
let signInPromise = null;
let syncTimer = 0;
let syncInFlight = false;
let syncRequested = false;
let lastProfileSignature = "";
let lastProgressSignature = "";
let profileAvatarV2Supported = true;
let cloudState = Object.freeze({ status: "idle", uid: "", error: "" });

function emitCloudState(status, details = {}) {
  cloudState = Object.freeze({
    status,
    uid: activeUser?.uid || "",
    error: "",
    ...details,
  });
  document.documentElement.dataset.kumaCloudStatus = status;
  window.dispatchEvent(new CustomEvent(CLOUD_EVENT, { detail: cloudState }));
}

function readStoredJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function boundedText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function normalizedNickname(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replaceAll("/", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.floor(number)));
}

function normalizeResultStats(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const key of RESULT_KEYS) result[key] = boundedCount(source[key]);
  result.played = Math.max(result.played, result.wins + result.losses + result.draws);
  return result;
}

function profileSnapshot() {
  const source = readStoredJson(PROFILE_STATE_KEY, {});
  const avatar = source?.avatar && typeof source.avatar === "object" ? source.avatar : {};
  const volume = Number(source?.bgmVolume);
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    displayName: boundedText(source?.displayName, 24),
    avatar: {
      portraitId: boundedText(avatar.portraitId || "portrait-basic-01", 40) || "portrait-basic-01",
      frameId: boundedText(avatar.frameId || "frame-basic-01", 40) || "frame-basic-01",
      skinId: boundedText(avatar.skinId || "classic", 40) || "classic",
      color: avatar.color === "b" ? "b" : "w",
    },
    language: ["ko", "en", "ja"].includes(source?.language) ? source.language : "ko",
    soundEnabled: source?.soundEnabled !== false,
    bgmVolume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.35,
    vibrationEnabled: source?.vibrationEnabled !== false,
  };
}

function legacyProfileSnapshot(profile) {
  return {
    ...profile,
    avatar: {
      skinId: profile.avatar.skinId,
      color: profile.avatar.color,
    },
  };
}

async function writeProfileDocument(profile) {
  const profileRef = doc(database, "users", activeUser.uid, "sync", "profile");
  const snapshot = profileAvatarV2Supported ? profile : legacyProfileSnapshot(profile);
  try {
    await setDoc(profileRef, { ...snapshot, updatedAt: serverTimestamp() });
  } catch (error) {
    if (!profileAvatarV2Supported || error?.code !== "permission-denied") throw error;
    profileAvatarV2Supported = false;
    await setDoc(profileRef, {
      ...legacyProfileSnapshot(profile),
      updatedAt: serverTimestamp(),
    });
  }
}

function progressSnapshot() {
  const player = readStoredJson(PLAYER_STATE_KEY, {});
  const puzzles = readStoredJson(PUZZLE_PROGRESS_KEY, []);
  const medals = readStoredJson(MEDAL_STATE_KEY, {});
  const aiSource = player?.stats?.ai && typeof player.stats.ai === "object" ? player.stats.ai : {};
  const aiStats = {};
  for (const difficulty of AI_DIFFICULTIES) {
    aiStats[difficulty] = normalizeResultStats(aiSource[difficulty]);
  }
  const pvpSource = player?.stats?.pvp && typeof player.stats.pvp === "object" ? player.stats.pvp : {};
  const pvpStats = {
    wWins: boundedCount(pvpSource.wWins),
    bWins: boundedCount(pvpSource.bWins),
    draws: boundedCount(pvpSource.draws),
    played: boundedCount(pvpSource.played),
  };
  pvpStats.played = Math.max(pvpStats.played, pvpStats.wWins + pvpStats.bWins + pvpStats.draws);

  const completedPuzzleIds = Array.from(new Set(
    (Array.isArray(puzzles) ? puzzles : [])
      .map((id) => boundedText(id, 32))
      .filter(Boolean),
  )).slice(0, 100);
  const unlockedMedalIds = Object.keys(
    medals?.unlockedAt && typeof medals.unlockedAt === "object" ? medals.unlockedAt : {},
  ).map((id) => boundedText(id, 80)).filter(Boolean).slice(0, 100);
  const miniGamesPlayed = MINI_GAME_IDS.filter((id) => medals?.miniGamesPlayed?.[id] === true);

  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    source: "local-unverified",
    aiStats,
    pvpStats,
    completedPuzzleIds,
    unlockedMedalIds,
    miniGamesPlayed,
  };
}

async function writeChangedSnapshots() {
  if (!activeUser || !database || syncInFlight) {
    syncRequested = true;
    return;
  }
  syncInFlight = true;
  syncRequested = false;
  emitCloudState("syncing");
  try {
    const profile = profileSnapshot();
    const progress = progressSnapshot();
    const profileSignature = JSON.stringify(profile);
    const progressSignature = JSON.stringify(progress);
    const writes = [];
    if (profileSignature !== lastProfileSignature) {
      writes.push(writeProfileDocument(profile));
    }
    if (progressSignature !== lastProgressSignature) {
      writes.push(setDoc(doc(database, "users", activeUser.uid, "sync", "progress"), {
        ...progress,
        updatedAt: serverTimestamp(),
      }));
    }
    await Promise.all(writes);
    lastProfileSignature = profileSignature;
    lastProgressSignature = progressSignature;
    emitCloudState("ready", { lastSyncedAt: Date.now() });
  } catch (error) {
    console.warn("[KUMA CHESS] Cloud sync is unavailable; local play remains active.", error);
    emitCloudState("offline", { error: error?.code || "sync-failed" });
  } finally {
    syncInFlight = false;
    if (syncRequested) scheduleSync();
  }
}

function scheduleSync(delay = SYNC_DELAY_MS) {
  syncRequested = true;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void writeChangedSnapshots(), delay);
}

async function registerUser(user) {
  const userRef = doc(database, "users", user.uid);
  const existing = await getDoc(userRef);
  const base = {
    uid: user.uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    accountType: user.isAnonymous ? "anonymous" : "registered",
    lastSeenAt: serverTimestamp(),
  };
  if (!existing.exists()) base.createdAt = serverTimestamp();
  await setDoc(userRef, base, { merge: true });
}

async function ensureAnonymousUser() {
  if (signInPromise) return signInPromise;
  signInPromise = signInAnonymously(auth).finally(() => {
    signInPromise = null;
  });
  return signInPromise;
}

async function requireActiveUser() {
  if (activeUser) return activeUser;
  const credential = await ensureAnonymousUser();
  activeUser = credential?.user || auth?.currentUser || null;
  if (!activeUser) throw Object.assign(new Error("authentication-required"), { code: "authentication-required" });
  return activeUser;
}

function onlineDisplayName() {
  return boundedText(profileSnapshot().displayName || "Player", 16) || "Player";
}

function normalizeOnlineAvatar(value = {}) {
  return Object.freeze({
    portraitId: boundedText(value?.portraitId || "portrait-basic-01", 40) || "portrait-basic-01",
    frameId: boundedText(value?.frameId || "frame-basic-01", 40) || "frame-basic-01",
  });
}

function onlineAvatarSnapshot() {
  return normalizeOnlineAvatar(profileSnapshot().avatar);
}

function onlineRoomSnapshot(snapshot) {
  if (!snapshot?.exists?.()) return null;
  const data = snapshot.data() || {};
  const timestamp = (value) => value?.toMillis?.() ?? 0;
  return Object.freeze({
    code: normalizeOnlineRoomCode(snapshot.id),
    hostUid: boundedText(data.hostUid, 128),
    guestUid: boundedText(data.guestUid, 128),
    hostName: boundedText(data.hostName || "Player", 16) || "Player",
    guestName: boundedText(data.guestName || "", 16),
    hostAvatar: normalizeOnlineAvatar(data.hostAvatar),
    guestAvatar: normalizeOnlineAvatar(data.guestAvatar),
    whiteUid: boundedText(data.whiteUid, 128),
    blackUid: boundedText(data.blackUid, 128),
    status: boundedText(data.status, 16),
    fen: boundedText(data.fen, 120),
    moves: Object.freeze((Array.isArray(data.moves) ? data.moves : []).map(normalizeOnlineMove).filter(Boolean)),
    turnUid: boundedText(data.turnUid, 128),
    result: boundedText(data.result, 16),
    reason: boundedText(data.reason, 20),
    revision: boundedCount(data.revision),
    createdAtMs: timestamp(data.createdAt),
    updatedAtMs: timestamp(data.updatedAt),
    lastMoveAtMs: timestamp(data.lastMoveAt),
  });
}

async function createOnlineRoom() {
  const user = await requireActiveUser();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = createOnlineRoomCode();
    const roomRef = doc(database, ONLINE_ROOM_COLLECTION, code);
    try {
      await runTransaction(database, async (transaction) => {
        if ((await transaction.get(roomRef)).exists()) {
          throw Object.assign(new Error("room-code-collision"), { code: "room-code-collision" });
        }
        transaction.set(roomRef, {
          schemaVersion: 2,
          code,
          hostUid: user.uid,
          hostName: onlineDisplayName(),
          hostAvatar: onlineAvatarSnapshot(),
          guestUid: "",
          guestName: "",
          guestAvatar: normalizeOnlineAvatar(),
          whiteUid: user.uid,
          blackUid: "",
          status: "waiting",
          fen: ONLINE_INITIAL_FEN,
          moves: [],
          turnUid: user.uid,
          result: "",
          reason: "",
          revision: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMoveAt: serverTimestamp(),
        });
      });
      return Object.freeze({ ok: true, code, color: "w", uid: user.uid });
    } catch (error) {
      if (error?.code === "room-code-collision") continue;
      throw error;
    }
  }
  return Object.freeze({ ok: false, reason: "code-generation-failed" });
}

async function joinOnlineRoom(value) {
  const user = await requireActiveUser();
  const code = normalizeOnlineRoomCode(value);
  if (code.length !== 6) return Object.freeze({ ok: false, reason: "invalid-code" });
  const roomRef = doc(database, ONLINE_ROOM_COLLECTION, code);
  try {
    await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw Object.assign(new Error("room-not-found"), { code: "room-not-found" });
      const room = snapshot.data() || {};
      if (room.hostUid === user.uid) throw Object.assign(new Error("same-player"), { code: "same-player" });
      if (room.status !== "waiting" || room.guestUid) {
        throw Object.assign(new Error("room-unavailable"), { code: "room-unavailable" });
      }
      const update = {
        guestUid: user.uid,
        guestName: onlineDisplayName(),
        blackUid: user.uid,
        status: "active",
        updatedAt: serverTimestamp(),
        lastMoveAt: serverTimestamp(),
      };
      if (Number(room.schemaVersion) >= 2) update.guestAvatar = onlineAvatarSnapshot();
      transaction.update(roomRef, update);
    });
    return Object.freeze({ ok: true, code, color: "b", uid: user.uid });
  } catch (error) {
    return Object.freeze({ ok: false, reason: error?.code || "join-failed" });
  }
}

function watchOnlineRoom(value, onChange, onError) {
  const code = normalizeOnlineRoomCode(value);
  if (!database || code.length !== 6) return () => {};
  return onSnapshot(
    doc(database, ONLINE_ROOM_COLLECTION, code),
    (snapshot) => onChange?.(onlineRoomSnapshot(snapshot)),
    (error) => onError?.(error?.code || "watch-failed"),
  );
}

async function submitOnlineMove(value, request = {}) {
  const user = await requireActiveUser();
  const code = normalizeOnlineRoomCode(value);
  const move = normalizeOnlineMove(request.move);
  const fen = boundedText(request.fen, 120);
  const expectedRevision = boundedCount(request.expectedRevision);
  if (code.length !== 6 || !move || !fen) return Object.freeze({ ok: false, reason: "invalid-move" });
  const roomRef = doc(database, ONLINE_ROOM_COLLECTION, code);
  try {
    await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw Object.assign(new Error("room-not-found"), { code: "room-not-found" });
      const room = snapshot.data() || {};
      if (room.status !== "active") throw Object.assign(new Error("room-finished"), { code: "room-finished" });
      if (room.turnUid !== user.uid) throw Object.assign(new Error("not-your-turn"), { code: "not-your-turn" });
      if (Number(room.revision) !== expectedRevision) {
        throw Object.assign(new Error("stale-position"), { code: "stale-position" });
      }
      const participant = [room.whiteUid, room.blackUid].includes(user.uid);
      if (!participant) throw Object.assign(new Error("not-a-player"), { code: "not-a-player" });
      const finished = request.status === "finished";
      const nextTurnUid = room.turnUid === room.whiteUid ? room.blackUid : room.whiteUid;
      transaction.update(roomRef, {
        fen,
        moves: [...(Array.isArray(room.moves) ? room.moves : []), move],
        turnUid: finished ? "" : nextTurnUid,
        status: finished ? "finished" : "active",
        result: finished ? boundedText(request.result, 16) : "",
        reason: finished ? boundedText(request.reason, 20) : "",
        revision: expectedRevision + 1,
        updatedAt: serverTimestamp(),
        lastMoveAt: serverTimestamp(),
      });
    });
    return Object.freeze({ ok: true, revision: expectedRevision + 1 });
  } catch (error) {
    return Object.freeze({ ok: false, reason: error?.code || "move-failed" });
  }
}

async function leaveOnlineRoom(value) {
  const user = await requireActiveUser();
  const code = normalizeOnlineRoomCode(value);
  if (code.length !== 6) return Object.freeze({ ok: false, reason: "invalid-code" });
  const roomRef = doc(database, ONLINE_ROOM_COLLECTION, code);
  try {
    await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return;
      const room = snapshot.data() || {};
      if (room.status === "waiting" && room.hostUid === user.uid) {
        transaction.update(roomRef, {
          status: "cancelled",
          turnUid: "",
          reason: "cancelled",
          revision: boundedCount(room.revision) + 1,
          updatedAt: serverTimestamp(),
          lastMoveAt: serverTimestamp(),
        });
        return;
      }
      if (room.status !== "active" || ![room.whiteUid, room.blackUid].includes(user.uid)) return;
      transaction.update(roomRef, {
        status: "finished",
        result: user.uid === room.whiteUid ? "b_win" : "w_win",
        reason: "resign",
        turnUid: "",
        revision: boundedCount(room.revision) + 1,
        updatedAt: serverTimestamp(),
        lastMoveAt: serverTimestamp(),
      });
    });
    return Object.freeze({ ok: true });
  } catch (error) {
    return Object.freeze({ ok: false, reason: error?.code || "leave-failed" });
  }
}

async function nicknameClaimsSupported() {
  const probeId = `__probe_${activeUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    await getDoc(doc(database, "nicknameClaims", probeId));
    return true;
  } catch (_error) {
    return false;
  }
}

async function reserveNickname(nextValue, previousValue = "") {
  if (!database || !auth) return Object.freeze({ ok: false, reason: "offline" });
  if (!activeUser) {
    const credential = await ensureAnonymousUser();
    activeUser = credential?.user || auth.currentUser || null;
  }
  if (!activeUser) return Object.freeze({ ok: false, reason: "offline" });

  const displayName = normalizedNickname(nextValue);
  const previousName = normalizedNickname(previousValue);
  if (displayName.length < 2) return Object.freeze({ ok: false, reason: "invalid" });
  if (displayName === previousName) return Object.freeze({ ok: true, displayName, unchanged: true });
  if (!await nicknameClaimsSupported()) return Object.freeze({ ok: false, reason: "offline" });

  const claimRef = doc(database, "nicknameClaims", displayName);
  try {
    await runTransaction(database, async (transaction) => {
      const existing = await transaction.get(claimRef);
      if (existing.exists()) {
        if (existing.data()?.ownerUid !== activeUser.uid) throw Object.assign(new Error("nickname-taken"), { code: "nickname-taken" });
        return;
      }
      transaction.set(claimRef, {
        ownerUid: activeUser.uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (["nickname-taken", "permission-denied"].includes(error?.code)) {
      return Object.freeze({ ok: false, reason: "duplicate" });
    }
    console.warn("[KUMA CHESS] Nickname availability check failed.", error);
    return Object.freeze({ ok: false, reason: "offline" });
  }

  if (previousName && previousName !== displayName) {
    try {
      await deleteDoc(doc(database, "nicknameClaims", previousName));
    } catch (_error) {
      // A missing or legacy claim does not invalidate the newly reserved nickname.
    }
  }
  return Object.freeze({ ok: true, displayName });
}

function leaderboardEntrySnapshot(snapshot) {
  const source = snapshot.data() || {};
  const avatar = source.avatar && typeof source.avatar === "object" ? source.avatar : {};
  const timestamp = source.updatedAt?.toMillis?.() ?? Number(source.updatedAtMs) ?? 0;
  return Object.freeze({
    displayName: boundedText(source.displayName || "Player", 24) || "Player",
    avatar: Object.freeze({
      portraitId: boundedText(avatar.portraitId || "portrait-basic-01", 40) || "portrait-basic-01",
      frameId: boundedText(avatar.frameId || "frame-basic-01", 40) || "frame-basic-01",
    }),
    score: boundedCount(source.score),
    wins: boundedCount(source.wins),
    playTimeSeconds: boundedCount(source.playTimeSeconds),
    updatedAtMs: Number.isFinite(timestamp) ? Math.max(0, timestamp) : 0,
  });
}

async function fetchLeaderboard(period = "weekly") {
  if (!database) throw new Error("firebase-not-ready");
  if (!activeUser) await ensureAnonymousUser();
  const normalizedPeriod = period === "all" ? "all" : "weekly";
  const season = normalizedPeriod === "weekly" ? "weekly-current" : "all-time";
  const entriesQuery = query(
    collection(database, "leaderboards", season, "entries"),
    orderBy("score", "desc"),
    limit(10),
  );
  const snapshot = await getDocs(entriesQuery);
  return Object.freeze({
    period: normalizedPeriod,
    season,
    entries: Object.freeze(snapshot.docs.map(leaderboardEntrySnapshot)),
  });
}

function bindSyncEvents() {
  window.addEventListener("kuma-state-changed", () => scheduleSync());
  window.addEventListener("kuma-profile-changed", () => scheduleSync());
  window.addEventListener("storage", (event) => {
    if ([PROFILE_STATE_KEY, PLAYER_STATE_KEY, PUZZLE_PROGRESS_KEY, MEDAL_STATE_KEY].includes(event.key)) {
      scheduleSync();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleSync(0);
  });
}

async function initializeCloud() {
  if (window.self !== window.top) return;
  emitCloudState("connecting");
  try {
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    database = getFirestore(app);
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch (_error) {
      await setPersistence(auth, browserLocalPersistence);
    }
    bindSyncEvents();
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        emitCloudState("signing-in");
        try {
          await ensureAnonymousUser();
        } catch (error) {
          console.warn("[KUMA CHESS] Firebase anonymous sign-in failed.", error);
          emitCloudState("offline", { error: error?.code || "anonymous-auth-failed" });
        }
        return;
      }
      activeUser = user;
      profileAvatarV2Supported = true;
      lastProfileSignature = "";
      lastProgressSignature = "";
      try {
        await registerUser(user);
        const nickname = await reserveNickname(profileSnapshot().displayName);
        if (!nickname.ok) {
          emitCloudState(nickname.reason === "duplicate" ? "nickname-conflict" : "offline", {
            error: nickname.reason,
          });
          return;
        }
        scheduleSync(0);
      } catch (error) {
        console.warn("[KUMA CHESS] Firebase user registration failed.", error);
        emitCloudState("offline", { error: error?.code || "registration-failed" });
      }
    }, (error) => {
      console.warn("[KUMA CHESS] Firebase authentication failed.", error);
      emitCloudState("offline", { error: error?.code || "auth-failed" });
    });
  } catch (error) {
    console.warn("[KUMA CHESS] Firebase initialization failed.", error);
    emitCloudState("offline", { error: error?.code || "initialization-failed" });
  }
}

window.KumaCloud = Object.freeze({
  getState: () => cloudState,
  syncNow: () => scheduleSync(0),
  getLeaderboard: (period) => fetchLeaderboard(period),
  reserveNickname: (nextValue, previousValue) => reserveNickname(nextValue, previousValue),
  createOnlineRoom: () => createOnlineRoom(),
  joinOnlineRoom: (code) => joinOnlineRoom(code),
  watchOnlineRoom: (code, onChange, onError) => watchOnlineRoom(code, onChange, onError),
  submitOnlineMove: (code, request) => submitOnlineMove(code, request),
  leaveOnlineRoom: (code) => leaveOnlineRoom(code),
});

void initializeCloud();
