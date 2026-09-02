import { Boot } from "./scenes/Boot.js?v=20260903-online93";
import { Start } from "./scenes/Start.js?v=20260903-online93";
import { PieceSelect } from "./scenes/PieceSelect.js?v=20260903-online93";
import { PieceSelectAI } from "./scenes/PieceSelectAI.js?v=20260903-online93";
import { Game } from "./scenes/Game.js?v=20260903-online93";
import { Result } from "./scenes/Result.js?v=20260903-online93";
import { OnlineGame } from "./scenes/OnlineGame.js?v=20260903-online93";
import { PuzzleSelect } from "./scenes/PuzzleSelect.js?v=20260903-online93";
import { Puzzle } from "./scenes/Puzzle.js?v=20260903-online93";
import { MedalCatalog } from "./scenes/MedalCatalog.js?v=20260903-online93";
import { KingdomTug } from "./scenes/KingdomTug.js?v=20260903-online93";
import { RoyalRoad } from "./scenes/RoyalRoad.js?v=20260903-online93";
import { RoyalRoadPuzzleSelect } from "./scenes/RoyalRoadPuzzleSelect.js?v=20260903-online93";
import { RoyalRoadPuzzle } from "./scenes/RoyalRoadPuzzle.js?v=20260903-online93";
import { CrownClash } from "./scenes/CrownClash.js?v=20260903-online93";
import { KingdomSiege } from "./scenes/KingdomSiege.js?v=20260903-online93";
import { Demo } from "./scenes/Demo.js?v=20260903-online93";
import { installFeedbackUnlock } from "./feedback.js?v=20260903-online93";
import {
  installMenuBgm,
  installMenuBgmSceneHooks,
} from "./menuBgm.js?v=20260903-online93";

const isEmbedded = window.parent !== window;
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 720,
  height: 1280,
  transparent: isEmbedded,
  backgroundColor: "#fff8ea",
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
  scene: [Boot, Start, PieceSelect, PieceSelectAI, PuzzleSelect, Puzzle, RoyalRoadPuzzleSelect, RoyalRoadPuzzle, Game, OnlineGame, Result, MedalCatalog, KingdomTug, RoyalRoad, CrownClash, KingdomSiege, Demo],
};

installFeedbackUnlock();
if (!isEmbedded) installMenuBgm();

const game = new Phaser.Game(config);
if (!isEmbedded) installMenuBgmSceneHooks(game);
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

const initialParams = new URLSearchParams(window.location.search);
let launch = initialParams.get("launch") || "";
let launchMode = initialParams.get("mode") || "";
let hostSession = initialParams.get("hostSession") || "";
let launchPayload = null;
const directLaunchScenes = {
  ai: "PieceSelectAI",
  pvp: "PieceSelect",
  puzzle: "PuzzleSelect",
  "road-puzzle": "RoyalRoadPuzzleSelect",
  medals: "MedalCatalog",
  "online-game": "OnlineGame",
};
let parentReadySent = false;

function stopActiveScenes() {
  for (const scene of game.scene.getScenes(true)) {
    game.scene.stop(scene.sys.settings.key);
  }
}

