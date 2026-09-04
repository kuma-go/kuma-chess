import { ensurePieceSetsLoaded, pieceTextureKey } from "../pieceAssets.js?v=20260904-accountpopup108";
import { alignBoardPieceView, createPieceView } from "../pieceStyles.js?v=20260904-accountpopup108";
import { playFeedback, vibrateFeedback } from "../feedback.js?v=20260904-accountpopup108";
import { t } from "../i18n.js?v=20260904-accountpopup108";
import { recordMiniGameCompletion } from "../medals.js?v=20260904-accountpopup108";
import { recordDailyMiniGameCompletion } from "../dailyMissions.js?v=20260904-accountpopup108";
import {
  addChessBoard,
  addDarkTopBar,
  addLargeTextButton,
  addScreenBg,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260904-accountpopup108";

const AI_POWER = Object.freeze({ easy: 0.58, normal: 0.88, hard: 1 });
const AI_ERROR = Object.freeze({ easy: 90, normal: 28, hard: 7 });
const AI_POWER_VARIANCE = Object.freeze({
  easy: Object.freeze([0.74, 1.02]),
  normal: Object.freeze([0.95, 1.04]),
  hard: Object.freeze([0.99, 1.015]),
});
const PIECE_STATS = Object.freeze({
  p: Object.freeze({ radius: 27, mass: 0.7, force: 1, maxSpeed: 25.5, friction: 0.986 }),
  n: Object.freeze({ radius: 32, mass: 1.22, force: 1, maxSpeed: 22.5, friction: 0.984 }),
  b: Object.freeze({ radius: 31, mass: 1.16, force: 1, maxSpeed: 23, friction: 0.984 }),
  r: Object.freeze({ radius: 35, mass: 1.55, force: 1, maxSpeed: 20.5, friction: 0.982 }),
  q: Object.freeze({ radius: 38, mass: 1.86, force: 1, maxSpeed: 19, friction: 0.981 }),
  k: Object.freeze({ radius: 45, mass: 5.6, force: 1, maxSpeed: 12.5, friction: 0.965 }),
});

const MAJOR_TYPES = Object.freeze(["r", "n", "k", "b", "q"]);
const PAWN_COUNT = 5;
const DRAG_LIMIT = 190;
const MIN_LAUNCH = 18;
const STOP_SPEED = 0.075;
const IMPACT_ELASTICITY = 0.82;
const RESTITUTION_BOOST = 0.08;
const COLLIDER_SCALE = 0.8;
const COLLIDER_BASE_SHIFT = 0.44;
const COLLIDER_VIEW_SHIFT = Object.freeze({ front: 0.153, back: 0.44 });
const MATCH_DURATION_MS = 2 * 60 * 1000;
const TIMER_WARNING_SECONDS = 30;
const TURN_DURATION_MS = 8 * 1000;
const ARENA_OUTER_SIZE = 712;

function clampVector(x, y, maxLength) {
  const length = Math.hypot(x, y);
  if (length <= maxLength || length === 0) return { x, y, length };
  const scale = maxLength / length;
  return { x: x * scale, y: y * scale, length: maxLength };
}

function sideName(color) {
  return color === "b" ? t("side.b") : t("side.w");
}

export class KingdomTug extends Phaser.Scene {
  constructor() {
    super("KingdomTug");
    this.pieces = [];
    this.turn = "w";
    this.selected = null;
    this.pointerDown = null;
    this.settleFrames = 0;
    this.shotInProgress = false;
    this.lastImpactAt = 0;
    this.gameOver = false;
    this.aiTimer = null;
    this.gameSessionId = "";
    this.capturedBy = { w: [], b: [] };
    this.lastShooterColor = null;
    this._turnFlipBusy = false;
    this._lastTurn = "w";
    this.setupPhase = true;
    this.setupDragOrigin = null;
    this.setupUi = [];
    this.setupButtons = {};
    this.setupReady = { w: false, b: false };
    this.setupPlacementInvalid = null;
    this.setupZoneGraphics = null;
    this.setupBlockedRing = null;
    this.matchTimeRemainingMs = MATCH_DURATION_MS;
    this.displayedTimerSecond = null;
    this.timerUrgent = false;
    this.turnTimeRemainingMs = TURN_DURATION_MS;
    this.displayedTurnSecond = null;
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this, "bg_select");
    this.add.rectangle(0, 0, width, height, 0xfff8ea, 0.72).setOrigin(0).setDepth(-90);
    addDarkTopBar(this, "Kuma Chess", {
      onHome: () => {
        if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
      },
    });
    this.add.text(width / 2, 122, t("tug.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "30px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(120);

    const arenaOuterTop = Math.round((height - ARENA_OUTER_SIZE) / 2);
    this.boardLayout = getChessBoardLayout(this, {
      outerTop: arenaOuterTop,
      outerWidth: ARENA_OUTER_SIZE,
    });
    this.boardBounds = {
      left: this.boardLayout.boardX,
      top: this.boardLayout.boardY,
      right: this.boardLayout.boardX + this.boardLayout.squareSize * 8,
      bottom: this.boardLayout.boardY + this.boardLayout.squareSize * 8,
    };
    addChessBoard(this, this.boardLayout, 0);
    this.drawArenaEdges();
    this.drawHud();
    this.createInput();

    this.mode = this.registry.get("gameMode") === "ai" ? "ai" : "pvp";
    this.playerColor = this.registry.get("playerColor") === "b" ? "b" : "w";
    this.aiDifficulty = this.registry.get("aiDifficulty") || "normal";
    const skins = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skins = { w: skins.w || "classic", b: skins.b || "classic" };
    this.loadingText = this.add.text(width / 2, height / 2, "LOADING...", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(300);
    ensurePieceSetsLoaded(this, [
      { skin: this.skins.w, color: "w" },
      { skin: this.skins.b, color: "b" },
    ]).then(() => {
      if (!this.scene.isActive()) return;
      this.loadingText?.destroy();
      this.resetMatch();
    }).catch(() => {
      if (this.scene.isActive()) {
        this.loadingText?.destroy();
        showRewardLine(this, t("select.loadFailed"), { tone: "failure", showCoin: false });
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.aiTimer?.remove(false);
      this.tweens.killTweensOf(this.timerBadge);
      this.tweens.killTweensOf(this.opponentTimerBadge);
      this.clearGuide();
      this.destroySetupUi();
      this._capLayer?.destroy();
      this.pieces.forEach((piece) => this.destroyPieceObjects(piece));
      this.pieces = [];
    });
  }

  drawArenaEdges() {
    const { left, right, top, bottom } = this.boardBounds;
    const edge = this.add.graphics().setDepth(8);
    edge.lineStyle(5, 0xae7d2d, 0.55);
    edge.strokeRoundedRect(left - 2, top - 2, right - left + 4, bottom - top + 4, 10);
    edge.lineStyle(2, 0xfff1b6, 0.42);
    edge.strokeRoundedRect(left + 5, top + 5, right - left - 10, bottom - top - 10, 8);
  }

  drawHud() {
    const { width, height } = this.scale;
    this.topStatus = this.add.text(width / 2, 184, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.bottomStatus = this.add.text(width / 2, 1114, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.helpText = this.add.text(width / 2, height - 86, t("tug.help"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: "#8b6d4f",
      fontStyle: "600",
      align: "center",
    }).setOrigin(0.5).setDepth(120);

    this.timerBadgeBg = this.add.graphics();
    this.timerText = this.add.text(0, 0, "2:00", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5);
    this.timerBadge = this.add.container(width - 72, 148, [this.timerBadgeBg, this.timerText])
      .setDepth(126)
      .setVisible(false);

    this.opponentTimerBadgeBg = this.add.graphics();
    this.opponentTimerText = this.add.text(0, 0, "2:00", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5);
    this.opponentTimerBadge = this.add.container(72, height - 148, [this.opponentTimerBadgeBg, this.opponentTimerText])
      .setDepth(126)
      .setAngle(180)
      .setVisible(false);
    this.redrawTimerBadge(false);
  }

  createInput() {
    this.input.on("pointerdown", (pointer) => this.beginDrag(pointer));
    this.input.on("pointermove", (pointer) => this.updateDrag(pointer));
    this.input.on("pointerup", (pointer) => this.endDrag(pointer));
    this.input.on("pointerupoutside", (pointer) => this.endDrag(pointer));
  }

  resetMatch() {
    this.pieces.forEach((piece) => this.destroyPieceObjects(piece));
    this.pieces = [];
    this.turn = "w";
    this.selected = null;
    this.pointerDown = null;
    this.settleFrames = 0;
    this.shotInProgress = false;
    this.lastImpactAt = 0;
    this.gameOver = false;
    this.matchTimeRemainingMs = MATCH_DURATION_MS;
    this.displayedTimerSecond = null;
    this.turnTimeRemainingMs = TURN_DURATION_MS;
    this.displayedTurnSecond = null;
    this.setTimerUrgent(false);
    this.timerBadge?.setVisible(false);
    this.opponentTimerBadge?.setVisible(false);
    this.updateTimerDisplay(MATCH_DURATION_MS / 1000);
    this.resetTurnClock();
    this.aiTimer?.remove(false);
    this.aiTimer = null;
    this.capturedBy = { w: [], b: [] };
    this.lastShooterColor = null;
    this._turnFlipBusy = false;
    this._lastTurn = "w";
    this.setupPhase = true;
    this.setupDragOrigin = null;
    this.setupButtons = {};
    this.setupReady = {
      w: this.isAIMode() && this.playerColor !== "w",
      b: this.isAIMode() && this.playerColor !== "b",
    };
    this.setupPlacementInvalid = null;
    this.setupZoneGraphics = null;
    this.setupBlockedRing = null;
    this.gameSessionId = `tug-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    this.clearGuide();
    this.destroySetupUi();
    this.spawnPieces();
    this.showSetupUi();
    this.updateHud();
  }

  spawnPieces() {
    const columns = [1.05, 2.5, 4, 5.5, 6.95];
    const spawnRow = (color, types, row) => {
      types.forEach((type, index) => {
        this.createPhysicsPiece(color, type, columns[index], row);
      });
    };
    spawnRow("b", MAJOR_TYPES, 1.08);
    spawnRow("b", Array(PAWN_COUNT).fill("p"), 2.08);
    spawnRow("w", Array(PAWN_COUNT).fill("p"), 5.92);
    spawnRow("w", MAJOR_TYPES, 6.92);
  }

  createPhysicsPiece(color, type, col, row) {
    const stat = PIECE_STATS[type];
    const x = this.boardBounds.left + col * this.boardLayout.squareSize;
    const visualY = this.boardBounds.top + row * this.boardLayout.squareSize;
    const y = visualY + stat.radius * COLLIDER_BASE_SHIFT;
    const skin = this.skins[color] || "classic";
    const facing = this.getPieceFacing(color, this.turn);
    const viewSize = stat.radius * 2.05;
    const colliderRadius = stat.radius * COLLIDER_SCALE;
    const view = createPieceView(this, x, visualY, viewSize, skin, color, type, facing);
    alignBoardPieceView(view, viewSize, skin, facing);
    view.setRotation(this.getPieceAngle());
    view.setDepth(this.getPieceDepth(y));
    const base = this.createBaseMarker(x, y, colliderRadius, color);
    const piece = {
      id: `${color}-${type}-${this.pieces.length}`,
      color,
      type,
      skin,
      facing,
      radius: colliderRadius,
      artRadius: stat.radius,
      mass: stat.mass,
      force: stat.force,
      maxSpeed: stat.maxSpeed,
      friction: stat.friction,
      x,
      y,
      vx: 0,
      vy: 0,
      active: true,
      base,
      view,
    };
    view._tugPiece = piece;
    this.pieces.push(piece);
    return piece;
  }

  createBaseMarker(x, y, radius, color) {
    const marker = this.add.graphics().setPosition(x, y).setDepth(this.getBaseDepth(y));
    marker._radius = radius;
    marker._color = color;
    this.redrawBaseMarker(marker, false);
    return marker;
  }

  redrawBaseMarker(marker, isTurn) {
    if (!marker) return;
    const radius = marker._radius;
    const isWhite = marker._color === "w";
    const fill = isTurn ? 0xffcf58 : isWhite ? 0xfff0bd : 0x2d251d;
    const line = isTurn ? 0xffb72e : isWhite ? 0xb7832e : 0xffd778;
    marker.clear();
    marker.fillStyle(fill, isTurn ? 0.3 : isWhite ? 0.42 : 0.36);
    marker.fillCircle(0, 0, radius * 1.08);
    marker.lineStyle(isTurn ? 5 : 3, line, isTurn ? 0.98 : 0.72);
    marker.strokeCircle(0, 0, radius * 1.08);
    marker.lineStyle(2, 0xffffff, isTurn ? 0.48 : 0.28);
    marker.strokeCircle(0, 0, radius * 0.78);
  }

  destroyPieceObjects(piece) {
    piece?.view?.destroy();
    piece?.base?.destroy();
  }

  beginDrag(pointer) {
    if (this.gameOver || this.isMotionActive()) return;
    if (this.setupPhase) {
      this.beginSetupDrag(pointer);
      return;
    }
    if (this.isAIMode() && this.turn !== this.playerColor) return;
    const piece = this.pickPiece(pointer.x, pointer.y);
    if (!piece) return;
    this.selected = piece;
    this.pointerDown = { x: pointer.x, y: pointer.y };
    this.clearGuide();
    this.guide = this.add.graphics().setDepth(150);
    this.selectionRing = this.add.graphics().setDepth(35);
    playFeedback("ui");
    this.drawGuide(pointer.x, pointer.y);
  }

  updateDrag(pointer) {
    if (!this.selected) return;
    if (this.setupPhase) {
      this.updateSetupDrag(pointer);
      return;
    }
    this.drawGuide(pointer.x, pointer.y);
  }

  endDrag(pointer) {
    if (!this.selected) return;
    if (this.setupPhase) {
      this.endSetupDrag(pointer);
      return;
    }
    const piece = this.selected;
    const launch = clampVector(piece.x - pointer.x, piece.y - pointer.y, DRAG_LIMIT);
    this.clearGuide();
    this.selected = null;
    this.pointerDown = null;
    if (launch.length < MIN_LAUNCH) {
      this.updateHud();
      return;
    }
    this.launchPiece(piece, launch);
    playFeedback("move");
    vibrateFeedback("move");
    this.updateHud(t("tug.moving"));
  }

  beginSetupDrag(pointer) {
    const piece = this.pickSetupPiece(pointer.x, pointer.y);
    if (!piece) return;
    this.selected = piece;
    this.setupDragOrigin = { x: piece.x, y: piece.y };
    this.clearGuide();
    this.selectionRing = this.add.graphics().setDepth(150);
    this.setupBlockedRing = this.add.graphics().setDepth(153);
    piece.view?.setDepth(152);
    piece.base?.setDepth(151);
    this.updateSetupFeedback(piece, pointer, this.getSetupBounds(piece));
    playFeedback("ui");
  }

  updateSetupDrag(pointer) {
    const piece = this.selected;
    if (!piece) return;
    const bounds = this.getSetupBounds(piece);
    piece.x = Phaser.Math.Clamp(pointer.x, bounds.left, bounds.right);
    piece.y = Phaser.Math.Clamp(pointer.y, bounds.top, bounds.bottom);
    this.updateSetupFeedback(piece, pointer, bounds);
    this.syncViews();
  }

  endSetupDrag(pointer) {
    const piece = this.selected;
    if (!piece) return;
    this.updateSetupDrag(pointer);
    const invalid = this.setupPlacementInvalid;
    if (invalid?.invalid && this.setupDragOrigin) {
      piece.x = this.setupDragOrigin.x;
      piece.y = this.setupDragOrigin.y;
      playFeedback("error");
      vibrateFeedback("error");
      this.showSetupMessage(t(invalid.reason === "overlap" ? "tug.setupOverlap" : "tug.setupInvalid"));
    }
    this.selected = null;
    this.setupDragOrigin = null;
    this.setupPlacementInvalid = null;
    this.clearGuide();
    this.redrawSetupZones();
    this.syncViews();
    this.updateBaseMarkers();
  }

  pickSetupPiece(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const piece of this.pieces) {
      if (!piece.active) continue;
      if (this.isAIMode() && piece.color !== this.playerColor) continue;
      if (this.setupReady[piece.color]) continue;
      const distance = Math.hypot(piece.x - x, piece.y - y);
      if (distance <= piece.radius * 1.55 && distance < bestDistance) {
        best = piece;
        bestDistance = distance;
      }
    }
    return best;
  }

  getSetupBounds(piece) {
    const { left, right, top, bottom } = this.boardBounds;
    const zoneHeight = this.boardLayout.squareSize * 3;
    const margin = piece.radius + 4;
    return {
      left: left + margin,
      right: right - margin,
      top: piece.color === "b" ? top + margin : bottom - zoneHeight + margin,
      bottom: piece.color === "b" ? top + zoneHeight - margin : bottom - margin,
    };
  }

  getSetupOverlaps(piece) {
    return this.pieces.filter((other) => (
      other !== piece
      && other.active
      && Math.hypot(other.x - piece.x, other.y - piece.y) < other.radius + piece.radius + 5
    ));
  }

  updateSetupFeedback(piece, pointer, bounds) {
    const outside = pointer.x < bounds.left
      || pointer.x > bounds.right
      || pointer.y < bounds.top
      || pointer.y > bounds.bottom;
    const overlaps = this.getSetupOverlaps(piece);
    const invalid = outside || overlaps.length > 0;
    this.setupPlacementInvalid = {
      invalid,
      reason: overlaps.length > 0 ? "overlap" : outside ? "outside" : "",
    };

    const color = invalid ? 0xd84b3e : 0xffc444;
    this.selectionRing?.clear();
    this.selectionRing?.fillStyle(color, invalid ? 0.2 : 0.12);
    this.selectionRing?.fillCircle(piece.x, piece.y, piece.radius + 10);
    this.selectionRing?.lineStyle(invalid ? 7 : 5, color, 0.98);
    this.selectionRing?.strokeCircle(piece.x, piece.y, piece.radius + 10);

    this.setupBlockedRing?.clear();
    if (invalid && overlaps.length) {
      this.setupBlockedRing?.lineStyle(7, 0xd84b3e, 0.94);
      overlaps.forEach((other) => this.setupBlockedRing?.strokeCircle(other.x, other.y, other.radius + 10));
    }
    this.redrawSetupZones(piece.color, invalid);
  }

  showSetupUi() {
    const { width } = this.scale;
    const { left, right, top, bottom } = this.boardBounds;
    const zoneHeight = this.boardLayout.squareSize * 3;
    this.setupZoneGraphics = this.add.graphics().setDepth(9);
    this.redrawSetupZones();

    const blackZone = this.add.text(width / 2, top + zoneHeight - 18, t("tug.setupZone", { side: sideName("b") }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: "#765c40",
      fontStyle: "700",
    }).setOrigin(0.5).setAlpha(0.72).setDepth(10).setAngle(this.isAIMode() ? 0 : 180);
    const whiteZone = this.add.text(width / 2, bottom - zoneHeight + 18, t("tug.setupZone", { side: sideName("w") }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: "#765c40",
      fontStyle: "700",
    }).setOrigin(0.5).setAlpha(0.72).setDepth(10);

    this.setupButtons = {};
    const readyButtonColors = this.isAIMode() ? [this.playerColor] : ["b", "w"];
    for (const color of readyButtonColors) {
      this.setupButtons[color] = this.createSetupReadyButton(
        color,
        color === "b" ? 212 : 1092,
        !this.isAIMode() && color === "b"
      );
    }
    this.setupUi = [this.setupZoneGraphics, blackZone, whiteZone];
    Object.values(this.setupButtons).forEach((entry) => {
      this.setupUi.push(entry.button, entry.title, entry.sub);
    });
    this.setupUi = this.setupUi.filter(Boolean);
    this.refreshSetupReadyButtons();
  }

  redrawSetupZones(activeColor = null, invalid = false) {
    const zones = this.setupZoneGraphics;
    if (!zones) return;
    const { left, right, top, bottom } = this.boardBounds;
    const zoneHeight = this.boardLayout.squareSize * 3;
    const drawZone = (color, y, baseFill) => {
      const isInvalid = invalid && activeColor === color;
      const isActive = activeColor === color;
      zones.fillStyle(isInvalid ? 0xd84b3e : baseFill, isInvalid ? 0.2 : isActive ? 0.18 : 0.12);
      zones.fillRect(left, y, right - left, zoneHeight);
      zones.lineStyle(8, isInvalid ? 0x7a1f19 : 0x5f431f, isInvalid ? 0.92 : 0.78);
      zones.strokeRect(left + 3, y + 3, right - left - 6, zoneHeight - 6);
      zones.lineStyle(isInvalid ? 5 : isActive ? 5 : 4, isInvalid ? 0xff6254 : 0xffc342, 1);
      zones.strokeRect(left + 7, y + 7, right - left - 14, zoneHeight - 14);
      zones.lineStyle(2, isInvalid ? 0xffd0ca : 0xfff0a6, isInvalid ? 0.86 : 0.78);
      zones.strokeRect(left + 12, y + 12, right - left - 24, zoneHeight - 24);
    };
    zones.clear();
    drawZone("b", top, 0x2d251d);
    drawZone("w", bottom - zoneHeight, 0xffd778);
  }

  createSetupReadyButton(color, y, upsideDown) {
    const ready = addLargeTextButton(this, this.scale.width / 2, y, "", "", () => this.toggleSetupReady(color), {
      width: 270,
      height: 62,
      fontSize: 23,
      dark: color === "b",
      depth: 130,
    });
    if (upsideDown) {
      ready.button.setAngle(180);
      ready.title.setAngle(180);
    }
    return ready;
  }

  refreshSetupReadyButtons() {
    for (const color of ["b", "w"]) {
      const entry = this.setupButtons[color];
      if (!entry) continue;
      const ready = this.setupReady[color];
      entry.title.setText(t(ready ? "tug.readyDone" : "tug.ready", { side: sideName(color) }));
      entry.title.setColor(ready ? KUMA_COLORS.orange : color === "b" ? "#fff8dc" : KUMA_COLORS.ink);
      entry.button.setSelected(ready);
      entry.button.setEnabled(true);
    }
  }

  toggleSetupReady(color) {
    if (!this.setupPhase || this.selected) return;
    if (this.isAIMode() && color !== this.playerColor) return;
    this.setupReady[color] = !this.setupReady[color];
    this.refreshSetupReadyButtons();
    this.updateBaseMarkers();
    if (this.setupReady.w && this.setupReady.b) this.beginMatch();
  }

  destroySetupUi() {
    this.setupUi?.forEach((item) => item?.destroy?.());
    this.setupUi = [];
    this.setupButtons = {};
    this.setupZoneGraphics = null;
  }

  showSetupMessage(message) {
    this.helpText?.setText(message).setColor("#c94b3f");
    this.time.delayedCall(900, () => {
      if (this.scene.isActive() && this.setupPhase) this.updateHud();
    });
  }

  beginMatch() {
    if (!this.setupPhase || this.selected || !this.setupReady.w || !this.setupReady.b) return;
    this.setupPhase = false;
    this.destroySetupUi();
    this.matchTimeRemainingMs = MATCH_DURATION_MS;
    this.displayedTimerSecond = null;
    this.timerBadge?.setVisible(true);
    this.opponentTimerBadge?.setVisible(!this.isAIMode());
    this.updateTimerDisplay(MATCH_DURATION_MS / 1000);
    this.resetTurnClock();
    this.renderCaptured();
    this.updateHud();
    this.scheduleAiTurn();
    playFeedback("success");
  }

  launchPiece(piece, launch) {
    if (!piece || !launch?.length) return;
    const powerRatio = Phaser.Math.Clamp(launch.length / DRAG_LIMIT, 0, 1);
    const speed = piece.maxSpeed * Math.pow(powerRatio, 1.18);
    piece.vx = (launch.x / launch.length) * speed;
    piece.vy = (launch.y / launch.length) * speed;
    this.lastShooterColor = piece.color;
    this.settleFrames = 0;
    this.shotInProgress = true;
  }

  scheduleAiTurn() {
    this.aiTimer?.remove(false);
    this.aiTimer = null;
    if (!this.isAIMode() || this.gameOver || this.turn === this.playerColor || this.isMotionActive()) return;
    this.aiTimer = this.time.delayedCall(620, () => this.takeAiTurn());
  }

  takeAiTurn() {
    if (!this.scene.isActive() || this.gameOver || this.turn === this.playerColor || this.isMotionActive()) return;
    const aiColor = this.turn;
    const humanKing = this.pieces.find((piece) => piece.active && piece.color === this.playerColor && piece.type === "k");
    const candidates = this.pieces.filter((piece) => piece.active && piece.color === aiColor);
    if (!humanKing || candidates.length === 0) return;
    const difficulty = AI_POWER[this.aiDifficulty] ? this.aiDifficulty : "normal";
    const humanPieces = this.pieces.filter((piece) => piece.active && piece.color === this.playerColor);
    const shot = this.chooseAiDefensiveShot(candidates, difficulty)
      || this.chooseAiShot(candidates, humanPieces, humanKing, difficulty);
    const piece = shot.piece;
    const error = AI_ERROR[difficulty];
    const targetX = shot.targetX ?? shot.target.x + Phaser.Math.Between(-error, error);
    const targetY = shot.targetY ?? shot.target.y + Phaser.Math.Between(-error, error);
    const directionX = targetX - piece.x;
    const directionY = targetY - piece.y;
    const length = Math.hypot(directionX, directionY) || 1;
    const [varianceMin, varianceMax] = AI_POWER_VARIANCE[difficulty];
    const variance = Phaser.Math.FloatBetween(varianceMin, varianceMax);
    const boardDiagonal = Math.hypot(
      this.boardBounds.right - this.boardBounds.left,
      this.boardBounds.bottom - this.boardBounds.top
    );
    const distanceRatio = Phaser.Math.Clamp(length / boardDiagonal, 0, 1);
    const distanceBoost = difficulty === "easy" ? distanceRatio * 0.04 : distanceRatio * 0.12;
    const powerRatio = shot.powerRatio ?? Phaser.Math.Clamp(AI_POWER[difficulty] + distanceBoost, 0.3, 1);
    const power = DRAG_LIMIT * powerRatio * variance;
    const launch = {
      x: (directionX / length) * power,
      y: (directionY / length) * power,
      length: power,
    };
    this.launchPiece(piece, launch);
    playFeedback("move");
    this.updateHud(t("tug.moving"));
  }

  chooseAiDefensiveShot(candidates, difficulty) {
    if (difficulty === "easy") return null;
    const king = candidates.find((piece) => piece.type === "k");
    if (!king) return null;

    const clearance = this.distanceToBoardEdge(king) - king.radius;
    const threshold = this.boardLayout.squareSize * (difficulty === "hard" ? 0.72 : 0.34);
    if (clearance > threshold) return null;

    const centerX = (this.boardBounds.left + this.boardBounds.right) / 2;
    const centerY = (this.boardBounds.top + this.boardBounds.bottom) / 2;
    const centerDx = centerX - king.x;
    const centerDy = centerY - king.y;
    const centerDistance = Math.hypot(centerDx, centerDy) || 1;
    const urgency = Phaser.Math.Clamp(1 - clearance / threshold, 0, 1.4);
    const desiredDistance = Math.min(
      centerDistance,
      this.boardLayout.squareSize * (1 + urgency * 1.1)
    );
    const inwardAngle = Math.atan2(centerDy, centerDx);
    const angleOffsets = difficulty === "hard"
      ? [0, -18, 18, -36, 36, -48, 48, -60, 60, -72, 72]
      : [0, -24, 24, -42, 42];
    let bestPath = null;

    for (const offset of angleOffsets) {
      const angle = inwardAngle + Phaser.Math.DegToRad(offset);
      const point = {
        x: Phaser.Math.Clamp(king.x + Math.cos(angle) * desiredDistance, this.boardBounds.left + king.radius, this.boardBounds.right - king.radius),
        y: Phaser.Math.Clamp(king.y + Math.sin(angle) * desiredDistance, this.boardBounds.top + king.radius, this.boardBounds.bottom - king.radius),
      };
      const blockers = this.getAiShotBlockers(king, point, true);
      const friendlyBlocks = blockers.filter((blocker) => blocker.color === king.color).length;
      const enemyBlocks = blockers.length - friendlyBlocks;
      const centerAfter = Math.hypot(centerX - point.x, centerY - point.y);
      const edgeAfter = this.distanceToBoardEdge(point) - king.radius;
      const score = friendlyBlocks * 1800
        + enemyBlocks * 720
        + centerAfter * 0.1
        - edgeAfter * 1.8
        + Math.abs(offset) * 0.2;
      if (!bestPath || score < bestPath.score) bestPath = { ...point, score };
    }

    if (!bestPath) return null;
    const pathDistance = Math.hypot(bestPath.x - king.x, bestPath.y - king.y);
    const requiredPower = pathDistance * (1 - king.friction) / king.maxSpeed;
    const powerRatio = Phaser.Math.Clamp(
      requiredPower * (difficulty === "hard" ? 1.22 : 1.08),
      difficulty === "hard" ? 0.38 : 0.32,
      difficulty === "hard" ? 0.7 : 0.52
    );
    return {
      piece: king,
      targetX: bestPath.x,
      targetY: bestPath.y,
      powerRatio,
      defensive: true,
    };
  }

  chooseAiShot(candidates, humanPieces, humanKing, difficulty) {
    const availableTargets = humanPieces.length ? humanPieces : [humanKing];
    if (difficulty === "easy") {
      return {
        piece: Phaser.Utils.Array.GetRandom(candidates),
        target: Phaser.Utils.Array.GetRandom(availableTargets),
      };
    }

    const edgeTarget = [...availableTargets].sort((a, b) => this.distanceToBoardEdge(a) - this.distanceToBoardEdge(b))[0];
    const targets = difficulty === "hard"
      ? availableTargets
      : [humanKing, edgeTarget].filter((target, index, list) => target && list.indexOf(target) === index);
    let best = null;

    for (const piece of candidates) {
      for (const target of targets) {
        const distance = Math.hypot(target.x - piece.x, target.y - piece.y);
        const blockers = this.getAiShotBlockers(piece, target);
        const friendlyBlocks = blockers.filter((blocker) => blocker.color === piece.color).length;
        const enemyBlocks = blockers.length - friendlyBlocks;
        const kingTargetBonus = target.type === "k" ? (difficulty === "hard" ? 760 : 520) : 0;
        const edgeBonus = Math.max(0, 140 - this.distanceToBoardEdge(target)) * (difficulty === "hard" ? 1.2 : 0.55);
        const shooterKingPenalty = piece.type === "k" ? (difficulty === "hard" ? 260 : 170) : 0;
        const speedBonus = piece.maxSpeed * (difficulty === "hard" ? 5.2 : 3.5);
        const massBonus = piece.mass * 15;
        const score = distance
          + friendlyBlocks * 520
          + enemyBlocks * 125
          + shooterKingPenalty
          - kingTargetBonus
          - edgeBonus
          - speedBonus
          - massBonus
          + Phaser.Math.FloatBetween(0, 12);
        if (!best || score < best.score) best = { piece, target, score };
      }
    }

    return best || { piece: candidates[0], target: humanKing };
  }

  getAiShotBlockers(shooter, target, includeDestination = false) {
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const lengthSq = dx * dx + dy * dy || 1;
    return this.pieces.filter((piece) => {
      if (!piece.active || piece === shooter || piece === target) return false;
      const projection = ((piece.x - shooter.x) * dx + (piece.y - shooter.y) * dy) / lengthSq;
      if (projection <= 0.1 || projection >= (includeDestination ? 1.08 : 0.92)) return false;
      const closestX = shooter.x + dx * projection;
      const closestY = shooter.y + dy * projection;
      const corridor = piece.radius + shooter.radius * 0.58;
      return Math.hypot(piece.x - closestX, piece.y - closestY) < corridor;
    });
  }

  distanceToBoardEdge(piece) {
    return Math.min(
      piece.x - this.boardBounds.left,
      this.boardBounds.right - piece.x,
      piece.y - this.boardBounds.top,
      this.boardBounds.bottom - piece.y
    );
  }

  pickPiece(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const piece of this.pieces) {
      if (!piece.active || piece.color !== this.turn) continue;
      const distance = Math.hypot(piece.x - x, piece.y - y);
      if (distance <= piece.radius * 1.45 && distance < bestDistance) {
        best = piece;
        bestDistance = distance;
      }
    }
    return best;
  }

  drawGuide(pointerX, pointerY) {
    if (!this.selected || !this.guide) return;
    const piece = this.selected;
    const launch = clampVector(piece.x - pointerX, piece.y - pointerY, DRAG_LIMIT);
    const power = Math.round((launch.length / DRAG_LIMIT) * 100);
    const endX = piece.x + launch.x;
    const endY = piece.y + launch.y;
    this.guide.clear();
    this.guide.lineStyle(7, 0xf3b63e, 0.82);
    this.guide.beginPath();
    this.guide.moveTo(piece.x, piece.y);
    this.guide.lineTo(endX, endY);
    this.guide.strokePath();
    this.guide.lineStyle(3, 0xffffff, 0.75);
    this.guide.strokeCircle(endX, endY, 13);
    this.guide.fillStyle(0x2f251a, 0.86);
    this.guide.fillRoundedRect(piece.x - 44, piece.y - piece.radius - 58, 88, 32, 12);
    this.selectionRing?.clear();
    this.selectionRing?.lineStyle(5, 0xffd869, 0.9);
    this.selectionRing?.strokeCircle(piece.x, piece.y, piece.radius + 12);

    this.powerText?.destroy();
    this.powerText = this.add.text(piece.x, piece.y - piece.radius - 42, `${power}%`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: "#fff8df",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(151);
  }

  clearGuide() {
    this.guide?.destroy();
    this.guide = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
    this.powerText?.destroy();
    this.powerText = null;
    this.setupBlockedRing?.destroy();
    this.setupBlockedRing = null;
  }

  update(_time, delta) {
    if (this.gameOver || !this.pieces.length) return;
    if (this.setupPhase) {
      this.syncViews();
      return;
    }
    const dt = Math.min(Math.max(delta / 16.666, 0.25), 2.4);
    this.integrate(dt);
    this.resolveCollisions();
    this.removeOutPieces();
    this.syncViews();
    if (this.gameOver) return;
    this.updateMatchClock(delta);
    if (this.gameOver) return;
    if (!this.selected) this.checkSettled();
    this.updateTurnClock(delta);
  }

  integrate(dt) {
    for (const piece of this.pieces) {
      if (!piece.active) continue;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      const friction = Math.pow(piece.friction, dt);
      piece.vx *= friction;
      piece.vy *= friction;
      if (Math.hypot(piece.vx, piece.vy) < STOP_SPEED) {
        piece.vx = 0;
        piece.vy = 0;
      }
    }
  }

  resolveCollisions() {
    const active = this.pieces.filter((piece) => piece.active);
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        this.resolvePair(active[i], active[j]);
      }
    }
  }

  resolvePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const target = a.radius + b.radius;
    if (distance >= target) return;
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = target - distance;
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const totalInv = invA + invB;
    a.x -= nx * overlap * (invA / totalInv);
    a.y -= ny * overlap * (invA / totalInv);
    b.x += nx * overlap * (invB / totalInv);
    b.y += ny * overlap * (invB / totalInv);

    const relX = a.vx - b.vx;
    const relY = a.vy - b.vy;
    const velAlongNormal = relX * nx + relY * ny;
    if (velAlongNormal <= 0) return;
    const impulse = -((IMPACT_ELASTICITY + RESTITUTION_BOOST) * velAlongNormal) / totalInv;
    a.vx += impulse * invA * nx;
    a.vy += impulse * invA * ny;
    b.vx -= impulse * invB * nx;
    b.vy -= impulse * invB * ny;
    if (velAlongNormal > 0.85 && this.time.now - this.lastImpactAt > 110) {
      this.lastImpactAt = this.time.now;
      this.spawnImpact(a.x + nx * a.radius, a.y + ny * a.radius, velAlongNormal);
      playFeedback("capture");
    }
  }

  spawnImpact(x, y, strength = 1) {
    const size = Phaser.Math.Clamp(18 + strength * 6, 22, 46);
    const layer = this.add.container(x, y).setDepth(210);
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xffdf78, 0.96);
    ring.strokeCircle(0, 0, size * 0.55);
    ring.lineStyle(2, 0xffffff, 0.78);
    ring.strokeCircle(0, 0, size * 0.32);

    const sparks = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      const spark = this.add.rectangle(
        Math.cos(angle) * size * 0.5,
        Math.sin(angle) * size * 0.5,
        12,
        4,
        index % 2 ? 0xfff1b6 : 0xe3a43d,
        0.95
      ).setAngle(Phaser.Math.RadToDeg(angle));
      sparks.push(spark);
    }
    layer.add([ring, ...sparks]);
    this.tweens.add({
      targets: layer,
      alpha: 0,
      scaleX: 1.72,
      scaleY: 1.72,
      duration: 260,
      ease: "Sine.Out",
      onComplete: () => layer.destroy(true),
    });
  }

  removeOutPieces() {
    const margin = 1.15;
    for (const piece of this.pieces) {
      if (!piece.active) continue;
      const out = piece.x < this.boardBounds.left - piece.radius * margin
        || piece.x > this.boardBounds.right + piece.radius * margin
        || piece.y < this.boardBounds.top - piece.radius * margin
        || piece.y > this.boardBounds.bottom + piece.radius * margin;
      if (!out) continue;
      this.eliminate(piece);
      if (piece.type === "k") {
        this.finishMatch(piece.color === "w" ? "b" : "w");
        return;
      }
    }
  }

  eliminate(piece) {
    if (piece.type !== "k") this.recordCapture(piece);
    piece.active = false;
    piece.vx = 0;
    piece.vy = 0;
    this.tweens.add({
      targets: [piece.view, piece.base].filter(Boolean),
      alpha: 0,
      scaleX: 0.62,
      scaleY: 0.62,
      duration: 260,
      ease: "Sine.In",
      onComplete: () => this.destroyPieceObjects(piece),
    });
    this.renderCaptured();
    playFeedback(piece.type === "k" ? "failure" : "capture");
    vibrateFeedback(piece.type === "k" ? "failure" : "move");
  }

  recordCapture(piece) {
    const capturer = this.lastShooterColor && this.lastShooterColor !== piece.color
      ? this.lastShooterColor
      : piece.color === "w" ? "b" : "w";
    this.capturedBy[capturer].push({ color: piece.color, type: piece.type });
  }

  renderCaptured() {
    if (this._capLayer) this._capLayer.destroy();
    this._capLayer = this.add.container(0, 0).setDepth(18);

    const { width, height } = this.scale;

    const boardTop = this.boardBounds.top;
    const boardBottom = this.boardBounds.bottom;
    const topBarY = Math.max(250, boardTop - 58);
    const topCapturedY = this.isAIMode() ? topBarY - 34 : topBarY;
    const bottomBarY = Math.min(height - 170, boardBottom + 58);
    const labelStyle = { fontFamily: KUMA_FONT_SANS, fontSize: "18px", color: KUMA_COLORS.ink, fontStyle: "500" };
    const faceToFace = !this.isAIMode();
    const boardLeft = this.boardBounds.left;
    const boardRight = this.boardBounds.right;

    const labelBlack = this.add.text(
      faceToFace ? boardRight + 18 : boardLeft - 18,
      this.isAIMode() ? topCapturedY : topBarY - 28,
      t("game.captured"),
      labelStyle
    ).setOrigin(0, 0.5).setAngle(faceToFace ? 180 : 0);
    const labelWhite = this.add.text(boardLeft - 18, bottomBarY, t("game.captured"), labelStyle).setOrigin(0, 0.5);
    this._capLayer.add([labelBlack, labelWhite]);

    const minX = boardLeft + 8;
    const maxX = boardRight - 8;
    const leftStartX = Math.max(boardLeft + 122, labelWhite.x + labelWhite.width + 18);
    const rightStartX = Math.min(boardRight - 122, labelBlack.x - labelBlack.width - 18);

    const drawRow = (arr, baseY, { startX, direction, perspectiveTurn, upsideDown }) => {
      const availableWidth = direction > 0 ? maxX - startX : startX - minX;
      const gap = arr.length > 1
        ? Math.min(44, availableWidth / (arr.length - 1))
        : 0;
      const artWidth = arr.length > 10 ? 38 : arr.length > 7 ? 44 : 50;
      arr.forEach((p, i) => {
        const x = startX + direction * i * gap;
        const skin = this.getRenderSkin(p.color);
        const facing = this.getPieceFacing(p.color, perspectiveTurn);
        const view = createPieceView(this, x, baseY, 58, skin, p.color, p.type, facing);
        view._color = p.color;
        view._type = p.type;
        view._skin = skin;
        view._pieceSize = 58;
        const image = view._pieceImage;
        if (image && typeof image.setDisplaySize === "function") {
          image.setPosition(0, 0);
          image.setDisplaySize(artWidth, skin === "icon" ? artWidth : artWidth * 1.5);
        }
        view.setDepth(19);
        view.setAngle(upsideDown ? 180 : 0);
        this._capLayer.add(view);
      });
    };

    const topCaptured = this.isAIMode()
      ? this.capturedBy[this.opponentColor()]
      : this.capturedBy.b;
    const bottomCaptured = this.isAIMode()
      ? this.capturedBy[this.playerColor]
      : this.capturedBy.w;

    drawRow(topCaptured, topCapturedY, {
      startX: faceToFace ? rightStartX : leftStartX,
      direction: faceToFace ? -1 : 1,
      perspectiveTurn: faceToFace ? "b" : this.turn,
      upsideDown: faceToFace,
    });
    drawRow(bottomCaptured, bottomBarY, {
      startX: leftStartX,
      direction: 1,
      perspectiveTurn: faceToFace ? "w" : this.turn,
      upsideDown: false,
    });
  }

  syncViews() {
    for (const piece of this.pieces) {
      if (!piece.active || !piece.view?.scene) continue;
      piece.base?.setPosition(piece.x, piece.y);
      piece.base?.setDepth(this.setupPhase && piece === this.selected ? 151 : this.getBaseDepth(piece.y));
      if (piece.view._tugFlipTweening) continue;
      piece.view.setPosition(piece.x, this.getViewY(piece, this.turn));
      piece.view.setDepth(this.setupPhase && piece === this.selected ? 152 : this.getPieceDepth(piece.y, this.turn));
      piece.view.setRotation(this.getPieceAngle(this.turn));
    }
  }

  checkSettled() {
    if (!this.shotInProgress) return;
    if (this.isMotionActive()) {
      this.settleFrames = 0;
      return;
    }
    this.settleFrames += 1;
    if (this.settleFrames < 18) return;
    this.settleFrames = 0;
    this.shotInProgress = false;
    this.turn = this.turn === "w" ? "b" : "w";
    this.resetTurnClock();
    this.updateHud();
    this.applyTurnPerspective(() => this.scheduleAiTurn());
  }

  isMotionActive() {
    return this.pieces.some((piece) => piece.active && Math.hypot(piece.vx, piece.vy) > STOP_SPEED);
  }

  updateMatchClock(delta) {
    if (this.setupPhase || this.gameOver) return;
    const elapsed = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.matchTimeRemainingMs = Math.max(0, this.matchTimeRemainingMs - elapsed);
    const seconds = Math.ceil(this.matchTimeRemainingMs / 1000);
    this.updateTimerDisplay(seconds);
    if (this.matchTimeRemainingMs <= 0) this.finishMatchByTime();
  }

  resetTurnClock() {
    this.turnTimeRemainingMs = TURN_DURATION_MS;
    this.displayedTurnSecond = Math.ceil(TURN_DURATION_MS / 1000);
  }

  updateTurnClock(delta) {
    if (this.setupPhase || this.gameOver || this.shotInProgress || this.isMotionActive() || this._turnFlipBusy) return;
    const elapsed = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.turnTimeRemainingMs = Math.max(0, this.turnTimeRemainingMs - elapsed);
    const seconds = Math.ceil(this.turnTimeRemainingMs / 1000);
    if (seconds !== this.displayedTurnSecond) {
      this.displayedTurnSecond = seconds;
      this.updateHud();
    }
    if (this.turnTimeRemainingMs <= 0) this.skipExpiredTurn();
  }

  skipExpiredTurn() {
    if (this.gameOver || this.setupPhase || this.shotInProgress || this.isMotionActive()) return;
    const expiredSide = this.turn;
    this.selected = null;
    this.pointerDown = null;
    this.clearGuide();
    this.turn = this.turn === "w" ? "b" : "w";
    this.resetTurnClock();
    this.updateHud();
    playFeedback("wrong");
    showRewardLine(this, t("tug.turnExpired", { side: sideName(expiredSide) }), {
      y: this.scale.height * 0.5,
      tone: "failure",
      showCoin: false,
      hold: 1100,
    });
    this.applyTurnPerspective(() => this.scheduleAiTurn());
  }

  updateTimerDisplay(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    if (safeSeconds === this.displayedTimerSecond) return;
    this.displayedTimerSecond = safeSeconds;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = String(safeSeconds % 60).padStart(2, "0");
    this.timerText?.setText(`${minutes}:${remainder}`);
    this.opponentTimerText?.setText(`${minutes}:${remainder}`);
    this.setTimerUrgent(safeSeconds <= TIMER_WARNING_SECONDS);
  }

  setTimerUrgent(urgent) {
    if (!this.timerBadge) {
      this.timerUrgent = urgent;
      return;
    }
    if (this.timerUrgent === urgent && this.displayedTimerSecond !== null) return;
    this.timerUrgent = urgent;
    const badges = [this.timerBadge, this.opponentTimerBadge].filter(Boolean);
    for (const badge of badges) {
      this.tweens.killTweensOf(badge);
      badge.setScale(urgent ? 1.06 : 1);
    }
    for (const text of [this.timerText, this.opponentTimerText].filter(Boolean)) {
      text.setFontSize(urgent ? 28 : 24).setColor(urgent ? "#fff8dc" : KUMA_COLORS.ink);
    }
    this.redrawTimerBadge(urgent);
    if (urgent) {
      for (const badge of badges) {
        this.tweens.add({
          targets: badge,
          scaleX: 1.16,
          scaleY: 1.16,
          duration: 320,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
      }
    }
  }

  redrawTimerBadge(urgent) {
    for (const background of [this.timerBadgeBg, this.opponentTimerBadgeBg].filter(Boolean)) {
      background.clear();
      background.fillStyle(urgent ? 0x9c2f27 : 0xfff4d8, urgent ? 0.98 : 0.94);
      background.fillRoundedRect(-58, -23, 116, 46, 14);
      background.lineStyle(urgent ? 5 : 3, urgent ? 0xffca4e : 0xb8893d, 1);
      background.strokeRoundedRect(-58, -23, 116, 46, 14);
      if (urgent) {
        background.lineStyle(2, 0xfff3b0, 0.9);
        background.strokeRoundedRect(-52, -17, 104, 34, 10);
      }
    }
  }

  finishMatchByTime() {
    if (this.gameOver) return;
    const remainingPieces = this.pieces.reduce((counts, piece) => {
      if (piece.active) counts[piece.color] += 1;
      return counts;
    }, { w: 0, b: 0 });
    const winner = remainingPieces.w === remainingPieces.b
      ? null
      : remainingPieces.w > remainingPieces.b ? "w" : "b";
    for (const piece of this.pieces) {
      piece.vx = 0;
      piece.vy = 0;
    }
    this.finishMatch(winner, { reason: "timeout", remainingPieces });
  }

  updateHud(message = "") {
    if (!this.topStatus || !this.bottomStatus) return;
    this.topStatus.setAngle(!this.isAIMode() ? 180 : 0);
    this.bottomStatus.setAngle(0);
    if (this.setupPhase) {
      this.topStatus.setVisible(false);
      this.bottomStatus.setVisible(false);
      this.helpText?.setText(t("tug.setupHelp")).setColor("#8b6d4f");
      this.updateBaseMarkers();
      return;
    }
    this.topStatus.setVisible(true).setFontSize(24);
    this.bottomStatus.setVisible(true);
    this.helpText?.setText(t("tug.help")).setColor("#8b6d4f");
    const base = message || t("tug.turnTimed", {
      side: sideName(this.turn),
      seconds: Math.max(0, this.displayedTurnSecond ?? Math.ceil(TURN_DURATION_MS / 1000)),
    });
    this.topStatus.setText(this.turn === "b" ? base : t("tug.wait", { side: sideName("b") }));
    this.bottomStatus.setText(this.turn === "w" ? base : t("tug.wait", { side: sideName("w") }));
    this.topStatus.setColor(this.turn === "b" ? KUMA_COLORS.orange : "#9b8268");
    this.bottomStatus.setColor(this.turn === "w" ? KUMA_COLORS.orange : "#9b8268");
    this.updateBaseMarkers();
  }

  updateBaseMarkers() {
    for (const piece of this.pieces) {
      if (!piece.active) continue;
      const active = this.setupPhase
        ? (!this.setupReady[piece.color] && (!this.isAIMode() || piece.color === this.playerColor))
        : piece.color === this.turn;
      this.redrawBaseMarker(piece.base, active);
    }
  }

  finishMatch(winner, { reason = "pushout", remainingPieces = null } = {}) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.shotInProgress = false;
    this.selected = null;
    this.pointerDown = null;
    this.aiTimer?.remove(false);
    this.aiTimer = null;
    this.tweens.killTweensOf(this.timerBadge);
    this.tweens.killTweensOf(this.opponentTimerBadge);
    this.timerBadge?.setScale(this.timerUrgent ? 1.06 : 1);
    this.opponentTimerBadge?.setScale(this.timerUrgent ? 1.06 : 1);
    this.clearGuide();
    this.updateHud(winner
      ? t("tug.result", { side: sideName(winner) })
      : t("tug.timeDraw"));
    playFeedback(winner
      ? winner === this.playerColor || !this.isAIMode() ? "win" : "failure"
      : "draw");
    this.time.delayedCall(900, () => this.finishToResult(winner, reason, remainingPieces));
  }

  finishToResult(winner, reason = "pushout", remainingPieces = null) {
    if (!this.scene.isActive()) return;
    const resolvedRemaining = remainingPieces || this.pieces.reduce((counts, piece) => {
      if (piece.active) counts[piece.color] += 1;
      return counts;
    }, { w: 0, b: 0 });
    const medalResult = recordMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "tug",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
      stats: {
        noPiecesLost: Boolean(winner && resolvedRemaining[winner] >= PAWN_COUNT + MAJOR_TYPES.length),
      },
    });
    const dailyResult = recordDailyMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "tug",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
    });
    this.scene.start("Result", {
      result: winner ? `${winner}_win` : "draw",
      reason,
      winnerColor: winner,
      remainingPieces: resolvedRemaining,
      skins: { ...this.skins },
      mode: this.mode,
      playerColor: this.playerColor,
      difficulty: this.isAIMode() ? this.aiDifficulty : null,
      gameSessionId: this.gameSessionId,
      sourceScene: "KingdomTug",
      newlyUnlocked: Array.from(new Set([...medalResult.newlyUnlocked, ...dailyResult.newlyUnlocked])),
    });
  }

  isAIMode() {
    return this.mode === "ai";
  }

  opponentColor() {
    return this.playerColor === "w" ? "b" : "w";
  }

  getRenderSkin(color) {
    return this.skins[color] || "classic";
  }

  getPieceFacing(color, perspectiveTurn = null) {
    const viewerColor = this.isAIMode()
      ? this.playerColor
      : (perspectiveTurn ?? this.turn);
    return color === viewerColor ? "back" : "front";
  }

  setPieceViewFacing(view, piece, perspectiveTurn) {
    if (!view || !piece) return;
    const skin = piece.skin || this.getRenderSkin(piece.color);
    const size = piece.artRadius * 2.05;
    const facing = this.getPieceFacing(piece.color, perspectiveTurn);
    const image = view._pieceImage;
    if (skin !== "icon" && image?.setTexture) {
      const textureKey = pieceTextureKey(skin, piece.color, piece.type, facing);
      if (this.textures.exists(textureKey) && image.texture?.key !== textureKey) image.setTexture(textureKey);
    }
    alignBoardPieceView(view, size, skin, facing);
    view._facing = facing;
    piece.facing = facing;
  }

  setPieceViewTurnTransform(view, piece, turn) {
    if (!view || !piece) return;
    view.setRotation(this.getPieceAngle(turn));
    view.setDepth(this.getPieceDepth(piece.y, turn));
  }

  setPieceViewOrientation(view, piece, turn) {
    if (!view || !piece) return;
    const mag = Math.max(0.01, Math.abs(view.scaleX || 1));
    view.scaleX = mag;
    view.scaleY = mag;
    this.setPieceViewFacing(view, piece, turn);
    this.setPieceViewTurnTransform(view, piece, turn);
    view.setPosition(piece.x, this.getViewY(piece, turn, piece.facing));
  }

  applyTurnPerspective(onComplete = null) {
    if (this.isAIMode()) {
      this._lastTurn = this.turn;
      onComplete?.();
      return;
    }
    this.animateTurnFlip(this.turn, onComplete);
  }

  animateTurnFlip(targetTurn, onComplete = null) {
    if (this.isAIMode()) {
      onComplete?.();
      return;
    }
    const turn = targetTurn ?? this.turn;
    if (turn === this._lastTurn || this._turnFlipBusy) {
      onComplete?.();
      return;
    }

    const activePieces = this.pieces.filter((piece) => piece.active && piece.view?.scene && piece.view._pieceImage);
    if (!activePieces.length) {
      this._lastTurn = turn;
      onComplete?.();
      return;
    }

    this._turnFlipBusy = true;
    const handoffScale = 0.52;
    const rowDelay = 18;
    const collapseDuration = 180;
    const revealDuration = 250;
    let finished = false;

    const entries = activePieces.map((piece) => {
      const view = piece.view;
      const image = view._pieceImage;
      view._tugFlipTweening = true;
      return {
        piece,
        view,
        image,
        sourceViewY: view.y,
        targetViewY: this.getViewY(piece, turn, this.getPieceFacing(piece.color, turn)),
        sourceScaleY: image.scaleY,
        sourceOriginX: image.originX,
        sourceOriginY: image.originY,
        sourceX: image.x,
        sourceY: image.y,
        row: Phaser.Math.Clamp(Math.floor((piece.y - this.boardBounds.top) / this.boardLayout.squareSize), 0, 7),
        targetScaleY: 1,
        handoffView: null,
      };
    });

    for (const entry of entries) {
      entry.sourceBottomY = entry.sourceY + entry.image.displayHeight * (1 - entry.sourceOriginY);
      entry.sourceTurnSign = Math.cos(entry.view.rotation) >= 0 ? 1 : -1;
      entry.collapseViewY = entry.piece.y - entry.sourceTurnSign * entry.sourceBottomY;
    }

    for (const entry of entries) {
      const { piece } = entry;
      const facing = this.getPieceFacing(piece.color, turn);
      const size = piece.artRadius * 2.05;
      const handoffView = createPieceView(this, piece.x, entry.targetViewY, size, piece.skin, piece.color, piece.type, facing);
      this.setPieceViewOrientation(handoffView, piece, turn);
      handoffView.setDepth(this.getPieceDepth(piece.y, turn));
      entry.handoffView = handoffView;

      const handoffImage = handoffView._pieceImage;
      const handoffBottomY = handoffImage.y + handoffImage.displayHeight * (1 - handoffImage.originY);
      handoffImage.setOrigin(handoffImage.originX, 1);
      handoffImage.setY(handoffBottomY);
      entry.targetTurnSign = Math.cos(handoffView.rotation) >= 0 ? 1 : -1;
      entry.revealViewY = piece.y - entry.targetTurnSign * handoffBottomY;
      handoffView.setY(entry.revealViewY);
      entry.targetScaleY = handoffImage.scaleY;
      handoffImage.scaleY = entry.targetScaleY * handoffScale;
      handoffImage.setAlpha(0);
    }

    const restoreSourceAnchor = (entry) => {
      entry.image.setOrigin(entry.sourceOriginX, entry.sourceOriginY);
      entry.image.setPosition(entry.sourceX, entry.sourceY);
    };

    const finalize = () => {
      if (finished) return;
      finished = true;
      for (const entry of entries) restoreSourceAnchor(entry);
      for (const entry of entries) {
        const { piece, view } = entry;
        this.tweens.killTweensOf(view);
        this.tweens.killTweensOf(view._pieceImage);
        view.setAlpha(1);
        view._pieceImage?.setAlpha(1);
        view._tugFlipTweening = false;
        this.setPieceViewOrientation(view, piece, turn);
        entry.handoffView?._pieceImage && this.tweens.killTweensOf(entry.handoffView._pieceImage);
        entry.handoffView?.destroy();
        entry.handoffView = null;
      }
      this.renderCaptured();
      this._lastTurn = turn;
      this._turnFlipBusy = false;
      onComplete?.();
    };

    const timeoutEvt = this.time.delayedCall(900, finalize);
    let collapsed = 0;
    const reveal = () => {
      if (finished) return;
      for (const entry of entries) {
        this.setPieceViewTurnTransform(entry.view, entry.piece, turn);
        entry.view.setY(entry.piece.y - entry.targetTurnSign * entry.sourceBottomY);
        entry.outgoingRevealY = entry.view.y;
      }

      let revealed = 0;
      for (const entry of entries) {
        this.tweens.add({
          targets: entry.image,
          scaleY: entry.sourceScaleY,
          alpha: 0,
          duration: revealDuration,
          ease: "Sine.Out",
          onUpdate: (tween) => {
            entry.view.y = Phaser.Math.Linear(entry.outgoingRevealY, entry.targetViewY, tween.progress);
          },
        });
        this.tweens.add({
          targets: entry.handoffView._pieceImage,
          scaleY: entry.targetScaleY,
          alpha: 1,
          duration: revealDuration,
          ease: "Sine.Out",
          onUpdate: (tween) => {
            if (entry.handoffView) {
              entry.handoffView.y = Phaser.Math.Linear(entry.revealViewY, entry.targetViewY, tween.progress);
            }
          },
          onComplete: () => {
            restoreSourceAnchor(entry);
            this.setPieceViewOrientation(entry.view, entry.piece, turn);
            entry.view._pieceImage?.setAlpha(1);
            entry.handoffView?.destroy();
            entry.handoffView = null;
            revealed += 1;
            if (revealed >= entries.length) {
              timeoutEvt?.remove(false);
              finalize();
            }
          },
        });
      }
    };

    for (const entry of entries) {
      this.tweens.killTweensOf(entry.view);
      this.tweens.killTweensOf(entry.image);
      entry.view.setPosition(entry.piece.x, entry.sourceViewY);
      entry.image.setOrigin(entry.sourceOriginX, 1);
      entry.image.setPosition(entry.sourceX, entry.sourceBottomY);
      this.tweens.add({
        targets: entry.image,
        scaleY: entry.sourceScaleY * handoffScale,
        duration: collapseDuration,
        delay: entry.row * rowDelay,
        ease: "Sine.InOut",
        onUpdate: (tween) => {
          entry.view.y = Phaser.Math.Linear(entry.sourceViewY, entry.collapseViewY, tween.progress);
        },
        onComplete: () => {
          collapsed += 1;
          if (collapsed >= entries.length) reveal();
        },
      });
    }
  }

  getPieceAngle(turn = this.turn) {
    return !this.isAIMode() && turn === "b" ? Math.PI : 0;
  }

  getViewY(piece, turn = this.turn, facing = null) {
    const viewFacing = facing ?? this.getPieceFacing(piece.color, turn);
    const offset = piece.artRadius * (COLLIDER_VIEW_SHIFT[viewFacing] ?? COLLIDER_VIEW_SHIFT.front);
    const sign = this.getPieceAngle(turn) === Math.PI ? -1 : 1;
    return piece.y - offset * sign;
  }

  getPerspectiveY(y, turn = this.turn) {
    const row = Phaser.Math.Clamp(
      (y - this.boardBounds.top) / this.boardLayout.squareSize,
      0,
      8
    );
    return !this.isAIMode() && turn === "b" ? 8 - row : row;
  }

  getPieceDepth(y, turn = this.turn) {
    return 40 + this.getPerspectiveY(y, turn);
  }

  getBaseDepth(y, turn = this.turn) {
    return 24 + this.getPerspectiveY(y, turn);
  }
}
