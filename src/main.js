import { Boot } from "./scenes/Boot.js?v=20260716-mobile26";
import { Start } from "./scenes/Start.js?v=20260716-mobile26";
import { PieceSelect } from "./scenes/PieceSelect.js?v=20260716-mobile26";
import { PieceSelectAI } from "./scenes/PieceSelectAI.js?v=20260716-mobile26";
import { Game } from "./scenes/Game.js?v=20260716-mobile26";
import { Result } from "./scenes/Result.js?v=20260716-mobile26";
import { PuzzleSelect } from "./scenes/PuzzleSelect.js?v=20260716-mobile26";
import { Puzzle } from "./scenes/Puzzle.js?v=20260716-mobile26";
import { installFeedbackUnlock } from "./feedback.js?v=20260716-mobile26";
import { installMenuBgm, installMenuBgmSceneHooks } from "./menuBgm.js?v=20260716-mobile26";

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
    autoRound: true,
    expandParent: false,
    width: 720,
    height: 1280,
  },
  input: {
    // iOS/맥 트랙패드에서 pointerup 누락 방지(가능한 경우)
    activePointers: 3,
  },
  scene: [Boot, Start, PieceSelect, PieceSelectAI, PuzzleSelect, Puzzle, Game, Result],
};

installFeedbackUnlock();
installMenuBgm();

const game = new Phaser.Game(config);
installMenuBgmSceneHooks(game);
const parent = document.getElementById("game-container");
let refreshFrame = 0;
let refreshTimer = 0;

function refreshGameScale() {
  cancelAnimationFrame(refreshFrame);
  window.clearTimeout(refreshTimer);
  refreshFrame = requestAnimationFrame(() => {
    if (!game.scale || !parent?.isConnected) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  });
  refreshTimer = window.setTimeout(() => {
    if (!game.scale || !parent?.isConnected) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  }, 240);
}

window.addEventListener("kuma-viewport-changed", refreshGameScale);
window.addEventListener("orientationchange", refreshGameScale, { passive: true });
window.visualViewport?.addEventListener("resize", refreshGameScale, { passive: true });

if (parent && typeof ResizeObserver === "function") {
  const observer = new ResizeObserver(refreshGameScale);
  observer.observe(parent);
}

window.kumaChessGame = game;
