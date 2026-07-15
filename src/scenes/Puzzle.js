import { Chess } from "../vendor-chess.js?v=20260715-domain04";
import { readPlayerState } from "../playerState.js?v=20260715-domain04";
import { alignBoardPieceView, createPieceView, setSelectedOutline } from "../pieceStyles.js?v=20260715-domain04";
import { puzzleGlossary, puzzleText, t } from "../i18n.js?v=20260715-domain04";
import { getPuzzle, markPuzzleCleared, PUZZLES } from "../puzzles.js?v=20260715-domain04";
import { SpriteButton } from "../ui/SpriteButton.js?v=20260715-domain04";
import {
  addDarkTopBar,
  addChessBoard,
  addLargeTextButton,
  addPanel,
  createModalBackdrop,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260715-domain04";

const FILES = "abcdefgh";

export class Puzzle extends Phaser.Scene {
  constructor() {
    super("Puzzle");
    this.game = null;
    this.puzzle = null;
    this.puzzleIndex = 0;
    this.stepIndex = 0;
    this.squareSize = 0;
    this.boardX = 0;
    this.boardY = 0;
    this.pieceViews = new Map();
    this.highlights = [];
    this.selected = null;
    this.skins = { w: "classic", b: "classic" };
    this.messageText = null;
    this.hintText = null;
    this.progressText = null;
    this.nextButtonLayer = null;
    this.promotionLayer = null;
    this.glossaryLayer = null;
    this.boardFrame = null;
    this.solved = false;
    this.conceptEnabled = true;
    this.responseTimer = null;
    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };
    this._dragCandidate = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragThreshold = 8;
    this._moveBusy = false;
    this._feedbackLine = null;
  }

  init(data) {
    this.puzzleIndex = data?.puzzleIndex ?? 0;
    this.puzzle = getPuzzle(this.puzzleIndex);
    this.stepIndex = 0;
    this.solved = false;
    this.selected = null;
    this.highlights = [];
    this.pieceViews = new Map();
    this.nextButtonLayer = null;
    this.promotionLayer = null;
    this.glossaryLayer = null;
    this.responseTimer = null;
    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };
    this._dragCandidate = false;
    this._moveBusy = false;
    this._feedbackLine = null;
  }

  create() {
    const savedSkin = this.registry.get("pieceSkin");
    if (savedSkin?.w) this.skins.w = savedSkin.w;
    if (savedSkin?.b) this.skins.b = savedSkin.b;
    this.conceptEnabled = true;
    this.registry.set("conceptEnabled", true);

    this.game = new Chess(this.puzzle.fen);
    this.layout();
    this.drawBackground();
    this.drawBoard();
    this.createUI();
    this.renderAll();
    this.updateProgress();

    this.input.on("pointerdown", (p) => this.onPointerDown(p));
    this.input.on("pointermove", (p) => this.onPointerMove(p));
    this.input.on("pointerup", (p) => this.onPointerUp(p));
    this.input.on("pointerupoutside", (p) => this.onPointerUp(p));
  }

  layout() {
    this.boardLayout = getChessBoardLayout(this, { outerTop: 284, outerWidth: 712 });
    this.squareSize = this.boardLayout.squareSize;
    this.boardX = this.boardLayout.boardX;
    this.boardY = this.boardLayout.boardY;
  }

  drawBackground() {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0);
    bg.setDepth(-100);
  }

  drawBoard() {
    this.boardFrame?.destroy();
    this.boardFrame = addChessBoard(this, this.boardLayout, 0);
  }

  createUI() {
    const { width, height } = this.scale;
    const side = t(`side.${this.puzzle.playerColor}`);
    this.defaultStatus = t("game.turn", { side, check: "" });
    addDarkTopBar(this, "Kuma Chess");

    this.titleText = this.add.text(width / 2, 154, puzzleText(this.puzzle, "title"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "30px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(50);
    this.drawGlossaryButton();

    this.promptText = this.add.text(width / 2, 211, puzzleText(this.puzzle, "prompt"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "18px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
      align: "center",
      wordWrap: { width: width * 0.84 },
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(50);

    this.progressText = this.add.text(width / 2, 250, "", {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "16px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(50);

    this.messageText = this.add.text(width / 2, 1100, this.defaultStatus, {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "26px",
      color: KUMA_COLORS.orange,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(50);

    this.hintText = this.add.text(width / 2, 1142, "", {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "16px",
      color: "#9b6b14",
      fontStyle: "500",
      align: "center",
      wordWrap: { width: width * 0.82 },
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(50);

    const hintBtn = this.add.image(150, height - 68, "kuma_ui_btn_hint").setDisplaySize(70, 70)
      .setDepth(60).setInteractive({ useHandCursor: true });
    hintBtn.on("pointerdown", () => this.showHint());

    const backBtn = new SpriteButton(this, 67, height - 68, {
      normal: "kuma_ui_btn_back",
      hover: "kuma_ui_btn_back",
      pressed: "kuma_ui_btn_back",
    }, () => this.undoLastTurn());
    backBtn.setScaleTo(72, 72);
    backBtn.setDepth(60);

    const toggleLabel = this.add.text(width - 67, height - 96, t("game.conceptOff"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "17px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(60);
    this.toggleLabel = toggleLabel;
    const toggle = this.add.image(width - 67, height - 56, this.conceptEnabled ? "kuma_ui_btn_radio_off" : "kuma_ui_btn_radio_on")
      .setDisplaySize(80, 54).setDepth(60).setInteractive({ useHandCursor: true });
    toggle.on("pointerdown", () => {
      this.conceptEnabled = !this.conceptEnabled;
      this.registry.set("conceptEnabled", this.conceptEnabled);
      toggle.setTexture(this.conceptEnabled ? "kuma_ui_btn_radio_off" : "kuma_ui_btn_radio_on");
      this.clearSelection();
      this.renderAll();
    });

  }

  drawGlossaryButton() {
    this.glossaryButton?.destroy();
    const glossary = puzzleGlossary(this.puzzle);
    if (!glossary || !this.titleText) return;

    const radius = 16;
    const x = Math.min(this.scale.width - 58, this.titleText.x + this.titleText.width / 2 + 30);
    const y = this.titleText.y;
    const group = this.add.container(x, y).setDepth(60);
    const ring = this.add.graphics();
    ring.lineStyle(1.5, 0xbda17f, 1);
    ring.strokeCircle(0, 0, radius);
    const mark = this.add.text(0, 0, "?", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "21px",
      color: "#846648",
      fontStyle: "700",
    }).setOrigin(0.5);
    const hit = this.add.circle(0, 0, radius + 6, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.showGlossary());
    group.add([ring, mark, hit]);
    this.glossaryButton = group;
  }

  showGlossary() {
    if (this.glossaryLayer || this.promotionLayer) return;
    const glossary = puzzleGlossary(this.puzzle);
    if (!glossary) return;

    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.glossaryLayer = layer;
    const px = width / 2;
    const py = height / 2;
    const panelW = Math.min(514, width * 0.86);
    const panelH = 440;
    const panel = addPanel(this, px, py, panelW, panelH, 10001);
    const title = this.add.text(px, py - 118, glossary.title, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "30px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
      align: "center",
      wordWrap: { width: panelW * 0.78 },
    }).setOrigin(0.5).setDepth(10002);
    const divider = this.add.rectangle(px, py - 74, panelW * 0.72, 2, 0xc69d72).setDepth(10002);
    const description = this.add.text(px, py + 12, glossary.description, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "21px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
      align: "center",
      wordWrap: { width: panelW * 0.76 },
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(10002);

    const close = () => {
      backdrop.cleanup();
      layer.destroy();
      this.glossaryLayer = null;
    };
    const confirm = addLargeTextButton(this, px, py + 150, t("common.confirm"), "", close, {
      width: 195,
      height: 72,
      fontSize: 23,
      dark: true,
      depth: 10002,
    });
    layer.add([panel, title, divider, description, confirm.button, confirm.title]);
  }

  renderAll() {
    for (const view of this.pieceViews.values()) view.destroy();
    this.pieceViews.clear();

    const board = this.game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const square = this.rcToSquare(r, c);
        const { x, y } = this.squareToCenter(square);
        const bottomColor = this.puzzle.playerColor;
        const size = Math.floor(this.squareSize * 1.02);
        const skin = this.conceptEnabled ? this.skins[piece.color] : "icon";
        const facing = piece.color === bottomColor ? "back" : "front";
        const view = createPieceView(
          this,
          x,
          y,
          size,
          skin,
          piece.color,
          piece.type,
          facing
        );
        alignBoardPieceView(view, size, skin, facing);
        view._square = square;
        view._color = piece.color;
        view._type = piece.type;
        this.setPieceViewOrientation(view);
        const displayRow = this.squareToRC(square).r;
        view._baseDepth = 20 + displayRow;
        view.setDepth(view._baseDepth);
        this.pieceViews.set(square, view);
      }
    }
  }

  setPieceViewOrientation(view) {
    const mag = Math.max(0.01, Math.abs(view.scaleX || 1));
    view.scaleX = mag;
    view.scaleY = mag;
  }

  onPointerDown(pointer) {
    if (this.solved || this._moveBusy) return;
    if (this.promotionLayer || this.glossaryLayer) return;
    if (this.game.turn() !== this.puzzle.playerColor) return;

    const square = this.pointerToSquare(pointer);
    if (!square) return;

    const piece = this.game.get(square);
    const view = this.pieceViews.get(square);

    if (piece && piece.color === this.game.turn() && view) {
      this.selectPiece(square, view);
      this._dragCandidate = true;
      this.dragging = false;
      this._dragStart.x = pointer.x;
      this._dragStart.y = pointer.y;
      this.dragOffset = { dx: 0, dy: 0 };
      return;
    }

    if (this.selected) this.tryMove(this.selected.square, square);
  }

  onPointerMove(pointer) {
    if (this.solved || this._moveBusy || this.promotionLayer || this.glossaryLayer) return;
    if (this.game.turn() !== this.puzzle.playerColor || !this.selected?.view) return;

    if (this._dragCandidate && !this.dragging) {
      const dx = pointer.x - this._dragStart.x;
      const dy = pointer.y - this._dragStart.y;
      if (Math.hypot(dx, dy) >= this._dragThreshold) {
        this.dragging = true;
        const view = this.selected.view;
        this.dragOffset = { dx: view.x - pointer.x, dy: view.y - pointer.y };
      }
    }

    if (this.dragging) {
      const view = this.selected.view;
      view.x = pointer.x + this.dragOffset.dx;
      view.y = pointer.y + this.dragOffset.dy;
    }
  }

  onPointerUp(pointer) {
    if (this.promotionLayer || this.glossaryLayer) return;

    const wasDragging = this.dragging;
    this._dragCandidate = false;
    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };

    if (!wasDragging || this.solved || this._moveBusy) return;

    const from = this.selected?.square;
    const to = this.pointerToSquare(pointer);
    this.snapSelectedBack();

    if (!from || !to || from === to) {
      this.showMoveFailure(t("puzzle.illegal"));
      return;
    }

    this.tryMove(from, to);
  }

  selectPiece(square, view) {
    this.clearSelection(false);
    this.selected = { square, view };
    this.tweens.killTweensOf(view);
    setSelectedOutline(view, true);
    view.setDepth(110);

    for (const move of this.game.moves({ square, verbose: true })) {
      this.highlights.push(this.drawHighlight(move.to));
    }
  }

  snapSelectedBack() {
    if (!this.selected?.view || !this.selected?.square) return;
    const { x, y } = this.squareToCenter(this.selected.square);
    this.selected.view.x = x;
    this.selected.view.y = y;
  }

  bounceSelectedBack(keepSelected = true) {
    const selected = this.selected;
    if (!selected?.view || !selected?.square) return;
    const { x, y } = this.squareToCenter(selected.square);
    this.tweens.killTweensOf(selected.view);
    this.tweens.add({
      targets: selected.view,
      x,
      y,
      duration: 130,
      ease: "Quad.Out",
      onComplete: () => {
        if (!keepSelected) this.clearSelection();
      },
    });
  }

  tryMove(from, to) {
    const candidates = this.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!candidates.length) {
      this.bounceSelectedBack(true);
      this.showMoveFailure(t("puzzle.illegal"));
      return;
    }

    if (candidates.some((m) => m.promotion)) {
      this.showPromotionPicker(this.game.get(from)?.color || this.puzzle.playerColor, (promotion) => {
        if (!promotion) {
          this.clearSelection();
          return;
        }
        this.applyPuzzleMove(from, to, promotion);
      });
      return;
    }

    this.applyPuzzleMove(from, to, null);
  }

  applyPuzzleMove(from, to, promotion = null) {
    const payload = { from, to };
    if (promotion) payload.promotion = promotion;

    let move = null;
    try {
      move = this.game.move(payload);
    } catch (e) {
      this.bounceSelectedBack(true);
      this.showMoveFailure(t("puzzle.illegal"));
      return;
    }

    const uci = `${move.from}${move.to}${move.promotion || ""}`;
    const answers = this.puzzle.solutionSteps[this.stepIndex] || [];
    if (!answers.includes(uci)) {
      this.game.undo();
      this.clearSelection();
      this.renderAll();
      this.showMoveFailure(t("puzzle.wrong"));
      return;
    }

    this._moveBusy = true;
    this.stepIndex += 1;
    this.clearSelection();
    this.renderAll();
    this.updateProgress();
    this.flashMessage(move.san.includes("#") ? "CHECKMATE!" : t("puzzle.correct"), "#bbf7d0");
    this.playImpactEffect(move.to, !!move.captured, true, () => {
      this._moveBusy = false;
    });

    if (this.stepIndex >= this.puzzle.solutionSteps.length) {
      this.completePuzzle();
      return;
    }

    this.responseTimer = this.time.delayedCall(520, () => {
      this.responseTimer = null;
      this.playAutoResponses();
    });
  }

  undoLastTurn() {
    if (!this.game || this.solved || this.promotionLayer) return;

    this.responseTimer?.remove(false);
    this.responseTimer = null;
    const history = this.game.history({ verbose: true });
    if (!history.length) {
      this.flashMessage(t("game.undoUnavailable"), "#9b6b14");
      return;
    }

    let undoCount = 1;
    if (this.game.turn() === this.puzzle.playerColor) {
      const last = history[history.length - 1];
      const previous = history[history.length - 2];
      if (!last || last.color === this.puzzle.playerColor || !previous || previous.color !== this.puzzle.playerColor) {
        this.flashMessage(t("game.undoUnavailable"), "#9b6b14");
        return;
      }
      undoCount = 2;
    }

    for (let i = 0; i < undoCount; i++) this.game.undo();
    this.stepIndex = Math.max(0, this.stepIndex - undoCount);
    this.hintText?.setText("");
    this.clearSelection();
    this.renderAll();
    this.updateProgress();
    this.flashMessage(this.defaultStatus, KUMA_COLORS.orange);
  }

  showPromotionPicker(color, onPick) {
    if (this.promotionLayer) return;

    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.promotionLayer = layer;

    const panelW = 513;
    const panelH = 647;
    const px = width / 2;
    const py = height / 2;

    const panel = addPanel(this, px, py, panelW, panelH, 10001);
    layer.add(panel);

    const title = this.add.text(px, py - 195, t("promotion.title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "26px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(10002);
    const divider = this.add.rectangle(px, py - 153, panelW * 0.74, 2, 0xc69d72).setDepth(10002);
    const subtitle = this.add.text(px, py - 110, t("promotion.subtitle"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "23px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(10002);
    layer.add([title, divider, subtitle]);

    const choices = [
      { key: "q", label: "Queen" },
      { key: "r", label: "Rook" },
      { key: "b", label: "Bishop" },
      { key: "n", label: "Knight" },
    ];
    const skinId = this.conceptEnabled ? this.skins[color] : "icon";
    let selectedChoice = "q";
    let choiceLayer = null;
    const drawChoices = () => {
      choiceLayer?.destroy();
      choiceLayer = this.add.container(0, 0).setDepth(10002);
      const y = py + 49;
      choices.forEach((choice, i) => {
        const x = px - 160 + i * 106.7;
        const selected = selectedChoice === choice.key;
        const card = this.add.rectangle(x, y, 98, 218, 0xfff4df, selected ? 0.94 : 0.62)
          .setStrokeStyle(2, selected ? 0xc79a37 : 0xc69d72, 1)
          .setInteractive({ useHandCursor: true });
        card.on("pointerdown", () => {
          selectedChoice = choice.key;
          drawChoices();
        });
        const topLabel = this.add.text(x, y - 82, choice.label, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "15px",
          color: selected ? KUMA_COLORS.teal : "#8b735b",
          fontStyle: "700",
        }).setOrigin(0.5);
        const piece = createPieceView(this, x, y + 2, 100, skinId, color, choice.key);
        const keyLabel = this.add.text(x, y + 84, choice.key.toUpperCase(), {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "24px",
          color: selected ? KUMA_COLORS.teal : KUMA_COLORS.ink,
          fontStyle: "900",
        }).setOrigin(0.5);
        choiceLayer.add([card, topLabel, piece, keyLabel]);
      });
      layer.add(choiceLayer);
    };
    drawChoices();

    const close = (choice) => {
      backdrop.cleanup();
      layer.destroy();
      this.promotionLayer = null;
      onPick(choice);
    };
    const cancel = addLargeTextButton(this, px - 106, py + 243, t("common.cancel"), "", () => close(null), {
      width: 187,
      height: 81,
      fontSize: 24,
      depth: 10002,
    });
    const change = addLargeTextButton(this, px + 103, py + 243, t("common.change"), "", () => close(selectedChoice), {
      width: 195,
      height: 81,
      fontSize: 24,
      dark: true,
      depth: 10002,
    });
    layer.add([cancel.button, cancel.title, change.button, change.title]);
  }

  playAutoResponses() {
    if (this.solved) return;
    while (this.game.turn() !== this.puzzle.playerColor && this.stepIndex < this.puzzle.solutionSteps.length) {
      const next = this.puzzle.solutionSteps[this.stepIndex]?.[0];
      if (!next) return;

      let moved = null;
      try {
        moved = this.game.move({
          from: next.slice(0, 2),
          to: next.slice(2, 4),
          promotion: next[4],
        });
      } catch (e) {
        return;
      }

      this.stepIndex += 1;
      this.renderAll();
      this.updateProgress();
      this.playImpactEffect(next.slice(2, 4), !!moved?.captured, false);
    }
  }

  showMoveFailure(message) {
    if (this._feedbackLine?.scene) this._feedbackLine.destroy();
    this._feedbackLine = showRewardLine(this, message, {
      y: this.scale.height * 0.52,
      hold: 1750,
      showCoin: false,
      tone: "failure",
      particleScale: 1.15,
      particleCount: 10,
    });
  }

  vibrateImpact(strong = false) {
    if (!readPlayerState().vibrationEnabled) return;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(strong ? [28, 18, 44] : 18);
      }
    } catch (e) {
      // Vibration is optional and may be blocked by the browser or device policy.
    }
  }

  playImpactEffect(square, isCapture, isCorrect = false, onDone = null) {
    const view = this.pieceViews.get(square);
    const { x, y } = this.squareToCenter(square);
    const strong = isCapture || isCorrect;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      onDone?.();
    };

    this.vibrateImpact(strong);
    this.cameras.main.shake(strong ? 85 : 50, strong ? 0.005 : 0.0025);

    const ring = this.add.graphics().setDepth(997).setPosition(x, y);
    ring.lineStyle(strong ? 5 : 3, strong ? 0xe0b353 : 0xbda17f, 0.9);
    ring.strokeCircle(0, 0, this.squareSize * 0.2);
    ring.setScale(0.55);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: strong ? 330 : 260,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });

    const textureKey = "puzzle_fx_dust_dot";
    if (!this.textures.exists(textureKey)) {
      const texture = this.make.graphics({ x: 0, y: 0, add: false });
      texture.fillStyle(0xffffff, 1);
      texture.fillCircle(8, 8, 8);
      texture.generateTexture(textureKey, 16, 16);
      texture.destroy();
    }

    const count = strong ? 14 : 9;
    for (let i = 0; i < count; i += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const speed = Phaser.Math.FloatBetween(strong ? 95 : 65, strong ? 205 : 145);
      const dust = this.add.image(x, y + this.squareSize * 0.2, textureKey)
        .setDepth(996)
        .setTint(i % 2 ? 0xe0b353 : 0xc7aa82)
        .setAlpha(Phaser.Math.FloatBetween(0.28, 0.58))
        .setScale(Phaser.Math.FloatBetween(0.24, 0.55));
      this.tweens.add({
        targets: dust,
        x: x + Math.cos(angle) * speed,
        y: dust.y + Math.sin(angle) * speed * 0.58 - Phaser.Math.FloatBetween(12, 38),
        alpha: 0,
        scaleX: dust.scaleX * 1.8,
        scaleY: dust.scaleY * 1.8,
        duration: Phaser.Math.Between(230, 370),
        ease: "Quad.Out",
        onComplete: () => dust.destroy(),
      });
    }

    if (view) {
      const baseX = view.scaleX;
      const baseY = view.scaleY;
      this.tweens.killTweensOf(view);
      this.tweens.add({
        targets: view,
        scaleX: baseX * 1.08,
        scaleY: baseY * 0.9,
        duration: 95,
        ease: "Quad.Out",
        yoyo: true,
        hold: 20,
        onComplete: () => {
          view.scaleX = baseX;
          view.scaleY = baseY;
          done();
        },
      });
    } else {
      this.time.delayedCall(240, done);
    }
    this.time.delayedCall(500, done);
  }

  completePuzzle() {
    this.solved = true;
    const result = markPuzzleCleared(this.puzzle.id);
    this.hintText?.setText("");
    this.messageText?.setVisible(false);
    const rewardText = result.reward?.awarded ? `   +${result.reward.amount} COIN` : "";
    showRewardLine(this, `${t("puzzle.clear")}${rewardText}`, {
      y: this.scale.height * 0.52,
      hold: 2300,
      showCoin: !!result.reward?.awarded,
      particleScale: 1.6,
    });
    this.showNextButton();
  }

  showNextButton() {
    const { width, height } = this.scale;
    const isLastPuzzle = this.puzzleIndex >= PUZZLES.length - 1;
    const nextIndex = this.puzzleIndex + 1;

    if (this.nextButtonLayer) this.nextButtonLayer.destroy();
    this.nextButtonLayer = this.add.container(0, 0).setDepth(200);

    const btn = new SpriteButton(this, width / 2, height - 156, {
      normal: "kuma_ui_btn_start_normal",
      hover: "kuma_ui_btn_start_hover",
      pressed: "kuma_ui_btn_start_click",
    }, () => {
      if (isLastPuzzle) {
        this.scene.start("PuzzleSelect", { page: Math.floor(this.puzzleIndex / 8) });
      } else {
        this.scene.restart({ puzzleIndex: nextIndex });
      }
    });
    btn.setScaleTo(420, 92);

    const label = this.add.text(width / 2, height - 156, isLastPuzzle ? t("puzzle.menu") : t("puzzle.next"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "28px",
      color: "#0b1020",
      fontStyle: "700",
    }).setOrigin(0.5);

    this.nextButtonLayer.add([btn, label]);
  }

  updateProgress() {
    const total = Math.ceil(this.puzzle.solutionSteps.length / 2);
    const current = Math.min(Math.floor(this.stepIndex / 2) + 1, total);
    this.progressText.setText(t("puzzle.progress", {
      current: this.puzzleIndex + 1,
      total: PUZZLES.length,
      step: current,
      steps: total,
    }));
  }

  flashMessage(text, color = "#ffffff") {
    this._statusTimer?.remove(false);
    this.messageText.setText(text);
    this.messageText.setColor(color);
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.tweens.add({
      targets: this.messageText,
      alpha: 0.72,
      duration: 180,
      yoyo: true,
      repeat: 1,
    });
    this._statusTimer = this.time.delayedCall(1600, () => {
      if (this.solved || !this.messageText?.scene) return;
      this.messageText.setText(this.defaultStatus);
      this.messageText.setColor(KUMA_COLORS.orange);
      this.messageText.setAlpha(1);
    });
  }

  showHint() {
    this.hintText.setText(puzzleText(this.puzzle, "hint"));
    this.flashMessage(t("puzzle.hintNotice"), KUMA_COLORS.orange);
  }

  refreshLanguage() {
    const side = t(`side.${this.puzzle.playerColor}`);
    this.defaultStatus = t("game.turn", { side, check: "" });
    this.titleText?.setText(puzzleText(this.puzzle, "title"));
    this.drawGlossaryButton();
    this.promptText?.setText(puzzleText(this.puzzle, "prompt"));
    this.toggleLabel?.setText(t("game.conceptOff"));
    if (this.hintText?.text) this.hintText.setText(puzzleText(this.puzzle, "hint"));
    if (!this.solved) this.messageText?.setText(this.defaultStatus);
    this.updateProgress();
    if (this.solved) this.showNextButton();
  }

  drawHighlight(square) {
    const { x, y } = this.squareToTopLeft(square);
    const g = this.add.graphics();
    g.fillStyle(0xf4c65d, 0.28);
    g.fillRoundedRect(x + 5, y + 5, this.squareSize - 10, this.squareSize - 10, 8);
    g.lineStyle(4, 0xf0a44a, 0.68);
    g.strokeRoundedRect(x + 7, y + 7, this.squareSize - 14, this.squareSize - 14, 7);
    g.setDepth(8);
    return g;
  }

  clearSelection(snap = true) {
    for (const h of this.highlights) h.destroy();
    this.highlights = [];
    if (this.selected?.view) {
      if (snap) {
        const { x, y } = this.squareToCenter(this.selected.square);
        this.selected.view.x = x;
        this.selected.view.y = y;
      }
      setSelectedOutline(this.selected.view, false);
      this.selected.view.setDepth(this.selected.view._baseDepth ?? 20);
    }
    this.selected = null;
    this._dragCandidate = false;
    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };
  }

  isViewFlipped() {
    return this.puzzle.playerColor === "b";
  }

  pointerToSquare(pointer) {
    const x = pointer.x - this.boardX;
    const y = pointer.y - this.boardY;
    if (x < 0 || y < 0) return null;
    const c = Math.floor(x / this.squareSize);
    const r = Math.floor(y / this.squareSize);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    if (this.isViewFlipped()) return this.rcToSquare(7 - r, 7 - c);
    return this.rcToSquare(r, c);
  }

  rcToSquare(r, c) {
    const file = FILES[c];
    const rank = 8 - r;
    return `${file}${rank}`;
  }

  squareToRC(square) {
    let c = FILES.indexOf(square[0]);
    let r = 8 - parseInt(square[1], 10);
    if (this.isViewFlipped()) {
      r = 7 - r;
      c = 7 - c;
    }
    return { r, c };
  }

  squareToTopLeft(square) {
    const { r, c } = this.squareToRC(square);
    return {
      x: this.boardX + c * this.squareSize,
      y: this.boardY + r * this.squareSize,
    };
  }

  squareToCenter(square) {
    const tl = this.squareToTopLeft(square);
    return { x: tl.x + this.squareSize / 2, y: tl.y + this.squareSize / 2 };
  }
}
