import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260903-online95";
import { createPieceView } from "../pieceStyles.js?v=20260903-online95";
import { playFeedback, vibrateFeedback } from "../feedback.js?v=20260903-online95";
import { t } from "../i18n.js?v=20260903-online95";
import { markMedalsSeen, recordMiniGameCompletion } from "../medals.js?v=20260903-online95";
import { recordDailyMiniGameCompletion } from "../dailyMissions.js?v=20260903-online95";
import {
  createRoadPuzzleState,
  findRoadPuzzlePath,
  getRoadPuzzleTile,
  moveRoadPuzzlePlayer,
  roadPuzzleHint,
  roadPuzzleIsSolved,
  roadPuzzleNeighbors,
  rotateRoadPuzzleTile,
  scoreRoadPuzzle,
} from "../royalRoadPuzzleLogic.js?v=20260903-online95";
import { getRoyalRoadPuzzleStage, ROYAL_ROAD_PUZZLE_STAGES } from "../royalRoadPuzzleStages.js?v=20260903-online95";
import { readRoyalRoadPuzzleProgress, saveRoyalRoadPuzzleClear } from "../royalRoadPuzzleProgress.js?v=20260903-online95";
import { showMedalAwardSequence } from "../ui/MedalAward.js?v=20260903-online95";
import {
  addDarkTopBar,
  addLargeTextButton,
  addPanel,
  addScreenBg,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260903-online95";

const VIEW = Object.freeze({ x: 18, y: 214, width: 684, height: 882 });
const PLAY_VIEW = Object.freeze({
  x: VIEW.x + 30,
  y: VIEW.y + 34,
  width: VIEW.width - 60,
  height: VIEW.height - 70,
});
const CELL = 104;
const TILE_H = CELL * (124 / 120);
const KING_ANCHOR_Y = -CELL * 0.48;
const TAP_THRESHOLD = 10;
const TEXTURE_BY_KIND = Object.freeze({
  straight: "kuma_ui_tile_down_up",
  corner: "kuma_ui_tile_down_right",
  cross: "kuma_ui_tile_crossroad",
});

function tileVisual(tile) {
  if (tile.special?.trap) return { texture: "kuma_ui_tile_trap", angle: tile.rotation * 90 };
  if (tile.kind === "tee") {
    return {
      texture: ["kuma_ui_tile_t_right", "kuma_ui_tile_t_down", "kuma_ui_tile_t_left", "kuma_ui_tile_t_up"][tile.rotation],
      angle: 0,
    };
  }
  if (tile.kind === "deadEnd") {
    return {
      texture: tile.rotation === 1 ? "kuma_ui_tile_right_end" : "kuma_ui_tile_left_end",
      angle: [90, 0, 270, 0][tile.rotation],
    };
  }
  return { texture: TEXTURE_BY_KIND[tile.kind], angle: tile.rotation * 90 };
}

function oneWayAngle(direction) {
  return { up: 0, right: 90, down: 180, left: 270 }[direction] || 0;
}

function applyTileVisual(view, tile) {
  const visual = tileVisual(tile);
  view.tileImage.setTexture(visual.texture).setAngle(visual.angle);
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export class RoyalRoadPuzzle extends Phaser.Scene {
  constructor() {
    super("RoyalRoadPuzzle");
    this.stageIndex = 0;
    this.cameraOffset = { x: 0, y: 0 };
    this.inputLocked = true;
    this.actionMode = "rotate";
  }

  init(data = {}) {
    this.stageIndex = Math.max(0, Math.min(ROYAL_ROAD_PUZZLE_STAGES.length - 1, Number(data.stageIndex) || 0));
  }

  create() {
    const { width, height } = this.scale;
    // Phaser reuses the scene instance on restart, so clear run-scoped references.
    this.resultLayer = null;
    this.pointerGesture = null;
    this.lastSecond = -1;
    this.cameraOffset = { x: 0, y: 0 };
    this.inputLocked = true;
    this.stage = getRoyalRoadPuzzleStage(this.stageIndex);
    this.state = createRoadPuzzleState(this.stage);
    this.gameSessionId = `road-puzzle-${this.stage.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.portalUses = 0;
    this.startedAt = this.time.now;
    this.actionMode = this.stage.type === "hybrid" ? "rotate" : (this.stage.type === "maze" ? "move" : "rotate");
    addScreenBg(this, "bg_select");
    this.add.rectangle(0, 0, width, height, 0xfff8ea, 0.84).setOrigin(0).setDepth(-80);
    addDarkTopBar(this, "Kuma Chess", { onHome: () => this.scene.start("RoyalRoadPuzzleSelect") });
    this.add.text(width / 2, 138, t("roadPuzzle.title"), {
      fontFamily: KUMA_FONT_SANS, fontSize: "29px", color: KUMA_COLORS.ink, fontStyle: "900",
    }).setOrigin(0.5).setDepth(300);
    this.add.text(width / 2, 172, t("roadPuzzle.stageTitle", { stage: String(this.stage.number).padStart(2, "0"), title: this.stage.title }), {
      fontFamily: KUMA_FONT_SANS, fontSize: "18px", color: "#8b6a43", fontStyle: "700",
    }).setOrigin(0.5).setDepth(300);

    this.add.rectangle(VIEW.x + VIEW.width / 2, VIEW.y + VIEW.height / 2, VIEW.width, VIEW.height, 0xefe3ce, 1)
      .setStrokeStyle(2, 0xb88a48, 1).setDepth(0);
    this.boardRoot = this.add.container(0, 0).setDepth(20);
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff, 1).fillRect(PLAY_VIEW.x, PLAY_VIEW.y, PLAY_VIEW.width, PLAY_VIEW.height);
    this.boardRoot.setMask(maskShape.createGeometryMask());
    this.maskShape = maskShape;
    this.drawBoard();
    this.addBoardFrame();
    this.createHud();
    this.installInput();

    const savedSkins = this.registry.get("pieceSkin") || { w: "classic" };
    this.skin = savedSkins.w || "classic";
    ensurePieceSetsLoaded(this, [{ skin: this.skin, color: "w" }]).then(() => {
      if (!this.scene.isActive()) return;
      this.createKing();
      this.inputLocked = false;
      this.refreshHighlights();
    }).catch(() => showRewardLine(this, t("select.loadFailed"), { tone: "failure", showCoin: false }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.maskShape?.destroy();
      this.pointerGesture = null;
    });
  }

  drawBoard() {
    this.boardRoot.removeAll(true);
    this.boardWidth = this.stage.width * CELL;
    this.boardHeight = this.stage.height * CELL;
    const bg = this.add.graphics();
    for (let y = 0; y < this.stage.height; y += 1) {
      for (let x = 0; x < this.stage.width; x += 1) {
        bg.fillStyle((x + y) % 2 ? 0xcab89d : 0xfff7e8, 1);
        bg.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    this.boardRoot.add(bg);
    this.tileViews = new Map();
    for (const tile of this.state.tiles.values()) {
      const view = this.createTileView(tile);
      this.tileViews.set(`${tile.x},${tile.y}`, view);
      this.boardRoot.add(view);
    }
    this.goalView = this.add.image(
      this.stage.goal.x * CELL + CELL / 2,
      this.stage.goal.y * CELL + CELL / 2 + 6,
      "kuma_ui_img_castle"
    ).setDisplaySize(CELL * 1.12, CELL * 1.03).setDepth(88);
    this.boardRoot.add(this.goalView);
    this.highlightLayer = this.add.graphics().setDepth(72);
    this.boardRoot.add(this.highlightLayer);
    this.fitInitialCamera();
  }

  addBoardFrame() {
    const depth = 150;
    this.add.image(VIEW.x + VIEW.width / 2, VIEW.y + 15, "kuma_ui_chess_board_center_top_shot")
      .setDisplaySize(VIEW.width, 34).setDepth(depth);
    this.add.image(VIEW.x + VIEW.width / 2, VIEW.y + VIEW.height - 16, "kuma_ui_chess_board_center_bottom_shot")
      .setDisplaySize(VIEW.width, 36).setDepth(depth);
    this.add.image(VIEW.x + 14, VIEW.y + VIEW.height / 2, "kuma_ui_chess_board_left")
      .setDisplaySize(30, VIEW.height).setDepth(depth);
    this.add.image(VIEW.x + VIEW.width - 14, VIEW.y + VIEW.height / 2, "kuma_ui_chess_board_right")
      .setDisplaySize(30, VIEW.height).setDepth(depth);
  }

  createTileView(tile) {
    const x = tile.x * CELL + CELL / 2;
    const y = tile.y * CELL + CELL / 2;
    const root = this.add.container(x, y).setDepth(20 + tile.y);
    const visual = tileVisual(tile);
    const image = this.add.image(0, 0, visual.texture).setDisplaySize(CELL, TILE_H).setAngle(visual.angle);
    root.add(image);
    root.tileImage = image;
    root.tile = tile;
    if (tile.special?.oneWay) {
      const marker = this.add.container(-CELL * 0.31, CELL * 0.3).setAngle(oneWayAngle(tile.special.oneWay));
      const badge = this.add.circle(0, 0, 17, 0xfff4d5, 0.97).setStrokeStyle(3, 0xb97818, 1);
      const arrow = this.add.graphics();
      arrow.fillStyle(0x71400c, 1);
      arrow.fillTriangle(0, -11, -8, -1, 8, -1);
      arrow.fillRoundedRect(-3.5, -2, 7, 13, 2);
      marker.add([badge, arrow]);
      root.add(marker);
      root.oneWayMarker = marker;
    }
    if (tile.special?.portal) {
      const portal = this.add.image(0, 0, "kuma_ui_img_potal").setDisplaySize(CELL * 0.62, CELL * 0.62);
      root.add(portal);
      this.tweens.add({ targets: portal, angle: 360, duration: 4200, repeat: -1, ease: "Linear" });
    }
    if (tile.special?.fixed) {
      const fixedLock = this.add.image(CELL * 0.31, -CELL * 0.3, "kuma_ui_icon_lock").setDisplaySize(34, 34);
      root.add(fixedLock);
    }
    if (tile.special?.door) {
      const gate = this.add.container(0, 0);
      const gateBg = this.add.rectangle(0, 0, CELL * 0.76, CELL * 0.76, 0x4b3826, 0.3)
        .setStrokeStyle(4, 0x8e662e, 0.9);
      const bars = this.add.graphics();
      bars.lineStyle(5, 0x7b592c, 0.92);
      [-22, 0, 22].forEach((barX) => bars.lineBetween(barX, -31, barX, 31));
      bars.lineBetween(-34, -18, 34, -18);
      bars.lineBetween(-34, 18, 34, 18);
      const doorIcon = this.add.image(0, 0, "kuma_ui_icon_lock").setDisplaySize(38, 38);
      gate.add([gateBg, bars, doorIcon]);
      root.add(gate);
      root.doorGate = gate;
      root.doorViews = [gate];
      image.setAlpha(0.5);
    }
    if (tile.special?.switch) {
      const switchPlate = this.add.circle(0, 0, 29, 0xffe5a2, 0.84).setStrokeStyle(4, 0xb87418, 0.95);
      const switchIcon = this.add.image(0, 0, "kuma_ui_img_key").setDisplaySize(48, 48).setAngle(-12);
      root.add([switchPlate, switchIcon]);
      root.switchPlate = switchPlate;
      root.switchIcon = switchIcon;
    }
    if (tile.special?.checkpoint) {
      const checkpointRing = this.add.circle(0, 0, 33, 0xffffff, 0.12).setStrokeStyle(4, 0x20abc1, 0.95);
      const checkpointFlag = this.add.image(0, -2, "kuma_ui_img_flag").setDisplaySize(60, 60);
      root.add([checkpointRing, checkpointFlag]);
      root.checkpointRing = checkpointRing;
      root.checkpointFlag = checkpointFlag;
    }
    if (tile.special?.rotateTarget) {
      root.add(this.add.text(0, 0, "↻", { fontFamily: KUMA_FONT_SANS, fontSize: "36px", color: "#a75f22", stroke: "#fff7df", strokeThickness: 5, fontStyle: "900" }).setOrigin(0.5));
    }
    return root;
  }

  createKing() {
    this.kingView = createPieceView(this, 0, 0, CELL * 0.82, this.skin, "w", "k", "back").setDepth(110);
    this.boardRoot.add(this.kingView);
    this.positionKing(false);
  }

  positionKing(animate = true) {
    const target = {
      x: this.state.player.x * CELL + CELL / 2,
      y: this.state.player.y * CELL + CELL / 2 + KING_ANCHOR_Y,
    };
    if (!animate) this.kingView.setPosition(target.x, target.y);
    else this.tweens.add({ targets: this.kingView, ...target, duration: 220, ease: "Sine.Out" });
  }

  createHud() {
    const { width } = this.scale;
    this.statsText = this.add.text(38, 1118, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "18px", color: KUMA_COLORS.ink, fontStyle: "700", lineSpacing: 5,
    }).setOrigin(0, 0).setDepth(310);
    const restart = this.add.image(112, 1212, "kuma_ui_btn_back").setDisplaySize(62, 62).setInteractive({ useHandCursor: true }).setDepth(310);
    restart.on("pointerup", () => this.scene.restart({ stageIndex: this.stageIndex }));
    this.hintButton = this.add.image(width - 112, 1212, "kuma_ui_btn_hint").setDisplaySize(62, 62).setInteractive({ useHandCursor: true }).setDepth(310);
    this.hintButton.on("pointerup", () => this.showHint());
    this.modeButton = addLargeTextButton(this, width / 2, 1210, "", this.stage.type === "hybrid" ? " " : "", () => this.toggleMode(), {
      width: 300,
      height: 68,
      fontSize: 20,
      subFontSize: 13,
      titleOffsetY: this.stage.type === "hybrid" ? -10 : 0,
      subOffsetY: 17,
      depth: 310,
      dark: this.stage.type === "hybrid",
    });
    this.refreshHud();
  }

  refreshHud() {
    const objective = this.stage.type === "rotate" ? this.stage.stars.rotations : this.stage.stars.moves;
    this.statsText?.setText(t("roadPuzzle.stats", {
      feature: this.stage.feature,
      rotations: this.state.rotations,
      moves: this.state.moves,
      target: objective,
      time: formatTime(this.state.elapsedMs),
    }));
    if (this.modeButton) {
      const hybrid = this.stage.type === "hybrid";
      const label = hybrid
        ? t(this.actionMode === "rotate" ? "roadPuzzle.modeToMove" : "roadPuzzle.modeToRotate")
        : t(this.stage.type === "maze" ? "roadPuzzle.modeMove" : "roadPuzzle.modeRotate");
      const subLabel = hybrid
        ? t(this.actionMode === "rotate" ? "roadPuzzle.modeToMoveSub" : "roadPuzzle.modeToRotateSub")
        : "";
      this.modeButton.title.setText(label);
      this.modeButton.sub?.setText(subLabel).setVisible(hybrid);
      this.modeButton.button.setAlpha(hybrid ? 1 : 0.72);
    }
  }

  toggleMode() {
    if (this.stage.type !== "hybrid" || this.inputLocked) return;
    this.actionMode = this.actionMode === "rotate" ? "move" : "rotate";
    playFeedback("ui");
    this.refreshHud();
    this.refreshHighlights();
  }

  installInput() {
    this.input.on("wheel", (_pointer, _objects, deltaX, deltaY) => {
      this.setCamera(this.cameraOffset.x - deltaX * 0.5, this.cameraOffset.y - deltaY * 0.5);
    });
    this.input.on("pointerdown", (pointer) => {
      if (!Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(PLAY_VIEW.x, PLAY_VIEW.y, PLAY_VIEW.width, PLAY_VIEW.height), pointer.x, pointer.y)) return;
      this.pointerGesture = { x: pointer.x, y: pointer.y, cameraX: this.cameraOffset.x, cameraY: this.cameraOffset.y, dragged: false };
    });
    this.input.on("pointermove", (pointer) => {
      if (!this.pointerGesture || !pointer.isDown) return;
      const dx = pointer.x - this.pointerGesture.x;
      const dy = pointer.y - this.pointerGesture.y;
      if (Math.hypot(dx, dy) > TAP_THRESHOLD) this.pointerGesture.dragged = true;
      if (this.pointerGesture.dragged) this.setCamera(this.pointerGesture.cameraX + dx, this.pointerGesture.cameraY + dy);
    });
    this.input.on("pointerup", (pointer) => {
      const gesture = this.pointerGesture;
      this.pointerGesture = null;
      if (!gesture || gesture.dragged || this.inputLocked) return;
      const localX = pointer.x - this.boardRoot.x;
      const localY = pointer.y - this.boardRoot.y;
      const x = Math.floor(localX / CELL);
      const y = Math.floor(localY / CELL);
      this.handleCellTap(x, y);
    });
  }

  handleCellTap(x, y) {
    const tile = getRoadPuzzleTile(this.state, x, y);
    if (!tile) return;
    if (this.actionMode === "move") {
      this.tryMove(x, y);
      return;
    }
    const result = rotateRoadPuzzleTile(this.state, x, y);
    if (!result.rotated) {
      this.flashTile(x, y, 0xc64b42);
      playFeedback("wrong");
      return;
    }
    this.inputLocked = true;
    const view = this.tileViews.get(`${x},${y}`);
    playFeedback("move");
    this.tweens.add({
      targets: view.tileImage,
      angle: view.tileImage.angle + 90,
      duration: 160,
      ease: "Cubic.Out",
      onComplete: () => {
        applyTileVisual(view, tile);
        this.inputLocked = false;
        this.refreshHud();
        this.refreshHighlights();
        if (this.stage.movementMode === "auto" && roadPuzzleIsSolved(this.state)) this.autoTravel();
      },
    });
  }

  tryMove(x, y) {
    this.inputLocked = true;
    const result = moveRoadPuzzlePlayer(this.state, x, y);
    if (!result.moved) {
      this.inputLocked = false;
      const blockedDoor = getRoadPuzzleTile(this.state, x, y);
      if (blockedDoor?.special?.door && !this.state.switches[blockedDoor.special.door]) {
        this.playLockedDoorFeedback(blockedDoor.special.door);
      }
      this.flashTile(x, y, 0xc64b42);
      playFeedback("wrong");
      vibrateFeedback([24]);
      return;
    }
    playFeedback("move");
    const portalEvent = result.events.find((event) => event.type === "portal");
    const trapEvent = result.events.find((event) => event.type === "trap");
    this.positionKing(true);
    this.time.delayedCall(240, () => {
      if (portalEvent) {
        this.portalUses += 1;
        this.playPortalEvent(portalEvent);
      }
      if (trapEvent) this.playTrapEvent(trapEvent);
      if (!portalEvent && !trapEvent) this.finishMoveEvents(result.events);
    });
  }

  playPortalEvent(event) {
    this.tweens.add({ targets: this.kingView, alpha: 0, scale: 0.3, duration: 120, onComplete: () => {
      this.kingView.setPosition(event.destination.x * CELL + CELL / 2, event.destination.y * CELL + CELL / 2 + KING_ANCHOR_Y);
      this.tweens.add({ targets: this.kingView, alpha: 1, scale: 1, duration: 170, ease: "Back.Out", onComplete: () => this.finishMoveEvents([{ type: this.state.completed ? "goal" : "portal" }]) });
    } });
  }

  playTrapEvent() {
    playFeedback("wrong");
    vibrateFeedback([30, 30, 50]);
    this.tweens.add({ targets: this.kingView, x: this.kingView.x + 5, duration: 45, yoyo: true, repeat: 3, onComplete: () => {
      this.positionKing(false);
      this.finishMoveEvents([]);
    } });
  }

  finishMoveEvents(events) {
    this.inputLocked = false;
    this.refreshHud();
    this.refreshHighlights();
    if (events.some((event) => event.type === "switch" || event.type === "checkpoint" || event.type === "rotateTarget")) {
      this.refreshTileStates();
    }
    this.playTileEventFeedback(events);
    if (this.state.completed || events.some((event) => event.type === "goal")) this.completeStage();
    else this.followPlayer();
  }

  refreshTileStates() {
    for (const [key, view] of this.tileViews) {
      const tile = this.state.tiles.get(key);
      applyTileVisual(view, tile);
      if (tile.special?.door) {
        const opened = !!this.state.switches[tile.special.door];
        view.doorViews?.forEach((item) => {
          if (opened && item.visible && !item.getData("opening")) {
            item.setData("opening", true);
            this.tweens.add({
              targets: item,
              alpha: 0,
              scaleY: 0.25,
              duration: 260,
              ease: "Cubic.In",
              onComplete: () => item.setVisible(false),
            });
          } else if (!opened) {
            item.setVisible(true).setAlpha(1).setScale(1).setData("opening", false);
          }
        });
        view.tileImage.setAlpha(opened ? 1 : 0.5);
      }
      if (tile.special?.switch) {
        const active = !!this.state.switches[tile.special.switch];
        view.switchPlate?.setFillStyle(active ? 0x9fe6d6 : 0xffe5a2, active ? 0.86 : 0.84)
          .setStrokeStyle(4, active ? 0x159b92 : 0xb87418, 0.95);
        view.switchIcon?.setAngle(active ? 0 : -12).setAlpha(active ? 0.72 : 1);
      }
      if (tile.special?.checkpoint) {
        const active = this.state.checkpoint.x === tile.x && this.state.checkpoint.y === tile.y;
        view.checkpointRing?.setFillStyle(active ? 0xa9edf1 : 0xffffff, active ? 0.34 : 0.12)
          .setStrokeStyle(4, active ? 0x008fa7 : 0x20abc1, 0.95);
      }
    }
  }

  playTileEventFeedback(events) {
    for (const event of events) {
      const view = event.tile ? this.tileViews.get(`${event.tile.x},${event.tile.y}`) : null;
      if (event.type === "switch" && view?.switchIcon) {
        this.tweens.add({ targets: view.switchIcon, scale: 1.22, duration: 130, yoyo: true, ease: "Back.Out" });
        this.flashTile(event.tile.x, event.tile.y, 0xe2aa2f);
      }
      if (event.type === "checkpoint" && view?.checkpointFlag) {
        this.tweens.add({ targets: view.checkpointFlag, y: -9, duration: 140, yoyo: true, ease: "Sine.Out" });
        this.flashTile(event.tile.x, event.tile.y, 0x19a9bf);
      }
    }
  }

  playLockedDoorFeedback(switchId) {
    for (const [key, view] of this.tileViews) {
      const tile = this.state.tiles.get(key);
      if (tile.special?.door === switchId && view.doorGate) {
        this.tweens.add({ targets: view.doorGate, scale: 1.12, duration: 90, yoyo: true, repeat: 2 });
      }
      if (tile.special?.switch === switchId && view.switchIcon) {
        this.tweens.add({ targets: view.switchIcon, angle: 12, duration: 130, yoyo: true, repeat: 2 });
      }
    }
  }

  autoTravel() {
    const path = findRoadPuzzlePath(this.state, this.stage.start, this.stage.goal);
    if (!path) return;
    this.inputLocked = true;
    this.kingView.setPosition(this.stage.start.x * CELL + CELL / 2, this.stage.start.y * CELL + CELL / 2 + KING_ANCHOR_Y);
    const travel = (index) => {
      if (index >= path.length) {
        this.state.player = { ...this.stage.goal };
        this.state.moves = Math.max(this.state.moves, path.length - 1);
        this.state.completed = true;
        this.completeStage();
        return;
      }
      const target = path[index];
      const distance = Math.abs(target.x - (path[index - 1]?.x ?? target.x)) + Math.abs(target.y - (path[index - 1]?.y ?? target.y));
      const props = { x: target.x * CELL + CELL / 2, y: target.y * CELL + CELL / 2 + KING_ANCHOR_Y };
      this.state.player = { ...target };
      if (distance > 1) {
        this.tweens.add({ targets: this.kingView, alpha: 0, duration: 110, onComplete: () => {
          this.kingView.setPosition(props.x, props.y);
          this.tweens.add({ targets: this.kingView, alpha: 1, duration: 150, onComplete: () => { this.followPlayer(); travel(index + 1); } });
        } });
      } else {
        this.tweens.add({ targets: this.kingView, ...props, duration: 180, ease: "Sine.InOut", onComplete: () => { this.followPlayer(); travel(index + 1); } });
      }
    };
    travel(1);
  }

  refreshHighlights() {
    this.highlightLayer.clear();
    if (this.actionMode !== "move" || this.inputLocked) return;
    this.highlightLayer.lineStyle(4, 0x19a9bf, 0.88);
    for (const cell of roadPuzzleNeighbors(this.state)) {
      this.highlightLayer.strokeRoundedRect(cell.x * CELL + 5, cell.y * CELL + 5, CELL - 10, CELL - 10, 8);
    }
  }

  flashTile(x, y, color) {
    const marker = this.add.graphics().setDepth(190);
    marker.lineStyle(5, color, 0.95).strokeRoundedRect(x * CELL + 6, y * CELL + 6, CELL - 12, CELL - 12, 8);
    this.boardRoot.add(marker);
    this.tweens.add({ targets: marker, alpha: 0, duration: 300, onComplete: () => marker.destroy() });
  }

  showHint() {
    if (this.inputLocked) return;
    const hint = roadPuzzleHint(this.state);
    if (!hint) return;
    this.state.hints += 1;
    this.flashTile(hint.x, hint.y, 0xe6ad35);
    showRewardLine(this, t(hint.type === "rotate" ? "roadPuzzle.hintRotate" : "roadPuzzle.hintMove"), { showCoin: false, y: 190, hold: 1300 });
    this.refreshHud();
  }

  fitInitialCamera() {
    const centerOnStartX = PLAY_VIEW.x + PLAY_VIEW.width / 2 - (this.stage.start.x * CELL + CELL / 2);
    const centerOnStartY = PLAY_VIEW.y + PLAY_VIEW.height * 0.72 - (this.stage.start.y * CELL + CELL / 2);
    this.setCamera(centerOnStartX, centerOnStartY);
  }

  setCamera(x, y) {
    const centeredX = PLAY_VIEW.x + (PLAY_VIEW.width - this.boardWidth) / 2;
    const centeredY = PLAY_VIEW.y + (PLAY_VIEW.height - this.boardHeight) / 2;
    const minX = this.boardWidth <= PLAY_VIEW.width ? centeredX : PLAY_VIEW.x + PLAY_VIEW.width - this.boardWidth;
    const maxX = this.boardWidth <= PLAY_VIEW.width ? centeredX : PLAY_VIEW.x;
    const minY = this.boardHeight <= PLAY_VIEW.height ? centeredY : PLAY_VIEW.y + PLAY_VIEW.height - this.boardHeight;
    const maxY = this.boardHeight <= PLAY_VIEW.height ? centeredY : PLAY_VIEW.y;
    this.cameraOffset.x = Phaser.Math.Clamp(x, minX, maxX);
    this.cameraOffset.y = Phaser.Math.Clamp(y, minY, maxY);
    if (this.boardRoot) this.boardRoot.setPosition(this.cameraOffset.x, this.cameraOffset.y);
  }

  followPlayer() {
    const x = this.state.player.x * CELL + CELL / 2 + this.boardRoot.x;
    const y = this.state.player.y * CELL + CELL / 2 + this.boardRoot.y;
    const marginX = PLAY_VIEW.width * 0.25;
    const marginY = PLAY_VIEW.height * 0.25;
    let targetX = this.cameraOffset.x;
    let targetY = this.cameraOffset.y;
    if (x < PLAY_VIEW.x + marginX || x > PLAY_VIEW.x + PLAY_VIEW.width - marginX) {
      targetX += PLAY_VIEW.x + PLAY_VIEW.width / 2 - x;
    }
    if (y < PLAY_VIEW.y + marginY || y > PLAY_VIEW.y + PLAY_VIEW.height - marginY) {
      targetY += PLAY_VIEW.y + PLAY_VIEW.height / 2 - y;
    }
    this.setCamera(targetX, targetY);
  }

  update(_time, delta) {
    if (!this.state?.completed) {
      this.state.elapsedMs += delta;
      if (Math.floor(this.state.elapsedMs / 1000) !== this.lastSecond) {
        this.lastSecond = Math.floor(this.state.elapsedMs / 1000);
        this.refreshHud();
      }
    }
  }

  completeStage() {
    if (this.resultLayer) return;
    this.inputLocked = true;
    this.state.completed = true;
    const stars = scoreRoadPuzzle(this.state);
    const saved = saveRoyalRoadPuzzleClear(this.stage.id, {
      stars, rotations: this.state.rotations, moves: this.state.moves, timeMs: Math.round(this.state.elapsedMs),
    });
    const progress = readRoyalRoadPuzzleProgress();
    const allStars = ROYAL_ROAD_PUZZLE_STAGES.every((stage) => progress.records[stage.id]?.stars >= 3);
    const medalResult = recordMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "road-puzzle",
      mode: "solo",
      playerColor: "w",
      winnerColor: "w",
      stats: { firstClear: saved.firstClear, allStars, portalUses: this.portalUses },
    });
    const dailyResult = recordDailyMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "road-puzzle",
      mode: "solo",
      playerColor: "w",
      winnerColor: "w",
    });
    playFeedback("win");
    const newlyUnlocked = Array.from(new Set([...medalResult.newlyUnlocked, ...dailyResult.newlyUnlocked]));
    this.time.delayedCall(420, () => this.showResult(stars, saved, newlyUnlocked));
  }

  showResult(stars, saved, newlyUnlocked = []) {
    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 1800);
    const root = this.add.container(0, 0).setDepth(1810);
    this.resultLayer = { root, backdrop };
    const panel = addPanel(this, width / 2, height / 2, 550, 620, 1811);
    const title = this.add.text(width / 2, height / 2 - 190, t("roadPuzzle.clear"), {
      fontFamily: KUMA_FONT_SANS, fontSize: "38px", color: "#9b6519", fontStyle: "900",
    }).setOrigin(0.5).setDepth(1812);
    const crownViews = Array.from({ length: 3 }, (_, index) => this.add.image(
      width / 2 + (index - 1) * 94,
      height / 2 - 105,
      index < stars ? "kuma_ui_result_crown" : "kuma_ui_result_crown_slot"
    ).setDisplaySize(index < stars ? 82 : 78, index < stars ? 83 : 79).setDepth(1812));
    const record = this.add.text(width / 2, height / 2 + 5, t("roadPuzzle.record", {
      rotations: this.state.rotations, moves: this.state.moves, time: formatTime(this.state.elapsedMs),
    }), {
      fontFamily: KUMA_FONT_SANS, fontSize: "20px", color: KUMA_COLORS.ink, fontStyle: "700", align: "center", lineSpacing: 8,
    }).setOrigin(0.5).setDepth(1812);
    const reward = this.add.text(width / 2, height / 2 + 82, saved.firstClear ? t("roadPuzzle.reward", { amount: saved.reward.amount }) : t("roadPuzzle.best", { stars: saved.record.stars }), {
      fontFamily: KUMA_FONT_SANS, fontSize: "19px", color: KUMA_COLORS.teal, fontStyle: "800",
    }).setOrigin(0.5).setDepth(1812);
    const retry = addLargeTextButton(this, width / 2 - 132, height / 2 + 190, t("result.retry"), "", () => this.scene.restart({ stageIndex: this.stageIndex }), { width: 230, height: 70, fontSize: 23, depth: 1814 });
    const hasNext = this.stageIndex < ROYAL_ROAD_PUZZLE_STAGES.length - 1;
    const next = addLargeTextButton(this, width / 2 + 132, height / 2 + 190, hasNext ? t("roadPuzzle.next") : t("roadPuzzle.list"), "", () => {
      if (hasNext) this.scene.restart({ stageIndex: this.stageIndex + 1 });
      else this.scene.start("RoyalRoadPuzzleSelect");
    }, { width: 230, height: 70, fontSize: 23, dark: true, depth: 1814 });
    root.add([panel, title, ...crownViews, record, reward, retry.button, retry.title, next.button, next.title]);
    if (newlyUnlocked.length) {
      this.time.delayedCall(700, async () => {
        const confirmedIds = await showMedalAwardSequence(this, newlyUnlocked, { y: height * 0.47 });
        if (confirmedIds.length) markMedalsSeen(confirmedIds);
      });
    }
  }
}
