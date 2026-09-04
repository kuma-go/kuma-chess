import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

for (const file of [
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "src/firebaseConfig.js",
  "src/firebaseClientEntry.js",
  "firebase-client.js",
  "functions/package.json",
  "functions/index.js",
  "functions/ranking.js",
]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`${file}: missing`);
}

const rules = read("firestore.rules");
for (const deniedPath of ["wallets", "rewardClaims", "gameEvents"]) {
  const block = rules.match(new RegExp(`match \\/${deniedPath}[^}]+\\{([\\s\\S]*?)\\n    \\}`, "m"))?.[1] || "";
  if (!block.includes("allow write: if false") && !block.includes("allow read, write: if false")) {
    failures.push(`firestore.rules: ${deniedPath} client writes are not explicitly denied`);
  }
}
if (!rules.includes("request.auth.uid == uid")) failures.push("firestore.rules: owner check is missing");
if (!rules.includes("source == 'local-unverified'")) failures.push("firestore.rules: local progress trust label is missing");
if (!rules.includes("match /leaderboards/{season}/entries/{entryId}")) {
  failures.push("firestore.rules: read-only leaderboard path is missing");
}
if (!rules.includes("match /ranking/identity") || !rules.includes("match /rankingEvents/{eventId}")) {
  failures.push("firestore.rules: private ranking identity or server-only event ledger is missing");
}
if (!rules.includes("validAccountType(request.resource.data.accountType)")) {
  failures.push("firestore.rules: account type is not bound to the authentication provider");
}
if (!rules.includes("match /sync/backup")
  || !rules.includes("request.auth.token.firebase.sign_in_provider != 'anonymous'")
  || !rules.includes("request.resource.data.source == 'local-unverified'")
  || !rules.includes("request.resource.data.payload.player.size() <= 300000")) {
  failures.push("firestore.rules: registered recovery backups are not owner-only, bounded, and unverified");
}
if (!rules.includes("match /nicknameClaims/{displayName}")
  || !rules.includes("request.resource.data.displayName == displayName")
  || !rules.includes("nicknameClaims/$(request.resource.data.displayName)")) {
  failures.push("firestore.rules: unique nickname claims are not bound to profile writes");
}
if (!rules.includes("match /onlineRooms/{code}")
  || !rules.includes("allow list: if false")
  || !rules.includes("request.auth.uid == resource.data.turnUid")
  || !rules.includes("validOnlineAvatar")) {
  failures.push("firestore.rules: invite rooms must block listing and enforce the active turn owner");
}

const client = read("src/firebaseClientEntry.js");
const index = read("index.html");
const responseHeaders = read("_headers");
for (const [file, policy] of [["index.html", index], ["_headers", responseHeaders]]) {
  if (!policy.includes("script-src 'self' https://apis.google.com")) {
    failures.push(`${file}: Firebase popup authentication must allow the Google API loader`);
  }
  if (!policy.includes("frame-src 'self' https://kuma-chess.firebaseapp.com")) {
    failures.push(`${file}: Firebase popup authentication must allow its helper iframe`);
  }
}
if (!client.includes("fullBackupPayload")
  || !client.includes("restoreRegisteredBackup")
  || !client.includes("activeUser.isAnonymous ? null : fullBackupPayload()")
  || !client.includes('source: "local-unverified"')) {
  failures.push("src/firebaseClientEntry.js: registered local recovery backup or restore flow is missing");
}
if (!client.includes("GoogleAuthProvider")
  || !client.includes("linkWithPopup")
  || !client.includes("signInWithCredential")
  || !client.includes("connectGoogleAccount")
  || !client.includes("restoreExistingGoogleAccount")) {
  failures.push("src/firebaseClientEntry.js: popup-based Google account upgrade and existing-account restore flow is missing");
}
if (client.includes("linkWithRedirect") || client.includes("getRedirectResult")) {
  failures.push("src/firebaseClientEntry.js: cross-origin redirect auth is incompatible with the current GitHub Pages hosting");
}
if (client.includes('"auth/internal-error"].includes')) {
  failures.push("src/firebaseClientEntry.js: internal SDK failures must not be mislabeled as popup blocking");
}
if (client.includes("getAnalytics") || client.includes("firebase/analytics")) {
  failures.push("src/firebaseClientEntry.js: Analytics requires a separate consent decision");
}
if (!client.includes("getLeaderboard") || !client.includes("currentWeeklySeasonId") || !client.includes("all-time")) {
  failures.push("src/firebaseClientEntry.js: verified leaderboard read API is missing");
}
if (!client.includes("reserveNickname") || !client.includes("runTransaction")
  || !client.includes("nicknameClaims") || !client.includes("nicknameClaimsSupported")) {
  failures.push("src/firebaseClientEntry.js: transactional nickname reservation is missing");
}
if (client.includes("uid: boundedText(snapshot.id")) {
  failures.push("src/firebaseClientEntry.js: leaderboard responses must not expose document IDs as auth UIDs");
}
for (const onlineMethod of [
  "createOnlineRoom",
  "joinOnlineRoom",
  "watchOnlineRoom",
  "submitOnlineMove",
  "leaveOnlineRoom",
  "requestOnlineRematch",
  "cancelOnlineRematch",
  "acceptOnlineRematch",
]) {
  if (!client.includes(onlineMethod)) failures.push(`src/firebaseClientEntry.js: ${onlineMethod} API is missing`);
}
if (!client.includes("hostAvatar: onlineAvatarSnapshot()")
  || !client.includes("guestAvatar = onlineAvatarSnapshot()")) {
  failures.push("src/firebaseClientEntry.js: online room profiles must include public avatar cosmetics");
}

const rankingFunction = read("functions/index.js");
const rankingLogic = read("functions/ranking.js");
if (!rankingFunction.includes("onDocumentUpdatedWithAuthContext")
  || !rankingFunction.includes("rankingEvents")
  || !rankingFunction.includes("leaderboards/")) {
  failures.push("functions/index.js: authenticated online result aggregation is missing");
}
if (!rankingLogic.includes("new Chess()")
  || !rankingLogic.includes("calculateEloPair")
  || !rankingLogic.includes("publicLeaderboardId")) {
  failures.push("functions/ranking.js: replay validation, Elo, or opaque identity logic is missing");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Firebase validation passed: Google linking and owner-scoped unverified recovery are bounded and separated from authoritative ledgers.");
}
