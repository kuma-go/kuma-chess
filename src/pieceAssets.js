export const PIECE_SKINS = ["classic", "rabbit", "bear", "cat", "wolf", "sheep", "eagle", "owl", "capybara", "brownBear", "goldBear"];
export const PIECE_TYPES = ["p", "n", "b", "r", "q", "k"];
export const PIECE_FACINGS = ["front", "back"];
export const PIECE_ASSET_VERSION = "20260827-brown-black-1";

const ROOT = "assets/kuma/pieces/";

export function pieceTextureKey(skin, color, type, facing) {
  return `kuma_piece_v41_${skin}_${color}_${type}_${facing}`;
}

function queuePiece(scene, skin, color, type, facing) {
  const key = pieceTextureKey(skin, color, type, facing);
  if (scene.textures.exists(key)) return false;
  scene.load.image(key, `${ROOT}${skin}_${color}_${type}_${facing}.png?v=${PIECE_ASSET_VERSION}`);
  return true;
}

export function queueInitialPieceAssets(scene) {
  for (const color of ["w", "b"]) {
    for (const type of PIECE_TYPES) {
      for (const facing of PIECE_FACINGS) queuePiece(scene, "classic", color, type, facing);
    }
  }

  for (const skin of PIECE_SKINS) {
    if (skin === "classic") continue;
    for (const color of ["w", "b"]) queuePiece(scene, skin, color, "k", "front");
  }

  for (const type of PIECE_TYPES) {
    queuePiece(scene, "goldBear", "w", type, "front");
  }
}

export function ensurePieceSetsLoaded(scene, selections) {
  let queued = 0;
  const unique = new Map();
  for (const selection of selections) {
    const color = selection.color === "b" ? "b" : "w";
    const skin = PIECE_SKINS.includes(selection.skin) ? selection.skin : "classic";
    unique.set(`${skin}:${color}`, { skin, color });
  }

  for (const { skin, color } of unique.values()) {
    for (const type of PIECE_TYPES) {
      for (const facing of PIECE_FACINGS) {
        if (queuePiece(scene, skin, color, type, facing)) queued += 1;
      }
    }
  }

  if (queued === 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.load.once("complete", resolve);
    scene.load.start();
  });
}

export function ensurePieceAssetsLoaded(scene, selections) {
  let queued = 0;
  const unique = new Map();
  for (const selection of Array.isArray(selections) ? selections : []) {
    const color = selection?.color === "b" ? "b" : "w";
    const skin = PIECE_SKINS.includes(selection?.skin) ? selection.skin : "classic";
    const type = PIECE_TYPES.includes(selection?.type) ? selection.type : "k";
    const facing = PIECE_FACINGS.includes(selection?.facing) ? selection.facing : "front";
    unique.set(`${skin}:${color}:${type}:${facing}`, { skin, color, type, facing });
  }

  for (const selection of unique.values()) {
    if (queuePiece(scene, selection.skin, selection.color, selection.type, selection.facing)) queued += 1;
  }

  if (queued === 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.load.once("complete", resolve);
    scene.load.start();
  });
}
