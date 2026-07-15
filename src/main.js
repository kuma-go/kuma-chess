import { Boot } from "./scenes/Boot.js?v=20260715-domain04";
import { Start } from "./scenes/Start.js?v=20260715-domain04";
import { PieceSelect } from "./scenes/PieceSelect.js?v=20260715-domain04";
import { PieceSelectAI } from "./scenes/PieceSelectAI.js?v=20260715-domain04";
import { Game } from "./scenes/Game.js?v=20260715-domain04";
import { Result } from "./scenes/Result.js?v=20260715-domain04";
import { PuzzleSelect } from "./scenes/PuzzleSelect.js?v=20260715-domain04";
import { Puzzle } from "./scenes/Puzzle.js?v=20260715-domain04";

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 720,
  height: 1280,
  backgroundColor: "#000000",
  render: { pixelArt: false, antialias: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  input: {
    // iOS/맥 트랙패드에서 pointerup 누락 방지(가능한 경우)
    activePointers: 3,
  },
  scene: [Boot, Start, PieceSelect, PieceSelectAI, PuzzleSelect, Puzzle, Game, Result],
};

new Phaser.Game(config);
