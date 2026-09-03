import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260904-mobilefix102";
import { alignBoardPieceView, createPieceView } from "../pieceStyles.js?v=20260904-mobilefix102";
import { playFeedback } from "../feedback.js?v=20260904-mobilefix102";
import { t } from "../i18n.js?v=20260904-mobilefix102";
import { recordMiniGameCompletion } from "../medals.js?v=20260904-mobilefix102";
import { recordDailyMiniGameCompletion } from "../dailyMissions.js?v=20260904-mobilefix102";
import {
  createSiegeAllyAura,
  createSiegeKingAura,
  destroySiegeKingAura,
  playSiegeAttackEffect,
  playSiegeCastleHitEffect,
} from "../siegeEffects.js?v=20260904-mobilefix102";
import {
  chooseSiegeAIAction,
  createSiegeState,
  siegeDefenseSupplyRate,
  siegeEffectiveResourceRate,
  summonSiegeUnit,
  tickSiege,
} from "../siegeLogic.js?v=20260904-mobilefix102";
import {
  addChessBoard,
  addDarkTopBar,
  addScreenBg,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  createModalBackdrop,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260904-mobilefix102";

const BOARD_OUTER_TOP = 317;
const BOARD_OUTER_WIDTH = 712;
const PANEL_Y = Object.freeze({ b: 232, w: 1114 });
const SIDE_COLORS = Object.freeze({ w: 0x18a9c2, b: 0xdd5c55 });
const SIDE_TEXT_COLORS = Object.freeze({ w: "#008faa", b: "#c34b45" });
const HEALTH_COLORS = Object.freeze({ healthy: 0x3fc27a, warning: 0xf0b23d, critical: 0xe04e45 });
const TYPE_TO_PIECE = Object.freeze({
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q",
  king: "k",
});
const UNIT_UI_ORDER = Object.freeze(["pawn", "knight", "rook", "bishop", "queen", "king"]);

function cellKey(cell) {
  return cell ? `${cell.row},${cell.col}` : "";
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export class KingdomSiege extends Phaser.Scene {
  constructor() {
    super("KingdomSiege");
    this.state = null;
    this.selectedTypes = { w: null, b: null };
    this.unitEntries = new Map();
    this.accumulatorMs = 0;
    this.gameOver = false;
    this.helpOpen = false;
    this.portalAnimationTargets = [];
    this.lastCastleImpactAt = -Infinity;
    this.aiCooldownMs = 0;
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this, "bg_select");
    this.add.rectangle(0, 0, width, height, 0xfff8ea, 0.7).setOrigin(0).setDepth(-90);
    addDarkTopBar(this, "Kuma Chess", { onHome: () => {
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    } });

    this.mode = this.registry.get("gameMode") === "ai" ? "ai" : "pvp";
    this.playerColor = this.registry.get("playerColor") === "b" ? "b" : "w";
    this.aiColor = this.playerColor === "w" ? "b" : "w";
    this.aiDifficulty = this.registry.get("aiDifficulty") || "normal";

    this.skins = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skins = { w: this.skins.w || "classic", b: this.skins.b || "classic" };

    this.titleText = this.add.text(width / 2, 124, t("siege.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "29px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(140);
    this.helpButton = this.add.image(width / 2 + 104, 124, "kuma_ui_btn_hint")
      .setDisplaySize(36, 36)
      .setDepth(142);
    this.helpHit = this.add.circle(width / 2 + 104, 124, 24, 0xffffff, 0.001)
      .setDepth(143)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.showSiegeHelp());

    this.boardLayout = getChessBoardLayout(this, {
      outerTop: BOARD_OUTER_TOP,
      outerWidth: BOARD_OUTER_WIDTH,
    });
    this.squareSize = this.boardLayout.squareSize;
    addChessBoard(this, this.boardLayout, 0);
    this.drawDeploymentZones();
    this.createBoardInput();
    this.createCastleViews();
    this.sidePanels = {
      b: this.createSidePanel("b", this.panelY("b"), this.panelRotated("b")),
      w: this.createSidePanel("w", this.panelY("w"), this.panelRotated("w")),
    };
    if (this.isAIMode()) this.configureAIPanel();

    this.loadingText = this.add.text(width / 2, height / 2, "LOADING...", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(600);

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
    if (!this.state || this.state.status !== "running" || this.gameOver || this.helpOpen) return;
    this.updateAI(delta);
    this.accumulatorMs += Math.min(delta, 500);
    const tickMs = this.state.config.tickMs;
    const tickCount = Math.min(5, Math.floor(this.accumulatorMs / tickMs));
    if (tickCount <= 0) return;
    this.accumulatorMs -= tickCount * tickMs;
    const { events } = tickSiege(this.state, tickCount);
    this.handleEvents(events);
    this.renderState();
    if (this.state.status === "finished") this.finishMatch();
  }

  cleanup() {
    this.unitEntries.forEach((entry) => this.destroyUnitEntry(entry));
    this.unitEntries.clear();
    this.destroyPortalLayer();
    this.destroyChestView();
    this.helpLayer?.destroy(true);
    this.helpBackdrop?.cleanup();
    this.tweens.killTweensOf([this.castleViews?.w, this.castleViews?.b]);
  }

  showSiegeHelp() {
    if (this.helpOpen) return;
    this.helpOpen = true;
    const { width } = this.scale;
    this.helpBackdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    const panel = this.add.image(width / 2, 290, "kuma_ui_popup").setDisplaySize(610, 300);
    const title = this.add.text(width / 2, 214, t("siege.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5);
    const body = this.add.text(width / 2, 286, t("siege.help"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "20px",
      color: "#4b3928",
      fontStyle: "600",
      align: "center",
      lineSpacing: 7,
      wordWrap: { width: 530 },
    }).setOrigin(0.5);
    const close = this.add.image(width / 2, 374, "kuma_ui_btn_back")
      .setDisplaySize(58, 58)
      .setInteractive({ useHandCursor: true });
    const closePopup = () => {
      if (!layer.active) return;
      this.helpBackdrop?.cleanup();
      this.helpBackdrop = null;
      layer.destroy(true);
      this.helpLayer = null;
      this.helpOpen = false;
      playFeedback("ui");
    };
    close.on("pointerdown", closePopup);
    this.helpBackdrop.dim.on("pointerdown", closePopup);
    layer.add([panel, title, body, close]);
    this.helpLayer = layer;
    playFeedback("ui");
  }

  startMatch() {
    this.gameSessionId = `siege-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.state = createSiegeState({ seed: Date.now() });
    this.accumulatorMs = 0;
    this.gameOver = false;
    this.selectedTypes = { w: null, b: null };
    this.medalStats = {
      portalUses: { w: 0, b: 0 },
      itemUses: { w: 0, b: 0 },
      defenseSaves: { w: 0, b: 0 },
      summonedTypes: { w: new Set(), b: new Set() },
      maxCrownPoints: { w: 0, b: 0 },
    };
    this.aiCooldownMs = this.isAIMode() ? 450 : 0;
    this.updateMedalPointPeaks();
    this.renderState(true);
    playFeedback("success");
  }

  drawDeploymentZones() {
    const graphics = this.add.graphics().setDepth(5);
    const x = this.boardLayout.boardX;
    const y = this.boardLayout.boardY;
    const width = this.squareSize * 8;
    const height = this.squareSize * 3;
    for (const color of ["b", "w"]) {
      const rows = [0, 1, 2].map((offset) => this.displayCell(color === "b" ? offset : 7 - offset, 0).row);
      const row = Math.min(...rows);
      const zoneY = y + row * this.squareSize;
      graphics.fillStyle(SIDE_COLORS[color], 0.075);
      graphics.fillRect(x, zoneY, width, height);
      graphics.lineStyle(4, SIDE_COLORS[color], 0.72);
      graphics.strokeRoundedRect(x + 2, zoneY + 2, width - 4, height - 4, 9);
    }
  }

  createBoardInput() {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        this.add.rectangle(
          this.boardLayout.boardX + (col + 0.5) * this.squareSize,
          this.boardLayout.boardY + (row + 0.5) * this.squareSize,
          this.squareSize,
          this.squareSize,
          0xffffff,
          0.001,
        ).setDepth(80).setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            const logical = this.logicalCell(row, col);
            this.handleBoardPress(logical.row, logical.col);
          });
      }
    }
  }

  createCastleViews() {
    this.castleViews = {};
    this.castleBars = {};
    this.castleTimers = {};
    for (const color of ["b", "w"]) {
      const cell = { row: color === "b" ? 0 : 7, col: 3 };
      const position = this.boardCenter(cell.row, cell.col);
      const castle = this.add.image(position.x, position.y, "kuma_ui_img_castle")
        .setDisplaySize(this.squareSize * 0.95, this.squareSize * 0.88)
        .setAngle(this.displayCell(cell.row, cell.col).row < 4 ? 180 : 0)
        .setDepth(93 + this.displayCell(cell.row, cell.col).row);
      this.castleViews[color] = castle;

      const displayCastle = this.displayCell(cell.row, cell.col);
      const barY = displayCastle.row === 0
        ? this.boardLayout.boardY - 8
        : this.boardLayout.boardY + this.squareSize * 8 + 8;
      const bar = this.add.container(this.scale.width / 2, barY).setDepth(130);
      const track = this.add.rectangle(0, 0, 214, 13, 0x3a342d, 0.96).setStrokeStyle(2, 0xe0b353, 0.9);
      const fill = this.add.rectangle(-103, 0, 206, 7, SIDE_COLORS[color], 1).setOrigin(0, 0.5);
      const label = this.add.text(0, 0, "2000", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "13px",
        color: "#ffffff",
        fontStyle: "900",
      }).setOrigin(0.5);
      bar.add([track, fill, label]);
      if (!this.isAIMode() && displayCastle.row === 0) bar.setAngle(180);
      this.castleBars[color] = { container: bar, fill, label };

      const timerY = position.y + this.squareSize * 0.39;
      const timer = this.add.container(position.x, timerY).setDepth(132);
      const timerPill = this.add.rectangle(0, 0, 56, 21, 0xfff8ea, 0.94)
        .setStrokeStyle(1.5, SIDE_COLORS[color], 0.88);
      const timerText = this.add.text(0, 0, "3:00", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "13px",
        color: SIDE_TEXT_COLORS[color],
        fontStyle: "900",
      }).setOrigin(0.5);
      timer.add([timerPill, timerText]);
      if (!this.isAIMode() && displayCastle.row === 0) timer.setAngle(180);
      this.castleTimers[color] = { container: timer, pill: timerPill, text: timerText };
    }
  }

  createSidePanel(color, y, rotated) {
    const panel = this.add.container(this.scale.width / 2, y).setDepth(170);
    if (rotated) panel.setAngle(180);
    const crownGlow = this.add.circle(-294, 0, 25, 0xe8bd5a, 0.08);
    const crown = this.add.image(-294, 0, "kuma_ui_icon_king_crown").setDisplaySize(43, 43);
    const points = this.add.text(-260, -9, "800", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "25px",
      color: SIDE_TEXT_COLORS[color],
      fontStyle: "900",
    }).setOrigin(0, 0.5);
    const income = this.add.text(-260, 19, t("siege.income", { income: 8 }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "12px",
      color: "#72583f",
      fontStyle: "800",
      lineSpacing: 2,
      fixedWidth: 72,
    }).setOrigin(0, 0);
    panel.add([crownGlow, crown, points, income]);

    const buttons = new Map();
    const startX = -143;
    UNIT_UI_ORDER.forEach((type, index) => {
      const x = startX + index * 84;
      const button = this.createUnitButton(color, type, x, 2);
      panel.add(button.container);
      buttons.set(type, button);
    });

    const status = this.add.text(0, -68, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "15px",
      color: "#7e654c",
      fontStyle: "700",
      align: "center",
      fixedWidth: 580,
      wordWrap: { width: 560 },
      lineSpacing: 3,
    }).setOrigin(0.5);
    panel.add(status);
    return { container: panel, points, income, buttons, status };
  }

  createUnitButton(color, type, x, y) {
    const config = this.state?.config?.units?.[type];
    const fallbackCosts = { pawn: 40, knight: 100, bishop: 140, rook: 180, queen: 240, king: 80 };
    const cost = config?.cost ?? fallbackCosts[type];
    const container = this.add.container(x, y).setSize(80, 112);
    const selectorGlow = this.add.rectangle(0, 0, 76, 110, SIDE_COLORS[color], 0.1)
      .setStrokeStyle(3, SIDE_COLORS[color], 0.9)
      .setVisible(false);
    const hit = this.add.rectangle(0, 0, 80, 112, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggleUnitSelection(color, type));
    const icon = createPieceView(this, 0, -15, 58, this.skins[color], color, TYPE_TO_PIECE[type], "front");
    const costLabel = this.add.text(0, 43, String(cost), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "15px",
      color: SIDE_TEXT_COLORS[color],
      fontStyle: "900",
    }).setOrigin(0.5);
    container.add([selectorGlow, icon, costLabel, hit]);
    return { container, selectorGlow, icon, costLabel, hit, cost };
  }

  toggleUnitSelection(color, type) {
    if (!this.state || this.gameOver) return;
    if (this.isAIMode() && color !== this.playerColor) return;
    if (this.selectedTypes[color] === type) {
      this.selectedTypes[color] = null;
      this.updatePanels();
      playFeedback("ui");
      return;
    }
    const cost = this.state.config.units[type].cost;
    if (this.state.players[color].points < cost) {
      this.setSideMessage(color, t("siege.notEnough", {
        points: Math.floor(this.state.players[color].points),
        cost,
      }), true);
      playFeedback("error");
      return;
    }
    this.selectedTypes[color] = type;
    this.updatePanels();
    if (this.selectedTypes[color]) this.pulseUnitSelection(color, type);
    playFeedback("ui");
  }

  pulseUnitSelection(color, type) {
    const selector = this.sidePanels[color]?.buttons.get(type)?.selectorGlow;
    if (!selector) return;
    this.tweens.killTweensOf(selector);
    selector.setScale(1);
    this.tweens.add({
      targets: selector,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 70,
      yoyo: true,
      ease: "Sine.Out",
    });
  }

  handleBoardPress(row, col) {
    if (!this.state || this.gameOver) return;
    const color = row <= 3 ? "b" : "w";
    if (this.isAIMode() && color !== this.playerColor) return;
    const type = this.selectedTypes[color];
    if (!type) {
      this.setSideMessage(color, t("siege.deploy"));
      return;
    }
    const result = summonSiegeUnit(this.state, color, type, { row, col });
    if (!result.valid) {
      const message = result.reason === "insufficientPoints"
        ? t("siege.notEnough", {
            points: Math.floor(this.state.players[color].points),
            cost: this.state.config.units[type].cost,
          })
        : ["unitOccupied", "castleOccupied", "objectOccupied"].includes(result.reason)
          ? t("siege.occupied")
          : t("siege.invalidZone");
      this.setSideMessage(color, message, true);
      this.showInvalidCell(row, col);
      playFeedback("error");
      return;
    }
    this.handleEvents([result.event]);
    this.renderState();
    playFeedback("move");
  }

  showInvalidCell(row, col) {
    const { x, y } = this.boardCenter(row, col);
    const marker = this.add.rectangle(x, y, this.squareSize - 5, this.squareSize - 5, 0xd83e3e, 0.28)
      .setStrokeStyle(4, 0xd83e3e, 0.9).setDepth(210);
    this.tweens.add({
      targets: marker,
      alpha: 0,
      duration: 420,
      onComplete: () => marker.destroy(),
    });
  }

  setSideMessage(color, message, failure = false) {
    const status = this.sidePanels[color]?.status;
    if (!status) return;
    status.setText(message).setColor(failure ? "#c84b43" : "#7e654c");
    this.time.delayedCall(1700, () => {
      if (!status.active) return;
      status.setText("").setColor("#7e654c");
    });
  }

  boardCenter(row, col) {
    const display = this.displayCell(row, col);
    return {
      x: this.boardLayout.boardX + (display.col + 0.5) * this.squareSize,
      y: this.boardLayout.boardY + (display.row + 0.5) * this.squareSize,
    };
  }

  isAIMode() {
    return this.mode === "ai";
  }

  boardFlipped() {
    return this.isAIMode() && this.playerColor === "b";
  }

  displayCell(row, col) {
    return this.boardFlipped() ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  logicalCell(row, col) {
    return this.boardFlipped() ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  panelY(color) {
    if (!this.isAIMode()) return PANEL_Y[color];
    return color === this.playerColor ? PANEL_Y.w : PANEL_Y.b;
  }

  panelRotated(color) {
    return !this.isAIMode() && color === "b";
  }

  configureAIPanel() {
    const panel = this.sidePanels[this.aiColor];
    if (!panel) return;
    panel.buttons.forEach((button) => {
      button.hit.disableInteractive();
      button.container.setVisible(false);
    });
    panel.status.setText(t("siege.aiCommander")).setAlpha(0.82);
  }

  updateAI(delta) {
    if (!this.isAIMode() || !this.state || this.state.status !== "running" || this.helpOpen) return;
    this.aiCooldownMs -= Math.min(delta, 500);
    if (this.aiCooldownMs > 0) return;
    const action = chooseSiegeAIAction(this.state, this.aiColor, this.aiDifficulty);
    if (!action) {
      this.aiCooldownMs = 260;
      return;
    }
    const result = summonSiegeUnit(this.state, this.aiColor, action.type, action.cell);
    this.aiCooldownMs = action.intervalMs;
    if (!result.valid) return;
    this.handleEvents([result.event]);
    playFeedback("move", { vibrate: false });
  }

  renderState(initial = false) {
    if (!this.state) return;
    this.updatePanels();
    this.updateTimer();
    this.updateCastleBars();
    this.renderUnits(initial);
    this.renderChest();
    this.renderPortals();
  }

  updatePanels() {
    if (!this.state) return;
    for (const color of ["w", "b"]) {
      const panel = this.sidePanels[color];
      panel.points.setText(String(Math.floor(this.state.players[color].points)));
      const defense = siegeDefenseSupplyRate(this.state, color);
      panel.income.setText(t(defense > 0 ? "siege.incomeDefense" : "siege.income", {
        income: siegeEffectiveResourceRate(this.state, color),
        bonus: defense,
      }));
      panel.buttons.forEach((button, type) => {
        const affordable = this.state.players[color].points >= this.state.config.units[type].cost;
        const selected = this.selectedTypes[color] === type;
        const contentAlpha = affordable ? 1 : 0.52;
        button.icon.setAlpha(contentAlpha);
        button.costLabel.setAlpha(1);
        button.costLabel.setColor(affordable ? "#008faa" : "#c84b43");
        button.selectorGlow.setVisible(selected);
        if (selected) {
          const selectedColor = affordable ? SIDE_COLORS[color] : 0xc84b43;
          button.selectorGlow.setFillStyle(selectedColor, 0.11);
          button.selectorGlow.setStrokeStyle(3, selectedColor, 0.92);
        }
      });
    }
  }

  updateTimer() {
    const remaining = this.state.config.matchDurationMs - this.state.timeMs;
    const urgent = remaining <= 30000;
    for (const color of ["w", "b"]) {
      const timer = this.castleTimers[color];
      timer.text.setText(formatTime(remaining));
      timer.text.setColor(urgent ? "#c8443c" : SIDE_TEXT_COLORS[color]);
      timer.text.setScale(urgent && Math.ceil(remaining / 1000) % 2 === 0 ? 1.1 : 1);
      timer.pill.setFillStyle(urgent ? 0xffe4df : 0xfff8ea, urgent ? 0.98 : 0.94);
      timer.pill.setStrokeStyle(urgent ? 2 : 1.5, urgent ? 0xc8443c : SIDE_COLORS[color], 0.9);
    }
  }

  updateCastleBars() {
    for (const color of ["w", "b"]) {
      const castle = this.state.castles[color];
      const ratio = Phaser.Math.Clamp(castle.hp / castle.maxHp, 0, 1);
      this.castleBars[color].fill.displayWidth = 206 * ratio;
      this.castleBars[color].label.setText(String(Math.ceil(castle.hp)));
    }
  }

  renderUnits(initial = false) {
    const livingIds = new Set(this.state.units.map((unit) => unit.id));
    this.unitEntries.forEach((entry, id) => {
      if (livingIds.has(id)) return;
      if (entry.dying) return;
      this.destroyUnitEntry(entry);
      this.unitEntries.delete(id);
    });

    for (const unit of this.state.units) {
      let entry = this.unitEntries.get(unit.id);
      const position = this.boardCenter(unit.row, unit.col);
      if (!entry) {
        entry = this.createUnitEntry(unit, position);
        this.unitEntries.set(unit.id, entry);
        if (!initial) {
          entry.view.setScale(0.45).setAlpha(0);
          this.tweens.add({ targets: entry.view, scale: 1, alpha: 1, duration: 220, ease: "Back.Out" });
        }
      }
      const displayRow = this.displayCell(unit.row, unit.col).row;
      const depth = 105 + displayRow;
      entry.view.setDepth(depth);
      entry.hpBar.setDepth(depth + 2);
      entry.aura?.container?.setDepth(94 + displayRow);
      entry.allyAura?.container?.setDepth(93 + displayRow);
      if (!entry.moving) {
        entry.view.setPosition(position.x, position.y);
        entry.hpBar.setPosition(position.x, position.y - this.squareSize * 0.44);
        entry.aura?.setPosition(position.x, position.y);
        entry.allyAura?.setPosition(position.x, position.y);
      }
      entry.allyAura?.setVisible(this.unitHasKingAura(unit));
      const hpRatio = Phaser.Math.Clamp(unit.hp / unit.maxHp, 0, 1);
      entry.hpFill.displayWidth = entry.hpInnerWidth * hpRatio;
      entry.hpShine.displayWidth = entry.hpInnerWidth * hpRatio;
      const healthColor = hpRatio <= 0.3
        ? HEALTH_COLORS.critical
        : hpRatio <= 0.6
          ? HEALTH_COLORS.warning
          : HEALTH_COLORS.healthy;
      entry.hpFill.setFillStyle(healthColor, 1);
      entry.hpBar.setAlpha(hpRatio >= 0.999 ? 0.82 : 1);
    }
  }

  createUnitEntry(unit, position) {
    const size = Math.floor(this.squareSize * 0.88);
    const facing = "front";
    const view = createPieceView(
      this,
      position.x,
      position.y,
      size,
      this.skins[unit.color],
      unit.color,
      TYPE_TO_PIECE[unit.type],
      facing,
    );
    alignBoardPieceView(view, size, this.skins[unit.color], facing);
    const display = this.displayCell(unit.row, unit.col);
    view.setAngle(this.isAIMode() ? 0 : display.row >= 4 ? 180 : 0);
    const hpWidth = Math.round(this.squareSize * 0.7);
    const hpInnerWidth = hpWidth - 6;
    const hpBar = this.add.container(position.x, position.y - this.squareSize * 0.44);
    const hpShadow = this.add.rectangle(0, 2, hpWidth + 5, 13, 0x2a2119, 0.28);
    const hpTrack = this.add.rectangle(0, 0, hpWidth, 10, 0x2d241d, 0.96)
      .setStrokeStyle(2, 0xe5be72, 0.96);
    const hpFill = this.add.rectangle(-hpInnerWidth / 2, 0, hpInnerWidth, 6, SIDE_COLORS[unit.color], 1)
      .setOrigin(0, 0.5);
    const hpShine = this.add.rectangle(-hpInnerWidth / 2, -1.5, hpInnerWidth, 1.5, 0xffffff, 0.46)
      .setOrigin(0, 0.5);
    const sideMark = this.add.circle(-hpWidth / 2 - 5, 0, 4, SIDE_COLORS[unit.color], 1)
      .setStrokeStyle(1.5, 0xffe4a3, 0.95);
    hpBar.add([hpShadow, hpTrack, hpFill, hpShine, sideMark]);
    if (!this.isAIMode() && display.row >= 4) hpBar.setAngle(180);
    const aura = unit.type === "king"
      ? createSiegeKingAura(this, {
          x: position.x,
          y: position.y,
          color: unit.color,
          squareSize: this.squareSize,
          depth: 94 + unit.row,
        })
      : null;
    const allyAura = unit.type === "king" ? null : createSiegeAllyAura(this, {
      x: position.x,
      y: position.y,
      squareSize: this.squareSize,
      depth: 93 + unit.row,
    });
    return { view, hpBar, hpFill, hpShine, hpInnerWidth, aura, allyAura, moving: false, dying: false };
  }

  destroyUnitEntry(entry) {
    if (!entry) return;
    this.tweens.killTweensOf([entry.view, entry.hpBar]);
    destroySiegeKingAura(entry.aura);
    destroySiegeKingAura(entry.allyAura);
    entry.view?.destroy();
    entry.hpBar?.destroy(true);
  }

  renderChest() {
    const key = cellKey(this.state.chest);
    if (key === this.chestCellKey) return;
    this.destroyChestView();
    this.chestCellKey = key;
    if (!this.state.chest) return;
    const position = this.boardCenter(this.state.chest.row, this.state.chest.col);
    this.chestView = this.add.image(position.x, position.y, "kuma_ui_img_item_box")
      .setDisplaySize(this.squareSize * 0.68, this.squareSize * 0.68)
      .setDepth(90);
    this.tweens.add({
      targets: this.chestView,
      y: position.y - 4,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  destroyChestView() {
    if (!this.chestView) return;
    this.tweens.killTweensOf(this.chestView);
    this.chestView.destroy();
    this.chestView = null;
  }

  renderPortals() {
    const key = this.state.portals.map(cellKey).join("|");
    if (key === this.portalCellKey) return;
    this.destroyPortalLayer();
    this.portalCellKey = key;
    this.portalLayer = this.add.container(0, 0).setDepth(88);
    this.portalAnimationTargets = [];
    for (const cell of this.state.portals) {
      const position = this.boardCenter(cell.row, cell.col);
      const portal = this.add.container(position.x, position.y);
      const glow = this.add.image(0, 0, "kuma_ui_img_potal")
        .setDisplaySize(this.squareSize * 0.9, this.squareSize * 0.9)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
      const image = this.add.image(0, 0, "kuma_ui_img_potal")
        .setDisplaySize(this.squareSize * 0.76, this.squareSize * 0.76);
      portal.add([glow, image]);
      this.portalLayer.add(portal);
      this.portalAnimationTargets.push(glow, image);
      this.tweens.add({
        targets: glow,
        scale: { from: 0.86, to: 1.16 },
        alpha: { from: 0.22, to: 0.62 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      this.tweens.add({ targets: image, angle: 360, duration: 3600, repeat: -1 });
    }
  }

  destroyPortalLayer() {
    if (this.portalAnimationTargets.length) this.tweens.killTweensOf(this.portalAnimationTargets);
    this.portalAnimationTargets = [];
    this.portalLayer?.destroy(true);
    this.portalLayer = null;
  }

  updateMedalPointPeaks() {
    if (!this.state?.players || !this.medalStats) return;
    for (const color of ["w", "b"]) {
      this.medalStats.maxCrownPoints[color] = Math.max(
        this.medalStats.maxCrownPoints[color],
        Math.floor(Number(this.state.players[color]?.points) || 0),
      );
    }
  }

  recordMedalEvent(event) {
    if (!this.medalStats || !event) return;
    if (event.type === "unitSummoned" && event.color && event.unitType) {
      this.medalStats.summonedTypes[event.color]?.add(event.unitType);
    } else if (event.type === "unitTeleported") {
      const color = this.state.units.find((unit) => unit.id === event.unitId)?.color;
      if (color) this.medalStats.portalUses[color] += 1;
    } else if (event.type === "chestEffectApplied" && event.color) {
      this.medalStats.itemUses[event.color] += 1;
    } else if (event.type === "unitDied" && event.killerColor && event.color !== event.killerColor) {
      const defended = event.killerColor === "w" ? event.row >= 5 : event.row <= 2;
      if (defended) this.medalStats.defenseSaves[event.killerColor] += 1;
    }
  }

  handleEvents(events) {
    const movedIds = new Set(events
      .filter((event) => event.type === "unitMoved" || event.type === "unitTeleported")
      .map((event) => event.unitId));
    const delayedDeathIds = new Set(events
      .filter((event) => event.type === "unitAttacked" && event.targetKind === "unit" && movedIds.has(event.attackerId))
      .map((event) => event.targetId));
    for (const event of events) {
      this.recordMedalEvent(event);
      if (event.type === "unitMoved" || event.type === "unitTeleported") this.animateUnitMove(event);
      else if (event.type === "unitAttacked") this.animateAttack(event, movedIds.has(event.attackerId) ? 215 : 0);
      else if (event.type === "unitDied") this.animateUnitDeath(event, delayedDeathIds.has(event.unitId) ? 350 : 0);
      else if (event.type === "castleDamaged") this.updateCastleHitFeedback(event);
      else if (event.type === "chestEffectApplied") this.showItemEffect(event);
      else if (event.type === "portalsSpawned") playFeedback("reward", { vibrate: false });
      if (event.type === "unitTeleported") playFeedback("check");
    }
    this.updateMedalPointPeaks();
  }

  animateUnitMove(event) {
    const entry = this.unitEntries.get(event.unitId);
    if (!entry) return;
    const destination = this.boardCenter(event.to.row, event.to.col);
    entry.moving = true;
    const duration = event.type === "unitTeleported" ? 150 : 210;
    this.tweens.killTweensOf([entry.view, entry.hpBar]);
    this.tweens.add({
      targets: [entry.view, entry.hpBar],
      x: destination.x,
      y: (target) => target === entry.view ? destination.y : destination.y - this.squareSize * 0.44,
      alpha: event.type === "unitTeleported" ? { from: 0.25, to: 1 } : 1,
      duration,
      ease: event.type === "unitTeleported" ? "Back.Out" : "Sine.Out",
      onComplete: () => { entry.moving = false; },
    });
    if (entry.aura?.container) {
      this.tweens.add({
        targets: entry.aura.container,
        x: destination.x,
        y: destination.y,
        duration,
        ease: "Sine.Out",
      });
    }
    if (entry.allyAura?.container) {
      this.tweens.add({
        targets: entry.allyAura.container,
        x: destination.x,
        y: destination.y,
        duration,
        ease: "Sine.Out",
      });
    }
  }

  unitHasKingAura(unit) {
    if (unit.type === "king") return false;
    const radius = this.state.config.units.king.auraRadius;
    return this.state.units.some((ally) => (
      ally.color === unit.color
      && ally.type === "king"
      && ally.hp > 0
      && Math.abs(ally.row - unit.row) + Math.abs(ally.col - unit.col) <= radius
    ));
  }

  animateAttack(event, delay = 0) {
    if (delay > 0) {
      this.time.delayedCall(delay, () => this.animateAttack(event));
      return;
    }
    const attacker = this.unitEntries.get(event.attackerId);
    const targetView = event.targetKind === "unit"
      ? this.unitEntries.get(event.targetId)?.view
      : this.castleViews[event.targetColor];
    const attackerPosition = event.attackerCell ? this.boardCenter(event.attackerCell.row, event.attackerCell.col) : attacker?.view;
    const targetPosition = event.targetCell ? this.boardCenter(event.targetCell.row, event.targetCell.col) : targetView;
    if (!attackerPosition || !targetPosition) return;
    playSiegeAttackEffect(this, {
      unitType: event.attackerType,
      special: event.special,
      effectRole: event.effectRole,
      targetKind: event.targetKind,
      attacker: attackerPosition,
      target: targetPosition,
      color: event.attackerColor,
      squareSize: this.squareSize,
      depth: 188,
    });
    if (event.effectRole !== "secondary" && attacker?.view && event.attackerType === "knight") {
      const dx = targetPosition.x - attackerPosition.x;
      const dy = targetPosition.y - attackerPosition.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const lunge = () => {
        if (!attacker.view?.active) return;
        this.tweens.add({
          targets: attacker.view,
          x: attacker.view.x + dx / distance * this.squareSize * 0.12,
          y: attacker.view.y + dy / distance * this.squareSize * 0.12,
          duration: 90,
          yoyo: true,
          ease: "Cubic.Out",
        });
      };
      lunge();
    } else if (event.effectRole !== "secondary" && attacker?.view) {
      this.tweens.add({
        targets: attacker.view,
        scaleX: 1.035,
        scaleY: 1.035,
        duration: 85,
        yoyo: true,
        ease: "Sine.Out",
      });
    }
    if (event.targetKind === "unit" && targetView) {
      this.tweens.add({
        targets: targetView,
        alpha: 0.48,
        duration: 90,
        yoyo: true,
        repeat: 1,
      });
    } else if (targetView) {
      playSiegeCastleHitEffect(this, {
        target: targetView,
        squareSize: this.squareSize,
        special: event.special,
        damage: event.damage,
        depth: 196,
      });
      if (event.attackerType === "rook" && event.special === "siege") {
        const now = this.time.now;
        if (now - this.lastCastleImpactAt >= 120) {
          this.lastCastleImpactAt = now;
          this.cameras.main.shake(85, 0.00085);
          playFeedback("capture", { vibrate: false });
        }
      }
    }
  }

  animateUnitDeath(event, delay = 0) {
    const entry = this.unitEntries.get(event.unitId);
    if (!entry) return;
    entry.dying = true;
    const run = () => {
      if (!entry.view?.active) return;
      this.tweens.add({
        targets: [entry.view, entry.hpBar],
        alpha: 0,
        scale: 0.6,
        duration: 230,
        onComplete: () => {
          this.showKillReward(event);
          this.destroyUnitEntry(entry);
          this.unitEntries.delete(event.unitId);
        },
      });
    };
    if (delay > 0) this.time.delayedCall(delay, run);
    else run();
  }

  showKillReward(event) {
    const reward = Math.round(event.reward || 0);
    if (reward <= 0 || !event.killerColor) return;
    const position = this.boardCenter(event.row, event.col);
    const layer = this.add.container(position.x, position.y - this.squareSize * 0.12).setDepth(240);
    const plate = this.add.rectangle(0, 0, 70, 28, 0x2d241d, 0.92)
      .setStrokeStyle(2, 0xe5be72, 0.96);
    const crown = this.add.image(-22, 0, "kuma_ui_icon_king_crown").setDisplaySize(22, 22);
    const label = this.add.text(7, 0, `+${reward}`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: "#fff4c8",
      fontStyle: "900",
    }).setOrigin(0.5);
    layer.add([plate, crown, label]);
    if (!this.isAIMode() && this.displayCell(event.row, event.col).row < 4) layer.setAngle(180);
    this.tweens.add({
      targets: layer,
      y: layer.y - 24,
      alpha: 0,
      duration: 760,
      ease: "Cubic.Out",
      onComplete: () => layer.destroy(true),
    });
    const points = this.sidePanels[event.killerColor]?.points;
    if (points) {
      this.tweens.killTweensOf(points);
      points.setScale(1);
      this.tweens.add({ targets: points, scale: 1.18, duration: 90, yoyo: true, ease: "Back.Out" });
    }
    playFeedback("reward", { vibrate: false });
  }

  updateCastleHitFeedback(_event) {
    const now = this.time.now;
    if (now - this.lastCastleImpactAt < 120) return;
    this.lastCastleImpactAt = now;
    playFeedback("capture", { vibrate: false });
  }

  showItemEffect(event) {
    const detail = event.detail || {};
    let key = "siege.item.boost";
    let params = {};
    if (event.effectId === "points50" || event.effectId === "points100") {
      key = "siege.item.points";
      params = { amount: Math.round(detail.amount || 0) };
    } else if (event.effectId === "income1" || event.effectId === "income2") {
      key = "siege.item.income";
      params = { amount: event.effectId === "income1" ? 1 : 2 };
    } else if (event.effectId === "attack") key = "siege.item.attack";
    else if (event.effectId === "move") key = "siege.item.speed";
    else if (event.effectId === "attackSpeed") key = "siege.item.haste";
    else if (event.effectId === "heal") key = "siege.item.heal";
    else if (event.effectId === "freePawn") key = "siege.item.pawn";
    else if (event.effectId === "portalReset") key = "siege.item.portal";
    const topSide = this.panelY(event.color) < this.scale.height / 2;
    const y = topSide ? 292 : 918;
    const label = this.add.text(this.scale.width / 2, y, t(key, params), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color: "#fff4cf",
      backgroundColor: "#3a2a1fde",
      padding: { x: 18, y: 10 },
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(520).setAngle(!this.isAIMode() && event.color === "b" ? 180 : 0);
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: y + (topSide ? 18 : -18),
      delay: 900,
      duration: 380,
      onComplete: () => label.destroy(),
    });
    playFeedback("reward");
  }

  finishMatch() {
    if (this.gameOver) return;
    this.gameOver = true;
    const winner = this.state.winner;
    const result = winner === "w" ? "w_win" : winner === "b" ? "b_win" : "draw";
    const reason = this.state.resultReason === "castleDestroyed" ? "siegeComplete" : "siegeTimeout";
    this.updateMedalPointPeaks();
    const profileColors = this.isAIMode() ? [this.playerColor] : ["w", "b"];
    const achievementColor = this.isAIMode() ? this.playerColor : winner;
    const medalResult = recordMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "siege",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner === "draw" ? null : winner,
      stats: {
        portalUses: profileColors.reduce((sum, color) => sum + this.medalStats.portalUses[color], 0),
        itemUses: profileColors.reduce((sum, color) => sum + this.medalStats.itemUses[color], 0),
        defenseSaves: profileColors.reduce((sum, color) => sum + this.medalStats.defenseSaves[color], 0),
        summonedTypes: achievementColor ? Array.from(this.medalStats.summonedTypes[achievementColor]) : [],
        maxCrownPoints: achievementColor ? this.medalStats.maxCrownPoints[achievementColor] : 0,
        castleDestroyed: this.state.resultReason === "castleDestroyed",
      },
    });
    const dailyResult = recordDailyMiniGameCompletion({
      sessionId: this.gameSessionId,
      gameId: "siege",
      mode: this.mode,
      playerColor: this.playerColor,
      winnerColor: winner === "draw" ? "" : winner,
    });
    playFeedback(winner === "draw" ? "check" : this.isAIMode() && winner !== this.playerColor ? "failure" : "reward");
    this.time.delayedCall(750, () => {
      this.scene.start("Result", {
        result,
        reason,
        winnerColor: winner === "draw" ? null : winner,
        castleHp: {
          w: Math.ceil(this.state.castles.w.hp),
          b: Math.ceil(this.state.castles.b.hp),
        },
        skins: this.skins,
        mode: this.mode,
        playerColor: this.isAIMode() ? this.playerColor : null,
        difficulty: this.isAIMode() ? this.aiDifficulty : null,
        gameSessionId: this.gameSessionId,
        sourceScene: "KingdomSiege",
        newlyUnlocked: Array.from(new Set([...medalResult.newlyUnlocked, ...dailyResult.newlyUnlocked])),
      });
    });
  }
}
