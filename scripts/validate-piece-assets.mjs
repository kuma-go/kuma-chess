import { ensurePieceSetsLoaded, queueInitialPieceAssets } from "../src/pieceAssets.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const loaded = new Set();
let complete = null;
const scene = {
  textures: { exists: (key) => loaded.has(key) },
  load: {
    image(key) { loaded.add(key); },
    once(event, callback) {
      if (event === "complete") complete = callback;
    },
    start() {
      complete?.();
      complete = null;
    },
  },
};

queueInitialPieceAssets(scene);
assert(loaded.size === 40, `initial load should contain 40 piece previews, found ${loaded.size}`);

await ensurePieceSetsLoaded(scene, [
  { skin: "bear", color: "w" },
  { skin: "cat", color: "b" },
]);
assert(loaded.size === 62, `two selected sets should add 22 missing images, found ${loaded.size - 40}`);

console.log("Validated lazy piece loading: 40 initial images, selected sets on demand.");
