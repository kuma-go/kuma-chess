import { PIECE_ASSET_VERSION, ensurePieceAssetsLoaded, ensurePieceSetsLoaded, queueInitialPieceAssets } from "../src/pieceAssets.js";
import crypto from "node:crypto";
import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const loaded = new Set();
const assetUrls = new Map();
let complete = null;
const scene = {
  textures: { exists: (key) => loaded.has(key) },
  load: {
    image(key, url) {
      loaded.add(key);
      assetUrls.set(key, url);
    },
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
assert([...loaded].every((key) => key.startsWith("kuma_piece_v41_")), "Piece textures must use versioned Phaser keys");
assert([...assetUrls.values()].every((url) => url.endsWith(`?v=${PIECE_ASSET_VERSION}`)), "Piece URLs must bypass stale browser image caches");

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

for (const type of ["p", "n", "b", "r", "q", "k"]) {
  for (const facing of ["front", "back"]) {
    const whiteAsset = new URL(`../assets/kuma/pieces/brownBear_w_${type}_${facing}.png`, import.meta.url);
    const blackAsset = new URL(`../assets/kuma/pieces/brownBear_b_${type}_${facing}.png`, import.meta.url);
    const digest = (asset) => crypto.createHash("sha256").update(fs.readFileSync(asset)).digest("hex");
    assert(
      digest(whiteAsset) !== digest(blackAsset),
      `Black brown-bear ${type} ${facing} must use its distinct dark-crown artwork.`,
    );
  }
}

await ensurePieceSetsLoaded(scene, [
  { skin: "bear", color: "w" },
  { skin: "cat", color: "b" },
  { skin: "goldBear", color: "w" },
  { skin: "brownBear", color: "b" },
]);
assert(loaded.size === 88, `four selected sets should add 39 missing images, found ${loaded.size - 49}`);

const beforeSingleAsset = loaded.size;
await ensurePieceAssetsLoaded(scene, [
  { skin: "brownBear", color: "b", type: "q", facing: "front" },
  { skin: "brownBear", color: "b", type: "q", facing: "front" },
  { skin: "goldBear", color: "b", type: "n", facing: "back" },
]);
assert(loaded.size === beforeSingleAsset + 1, "single-piece loading must deduplicate and load only missing notice art");

console.log("Validated lazy piece loading, special bear assets, and distinct black brown-bear artwork.");
