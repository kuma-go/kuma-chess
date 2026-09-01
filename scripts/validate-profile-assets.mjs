import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  FREE_PROFILE_FRAME_IDS,
  FREE_PROFILE_PORTRAIT_IDS,
  PROFILE_FRAMES,
  PROFILE_PORTRAITS,
} from "../src/profileCatalog.js";

const root = path.resolve("assets/kuma/ui/profile");
const editorSource = fs.readFileSync(path.resolve("src/ui/ProfileEditorPopup.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert(buffer.toString("ascii", 1, 4) === "PNG", `${filePath} is not a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

assert(PROFILE_PORTRAITS.length === 199, `expected 199 portraits, found ${PROFILE_PORTRAITS.length}`);
assert(PROFILE_FRAMES.length === 15, `expected 15 frames, found ${PROFILE_FRAMES.length}`);
assert(FREE_PROFILE_PORTRAIT_IDS.length === 8, "exactly eight portraits must be free defaults");
assert(FREE_PROFILE_FRAME_IDS.length === 4, "exactly four frames must be free defaults");
assert(editorSource.indexOf("const listHit") < editorSource.indexOf("const listLayer"),
  "profile list hit target must remain behind item controls");
assert(editorSource.includes("getSourceImage()") && editorSource.includes("activeType === \"frame\""),
  "frame previews must preserve the complete source art without portrait compositing");
assert(editorSource.includes("Phaser.Scenes.Events.SHUTDOWN") && editorSource.includes("dispose(false)"),
  "profile editor must clean itself up when the embedded scene is stopped");
assert(editorSource.includes("closeNicknameDialog?.()") && editorSource.includes("return close;"),
  "nickname DOM dialog must be removed with the profile scene");
assert(editorSource.includes("updateTileInputs()") && editorSource.includes("hit.disableInteractive()"),
  "masked profile tiles must not intercept input outside the visible list");
assert(!editorSource.includes("const coinText"), "profile editor must use the shared home coin display");
assert(!PROFILE_PORTRAITS.some((item) => item.fileName === "image 784.png"),
  "the duplicate image 784 hourglass must not remain in the catalog");
assert(!fs.existsSync(path.join(root, "image 784.png")),
  "the duplicate image 784 hourglass file must be removed");
assert(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "Frame 180.png"))).digest("hex")
  === "c9d1f8ef2464e1eb6a5c0daa0ed0ba24b4bcca0e835ae5ef4a09e6cda68cdde9",
"Frame 180 must use the corrected hourglass portrait");

const all = [...PROFILE_PORTRAITS, ...PROFILE_FRAMES];
const ids = new Set();
const files = new Set();
for (const item of all) {
  assert(!ids.has(item.id), `duplicate profile item id: ${item.id}`);
  assert(!files.has(item.fileName), `duplicate profile item file: ${item.fileName}`);
  ids.add(item.id);
  files.add(item.fileName);
  assert(Number.isInteger(item.cost) && item.cost >= 0, `invalid cost for ${item.id}`);
  const filePath = path.join(root, item.fileName);
  assert(fs.existsSync(filePath), `missing profile asset: ${item.fileName}`);
  const { width, height } = pngDimensions(filePath);
  assert(width >= 80 && width <= 240 && height >= 80 && height <= 240,
    `unexpected dimensions for ${item.fileName}: ${width}x${height}`);
}

console.log(`Validated ${PROFILE_PORTRAITS.length} profile portraits and ${PROFILE_FRAMES.length} frames.`);
