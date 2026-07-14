export const SKINS = [
  { id: "classic", name: "CLASSIC" },
  { id: "bear", name: "BEAR" },
  { id: "rabbit", name: "RABBIT" },
  { id: "cat", name: "CAT" },
  { id: "wolf", name: "WOLF" },
  { id: "sheep", name: "SHEEP" },
  { id: "eagle", name: "EAGLE" },
  { id: "owl", name: "OWL" },
  { id: "capybara", name: "CAPYBARA" },
];

export const PIECE_SYMBOL = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const ICON_TYPE = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

export function createPieceView(scene, x, y, size, skinId, color, type, facing = "front") {
  const container = scene.add.container(x, y);
  container.setSize(size, size);
  const iconMode = skinId === "icon";
  const key = iconMode
    ? `kuma_ui_icon_${ICON_TYPE[type]}_${color}`
    : `kuma_piece_${skinId}_${color}_${type}_${facing}`;

  let piece;
  if (scene.textures.exists(key)) {
    piece = scene.add.image(0, iconMode ? 0 : size * 0.02, key).setOrigin(0.5);
    if (iconMode) piece.setDisplaySize(size * 0.92, size * 0.92);
    else piece.setDisplaySize(size * 0.9, size * 1.34);
  } else {
    piece = scene.add.text(0, 0, PIECE_SYMBOL[color][type], {
      fontFamily: '"Noto Serif KR", "Noto Serif", Georgia, serif',
      fontSize: `${Math.floor(size * 0.9)}px`,
      color: color === "w" ? "#fff8e7" : "#30261c",
      stroke: color === "w" ? "#8d6d43" : "#d6ae68",
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  const outline = scene.add.graphics();
  const cellSize = size / 1.02;
  outline.fillStyle(0xf4c65d, 0.28);
  outline.fillRoundedRect(-cellSize / 2 + 5, -cellSize / 2 + 5, cellSize - 10, cellSize - 10, 8);
  outline.lineStyle(4, 0xf0a44a, 0.68);
  outline.strokeRoundedRect(-cellSize / 2 + 7, -cellSize / 2 + 7, cellSize - 14, cellSize - 14, 7);
  outline.setVisible(false);
  container.add([outline, piece]);
  container._outline = outline;
  container._pieceImage = piece;
  container._facing = facing;
  return container;
}

export function alignBoardPieceView(view, size, skinId, facing) {
  const image = view?._pieceImage;
  if (!image || typeof image.setDisplaySize !== "function") return;

  if (skinId === "icon") {
    image.setPosition(0, 0);
    image.setDisplaySize(size * 0.92, size * 0.92);
    return;
  }

  image.setDisplaySize(size * 0.96, size * 1.43);
  image.setPosition(0, facing === "back" ? -size * 0.19 : -size * 0.33);
}

export function setSelectedOutline(pieceView, isSelected) {
  if (!pieceView) return;
  pieceView._outline?.setVisible(!!isSelected);
  pieceView.scaleX = 1;
  pieceView.scaleY = 1;
}
