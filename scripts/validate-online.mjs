import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/vendor-chess.js";
import {
  createOnlineRoomCode,
  normalizeOnlineMove,
  normalizeOnlineRoomCode,
  onlineMovePayload,
  onlineRoomResult,
} from "../src/onlineRoom.js";

const sessionStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => sessionStorage.get(key) ?? null,
    setItem: (key, value) => sessionStorage.set(key, String(value)),
    removeItem: (key) => sessionStorage.delete(key),
  },
};
const { clearOnlineSession, readOnlineSession, saveOnlineSession } = await import("../src/onlineSession.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

assert.equal(normalizeOnlineRoomCode("ab-23 yz"), "AB23YZ");
assert.equal(normalizeOnlineRoomCode("abcd2345"), "ABCD23");
assert.equal(createOnlineRoomCode(Uint8Array.from([0, 1, 2, 3, 4, 5])).length, 6);
assert.match(createOnlineRoomCode(Uint8Array.from([0, 1, 2, 3, 4, 5])), /^[A-HJ-NP-Z2-9]{6}$/);
assert.equal(normalizeOnlineMove("E2E4"), "e2e4");
assert.equal(normalizeOnlineMove("a7a8q"), "a7a8q");
assert.equal(normalizeOnlineMove("e2-e4"), "");
assert.equal(onlineMovePayload({ from: "e2", to: "e4" }), "e2e4");

const game = new Chess();
for (const move of ["f3", "e5", "g4", "Qh4#"]) assert.ok(game.move(move));
assert.deepEqual(onlineRoomResult(game), { status: "finished", result: "b_win", reason: "checkmate" });
assert.deepEqual(saveOnlineSession("ab23yz", "b"), { code: "AB23YZ", color: "b" });
assert.deepEqual(readOnlineSession(), { code: "AB23YZ", color: "b" });
clearOnlineSession("AB23YZ");
assert.equal(readOnlineSession(), null);

const main = read("src/main.js");
const home = read("main-page.js");
const fallback = read("main-page-fallback.js");
const appInit = read("app-init.js");
const onlineGame = read("src/scenes/OnlineGame.js");
const client = read("src/firebaseClientEntry.js");
const rules = read("firestore.rules");
const html = read("index.html");
const css = read("main-page.css");
const resultScene = read("src/scenes/Result.js");

assert.doesNotMatch(main, /OnlineLobby/);
assert.match(main, /OnlineGame/);
assert.match(main, /event\.data\.payload/);
assert.match(html, /data-open-online/);
assert.match(html, /id="online-dialog"/);
assert.match(html, /data-online-share/);
assert.match(html, /share_online_1200x630\.png/);
for (const asset of ["img_card_pvp.png", "icon_pvp_add.png", "icon_pvp_entry.png"]) {
  assert.match(html, new RegExp(asset.replace(".", "\\.")));
}
for (const asset of ["pop_3p_top.png", "pop_3p_center.png", "pop_3p_bottom.png"]) {
  assert.match(css, new RegExp(asset.replace(".", "\\.")));
}
assert.match(css, /#online-dialog \.online-resource-button[\s\S]*font-family: "Pretendard"/);
assert.match(html, /class="online-three-patch-center"/);
assert.match(css, /\.online-three-patch-center[\s\S]*top: calc\(25\.602cqi - 2px\);[\s\S]*bottom: calc\(20\.152cqi - 2px\);[\s\S]*pop_3p_center\.png/);
assert.doesNotMatch(css, /#online-dialog:not\(\[data-online-view-state="entry"\]\)::backdrop/);
assert.doesNotMatch(html, /secondary-play is-disabled[^>]*>[\s\S]{0,240}온라인 플레이/);
for (const method of [
  "createOnlineRoom",
  "joinOnlineRoom",
  "watchOnlineRoom",
  "submitOnlineMove",
  "leaveOnlineRoom",
  "requestOnlineRematch",
  "cancelOnlineRematch",
  "acceptOnlineRematch",
]) {
  assert.match(client, new RegExp(method));
}
assert.match(rules, /match \/onlineRooms\/\{code\}/);
assert.match(rules, /allow list: if false/);
assert.match(rules, /request\.auth\.uid == resource\.data\.turnUid/);
assert.match(rules, /validOnlineAvatar/);
assert.match(rules, /onlineRoomFieldsV4/);
assert.match(rules, /roundStartedAt/);
assert.match(rules, /rematchRequesterUid/);
assert.match(rules, /request\.resource\.data\.whiteUid == resource\.data\.blackUid/);
assert.match(client, /hostAvatar: onlineAvatarSnapshot\(\)/);
assert.match(client, /guestAvatar = onlineAvatarSnapshot\(\)/);
assert.match(client, /schemaVersion: 3/);
assert.match(client, /currentWeeklySeasonId/);
assert.match(home, /function openOnlineDialog/);
assert.match(home, /function createOnlineRoom/);
assert.match(home, /function joinOnlineRoom/);
assert.match(home, /function shareOnlineInvite/);
assert.match(home, /navigator\.share\(shareData\)/);
assert.match(home, /searchParams\.set\("invite", code\)/);
assert.match(home, /openOnlineInviteDialog\(initialInviteCode\)/);
assert.match(home, /navigator\.clipboard\.writeText\(`\$\{shareData\.text\}\\n\$\{shareData\.url\}`\)/);
assert.match(appInit, /initialInviteCode\.length === 6/);
assert.match(appInit, /nextUrl\.searchParams\.set\("invite", initialInviteCode\)/);
assert.match(home, /openGameLaunch\("online-game"/);
assert.match(home, /비랭크 대전/);
assert.match(fallback, /\[data-open-online\]/);
assert.match(fallback, /const createOnlineRoom = async/);
assert.match(fallback, /const joinOnlineRoom = async/);
assert.match(fallback, /watchOnlineRoom/);
assert.match(fallback, /openGameLaunch\("online-game"/);
assert.match(onlineGame, /expectedRevision/);
assert.match(onlineGame, /room\.status === "finished"/);
assert.match(onlineGame, /addProfileAvatar/);
assert.match(onlineGame, /recordOnlineGameCompletion/);
assert.match(onlineGame, /rebuildCapturedFromHistory/);
assert.match(onlineGame, /showLineText\("CHECKMATE!"/);
assert.match(onlineGame, /showLineText\("CHECK!"/);
assert.match(onlineGame, /panelW = 513/);
assert.match(onlineGame, /onlineRoom: \{ \.\.\.room \}/);
assert.ok(resultScene.indexOf("showMedalAwardSequence") < resultScene.indexOf("showSecondaryNotices();"));
assert.match(resultScene, /setActionsEnabled\(false\)/);
assert.match(resultScene, /addOnlineWinnerIdentity/);
assert.match(resultScene, /addOnlineWinnerIdentity\(winnerColor, 925\)/);
assert.match(resultScene, /recordOnlineRematch/);
assert.match(resultScene, /showRematchPopup\("waiting"\)/);
assert.match(resultScene, /showRematchPopup\("incoming"\)/);

console.log("Online validation passed: invite flow, turn revisions, participation medals, rematches, and result profiles are wired.");