function startEmbeddedLaunch(nextLaunch, nextMode = "", nextHostSession = "", nextPayload = null) {
  if (!isEmbedded) return;
  launch = nextLaunch || "";
  launchMode = ["ai", "pvp"].includes(nextMode) ? nextMode : "";
  hostSession = nextHostSession || "";
  launchPayload = nextPayload && typeof nextPayload === "object" ? nextPayload : null;
  parentReadySent = false;
  stopActiveScenes();

  const miniGameScenes = {
    tug: "KingdomTug",
    road: "RoyalRoad",
    crown: "CrownClash",
    siege: "KingdomSiege",
  };
  if (launch === "ai" || launch === "pvp") {
    game.registry.set("pieceSelectTargetScene", "Game");
    game.registry.set("gameMode", launch);
    game.scene.start(launch === "ai" ? "PieceSelectAI" : "PieceSelect");
    return;
  }
  if (launch === "puzzle") {
    game.scene.start("PuzzleSelect");
    return;
  }
  if (launch === "road-puzzle") {
    game.scene.start("RoyalRoadPuzzleSelect");
    return;
  }
  if (launch === "medals") {
    game.scene.start("MedalCatalog");
    return;
  }
  if (launch === "online-game" && launchPayload?.room && launchPayload?.code) {
    game.scene.start("OnlineGame", launchPayload);
    return;
  }
  if (miniGameScenes[launch] && launchMode) {
    game.registry.set("pieceSelectTargetScene", miniGameScenes[launch]);
    game.registry.set("gameMode", launchMode);
    game.scene.start(launchMode === "ai" ? "PieceSelectAI" : "PieceSelect");
    return;
  }
  game.scene.start("Start", {
    embeddedLaunch: launch || "preload",
    embeddedIdle: !launch || launch === "preload",
  });
}

function suspendEmbeddedRuntime() {
  if (!isEmbedded) return;
  launch = "preload";
  launchMode = "";
  hostSession = "";
  launchPayload = null;
  parentReadySent = true;
  stopActiveScenes();
  game.scene.start("Start", { embeddedLaunch: "preload", embeddedIdle: true });
}

function returnToWebHome() {
  if (!isEmbedded) return false;
  const returningSession = hostSession;
  launch = "preload";
  launchMode = "";
  hostSession = "";
  launchPayload = null;
  parentReadySent = true;
  try {
    if (window.parent.KumaWebHomeHost?.returnHome) {
      window.parent.KumaWebHomeHost.returnHome({ hostSession: returningSession });
      return true;
    }
  } catch (_error) {
    // Cross-origin embeds use the message fallback below.
  }
  window.parent.postMessage({
    type: "kuma-game-home",
    hostSession: returningSession,
  }, window.location.origin);
  return true;
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !isEmbedded || launch === "preload") return;
  event.preventDefault();
  returnToWebHome();
});

window.KumaEmbeddedRuntime = {
  isEmbedded,
  returnHome: returnToWebHome,
  getLaunch: () => launch,
  getMode: () => launchMode,
  getHostSession: () => hostSession,
  getPayload: () => launchPayload,
};

if (isEmbedded) {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type === "kuma-game-launch") {
      startEmbeddedLaunch(event.data.launch, event.data.mode, event.data.hostSession, event.data.payload);
    } else if (event.data?.type === "kuma-game-suspend") {
      suspendEmbeddedRuntime();
    }
  });
}

function notifyParentWhenReady() {
  if (parentReadySent || window.parent === window) return;
  const isDirectMiniGame = ["tug", "road", "crown", "siege"].includes(launch)
    && ["ai", "pvp"].includes(launchMode);
  const expectedScene = isDirectMiniGame
    ? launchMode === "ai" ? "PieceSelectAI" : "PieceSelect"
    : directLaunchScenes[launch] || "Start";
  if (!game.scene.isActive(expectedScene)) return;
  if (!isDirectMiniGame && ["tug", "road", "crown", "siege"].includes(launch)) {
    const startScene = game.scene.getScene("Start");
    if (!startScene?.miniGameModeLayer) return;
  }
  if (launch === "info") {
    const startScene = game.scene.getScene("Start");
    if (!startScene?.playInfoLayer) return;
  }
  if (launch === "settings") {
    const startScene = game.scene.getScene("Start");
    if (!startScene?.settingsLayer) return;
  }
  if (launch === "daily") {
    const startScene = game.scene.getScene("Start");
    if (!startScene?.dailyMissionPopup) return;
  }
  parentReadySent = true;
  window.parent.postMessage({ type: "kuma-game-ready", launch, hostSession }, window.location.origin);
}

game.events.on(Phaser.Core.Events.POST_STEP, notifyParentWhenReady);
