import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260902-online92";
import { createPieceView } from "../pieceStyles.js?v=20260902-online92";
import { playFeedback, vibrateFeedback } from "../feedback.js?v=20260902-online92";
import { t } from "../i18n.js?v=20260902-online92";
import { recordMiniGameCompletion } from "../medals.js?v=20260902-online92";
import { recordDailyMiniGameCompletion } from "../dailyMissions.js?v=20260902-online92";
import {
  advanceRoadKing,
  applyRoadClockEffect,
  beginNextRoadInterval,
  cloneRoadSide,
  createRoadClock,
  createRoadSide,
  getRoadPlacement,
  placeRoadTile,
  ROAD_COLS,
  ROAD_ROWS,
  ROAD_TILE_BAG,
  ROAD_TILE_DEFS,
  roadGoalRow,
  roadKingCell,
  roadRemainingTiles,
  roadVisualTileId,
  roadWinner,
} from "../royalRoadLogic.js?v=20260902-online92";
import {
  addDarkTopBar,
  addScreenBg,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260902-online92";

const BOARD_TOP = 350;
const BOARD_VIEW_HEIGHT = 672;
const CELL_SIZE = 80;
const LANE_WIDTH = CELL_SIZE * ROAD_COLS;
const LANE_GAP = 114;
const TRACK_HEIGHT = CELL_SIZE * ROAD_ROWS;
const MAX_SCROLL = TRACK_HEIGHT - BOARD_VIEW_HEIGHT;
const TILE_HEIGHT = CELL_SIZE * (124 / 120);
const FRAME_SCALE = CELL_SIZE / 120;
const FRAME_RAIL_WIDTH = 56 * FRAME_SCALE;
const FRAME_RAIL_HEIGHT = 1068 * FRAME_SCALE;
const FRAME_TOP_HEIGHT = 43 * FRAME_SCALE;
const FRAME_BOTTOM_HEIGHT = 46 * FRAME_SCALE;
const FRAME_TOP_CAP_INSET = 7;
const FRAME_BOTTOM_CAP_INSET = 10;
const INITIAL_ROAD_DISTANCE = ROAD_ROWS - 2;
const MAX_CYCLES_PER_SIDE = 60;
const TIMER_RENDER_STEP_MS = 80;
const AI_SELECT_RATIO = Object.freeze({ easy: 0.38, normal: 0.58, hard: 0.78 });
const TILE_TEXTURES = Object.freeze(Object.fromEntries(
  Object.entries(ROAD_TILE_DEFS).map(([id, def]) => [id, `kuma_ui_${def.texture}`])
));

function sideName(color) {
  return color === "b" ? t("side.b") : t("side.w");
}

function otherColor(color) {
  return color === "w" ? "b" : "w";
}

function makeSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSeconds(milliseconds) {
  const seconds = milliseconds / 1000;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function splitCountdown(milliseconds) {
  const remaining = Math.max(0, milliseconds);
  const seconds = Math.floor(remaining / 1000);
  const centiseconds = Math.floor((remaining % 1000) / 10);
  return {
    seconds: String(seconds),
    fraction: `.${String(centiseconds).padStart(2, "0")}`,
  };
}

export class RoyalRoad extends Phaser.Scene {
  constructor() {
    super("RoyalRoad");
    this.sides = null;
    this.queues = { w: [], b: [] };
    this.clocks = null;
    this.forcedTargets = { w: null, b: null };
    this.resolvedCycles = { w: 0, b: 0 };
    this.boardScroll = { w: MAX_SCROLL, b: 0 };
    this.controlRoots = [];
    this.statTexts = {};
    this.kingViews = {};
    this.sideEventLayers = { w: null, b: null };
    this.inputLocked = true;
    this.gameOver = false;
    this.scrollDrag = null;
    this.lastTimerRenderAt = 0;
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this, "bg_select");
    this.add.rectangle(0, 0, width, height, 0xfff8ea, 0.82).setOrigin(0).setDepth(-80);
    addDarkTopBar(this, "Kuma Chess", { onHome: () => {
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    } });

    this.mode = this.registry.get("gameMode") === "ai" ? "ai" : "pvp";
    this.playerColor = this.registry.get("playerColor") === "b" ? "b" : "w";
    this.aiDifficulty = this.registry.get("aiDifficulty") || "normal";
    const savedSkins = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skins = { w: savedSkins.w || "classic", b: savedSkins.b || "classic" };
    this.gameSessionId = makeSessionId();

    const titleY = 144;
    const title = this.add.text(width / 2, titleY, t("road.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "29px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(300);
    const helpX = Math.min(width - 36, width / 2 + title.width / 2 + 28);
    const helpRoot = this.add.container(helpX, titleY).setDepth(301);
    const helpCircle = this.add.circle(0, 0, 16, 0xfff7e7, 1)
      .setStrokeStyle(2, 0xb8893d, 1);
    const helpMark = this.add.text(0, -1, "?", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5);
    const helpHit = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
    helpHit.on("pointerdown", () => helpRoot.setScale(0.94));
    helpHit.on("pointerout", () => helpRoot.setScale(1));
    helpHit.on("pointerup", () => {
      helpRoot.setScale(1);
      playFeedback("move");
      this.showEvent(t("road.guideComingSoon"));
    });
    helpRoot.add([helpCircle, helpMark, helpHit]);

    this.loadingText = this.add.text(width / 2, height / 2, "LOADING...", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(500);

    ensurePieceSetsLoaded(this, [
      { skin: this.skins.w, color: "w" },
      { skin: this.skins.b, color: "b" },
    ]).then(() => {
      if (!this.scene.isActive()) return;
      this.loadingText?.destroy();
      this.startMatch();
    }).catch(() => {
      if (!this.scene.isActive()) return;
      this.loadingText?.destroy();
      showRewardLine(this, t("select.loadFailed"), { tone: "failure", showCoin: false });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controlRoots.forEach((root) => root.destroy(true));
      this.boardRoot?.destroy(true);
      this.boardMaskShape?.destroy();
      this.decorRoot?.destroy(true);
      this.sideEventLayers.w?.destroy(true);
      this.sideEventLayers.b?.destroy(true);
      this.kingViews = {};
    });
  }

  startMatch() {
    this.sides = { w: createRoadSide("w"), b: createRoadSide("b") };
    this.queues = {
      w: [this.randomTile(), this.randomTile()],
      b: [this.randomTile(), this.randomTile()],
    };
    this.clocks = { w: createRoadClock(), b: createRoadClock() };
    this.forcedTargets = { w: null, b: null };
    this.resolvedCycles = { w: 0, b: 0 };
    this.boardScroll = {
      w: this.isFromBottom("w") ? MAX_SCROLL : 0,
      b: this.isFromBottom("b") ? MAX_SCROLL : 0,
    };
    this.inputLocked = false;
    this.gameOver = false;
    this.normalizeQueuePreview("w");
    this.normalizeQueuePreview("b");
    this.createBoard();
    this.createDecor();
    this.renderAll(false);
  }

  update(time, delta) {
    if (!this.clocks || this.inputLocked || this.gameOver) return;
    const expired = [];
    for (const color of ["w", "b"]) {
      const clock = this.clocks[color];
      clock.remainingMs = Math.max(0, clock.remainingMs - delta);
      this.maybeSelectAiTarget(color);
      if (clock.remainingMs <= 0) expired.push(color);
    }
    if (time - this.lastTimerRenderAt >= TIMER_RENDER_STEP_MS) {
      this.lastTimerRenderAt = time;
      this.updateTimerVisuals();
    }
    if (!expired.length) return;

    let boardChanged = false;
    let kingsChanged = false;
    for (const color of expired) {
      const outcome = this.resolveInterval(color);
      boardChanged ||= outcome.boardChanged;
      kingsChanged ||= outcome.kingMoved;
    }
    if (boardChanged) this.renderBoard();
    if (kingsChanged) this.renderKings(true);
    this.renderControls();
    this.updateTimerVisuals();

    const winner = roadWinner(this.sides);
    if (winner) {
      this.finishMatch(winner === "draw" ? null : winner, "roadComplete");
      return;
    }
    if (["w", "b"].every((color) => this.resolvedCycles[color] >= MAX_CYCLES_PER_SIDE)) {
      this.finishMatch(null, "roadDraw");
    }
  }

  randomTile() {
    return Phaser.Utils.Array.GetRandom(ROAD_TILE_BAG) || "straight";
  }

  forcedResumeFor(tileId) {
    if (tileId === "left") return "resumeLeft";
    if (tileId === "right") return "resumeRight";
    return null;
  }

  normalizeQueuePreview(ownerColor) {
    const queue = this.queues[ownerColor];
    while (queue.length < 2) queue.push(this.randomTile());
    queue.length = 2;
    const forcedTarget = this.forcedTargets[ownerColor];
    if (forcedTarget) {
      queue[0] = this.sides[forcedTarget].lateral < 0 ? "resumeLeft" : "resumeRight";
    } else if (queue[0] === "resumeLeft" || queue[0] === "resumeRight") {
      queue[0] = this.randomNonResumeTile();
    }
    const forcedNext = this.forcedResumeFor(queue[0]);
    if (forcedNext) queue[1] = forcedNext;
    else if (queue[1] === "resumeLeft" || queue[1] === "resumeRight") queue[1] = this.randomNonResumeTile();
  }

  randomNonResumeTile() {
    let tileId = this.randomTile();
    while (tileId === "resumeLeft" || tileId === "resumeRight") tileId = this.randomTile();
    return tileId;
  }

  createBoard() {
    this.boardRoot?.destroy(true);
    this.boardMaskShape?.destroy();
    this.boardRoot = this.add.container(this.scale.width / 2, BOARD_TOP).setDepth(20);
    this.boardMaskShape = this.make.graphics({ x: 0, y: 0, add: false });
    this.boardMaskShape.fillStyle(0xffffff, 1);
    this.boardMaskShape.fillRect(28, BOARD_TOP, this.scale.width - 56, BOARD_VIEW_HEIGHT);
    this.boardMask = this.boardMaskShape.createGeometryMask();

    this.boardStatic = this.add.container(0, 0);
    this.boardRoot.add(this.boardStatic);
    this.drawBoardFrames();
    this.drawBoardFrameCaps();
    this.kingViews = {};
    this.kingLayer = this.add.container(0, 0);
    this.boardRoot.add(this.kingLayer);

    for (const color of ["w", "b"]) {
      const zone = this.add.zone(
        this.laneLeft(color) + LANE_WIDTH / 2,
        BOARD_VIEW_HEIGHT / 2,
        LANE_WIDTH,
        BOARD_VIEW_HEIGHT
      ).setInteractive({ useHandCursor: true });
      zone._roadColor = color;
      zone.on("pointerdown", (pointer) => this.beginScroll(pointer, color));
      zone.on("pointermove", (pointer) => this.updateScroll(pointer));
      zone.on("pointerup", () => this.endScroll());
      zone.on("pointerout", () => this.endScroll());
      this.boardRoot.add(zone);
    }
    this.input.on("pointerup", () => this.endScroll());
  }

  drawBoardFrames() {
    const g = this.add.graphics();
    this.boardStatic.add(g);
    this.frameRails = this.add.container(0, 0).setDepth(70);
    this.boardRoot.add(this.frameRails);
    for (const color of ["w", "b"]) {
      const left = this.laneLeft(color);
      g.fillStyle(0xefdfc2, 1);
      g.fillRect(left, FRAME_TOP_CAP_INSET - FRAME_TOP_HEIGHT, LANE_WIDTH, FRAME_TOP_HEIGHT);
      g.fillRect(left, BOARD_VIEW_HEIGHT - FRAME_BOTTOM_CAP_INSET, LANE_WIDTH, FRAME_BOTTOM_HEIGHT);
      const leftRail = this.add.image(left - FRAME_RAIL_WIDTH / 2, BOARD_VIEW_HEIGHT / 2, "kuma_ui_chess_board_left")
        .setDisplaySize(FRAME_RAIL_WIDTH, FRAME_RAIL_HEIGHT);
      const rightRail = this.add.image(left + LANE_WIDTH + FRAME_RAIL_WIDTH / 2, BOARD_VIEW_HEIGHT / 2, "kuma_ui_chess_board_right")
        .setDisplaySize(FRAME_RAIL_WIDTH, FRAME_RAIL_HEIGHT);
      this.frameRails.add([leftRail, rightRail]);
    }
  }

  drawBoardFrameCaps() {
    const caps = this.add.container(0, 0).setDepth(65);
    this.frameCaps = caps;
    for (const color of ["w", "b"]) {
      const centerX = this.laneLeft(color) + LANE_WIDTH / 2;
      const top = this.add.image(centerX, FRAME_TOP_CAP_INSET, "kuma_ui_chess_board_center_top_shot")
        .setOrigin(0.5, 1)
        .setDisplaySize(LANE_WIDTH, FRAME_TOP_HEIGHT);
      const bottom = this.add.image(centerX, BOARD_VIEW_HEIGHT - FRAME_BOTTOM_CAP_INSET, "kuma_ui_chess_board_center_bottom_shot")
        .setOrigin(0.5, 0)
        .setDisplaySize(LANE_WIDTH, FRAME_BOTTOM_HEIGHT);
      caps.add([top, bottom]);
    }
    this.boardRoot.add(caps);
  }

  syncBoardLayerOrder() {
    const layers = [
      this.boardStatic,
      this.dynamicBoard,
      this.endpointLayer,
      this.kingLayer,
      this.frameCaps,
      this.frameRails,
      this.progressRoot,
    ].filter(Boolean);
    for (const layer of layers) {
      if (this.boardRoot.list.includes(layer)) this.boardRoot.remove(layer, false);
    }
    this.boardRoot.add(layers);
  }

  createDecor() {
    this.decorRoot?.destroy(true);
    this.decorRoot = this.add.container(0, 0).setDepth(140);
    this.statTexts = {};
    for (const color of ["w", "b"]) {
      const bottom = this.isFromBottom(color);
      const centerX = this.scale.width / 2 + this.laneLeft(color) + LANE_WIDTH / 2;
      const castleY = bottom ? 255 : 1112;
      const castle = this.add.image(centerX, castleY, "kuma_ui_img_castle")
        .setDisplaySize(136, 127)
        .setAngle(bottom ? 0 : 180);
      const stats = this.add.text(
        centerX + (bottom ? -116 : 116),
        bottom ? 184 : 1194,
        "",
        {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "16px",
          lineSpacing: 4,
          color: KUMA_COLORS.ink,
          fontStyle: "600",
          align: "left",
        }
      ).setOrigin(0.5).setAngle(bottom ? 0 : 180);
      this.statTexts[color] = stats;
      this.decorRoot.add([castle, stats]);
    }
  }

  laneSlot(color) {
    if (this.isAIMode()) return color === this.playerColor ? 0 : 1;
    return color === "w" ? 0 : 1;
  }

  laneLeft(color) {
    return this.laneSlot(color) === 0 ? -LANE_GAP / 2 - LANE_WIDTH : LANE_GAP / 2;
  }

  isFromBottom(color) {
    if (this.isAIMode()) return color === this.playerColor;
    return color === "w";
  }

  visualTileId(tileId, color) {
    return roadVisualTileId(tileId, this.isFromBottom(color));
  }

  displayRow(color, row) {
    return this.isAIMode() && this.playerColor === "b" ? ROAD_ROWS - 1 - row : row;
  }

  cellCenter(color, row, col) {
    return {
      x: this.laneLeft(color) + col * CELL_SIZE + CELL_SIZE / 2,
      y: this.displayRow(color, row) * CELL_SIZE + CELL_SIZE / 2 - this.boardScroll[color],
    };
  }

  isCellVisible(color, row) {
    const y = this.cellCenter(color, row, 1).y;
    return y + TILE_HEIGHT / 2 > 0 && y - TILE_HEIGHT / 2 < BOARD_VIEW_HEIGHT;
  }

  renderAll(animateKings = false) {
    if (!this.sides) return;
    this.renderBoard();
    this.renderKings(animateKings);
    this.renderControls();
    this.updateTimerVisuals();
  }

  renderBoard() {
    this.dynamicBoard?.destroy(true);
    this.dynamicBoard = this.add.container(0, 0).setMask(this.boardMask).setDepth(10);
    this.boardRoot.add(this.dynamicBoard);

    for (const color of ["w", "b"]) {
      const left = this.laneLeft(color);
      for (let row = 0; row < ROAD_ROWS; row += 1) {
        const displayRow = this.displayRow(color, row);
        const y = displayRow * CELL_SIZE - this.boardScroll[color];
        if (y >= BOARD_VIEW_HEIGHT || y + CELL_SIZE <= 0) continue;
        for (let col = 0; col < ROAD_COLS; col += 1) {
          const key = (row + col) % 2 === 0
            ? "kuma_ui_chess_board_cube_white"
            : "kuma_ui_chess_board_cube_black";
          const cell = this.add.image(left + col * CELL_SIZE, y, key)
            .setOrigin(0)
            .setDisplaySize(CELL_SIZE, CELL_SIZE)
            .setAlpha(0.9);
          this.dynamicBoard.add(cell);
        }
      }
      this.drawRoute(color);
    }
    this.renderProgress();
    this.renderEndpointLayer();
    this.syncBoardLayerOrder();
  }

  drawRoute(color) {
    const rotation = this.isFromBottom(color) ? 0 : 180;
    for (const tile of this.sides[color].route) {
      if (!this.isCellVisible(color, tile.row)) continue;
      const { x, y } = this.cellCenter(color, tile.row, tile.col);
      const visualType = tile.type === "start" ? "straight" : this.visualTileId(tile.type, color);
      const texture = TILE_TEXTURES[visualType];
      const image = this.add.image(x, y, texture)
        .setDisplaySize(CELL_SIZE, TILE_HEIGHT)
        .setAngle(rotation);
      this.dynamicBoard.add(image);
    }
  }

  renderProgress() {
    this.progressRoot?.destroy(true);
    this.progressRoot = this.add.container(0, 0).setDepth(90);
    const top = 22;
    const bottom = BOARD_VIEW_HEIGHT - 22;
    const height = bottom - top;

    for (const color of ["w", "b"]) {
      const rightForPlayer = this.laneSlot(color) === 0
        ? this.laneLeft(color) + LANE_WIDTH + 20
        : this.laneLeft(color) - 20;
      const remaining = roadRemainingTiles(this.sides[color]);
      const progress = Phaser.Math.Clamp((INITIAL_ROAD_DISTANCE - remaining) / INITIAL_ROAD_DISTANCE, 0, 1);
      const fromBottom = this.isFromBottom(color);
      const crownY = fromBottom ? bottom - height * progress : top + height * progress;
      const fillTop = fromBottom ? crownY : top;
      const fillHeight = fromBottom ? bottom - crownY : crownY - top;
      const fillColor = color === "w" ? 0x08a7c4 : 0xd34f49;
      const track = this.add.graphics();
      track.fillStyle(0x373735, 0.94);
      track.fillRoundedRect(rightForPlayer - 7, top, 14, height, 7);
      track.lineStyle(2, 0xe0ba70, 0.88);
      track.strokeRoundedRect(rightForPlayer - 7, top, 14, height, 7);
      if (fillHeight > 1) {
        track.fillStyle(fillColor, 1);
        track.fillRoundedRect(rightForPlayer - 4, fillTop, 8, fillHeight, 4);
      }
      const crown = this.add.image(rightForPlayer, crownY, "kuma_ui_icon_king_crown")
        .setDisplaySize(44, 44)
        .setAngle(fromBottom ? 0 : 180);
      this.progressRoot.add([track, crown]);
    }
    this.boardRoot.add(this.progressRoot);
  }

  renderEndpointLayer() {
    this.endpointLayer?.destroy(true);
    this.endpointLayer = this.add.container(0, 0).setMask(this.boardMask).setDepth(75);
    this.boardRoot.add(this.endpointLayer);

    for (const targetColor of ["w", "b"]) {
      const side = this.sides[targetColor];
      if (side.endpoint.row < 0 || side.endpoint.row >= ROAD_ROWS || !this.isCellVisible(targetColor, side.endpoint.row)) continue;
      const owner = this.timerOwnerForTarget(targetColor);
      if (!owner) continue;
      const { x, y } = this.cellCenter(targetColor, side.endpoint.row, side.endpoint.col);
      const g = this.add.graphics();
      const valid = getRoadPlacement(side, this.queues[owner][0]).valid;
      const tone = valid ? 0xffc341 : 0xc94b3f;
      const reserved = this.clocks[owner].selectedTarget === targetColor;
      g.fillStyle(tone, reserved ? 0.18 : 0.1);
      g.fillRoundedRect(x - 37, y - 37, 74, 74, 5);
      g.lineStyle(reserved ? 5 : 3, tone, reserved ? 0.98 : 0.72);
      g.strokeRoundedRect(x - 38, y - 38, 76, 76, 6);
      this.endpointLayer.add(g);
      this.addSlotTimer(this.endpointLayer, owner, x, y);
    }
  }

  addSlotTimer(layer, ownerColor, x, y) {
    const root = this.add.container(x, y).setAngle(this.isFromBottom(ownerColor) ? 0 : 180);
    const clock = this.clocks[ownerColor];
    if (clock.skipCurrent) {
      const skip = this.add.text(0, 0, t("road.skipShort"), {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "17px",
        color: "#2d2116",
        fontStyle: "800",
        stroke: "#fff4d8",
        strokeThickness: 3,
      }).setOrigin(0.5);
      root.add(skip);
      layer.add(root);
      return;
    }

    const value = splitCountdown(clock.remainingMs);
    const whole = this.add.text(-9, 0, value.seconds, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "38px",
      color: "#2d2116",
      fontStyle: "800",
      align: "center",
      stroke: "#fff4d8",
      strokeThickness: 4,
    }).setFixedSize(34, 48).setOrigin(0.5);
    const fraction = this.add.text(11, 7, value.fraction, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "13px",
      color: "#5f4932",
      fontStyle: "800",
      stroke: "#fff4d8",
      strokeThickness: 2,
    }).setFixedSize(31, 18).setOrigin(0, 0.5);
    root.add([whole, fraction]);
    layer.add(root);
  }

  renderKings(animate) {
    for (const color of ["w", "b"]) {
      const cell = roadKingCell(this.sides[color]);
      const position = this.cellCenter(color, cell.row, cell.col);
      const visible = this.isCellVisible(color, cell.row);
      let view = this.kingViews[color];
      const yOffset = color === "w" ? -20 : 20;
      if (!view) {
        view = createPieceView(this, position.x, position.y + yOffset, 84, this.skins[color], color, "k", "back");
        view.setMask(this.boardMask);
        this.kingLayer.add(view);
        this.kingViews[color] = view;
      }
      view.setVisible(true).setAngle(this.isFromBottom(color) ? 0 : 180).setDepth(100 + position.y);
      this.tweens.killTweensOf(view);
      if (animate && visible) {
        this.tweens.add({
          targets: view,
          x: position.x,
          y: position.y + yOffset,
          duration: 360,
          ease: "Cubic.Out",
        });
      } else {
        view.setPosition(position.x, position.y + yOffset);
      }
    }
    this.syncBoardLayerOrder();
  }

  renderControls() {
    this.controlRoots.forEach((root) => root.destroy(true));
    this.controlRoots = [];
    if (this.gameOver) return;
    for (const color of ["w", "b"]) this.createControl(color);
  }

  createControl(ownerColor) {
    const bottom = this.isFromBottom(ownerColor);
    const centerX = this.scale.width / 2 + this.laneLeft(ownerColor) + LANE_WIDTH / 2;
    const root = this.add.container(centerX, bottom ? 1110 : 260)
      .setAngle(bottom ? 0 : 180)
      .setDepth(260);
    this.controlRoots.push(root);

    const isAiOwner = this.isAIMode() && ownerColor !== this.playerColor;
    const currentType = this.visualTileId(this.queues[ownerColor][0], ownerColor);
    const nextType = this.visualTileId(this.queues[ownerColor][1], ownerColor);
    const current = this.add.image(0, 0, TILE_TEXTURES[currentType])
      .setDisplaySize(80, TILE_HEIGHT);
    const next = this.add.image(0, 91, TILE_TEXTURES[nextType])
      .setDisplaySize(62, TILE_HEIGHT * 0.775)
      .setAlpha(0.46);
    root.add([current, next]);

    this.createTargetButton(root, ownerColor, ownerColor, -105, "kuma_ui_btn_arrow_up", isAiOwner);
    this.createTargetButton(root, ownerColor, otherColor(ownerColor), 105, "kuma_ui_btn_arrow_right", isAiOwner);
  }

  animateTileResolution(ownerColor, tileId, targetColor = null, tile = null) {
    const fromBottom = this.isFromBottom(ownerColor);
    const startX = this.scale.width / 2 + this.laneLeft(ownerColor) + LANE_WIDTH / 2;
    const startY = fromBottom ? 1110 : 260;
    const visualType = this.visualTileId(tileId, ownerColor);
    const image = this.add.image(startX, startY, TILE_TEXTURES[visualType])
      .setDisplaySize(80, TILE_HEIGHT)
      .setAngle(fromBottom ? 0 : 180)
      .setDepth(390);

    if (targetColor && tile) {
      const target = this.cellCenter(targetColor, tile.row, tile.col);
      const targetScaleX = image.scaleX * 0.86;
      const targetScaleY = image.scaleY * 0.86;
      this.tweens.add({
        targets: image,
        x: this.scale.width / 2 + target.x,
        y: BOARD_TOP + target.y,
        angle: this.isFromBottom(targetColor) ? 0 : 180,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        alpha: 0.28,
        duration: 460,
        ease: "Cubic.InOut",
        onComplete: () => image.destroy(),
      });
      return;
    }

    this.tweens.add({
      targets: image,
      y: startY + (fromBottom ? 30 : -30),
      scaleX: image.scaleX * 0.52,
      scaleY: image.scaleY * 0.52,
      alpha: 0,
      duration: 320,
      ease: "Back.In",
      onComplete: () => image.destroy(),
    });
  }

  createTargetButton(root, ownerColor, targetColor, x, texture, isAiOwner) {
    const clock = this.clocks[ownerColor];
    const tileId = this.queues[ownerColor][0];
    const forcedTarget = this.forcedTargets[ownerColor];
    const valid = getRoadPlacement(this.sides[targetColor], tileId).valid;
    const enabled = !isAiOwner && !clock.skipCurrent && valid && (!forcedTarget || forcedTarget === targetColor);
    const selected = clock.selectedTarget === targetColor;
    const glow = this.add.circle(x, 0, 40, selected ? 0xffc341 : 0xffffff, selected ? 0.32 : 0)
      .setStrokeStyle(selected ? 4 : 0, 0xffc341, selected ? 1 : 0);
    const image = this.add.image(x, 0, texture)
      .setDisplaySize(68, 68)
      .setAlpha(enabled || selected ? 1 : isAiOwner ? 0.68 : 0.36);
    const hit = this.add.zone(x, 0, 76, 76);
    if (enabled) {
      hit.setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => image.setDisplaySize(64, 64));
      hit.on("pointerout", () => image.setDisplaySize(68, 68));
      hit.on("pointerup", () => {
        image.setDisplaySize(68, 68);
        this.selectTarget(ownerColor, targetColor);
      });
    }
    root.add([glow, image, hit]);
  }

  selectTarget(ownerColor, targetColor) {
    if (this.inputLocked || this.gameOver || !this.clocks) return;
    if (this.isAIMode() && ownerColor !== this.playerColor) return;
    const forcedTarget = this.forcedTargets[ownerColor];
    const tileId = this.queues[ownerColor][0];
    if ((forcedTarget && forcedTarget !== targetColor) || !getRoadPlacement(this.sides[targetColor], tileId).valid) {
      this.showEvent(t("road.edgeBlocked"), "failure");
      vibrateFeedback([30, 25, 30]);
      return;
    }
    this.clocks[ownerColor].selectedTarget = targetColor;
    playFeedback("move");
    vibrateFeedback(18);
    this.renderControls();
    this.updateTimerVisuals();
  }

  resolveInterval(ownerColor) {
    const clock = this.clocks[ownerColor];
    const tileId = this.queues[ownerColor][0];
    const targetColor = clock.selectedTarget;
    let boardChanged = false;
    let kingMoved = false;
    this.resolvedCycles[ownerColor] += 1;

    if (clock.skipCurrent) {
      this.showSideEvent(ownerColor, t("road.trapSkipped", { side: sideName(ownerColor) }), "failure");
    } else if (!targetColor) {
      this.animateTileResolution(ownerColor, tileId);
      this.consumeQueue(ownerColor, { placed: false, tileId });
    } else {
      const result = placeRoadTile(this.sides[targetColor], tileId);
      if (result.valid) {
        boardChanged = true;
        this.consumeQueue(ownerColor, { placed: true, tileId, targetColor });
        const movement = advanceRoadKing(this.sides[targetColor]);
        kingMoved = movement.moved;
        if (movement.effect) {
          applyRoadClockEffect(this.clocks[targetColor], movement.effect);
          this.announceEffect(targetColor, movement.effect);
        }
        this.autoScroll(targetColor, roadKingCell(this.sides[targetColor]).row);
        this.animateTileResolution(ownerColor, tileId, targetColor, result.tile);
        playFeedback("move");
        vibrateFeedback(22);
      } else {
        this.animateTileResolution(ownerColor, tileId);
        this.consumeQueue(ownerColor, { placed: false, tileId });
        this.showEvent(t("road.edgeBlocked"), "failure");
      }
    }

    beginNextRoadInterval(clock);
    this.normalizeQueuePreview(ownerColor);
    return { boardChanged, kingMoved };
  }

  consumeQueue(ownerColor, { placed, tileId, targetColor = null }) {
    const queue = this.queues[ownerColor];
    queue.shift();
    if (placed && (tileId === "left" || tileId === "right")) {
      this.forcedTargets[ownerColor] = targetColor;
    } else if (placed && (tileId === "resumeLeft" || tileId === "resumeRight")) {
      this.forcedTargets[ownerColor] = null;
    }
    queue.push(this.randomTile());
    this.normalizeQueuePreview(ownerColor);
  }

  announceEffect(color, effect) {
    const tone = effect === "speed" ? "success" : "failure";
    this.showSideEvent(color, t(`road.effect.${effect}`, { side: sideName(color) }), tone);
    playFeedback(effect === "speed" ? "success" : "failure");
  }

  maybeSelectAiTarget(color) {
    if (!this.isAIMode() || color === this.playerColor || this.gameOver) return;
    const clock = this.clocks[color];
    if (clock.skipCurrent || clock.selectedTarget) return;
    const ratio = AI_SELECT_RATIO[this.aiDifficulty] || AI_SELECT_RATIO.normal;
    if (clock.remainingMs > clock.totalMs * ratio) return;
    const target = this.chooseAiTarget(color);
    if (!target) return;
    clock.selectedTarget = target;
    this.renderControls();
  }

  chooseAiTarget(aiColor) {
    const tileId = this.queues[aiColor][0];
    const forcedTarget = this.forcedTargets[aiColor];
    const candidates = (forcedTarget ? [forcedTarget] : [aiColor, otherColor(aiColor)])
      .filter((target) => getRoadPlacement(this.sides[target], tileId).valid);
    if (!candidates.length) return null;
    if (this.aiDifficulty === "easy") return Phaser.Utils.Array.GetRandom(candidates);
    const scored = candidates.map((target) => ({
      target,
      score: this.scoreAiPlacement(target, tileId, aiColor),
    })).sort((a, b) => b.score - a.score);
    if (this.aiDifficulty === "normal" && scored.length > 1 && Math.random() < 0.24) return scored[1].target;
    return scored[0].target;
  }

  scoreAiPlacement(targetColor, tileId, aiColor) {
    const own = targetColor === aiColor;
    const tile = ROAD_TILE_DEFS[tileId];
    const side = cloneRoadSide(this.sides[targetColor]);
    const placement = placeRoadTile(side, tileId);
    if (!placement.valid) return -999;
    let score = own ? 24 : 10;
    if (own && tile.effect === "speed") score += 45;
    if (!own && tile.effect === "bomb") score += 43;
    if (!own && tile.effect === "trap") score += 52;
    if (!own && tile.effect === "spike") score += 32;
    if (own && ["bomb", "spike", "trap"].includes(tile.effect)) score -= 46;
    if (!own && tile.effect === "speed") score -= 42;
    if (own && placement.nextEndpoint.col === 1) score += 8;
    if (placement.tile.row === roadGoalRow(targetColor)) score += own ? 120 : -100;
    if (this.aiDifficulty === "normal") score += Phaser.Math.FloatBetween(-9, 9);
    return score;
  }

  updateTimerVisuals() {
    if (!this.clocks || this.gameOver) return;
    for (const color of ["w", "b"]) {
      const clock = this.clocks[color];
      const stats = this.statTexts[color];
      if (stats) {
        stats.setText(t("road.stats", {
          distance: roadRemainingTiles(this.sides[color]),
          seconds: formatSeconds(clock.totalMs),
        }));
      }
    }
    this.renderEndpointLayer();
  }

  indicatorTarget(ownerColor) {
    return this.clocks[ownerColor]?.selectedTarget
      || this.forcedTargets[ownerColor]
      || ownerColor;
  }

  timerOwnerForTarget(targetColor) {
    const candidates = ["w", "b"].filter((owner) => this.indicatorTarget(owner) === targetColor);
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => this.clocks[a].remainingMs - this.clocks[b].remainingMs)[0];
  }

  showSideEvent(color, message, tone = "success") {
    this.sideEventLayers[color]?.destroy(true);
    const x = this.scale.width / 2 + this.laneLeft(color) + LANE_WIDTH / 2;
    const y = BOARD_TOP + BOARD_VIEW_HEIGHT / 2;
    const layer = this.add.container(x, y)
      .setAngle(this.isFromBottom(color) ? 0 : 180)
      .setDepth(430);
    this.sideEventLayers[color] = layer;
    const bandColor = tone === "failure" ? 0x7f3029 : 0x146f7d;
    const band = this.add.rectangle(0, 0, LANE_WIDTH + 8, 54, bandColor, 0.82);
    const text = this.add.text(0, 0, message, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "15px",
      color: "#fffaf0",
      fontStyle: "900",
      align: "center",
      stroke: "#291c12",
      strokeThickness: 3,
      wordWrap: { width: LANE_WIDTH - 18 },
    }).setOrigin(0.5);
    layer.add([band, text]);
    layer.setAlpha(0).setScale(0.96);
    this.tweens.add({
      targets: layer,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: "Quad.Out",
      onComplete: () => {
        this.time.delayedCall(1050, () => {
          if (!layer.active) return;
          this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 320,
            ease: "Quad.In",
            onComplete: () => {
              if (this.sideEventLayers[color] === layer) this.sideEventLayers[color] = null;
              layer.destroy(true);
            },
          });
        });
      },
    });
  }

  showEvent(message, tone = "success") {
    this.eventText?.destroy();
    const color = tone === "failure" ? "#a64137" : "#148da0";
    this.eventText = this.add.text(this.scale.width / 2, 680, message, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color,
      fontStyle: "900",
      align: "center",
      backgroundColor: "#fff5dd",
      padding: { x: 14, y: 8 },
      wordWrap: { width: 430 },
    }).setOrigin(0.5).setDepth(420);
    this.tweens.add({
      targets: this.eventText,
      alpha: 0,
      y: 660,
      delay: 900,
      duration: 350,
      onComplete: () => this.eventText?.destroy(),
    });
  }

  autoScroll(color, row) {
    const displayRow = this.displayRow(color, row);
    this.boardScroll[color] = Phaser.Math.Clamp(
      displayRow * CELL_SIZE - BOARD_VIEW_HEIGHT / 2 + CELL_SIZE / 2,
      0,
      MAX_SCROLL
    );
  }

  beginScroll(pointer, color) {
    if (this.inputLocked || this.gameOver) return;
    this.scrollDrag = {
      color,
      pointerId: pointer.id,
      startY: pointer.y,
      startScroll: this.boardScroll[color],
    };
  }

  updateScroll(pointer) {
    if (!this.scrollDrag || pointer.id !== this.scrollDrag.pointerId) return;
    const delta = pointer.y - this.scrollDrag.startY;
    this.boardScroll[this.scrollDrag.color] = Phaser.Math.Clamp(
      this.scrollDrag.startScroll - delta,
      0,
      MAX_SCROLL
    );
    this.renderBoard();
    this.renderKings(false);
  }

  endScroll() {
    this.scrollDrag = null;
  }

  finishMatch(winner, reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.inputLocked = true;
    this.renderControls();
    playFeedback(winner
      ? winner === this.playerColor || !this.isAIMode() ? "win" : "failure"
      : "draw");
    this.showEvent(winner ? t("road.result", { side: sideName(winner) }) : t("road.draw"));
    const medalResult = recordMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "road",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
    });
    const dailyResult = recordDailyMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "road",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
    });
    this.time.delayedCall(1000, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("Result", {
        result: winner ? `${winner}_win` : "draw",
        reason,
        winnerColor: winner,
        skins: { ...this.skins },
        mode: this.mode,
        playerColor: this.playerColor,
        difficulty: this.isAIMode() ? this.aiDifficulty : null,
        gameSessionId: this.gameSessionId,
        sourceScene: "RoyalRoad",
        newlyUnlocked: Array.from(new Set([...medalResult.newlyUnlocked, ...dailyResult.newlyUnlocked])),
      });
    });
  }

  isAIMode() {
    return this.mode === "ai";
  }
}
