import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260903-onlinefix100";
import { alignBoardPieceView, createPieceView, setSelectedOutline } from "../pieceStyles.js?v=20260903-onlinefix100";
import { playFeedback, vibrateFeedback } from "../feedback.js?v=20260903-onlinefix100";
import { t } from "../i18n.js?v=20260903-onlinefix100";
import { recordMiniGameCompletion } from "../medals.js?v=20260903-onlinefix100";
import { recordDailyMiniGameCompletion } from "../dailyMissions.js?v=20260903-onlinefix100";
import {
  createCrownClashState,
  crownLegalMoves,
  moveCrownPiece,
  resolveCrownTurnIfStuck,
  rollCrownDice,
} from "../crownClashLogic.js?v=20260903-onlinefix100";
import {
  addChessBoard,
  addDarkTopBar,
  addScreenBg,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260903-onlinefix100";

const BOARD_OUTER_TOP = 250;
const BOARD_OUTER_WIDTH = 712;
const DICE_CENTER_Y = 625;
const DICE_RESULT_Y = 812;
const AI_DELAY = Object.freeze({ easy: 720, normal: 560, hard: 410 });
const HOME_COLORS = Object.freeze({ w: 0x16a8c6, b: 0xe26052 });
const DISPLAY_TYPE = Object.freeze({ pawn: "p", knight: "n", rook: "r" });

function sideName(color) {
  return t(color === "b" ? "side.b" : "side.w");
}

function diceSideColor(color) {
  return color === "b" ? "#b64b42" : "#008eaa";
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export class CrownClash extends Phaser.Scene {
  constructor() {
    super("CrownClash");
    this.state = null;
    this.selectedId = null;
    this.pieceViews = new Map();
    this.crownBadges = new Map();
    this.legalMarkers = [];
    this.inputLocked = true;
    this.gameOver = false;
    this.aiTimer = null;
    this.dicePower = 0;
    this.dicePowerDirection = 1;
    this.diceCharging = false;
    this.dicePhase = null;
    this.diceRolls = { w: null, b: null };
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this, "bg_select");
    this.add.rectangle(0, 0, width, height, 0xfff8ea, 0.72).setOrigin(0).setDepth(-90);
    addDarkTopBar(this, "Kuma Chess", { onHome: () => {
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    } });

    this.mode = this.registry.get("gameMode") === "ai" ? "ai" : "pvp";
    this.playerColor = this.registry.get("playerColor") === "b" ? "b" : "w";
    this.aiDifficulty = this.registry.get("aiDifficulty") || "normal";
    const selected = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skins = { w: selected.w || "classic", b: selected.b || "classic" };

    this.add.text(width / 2, 129, t("crown.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "32px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(120);

    this.topStatus = this.add.text(width / 2, 190, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: "#8a6a4d",
      fontStyle: "800",
      align: "center",
    }).setOrigin(0.5).setDepth(120);

    this.boardLayout = getChessBoardLayout(this, {
      outerTop: BOARD_OUTER_TOP,
      outerWidth: BOARD_OUTER_WIDTH,
    });
    this.squareSize = this.boardLayout.squareSize;
    addChessBoard(this, this.boardLayout, 0);
    this.drawHomeZones();
    this.createBoardInput();

    this.bottomStatus = this.add.text(width / 2, 1012, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "25px",
      color: KUMA_COLORS.orange,
      fontStyle: "900",
      align: "center",
    }).setOrigin(0.5).setDepth(120);
    this.turnProgress = this.add.text(width / 2, 1052, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color: "#8a6a4d",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(120);
    this.helpText = this.add.text(width / 2, height - 94, t("crown.help"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: "#8b6d4f",
      fontStyle: "600",
      align: "center",
      wordWrap: { width: 650 },
    }).setOrigin(0.5).setDepth(120);

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(_time, delta) {
    if (!this.diceCharging) return;
    const next = this.dicePower + this.dicePowerDirection * delta / 820;
    if (next >= 1) {
      this.dicePower = 1;
      this.dicePowerDirection = -1;
    } else if (next <= 0.08) {
      this.dicePower = 0.08;
      this.dicePowerDirection = 1;
    } else {
      this.dicePower = next;
    }
    this.redrawDicePower();
  }

  cleanup() {
    this.aiTimer?.remove(false);
    this.diceFrameTimer?.remove(false);
    this.crownBadges.forEach((badge) => this.tweens.killTweensOf(badge.list || []));
    this.pieceViews.forEach((view) => view.destroy());
    this.pieceViews.clear();
    this.crownBadges.clear();
    this.clearLegalMarkers();
    this.destroyCrownEffects();
    this.destroyTeleportEffects();
    this.diceLayer?.destroy(true);
  }

  startMatch() {
    this.gameSessionId = `crown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.state = createCrownClashState();
    this.selectedId = null;
    this.gameOver = false;
    this.inputLocked = true;
    this.diceRolls = { w: null, b: null };
    this.medalStats = { crownStolen: 0, crownFirst: 0, crownLost: 0, portalUses: 0 };
    this.renderAll();
    this.beginDiceSequence();
  }

  drawHomeZones() {
    const layer = this.add.graphics().setDepth(4);
    const s = this.squareSize;
    const x = this.boardLayout.boardX;
    const y = this.boardLayout.boardY;
    const drawZone = (row, col, color) => {
      layer.fillStyle(HOME_COLORS[color], 0.12);
      layer.fillRect(x + col * s, y + row * s, s, s);
      layer.lineStyle(4, HOME_COLORS[color], 0.82);
      layer.strokeRoundedRect(x + col * s + 3, y + row * s + 3, s - 6, s - 6, 10);
    };
    const zoneOrigins = {
      w: this.displayCell(7, 0),
      b: this.displayCell(0, 7),
    };
    drawZone(zoneOrigins.w.row, zoneOrigins.w.col, "w");
    drawZone(zoneOrigins.b.row, zoneOrigins.b.col, "b");

    const zoneLabelY = (origin) => y + s * (origin.row < 4 ? origin.row : origin.row + 1)
      + (origin.row < 4 ? -11 : 11);
    this.add.text(x + s * (zoneOrigins.w.col + 0.5), zoneLabelY(zoneOrigins.w), t("crown.whiteZone"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "15px",
      color: "#027f9a",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(12);
    const blackLabel = this.add.text(
      x + s * (zoneOrigins.b.col + 0.5),
      zoneLabelY(zoneOrigins.b),
      t("crown.blackZone"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "15px",
      color: "#b13c34",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(12);
    if (this.mode === "pvp") blackLabel.setAngle(180);
  }

  createBoardInput() {
    const s = this.squareSize;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const logical = this.logicalCell(row, col);
        this.add.rectangle(
          this.boardLayout.boardX + (col + 0.5) * s,
          this.boardLayout.boardY + (row + 0.5) * s,
          s,
          s,
          0xffffff,
          0.001
        ).setDepth(90).setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.handleCellPress(logical.row, logical.col));
      }
    }
  }

  isViewFlipped() {
    return this.mode === "ai" && this.playerColor === "b";
  }

  isFaceToFaceBlackTurn() {
    return this.mode === "pvp" && this.state?.turn === "b";
  }

  displayCell(row, col) {
    return this.isViewFlipped() ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  logicalCell(row, col) {
    return this.isViewFlipped() ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  boardCenter(row, col) {
    const display = this.displayCell(row, col);
    return {
      x: this.boardLayout.boardX + (display.col + 0.5) * this.squareSize,
      y: this.boardLayout.boardY + (display.row + 0.5) * this.squareSize,
    };
  }

  renderAll() {
    this.crownBadges.forEach((badge) => this.tweens.killTweensOf(badge.list || []));
    this.pieceViews.forEach((view) => view.destroy());
    this.pieceViews.clear();
    this.crownBadges.clear();
    if (!this.state) return;

    for (const piece of this.state.pieces) {
      const { x, y } = this.boardCenter(piece.row, piece.col);
      const perspective = this.mode === "ai" ? this.playerColor : (this.state.turn || "w");
      const facing = piece.color === perspective ? "back" : "front";
      const size = Math.floor(this.squareSize * 1.02);
      const view = createPieceView(
        this,
        x,
        y,
        size,
        this.skins[piece.color],
        piece.color,
        DISPLAY_TYPE[piece.type],
        facing
      );
      alignBoardPieceView(view, size, this.skins[piece.color], facing);
      const turnAngle = this.isFaceToFaceBlackTurn() ? 180 : 0;
      const displayRow = this.displayCell(piece.row, piece.col).row;
      view.setAngle(turnAngle);
      view.setDepth(40 + (turnAngle ? 7 - displayRow : displayRow));
      view._pieceId = piece.id;
      view._color = piece.color;
      view._type = DISPLAY_TYPE[piece.type];
      view._homeX = x;
      view._homeY = y;
      if (this.state.movedPieceIds?.includes(piece.id)) view.setAlpha(0.62);
      setSelectedOutline(view, piece.id === this.selectedId);
      this.pieceViews.set(piece.id, view);

      if (this.state.crown?.carrierId === piece.id) this.createCarrierBadge(piece, view);
    }
    this.renderTeleports();
    this.renderCrown();
    this.updateHud();
  }

  renderTeleports() {
    this.destroyTeleportEffects();
    if (!this.state?.teleports?.length) return;
    this.teleportLayer = this.add.container(0, 0).setDepth(27);
    this.state.teleports.forEach((cell, index) => {
      const { x, y } = this.boardCenter(cell.row, cell.col);
      const portal = this.add.container(x, y);
      const size = this.squareSize * 0.9;
      const glow = this.add.image(0, 0, "kuma_ui_img_potal")
        .setDisplaySize(size * 1.08, size * 1.08)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.32);
      const image = this.add.image(0, 0, "kuma_ui_img_potal").setDisplaySize(size, size);
      portal.add([glow, image]);
      this.teleportLayer.add(portal);
      this.tweens.add({
        targets: glow,
        scale: { from: 0.9, to: 1.12 },
        alpha: { from: 0.18, to: 0.5 },
        duration: 680,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: image,
        angle: index === 0 ? 360 : -360,
        duration: 3200,
        repeat: -1,
        ease: "Linear",
      });
    });
  }

  destroyTeleportEffects() {
    if (!this.teleportLayer) return;
    for (const portal of this.teleportLayer.list || []) {
      this.tweens.killTweensOf(portal.list || []);
    }
    this.teleportLayer.destroy(true);
    this.teleportLayer = null;
  }

  createCarrierBadge(piece, view) {
    const badge = this.add.container(this.squareSize * 0.29, -this.squareSize * 0.42);
    const glow = this.add.circle(0, 0, 22, 0xffd861, 0.34);
    const crown = this.add.image(0, 0, "kuma_ui_icon_king_crown").setDisplaySize(37, 37);
    badge.add([glow, crown]);
    view.add(badge);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.2, to: 0.66 },
      scale: { from: 0.82, to: 1.18 },
      duration: 640,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.crownBadges.set(piece.id, badge);
  }

  renderCrown() {
    this.destroyCrownEffects();
    if (!this.state?.crown || this.state.crown.carrierId) return;
    const { x, y } = this.boardCenter(this.state.crown.row, this.state.crown.col);
    this.crownLayer = this.add.container(x, y)
      .setAngle(this.isFaceToFaceBlackTurn() ? 180 : 0)
      .setDepth(33);

    const outerHalo = this.add.circle(0, 0, 56, 0xffc72e, 0.22).setBlendMode(Phaser.BlendModes.ADD);
    const innerHalo = this.add.circle(0, 0, 38, 0xfff2a1, 0.4).setBlendMode(Phaser.BlendModes.ADD);
    const crown = this.add.image(0, 0, "kuma_ui_icon_king_crown").setDisplaySize(66, 66);
    this.crownLayer.add([outerHalo, innerHalo, crown]);

    this.tweens.add({
      targets: outerHalo,
      scale: { from: 0.78, to: 1.36 },
      alpha: { from: 0.18, to: 0.66 },
      duration: 740,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.tweens.add({
      targets: crown,
      y: { from: -3, to: 3 },
      angle: { from: -2.5, to: 2.5 },
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    const sparkleColors = [0xfff3a0, 0xffca3f, 0xffffff, 0xf2a91d];
    for (let i = 0; i < 22; i++) {
      const angle = (Math.PI * 2 * i) / 22;
      const radius = 36 + (i % 4) * 8;
      const sparkle = this.add.star(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        4,
        i % 2 ? 2 : 3,
        i % 2 ? 6 : 8,
        sparkleColors[i % sparkleColors.length],
        0
      );
      sparkle.setBlendMode(Phaser.BlendModes.ADD);
      this.crownLayer.add(sparkle);
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.28, to: 1.2 },
        angle: 120,
        duration: 420 + (i % 4) * 90,
        delay: i * 52,
        yoyo: true,
        repeat: -1,
        repeatDelay: 90 + (i % 3) * 70,
        ease: "Quad.Out",
      });
    }
  }

  destroyCrownEffects() {
    if (!this.crownLayer) return;
    this.tweens.killTweensOf(this.crownLayer.list || []);
    this.crownLayer.destroy(true);
    this.crownLayer = null;
  }

  clearLegalMarkers() {
    this.legalMarkers.forEach((marker) => marker.destroy());
    this.legalMarkers = [];
  }

  showLegalMarkers(pieceId) {
    this.clearLegalMarkers();
    const moves = crownLegalMoves(this.state, pieceId);
    for (const move of moves) {
      const { x, y } = this.boardCenter(move.row, move.col);
      const occupied = this.state.pieces.find((piece) => piece.row === move.row && piece.col === move.col);
      const marker = this.add.circle(
        x,
        y,
        this.squareSize * (occupied ? 0.42 : 0.17),
        occupied ? 0xe05c4f : 0xdca33d,
        occupied ? 0.22 : 0.62
      ).setDepth(31);
      if (occupied) marker.setStrokeStyle(5, 0xe05c4f, 0.82);
      this.legalMarkers.push(marker);
    }
  }

  handleCellPress(row, col) {
    if (this.inputLocked || this.gameOver || !this.state?.turn) return;
    if (this.isAITurn()) return;
    const occupant = this.state.pieces.find((piece) => piece.row === row && piece.col === col);
    if (occupant?.color === this.state.turn && !this.state.movedPieceIds.includes(occupant.id)) {
      playFeedback("ui");
      this.selectedId = occupant.id;
      this.showLegalMarkers(occupant.id);
      this.renderSelection();
      return;
    }
    if (!this.selectedId) return;
    this.performMove(this.selectedId, row, col);
  }

  renderSelection() {
    for (const [id, view] of this.pieceViews) setSelectedOutline(view, id === this.selectedId);
  }

  performMove(pieceId, row, col, fromAI = false) {
    const moving = this.state.pieces.find((piece) => piece.id === pieceId);
    if (!moving) return false;
    const beforeCarrier = this.state.crown.carrierId;
    const beforeCarrierPiece = beforeCarrier
      ? this.state.pieces.find((piece) => piece.id === beforeCarrier)
      : null;
    const result = moveCrownPiece(this.state, pieceId, row, col);
    if (!result?.valid) {
      if (!fromAI) {
        playFeedback("error");
        vibrateFeedback("error");
      }
      return false;
    }
    const tracksMoving = this.mode === "pvp" || moving.color === this.playerColor;
    const tracksPreviousCarrier = beforeCarrierPiece
      && (this.mode === "pvp" || beforeCarrierPiece.color === this.playerColor);
    if (result.crownPicked && tracksMoving) this.medalStats.crownFirst += 1;
    if (result.crownStolen && tracksMoving) this.medalStats.crownStolen += 1;
    if (result.crownStolen && tracksPreviousCarrier) this.medalStats.crownLost += 1;
    if (result.teleported && tracksMoving) this.medalStats.portalUses += 1;

    this.inputLocked = true;
    this.selectedId = null;
    this.clearLegalMarkers();
    const entryTarget = this.boardCenter(row, col);
    const finalTarget = this.boardCenter(result.row, result.col);
    const view = this.pieceViews.get(pieceId);
    if (view) {
      view.setDepth(110);
      if (result.teleported) {
        this.tweens.add({
          targets: view,
          x: entryTarget.x,
          y: entryTarget.y,
          duration: 220,
          ease: "Cubic.Out",
          onComplete: () => {
            this.destroyTeleportEffects();
            playFeedback("success");
            this.tweens.add({
              targets: view,
              alpha: 0,
              scaleX: 0.36,
              scaleY: 0.36,
              duration: 130,
              ease: "Quad.In",
              onComplete: () => {
                view.setPosition(finalTarget.x, finalTarget.y);
                this.tweens.add({
                  targets: view,
                  alpha: 1,
                  scaleX: 1,
                  scaleY: 1,
                  duration: 190,
                  ease: "Back.Out",
                });
              },
            });
          },
        });
      } else {
        this.tweens.add({
          targets: view,
          x: finalTarget.x,
          y: finalTarget.y,
          duration: 270,
          ease: "Cubic.Out",
        });
      }
    }
    for (const capturedId of result.capturedIds || []) {
      const capturedView = this.pieceViews.get(capturedId);
      if (!capturedView) continue;
      this.tweens.add({
        targets: capturedView,
        alpha: 0,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 220,
        ease: "Quad.In",
      });
    }
    playFeedback(result.capturedId ? "capture" : "move");
    vibrateFeedback(result.capturedId ? "capture" : "move");

    const crownChanged = beforeCarrier !== this.state.crown.carrierId;
    if (crownChanged) {
      this.destroyCrownEffects();
      this.crownBadges.forEach((badge) => {
        this.tweens.killTweensOf(badge.list || []);
        badge.destroy();
      });
      this.crownBadges.clear();
      if (this.state.crown.carrierId === pieceId && view) this.createCarrierBadge(moving, view);
    }
    this.time.delayedCall(result.teleported ? 620 : 300, () => {
      if (!this.scene.isActive()) return;
      if (!result.turnEnded) resolveCrownTurnIfStuck(this.state);
      this.renderAll();
      if (result.crownStolen) this.showCrownEvent(t("crown.stolen", { side: sideName(moving.color) }), true);
      else if (result.crownPicked || crownChanged) this.showCrownEvent(t("crown.picked", { side: sideName(moving.color) }));
      else if (result.teleported) this.showCrownEvent(t("crown.teleport"));

      if (result.winner || this.state.winner) {
        this.finishMatch(result.winner || this.state.winner);
        return;
      }
      this.inputLocked = false;
      if (this.isAITurn()) this.scheduleAI();
    });
    return true;
  }

  showCrownEvent(message, stolen = false) {
    const line = showRewardLine(this, message, {
      y: this.boardLayout.boardY + this.squareSize * 4,
      hold: 760,
      showCoin: false,
      feedbackType: stolen ? "capture" : "reward",
      particleScale: 0.78,
    });
    line.setAngle(this.isFaceToFaceBlackTurn() ? 180 : 0);
  }

  updateHud() {
    if (!this.state?.turn) {
      this.topStatus.setText(t("crown.moveAll"));
      this.bottomStatus.setText("");
      this.turnProgress.setText("");
      return;
    }
    const side = sideName(this.state.turn);
    const moved = this.state.movedPieceIds?.length || 0;
    this.topStatus.setText(this.state.crown.carrierId ? t("crown.returnHome") : t("crown.moveAll"));
    this.bottomStatus.setText(t("crown.turn", { side, moved }));
    this.turnProgress.setText(this.state.crown.carrierId ? t("crown.carrier") : "");
    if (this.mode === "pvp") {
      const blackTurn = this.isFaceToFaceBlackTurn();
      this.topStatus.setAngle(blackTurn ? 180 : 0);
      this.bottomStatus.setAngle(blackTurn ? 180 : 0);
      this.turnProgress.setAngle(blackTurn ? 180 : 0);
      this.helpText.setAngle(blackTurn ? 180 : 0);
    }
  }

  beginDiceSequence() {
    this.dicePhase = this.mode === "ai" && this.playerColor === "b" ? "b" : "w";
    this.showDiceLayer();
    if (this.mode === "ai" && this.dicePhase !== this.playerColor) this.scheduleAIDice();
  }

  showDiceLayer() {
    this.diceLayer?.destroy(true);
    this.diceCharging = false;
    this.dicePower = 0;
    this.dicePowerDirection = 1;
    const { width, height } = this.scale;
    const layer = this.add.container(0, 0).setDepth(1400);
    this.diceLayer = layer;
    const phaseColor = diceSideColor(this.dicePhase);
    const diceTexture = this.dicePhase === "b" ? "kuma_ui_ani_dice_black" : "kuma_ui_ani_dice";
    const dim = this.add.rectangle(0, 0, width, height, 0x2b2118, 0.48).setOrigin(0).setInteractive();
    const panel = this.add.image(width / 2, 610, "kuma_ui_popup").setDisplaySize(570, 520);
    this.diceTitleText = this.add.text(width / 2, 470, t("crown.diceTitle"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "31px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5);
    this.diceGuideText = this.add.text(width / 2, 518, `${sideName(this.dicePhase)} · ${t("crown.diceCharge")}`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "20px",
      color: phaseColor,
      fontStyle: "700",
      align: "center",
    }).setOrigin(0.5);
    this.diceSprite = this.add.sprite(width / 2, DICE_CENTER_Y, diceTexture, 6).setDisplaySize(218, 291);
    this.diceBaseScale = { x: this.diceSprite.scaleX, y: this.diceSprite.scaleY };
    this.diceResultText = this.add.text(width / 2, DICE_RESULT_Y, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "58px",
      color: phaseColor,
      fontStyle: "900",
    }).setOrigin(0.5);
    this.diceWhiteScoreText = this.add.text(width / 2 - 92, DICE_RESULT_Y, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "34px",
      color: diceSideColor("w"),
      fontStyle: "900",
    }).setOrigin(0.5).setVisible(false);
    this.diceScoreSeparator = this.add.text(width / 2, DICE_RESULT_Y, "·", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "30px",
      color: "#9b8062",
      fontStyle: "800",
    }).setOrigin(0.5).setVisible(false);
    this.diceBlackScoreText = this.add.text(width / 2 + 92, DICE_RESULT_Y, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "34px",
      color: diceSideColor("b"),
      fontStyle: "900",
    }).setOrigin(0.5).setVisible(false);

    this.dicePowerBg = this.add.graphics();
    this.dicePowerFill = this.add.graphics();
    this.dicePowerLabel = this.add.text(width / 2, 836, t("crown.dicePower"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5);
    this.diceHit = this.add.rectangle(width / 2, DICE_CENTER_Y, 330, 250, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    this.diceHit.on("pointerdown", () => this.startDiceCharge());
    this.diceHit.on("pointerup", () => this.releaseDice());
    this.diceHit.on("pointerout", () => {
      if (this.diceCharging) this.releaseDice();
    });
    layer.add([
      dim,
      panel,
      this.diceTitleText,
      this.diceGuideText,
      this.diceSprite,
      this.diceResultText,
      this.diceWhiteScoreText,
      this.diceScoreSeparator,
      this.diceBlackScoreText,
      this.dicePowerBg,
      this.dicePowerFill,
      this.dicePowerLabel,
      this.diceHit,
    ]);
    this.redrawDicePower();
    this.orientDiceLayer();
  }

  orientDiceLayer() {
    const angle = this.mode === "pvp" && this.dicePhase === "b" ? 180 : 0;
    [
      this.diceTitleText,
      this.diceGuideText,
      this.diceResultText,
      this.diceWhiteScoreText,
      this.diceScoreSeparator,
      this.diceBlackScoreText,
      this.dicePowerLabel,
      this.diceSprite,
    ]
      .forEach((item) => item?.setAngle(angle));
  }

  showDiceScoreSummary() {
    this.diceResultText?.setVisible(false);
    this.diceWhiteScoreText?.setText(`${sideName("w")} ${this.diceRolls.w.total}`).setVisible(true);
    this.diceScoreSeparator?.setVisible(true);
    this.diceBlackScoreText?.setText(`${sideName("b")} ${this.diceRolls.b.total}`).setVisible(true);
  }

  redrawDicePower() {
    if (!this.dicePowerBg || !this.dicePowerFill) return;
    const x = this.scale.width / 2 - 180;
    const y = 794;
    this.dicePowerBg.clear().fillStyle(0xc8b28f, 0.4).fillRoundedRect(x, y, 360, 18, 9);
    const fillWidth = 356 * Phaser.Math.Clamp(this.dicePower, 0, 1);
    this.dicePowerFill.clear();
    if (fillWidth > 0) {
      this.dicePowerFill.fillStyle(0xe1a331, 1).fillRoundedRect(x + 2, y + 2, fillWidth, 14, 7);
    }
  }

  startDiceCharge() {
    if (!this.diceLayer || this.diceCharging) return;
    if (this.mode === "ai" && this.dicePhase !== this.playerColor) return;
    this.diceCharging = true;
    this.dicePower = Math.max(0.08, this.dicePower || 0.08);
    this.dicePowerDirection = 1;
    playFeedback("ui");
    this.tweens.add({
      targets: this.diceSprite,
      scaleX: this.diceBaseScale.x * 0.94,
      scaleY: this.diceBaseScale.y * 0.94,
      duration: 120,
    });
  }

  releaseDice(autoPower = null) {
    if (!this.diceCharging && autoPower == null) return;
    this.diceCharging = false;
    const power = autoPower == null ? this.dicePower : autoPower;
    this.throwDice(power);
  }

  throwDice(power) {
    this.diceHit?.disableInteractive();
    this.dicePowerBg?.setVisible(false);
    this.dicePowerFill?.setVisible(false);
    this.dicePowerLabel?.setVisible(false);
    const roll = rollCrownDice();
    const startY = DICE_CENTER_Y;
    const throwDirection = this.mode === "pvp" && this.dicePhase === "b" ? 1 : -1;
    const throwDistance = 80 + power * 150;
    this.diceFrameIndex = 0;
    this.diceFrameTimer?.remove(false);
    this.diceFrameTimer = this.time.addEvent({
      delay: 62,
      loop: true,
      callback: () => {
        this.diceSprite?.setFrame(this.diceFrameIndex);
        this.diceFrameIndex = (this.diceFrameIndex + 1) % 8;
      },
    });
    this.tweens.add({
      targets: this.diceSprite,
      y: startY + throwDirection * throwDistance,
      duration: 330 + power * 220,
      ease: "Quad.Out",
      yoyo: true,
      onComplete: () => {
        this.diceFrameTimer?.remove(false);
        this.diceSprite
          .setFrame((roll.total - 2) % 8)
          .setY(startY)
          .setScale(this.diceBaseScale.x, this.diceBaseScale.y);
        this.diceRolls[this.dicePhase] = roll;
        this.diceResultText.setText(String(roll.total));
        this.diceGuideText.setText(t("crown.diceResult", { side: sideName(this.dicePhase), total: roll.total }));
        playFeedback("success");
        this.time.delayedCall(1200, () => this.advanceDiceSequence());
      },
    });
  }

  advanceDiceSequence() {
    if (!this.scene.isActive()) return;
    if (!this.diceRolls.w || !this.diceRolls.b) {
      this.dicePhase = this.diceRolls.w ? "b" : "w";
      this.dicePower = 0;
      this.showDiceLayer();
      if (this.mode === "ai" && this.dicePhase !== this.playerColor) this.scheduleAIDice();
      return;
    }
    if (this.diceRolls.w.total === this.diceRolls.b.total) {
      this.diceGuideText.setText(t("crown.diceTie"));
      this.showDiceScoreSummary();
      this.diceRolls = { w: null, b: null };
      this.diceGuideText.setColor(KUMA_COLORS.orange).setFontSize(24);
      this.time.delayedCall(1600, () => {
        this.dicePhase = this.mode === "ai" ? this.playerColor : "w";
        this.showDiceLayer();
      });
      return;
    }
    const first = this.diceRolls.w.total > this.diceRolls.b.total ? "w" : "b";
    const firstColor = diceSideColor(first);
    this.diceGuideText
      .setText(t("crown.diceFirst", { side: sideName(first) }))
      .setColor(firstColor)
      .setFontSize(26)
      .setFontStyle("900");
    this.diceResultText
      .setColor(firstColor);
    this.showDiceScoreSummary();
    playFeedback("reward");
    this.time.delayedCall(2400, () => {
      this.diceLayer?.destroy(true);
      this.diceLayer = null;
      this.state.turn = first;
      this.state.movedPieceIds = [];
      resolveCrownTurnIfStuck(this.state);
      this.inputLocked = false;
      this.renderAll();
      if (this.isAITurn()) this.scheduleAI();
    });
  }

  scheduleAIDice() {
    this.time.delayedCall(620, () => {
      if (!this.scene.isActive() || !this.diceLayer) return;
      this.diceCharging = true;
      this.dicePower = Phaser.Math.FloatBetween(0.48, 0.96);
      this.redrawDicePower();
      this.time.delayedCall(470, () => this.releaseDice(this.dicePower));
    });
  }

  isAITurn() {
    return this.mode === "ai" && this.state?.turn && this.state.turn !== this.playerColor;
  }

  scheduleAI() {
    this.aiTimer?.remove(false);
    this.aiTimer = this.time.delayedCall(AI_DELAY[this.aiDifficulty] || AI_DELAY.normal, () => {
      if (!this.scene.isActive() || !this.isAITurn() || this.gameOver) return;
      const move = this.chooseAIMove();
      if (!move) {
        const resolved = resolveCrownTurnIfStuck(this.state);
        if (resolved.turnEnded) {
          this.renderAll();
          this.inputLocked = false;
          if (this.isAITurn()) this.scheduleAI();
        }
        return;
      }
      this.performMove(move.pieceId, move.row, move.col, true);
    });
  }

  chooseAIMove() {
    const color = this.state.turn;
    const candidates = [];
    const homeCell = this.state.pieces.find((piece) => piece.color === color && piece.type === "knight")?.start;
    for (const piece of this.state.pieces) {
      if (piece.color !== color || this.state.movedPieceIds.includes(piece.id)) continue;
      for (const move of crownLegalMoves(this.state, piece.id)) {
        const entryTarget = { row: move.row, col: move.col };
        const entryVictim = this.state.pieces.find((other) => (
          other.color !== color && other.row === move.row && other.col === move.col
        ));
        const teleportIndex = this.state.teleports.findIndex((cell) => (
          cell.row === move.row && cell.col === move.col
        ));
        const teleportExit = teleportIndex >= 0
          ? this.state.teleports[teleportIndex === 0 ? 1 : 0]
          : null;
        const exitOccupant = teleportExit
          ? this.state.pieces.find((other) => other.id !== piece.id && other.row === teleportExit.row && other.col === teleportExit.col)
          : null;
        const target = teleportExit && exitOccupant?.color !== color ? teleportExit : entryTarget;
        const exitVictim = exitOccupant?.color !== color ? exitOccupant : null;
        const victim = exitVictim || entryVictim;
        const capturesCarrier = [entryVictim, exitVictim]
          .some((captured) => captured && this.state.crown.carrierId === captured.id);
        const carrier = this.state.crown.carrierId === piece.id;
        const targetCell = carrier
          ? homeCell
          : this.state.crown.carrierId
            ? this.state.pieces.find((other) => other.id === this.state.crown.carrierId) || this.state.crown
            : this.state.crown;
        let score = 120 - manhattan(target, targetCell) * 11;
        if (victim) score += 80;
        if (capturesCarrier) score += 240;
        if (!this.state.crown.carrierId && target.row === this.state.crown.row && target.col === this.state.crown.col) score += 220;
        const inHome = target.row === homeCell?.row && target.col === homeCell?.col;
        if (carrier && inHome) score += 1000;
        score += Math.random() * (this.aiDifficulty === "easy" ? 130 : this.aiDifficulty === "normal" ? 38 : 8);
        if (teleportExit && target === teleportExit) score += 18;
        candidates.push({ pieceId: piece.id, row: move.row, col: move.col, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (!candidates.length) return null;
    if (this.aiDifficulty === "easy") return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    if (this.aiDifficulty === "normal" && candidates.length > 1 && Math.random() < 0.18) return candidates[1];
    return candidates[0];
  }

  finishMatch(winner) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.inputLocked = true;
    this.aiTimer?.remove(false);
    playFeedback(winner === this.playerColor || this.mode === "pvp" ? "win" : "failure");
    this.showCrownEvent(t("crown.result", { side: sideName(winner) }));
    const medalResult = recordMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "crown",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
      stats: this.medalStats,
    });
    const dailyResult = recordDailyMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "crown",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner,
    });
    this.time.delayedCall(1200, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("Result", {
        result: `${winner}_win`,
        reason: "crownComplete",
        winnerColor: winner,
        skins: { ...this.skins },
        mode: this.mode,
        playerColor: this.playerColor,
        difficulty: this.mode === "ai" ? this.aiDifficulty : null,
        gameSessionId: this.gameSessionId,
        sourceScene: "CrownClash",
        newlyUnlocked: Array.from(new Set([...medalResult.newlyUnlocked, ...dailyResult.newlyUnlocked])),
      });
    });
  }
}
