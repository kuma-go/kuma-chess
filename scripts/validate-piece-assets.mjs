import { ensurePieceSetsLoaded, queueInitialPieceAssets } from "../src/pieceAssets.js";
import fs from "node:fs";

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
assert(loaded.size === 49, `initial load should contain 49 piece previews, found ${loaded.size}`);

for (const skin of ["goldBear", "brownBear"]) {
  for (const color of ["w", "b"]) {
    for (const type of ["p", "n", "b", "r", "q", "k"]) {
      for (const facing of ["front", "back"]) {
        const asset = new URL(`../assets/kuma/pieces/${skin}_${color}_${type}_${facing}.png`, import.meta.url);
        assert(fs.existsSync(asset), `Missing special piece asset ${skin}_${color}_${type}_${facing}.png`);
      }
    }
  }
}

await ensurePieceSetsLoaded(scene, [
  { skin: "bear", color: "w" },
  { skin: "cat", color: "b" },
  { skin: "goldBear", color: "w" },
  { skin: "brownBear", color: "b" },
]);
assert(loaded.size === 88, `four selected sets should add 39 missing images, found ${loaded.size - 49}`);

console.log("Validated lazy piece loading: 49 initial images, selected sets and special bear assets on demand.");
