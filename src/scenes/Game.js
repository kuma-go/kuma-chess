import { Chess } from "../vendor-chess.js?v=20260716-mobile26";
import { alignBoardPieceView, createPieceView, setSelectedOutline } from "../pieceStyles.js?v=20260716-mobile26";
import { t } from "../i18n.js?v=20260716-mobile26";
import { playFeedback } from "../feedback.js?v=20260716-mobile26";
import { SpriteButton } from "../ui/SpriteButton.js?v=20260716-mobile26";
import { showConfirm } from "../ui/ConfirmPopup.js?v=20260716-mobile26";
import { AI_DIFFICULTIES, getAIDifficulty, grantCoinsOnce, recordGameResult } from "../playerState.js?v=20260716-mobile26";
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
} from "../ui/KumaUi.js?v=20260716-mobile26";

const FILES = "abcdefgh";
const AI_DIFFICULTY_IDS = new Set(Object.keys(AI_DIFFICULTIES));
const HARD_AI_LIMITS = Object.freeze({ rootMoves: 12, replyMoves: 12, nodes: 180, thinkMs: 48 });

export class Game extends Phaser.Scene {
  constructor() {
    super("Game");

    this.game = null;

    this.squareSize = 0;
    this.boardX = 0;
    this.boardY = 0;

    this.themeId = "kuma";
    this.uiThemeId = "kuma";

    this.pieceViews = new Map();
    this.highlights = [];
    this.selected = null;

    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };
    this._dragCandidate = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragThreshold = 8;

    this.skins = { w: "classic", b: "classic" };

    this.statusText = null;
    this._promoLayer = null;

    this._lastTurn = "w";
    this._perspectiveTurn = "w";

    // ✅ 캡처 기록 (w가 잡은 말들 / b가 잡은 말들)
    this.capturedBy = { w: [], b: [] };
    this._capLayer = null;

    this._bgImage = null;
    this._boardTiles = [];
    this._boardFrame = null;

    // ✅ 라인 텍스트 FX (CHECK / CHECKMATE)
    this._lineFxLayer = null;
    this._lastCheckKey = null;

    // ✅ 종료 연출 중 중복 호출 방지
    this._ending = false;

    // ✅ AI 모드
    this.mode = "pvp"; // 'pvp' | 'ai'
    this.playerColor = "w"; // AI 모드에서만 사용
    this.conceptEnabled = true;
    this._aiBusy = false;
    this._aiTimer = null;
    this._aiToken = 0;
    this._gameOverTimers = [];
    this._modalOpen = false;
    this.gameSessionId = "";
    this.aiDifficulty = "normal";
    this._resultRecorded = false;


  }


  // ✅ 여기(클래스 레벨)에 있어야 Phaser가 매번 호출함
  init() {
    // 새 게임 시작 시 상태 리셋
    this.capturedBy = { w: [], b: [] };
    this._ending = false;
    this._aiBusy = false;
    this.cancelPendingAI();
    this.cancelGameOverTimers();
    this._promoLayer = null;
    this._capLayer = null;
    this._turnFlipBusy = false;
    this._perspectiveTurn = "w";
    this._modalOpen = false;
    this._resultRecorded = false;

    this._lineFxLayer = null;
    this._lastCheckKey = null;

    this.selected = null;
    this.highlights = [];
    this.dragging = false;
    this._dragCandidate = false;

    // 혹시 남아있을 수 있는 뷰 정리
    this.pieceViews?.forEach(v => v.destroy && v.destroy());
    this.pieceViews = new Map();
  }


  create() {
    // --- mode ---
    this.mode = this.registry.get("gameMode") || "pvp";
    this.playerColor = this.registry.get("playerColor") || "w";
    const requestedDifficulty = this.registry.get("aiDifficulty") || "normal";
    this.aiDifficulty = AI_DIFFICULTY_IDS.has(requestedDifficulty) ? requestedDifficulty : "normal";
    if (this.isAIMode()) this.registry.set("aiDifficulty", this.aiDifficulty);
    this.gameSessionId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    this.game = new Chess(); // White 선공
    this._perspectiveTurn = this.game.turn();

    this.capturedBy = { w: [], b: [] }; // ✅ 전 게임 캡처 기록 리셋


    const savedSkin = this.registry.get("pieceSkin");
    if (savedSkin?.w) this.skins.w = savedSkin.w;
    if (savedSkin?.b) this.skins.b = savedSkin.b;
    // Every match starts with the illustrated concept pieces enabled.
    this.conceptEnabled = true;
    this.registry.set("conceptEnabled", true);
    if (this._capLayer) { this._capLayer.destroy(); this._capLayer = null; }
    this.capturedBy = { w: [], b: [] };


    this.themeId = "kuma";
    this.registry.set("currentGameThemeId", this.themeId);

    this.layout();
    this.drawBackground();
    this.drawBoardTiles();
    this.createUI();
    this.renderAll();
    this.renderCaptured();

    this._lastTurn = this.game.turn();
    this.applyTurnPerspective(true);

    this.input.on("pointerdown", (p) => this.onPointerDown(p));
    this.input.on("pointermove", (p) => this.onPointerMove(p));
    this.input.on("pointerup", (p) => this.onPointerUp(p));
    this.input.on("pointerupoutside", (p) => this.onPointerUp(p));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelPendingAI();
      this.cancelGameOverTimers();
    });

    this.updateStatus();

    // ✅ AI 모드에서 선턴이 AI(= 플레이어가 BLACK 선택)인 경우 즉시 AI 수 실행
    this.maybeAIMove(true);
  }

  layout() {
    this.boardLayout = getChessBoardLayout(this, { outerTop: 284, outerWidth: 712 });
    this.squareSize = this.boardLayout.squareSize;
    this.boardX = this.boardLayout.boardX;
    this.boardY = this.boardLayout.boardY;
  }

  drawBackground() {
    const { width, height } = this.scale;
    if (this._bgImage) this._bgImage.destroy();

    this._bgImage = this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0);
    this._bgImage.setDepth(-100);
  }

  drawBoardTiles() {
    for (const t of this._boardTiles) t.destroy();
    this._boardTiles = [];
    this._boardFrame?.destroy();
    this._boardFrame = null;

    this._boardFrame = addChessBoard(this, this.boardLayout, 0);
  }

  createUI() {
    const { width, height } = this.scale;
    addDarkTopBar(this, "Kuma Chess", {
      onHome: () => {
        this.cancelPendingAI();
        this.showGameConfirm({
          themeId: this.uiThemeId,
          title: t("game.homeTitle"),
          message: t("game.homeMessage"),
          confirmText: t("game.move"),
          cancelText: t("common.cancel"),
          onConfirm: () => {
            this.cancelGameOverTimers();
            this.scene.start("Start");
          },
        });
      },
    });

    // Status
    this.statusText = this.add.text(width / 2, 205, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "30px",
      color: "#dd8832",
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);

    // Undo. The home button in the top bar handles leaving the match.
    const backBtn = new SpriteButton(this, 58, height - 66, {
      normal: "kuma_ui_btn_back",
      hover: "kuma_ui_btn_back",
      pressed: "kuma_ui_btn_back",
    }, () => this.undoLastTurn()).setDepth(160);
    backBtn.setScaleTo(72, 72);

    this.drawConceptToggle(width - 67, height - 56);
  }

  drawConceptToggle(cx, cy) {
    this._conceptToggleLayer?.destroy();
    const layer = this.add.container(0, 0).setDepth(160);
    this._conceptToggleLayer = layer;
    const label = this.add.text(cx, cy - 40, t("game.conceptOff"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5);
    const toggle = this.add.image(cx, cy, this.conceptEnabled ? "kuma_ui_btn_radio_off" : "kuma_ui_btn_radio_on")
      .setDisplaySize(80, 54);
    const hit = this.add.rectangle(cx, cy, 94, 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      if (this._turnFlipBusy) return;
      this.conceptEnabled = !this.conceptEnabled;
      this.registry.set("conceptEnabled", this.conceptEnabled);
      this.clearSelection();
      this.renderAll();
      this.renderCaptured();
      this.drawConceptToggle(cx, cy);
    });
    layer.add([label, toggle, hit]);
  }

  refreshLanguage() {
    this.updateStatus();
    this.renderCaptured();
    this.drawConceptToggle(this.scale.width - 67, this.scale.height - 56);
  }

  getRenderSkin(color) {
    return this.conceptEnabled ? this.skins[color] : "icon";
  }

  getPieceFacing(color, perspectiveTurn = null) {
    const viewerColor = this.isAIMode()
      ? (this.isViewFlipped() ? "b" : "w")
      : (perspectiveTurn ?? this._perspectiveTurn ?? this.game?.turn?.() ?? "w");
    return color === viewerColor ? "back" : "front";
  }

  setPieceViewFacing(view, perspectiveTurn = null) {
    if (!view || !view._color || !view._type) return;

    const skin = view._skin ?? this.getRenderSkin(view._color);
    const size = view._pieceSize ?? Math.floor(this.squareSize * 1.02);
    const facing = this.getPieceFacing(view._color, perspectiveTurn);
    const image = view._pieceImage;

    if (skin !== "icon" && image?.setTexture) {
      const textureKey = `kuma_piece_${skin}_${view._color}_${view._type}_${facing}`;
      if (this.textures.exists(textureKey) && image.texture?.key !== textureKey) {
        image.setTexture(textureKey);
      }
    }

    alignBoardPieceView(view, size, skin, facing);
    view._facing = facing;
  }

  undoLastTurn() {
    if (!this.game || this._promoLayer || this._modalOpen || this._turnFlipBusy) return;

    this.cancelPendingAI();
    const history = this.game.history({ verbose: true });
    if (!history.length) {
      this.showLineText(t("game.undoUnavailable"), { duration: 520, stay: 420, y: this.scale.height * 0.52 });
      return;
    }

    let undoCount = 1;
    if (this.isAIMode()) {
      const aiColor = this.getAIColor();
      if (this.game.turn() === this.playerColor) {
        const last = history[history.length - 1];
        const previous = history[history.length - 2];
        if (!last || last.color !== aiColor || !previous || previous.color !== this.playerColor) {
          this.showLineText(t("game.undoUnavailable"), { duration: 520, stay: 420, y: this.scale.height * 0.52 });
          return;
        }
        undoCount = 2;
      }
    }

    this.cancelGameOverTimers();
    for (let i = 0; i < undoCount; i++) this.game.undo();

    this._ending = false;
    this._lastCheckKey = null;
    this.statusText?.setAlpha(1);
    this.clearSelection();
    this.rebuildCapturedFromHistory();
    this._perspectiveTurn = this.game.turn();
    this.renderAll(this.isAIMode() ? null : this.game.turn());
    this.renderCaptured();
    this.applyTurnPerspective(true, this.game.turn());
    this.updateStatus();
  }

  // In PVP, perspectiveTurn controls piece orientation only. Board squares stay fixed.
  renderAll(perspectiveTurn = null) {
    if (!this.isAIMode() && perspectiveTurn) this._perspectiveTurn = perspectiveTurn;
    for (const v of this.pieceViews.values()) v.destroy();
    this.pieceViews.clear();

    const board = this.game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const square = this.rcToSquare(r, c);
        const { x, y } = this.squareToCenter(square);
        const displayRow = this.squareToRC(square).r;

        const skin = this.getRenderSkin(piece.color);
        const size = Math.floor(this.squareSize * 1.02);
        const facing = this.getPieceFacing(piece.color, perspectiveTurn);
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

        view._baseDepth = 20 + displayRow;
        view.setDepth(view._baseDepth);
        view._square = square;
        view._color = piece.color;
        view._type = piece.type;
        view._skin = skin;
        view._pieceSize = size;

        this.setPieceViewOrientation(view, perspectiveTurn);

        view.setInteractive(
          new Phaser.Geom.Rectangle(-this.squareSize / 2, -this.squareSize / 2, this.squareSize, this.squareSize),
          Phaser.Geom.Rectangle.Contains
        );

        this.pieceViews.set(square, view);
      }
    }
  }

  // ---------- 말 시점/방향 ----------
  // AI stays fixed. PVP rotates each piece in its own square.
  setPieceViewTurnTransform(view, turn) {
    if (!view) return;
    view.setAngle(!this.isAIMode() && turn === "b" ? 180 : 0);

    if (!this.isAIMode() && view._square) {
      const row = this.squareToRC(view._square).r;
      view._baseDepth = 20 + (turn === "b" ? 7 - row : row);
      view.setDepth(view._baseDepth);
    }
  }

  setPieceViewOrientation(view, perspectiveTurn = null) {
    if (!view) return;
    const mag = Math.max(0.01, Math.abs(view.scaleX || 1));
    view.scaleX = mag;
    view.scaleY = mag;
    const turn = perspectiveTurn ?? this._perspectiveTurn ?? this.game?.turn?.() ?? "w";
    this.setPieceViewFacing(view, turn);
    this.setPieceViewTurnTransform(view, turn);
  }

  // ✅ 캡처 표시: 블랙(위), 화이트(아래)
  renderCaptured() {
    if (this._capLayer) this._capLayer.destroy();
    this._capLayer = this.add.container(0, 0).setDepth(90);

    const { width, height } = this.scale;

    const boardTop = this.boardY;
    const boardBottom = this.boardY + this.squareSize * 8;

    const topBarY = Math.max(250, boardTop - 58);
    const bottomBarY = Math.min(height - 170, boardBottom + 58);

    const labelStyle = { fontFamily: KUMA_FONT_SANS, fontSize: "18px", color: KUMA_COLORS.ink, fontStyle: "500" };

    const labelBlack = this.add.text(this.boardX - 18, topBarY, t("game.captured"), labelStyle).setOrigin(0, 0.5);
    const labelWhite = this.add.text(this.boardX - 18, bottomBarY, t("game.captured"), labelStyle).setOrigin(0, 0.5);
    this._capLayer.add([labelBlack, labelWhite]);

    const startX = Math.max(this.boardX + 122, labelBlack.x + labelBlack.width + 18);
    const maxX = this.boardX + this.squareSize * 8 - 8;

    const drawRow = (arr, baseY) => {
      const gap = arr.length > 1
        ? Math.min(44, (maxX - startX) / (arr.length - 1))
        : 0;
      const artWidth = arr.length > 10 ? 38 : arr.length > 7 ? 44 : 50;
      arr.forEach((p, i) => {
        const x = startX + i * gap;
        const skin = this.getRenderSkin(p.color);
        const facing = this.getPieceFacing(p.color, this._perspectiveTurn);
        const v = createPieceView(this, x, baseY, 58, skin, p.color, p.type, facing);
        v._color = p.color;
        v._type = p.type;
        v._skin = skin;
        v._pieceSize = 58;
        const image = v._pieceImage;
        if (image && typeof image.setDisplaySize === "function") {
          image.setPosition(0, 0);
          image.setDisplaySize(artWidth, skin === "icon" ? artWidth : artWidth * 1.5);
        }
        v.setDepth(91);
        v.setAngle(!this.isAIMode() && this._perspectiveTurn === "b" ? 180 : 0);
        this._capLayer.add(v);
      });
    };

    drawRow(this.capturedBy.b, topBarY);
    drawRow(this.capturedBy.w, bottomBarY);
  }

  showGameConfirm(opts) {
    this._modalOpen = true;
    const resumeAIIfNeeded = () => {
      this._modalOpen = false;
      this.maybeAIMove(true);
    };

    return showConfirm(this, {
      ...opts,
      onConfirm: () => {
        this._modalOpen = false;
        opts.onConfirm && opts.onConfirm();
      },
      onCancel: () => {
        resumeAIIfNeeded();
        opts.onCancel && opts.onCancel();
      },
    });
  }

  // ---------- 입력 ----------
  onPointerDown(pointer) {
    // ✅ 팝업 떠 있으면 인게임 입력 무시(실수 방지)
    if (this._promoLayer) return;
    if (this._modalOpen) return;
    if (this._ending) return;

    // ✅ 턴 뒤집힘 연출 중에는 입력 잠금
    if (this._turnFlipBusy) return;

    // ✅ AI가 두는 중이거나, AI 턴이면 입력 무시
    if (this.isAIMode()) {
      if (this._aiBusy) return;
      if (this.game.turn() !== this.playerColor) return;
    }

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

    // 클릭 배치
    if (this.selected) this.tryMove(this.selected.square, square);
  }

  onPointerMove(pointer) {
    if (this._turnFlipBusy) return;
    if (this._modalOpen) return;
    if (this._ending) return;
    if (!this.selected?.view) return;
    if (this._promoLayer) return;
    if (this.isAIMode() && (this._aiBusy || this.game.turn() !== this.playerColor)) return;

    if (this._dragCandidate && !this.dragging) {
      const dx = pointer.x - this._dragStart.x;
      const dy = pointer.y - this._dragStart.y;
      if (Math.hypot(dx, dy) >= this._dragThreshold) {
        this.dragging = true;
        const v = this.selected.view;
        this.dragOffset = { dx: v.x - pointer.x, dy: v.y - pointer.y };
      }
    }

    if (this.dragging) {
      const v = this.selected.view;
      v.x = pointer.x + this.dragOffset.dx;
      v.y = pointer.y + this.dragOffset.dy;
    }
  }

  onPointerUp(pointer) {
    if (this._turnFlipBusy) return;
    if (this._promoLayer) return;
    if (this._modalOpen) return;
    if (this._ending) return;
    if (this.isAIMode() && (this._aiBusy || this.game.turn() !== this.playerColor)) return;

    const wasDragging = this.dragging;

    this._dragCandidate = false;
    this.dragging = false;
    this.dragOffset = { dx: 0, dy: 0 };

    if (!wasDragging) return;

    const from = this.selected?.square;
    const to = this.pointerToSquare(pointer);

    // ✅ 드래그는 무조건 일단 원위치로 스냅 (여행가서 안 돌아오는 문제 방지)
    this.snapSelectedBack();

    if (!from || !to || from === to) {
      this.clearSelection();
      return;
    }

    this.tryMove(from, to);
  }

  selectPiece(square, view) {
    this.clearHighlights();
    if (this.selected?.view) {
      setSelectedOutline(this.selected.view, false);
      this.selected.view.setDepth(this.selected.view._baseDepth ?? 20);
    }

    this.selected = { square, view };
    // ✅ 남아있는 이펙트 tween이 선택 outline과 충돌하면 스케일이 꼬일 수 있음
    this.tweens.killTweensOf(view);
    setSelectedOutline(view, true);
    view.setDepth(110);

    const moves = this.game.moves({ square, verbose: true });
    for (const m of moves) this.highlights.push(this.drawHighlight(m.to));
  }

  bounceBack(keepSelected = true) {
    const sel = this.selected;
    if (!sel?.view || !sel?.square) return;

    const { x, y } = this.squareToCenter(sel.square);
    this.tweens.killTweensOf(sel.view);
    this.tweens.add({
      targets: sel.view,
      x,
      y,
      duration: 120,
      ease: "Quad.Out",
      onComplete: () => {
        if (!keepSelected) this.clearSelection();
      },
    });
  }

  // ✅ (핵심) from->to가 합법인지/승급인지 먼저 판단
  getMoveMeta(from, to) {
    const candidates = this.game.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!candidates.length) return { legal: false, promotion: false };
    const promotion = candidates.some(m => (m.flags && m.flags.includes("p")) || !!m.promotion);
    return { legal: true, promotion };
  }

  tryMove(from, to) {
    const prevTurn = this.game.turn();
    const piece = this.game.get(from);
    if (!piece) {
      playFeedback("error");
      this.bounceBack(true);
      return;
    }

    // ✅ 먼저 "법적으로 가능한 수"인지 확인 (불가능하면 승급 UI도 뜨면 안 됨)
    const legal = this.game.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!legal) {
      playFeedback("error");
      this.bounceBack(true);
      return;
    }

    const isPromotion =
      piece.type === "p" &&
      (to.endsWith("8") || to.endsWith("1")) &&
      // chess.js verbose move에서 promotion은 flags에 'p'가 포함됨
      (typeof legal.flags === "string" ? legal.flags.includes("p") : true);

    if (isPromotion) {
      this.snapSelectedBack();

      this.showPromotionPicker(piece.color, (chosen) => {
        if (!chosen) {
          // 취소면 선택만 해제하고 끝
          this.clearSelection();
          return;
        }

        const move = this.game.move({ from, to, promotion: chosen });
        if (!move) {
          // 이 경우는 거의 없어야 하지만(legal 기반), 안전장치
          playFeedback("error");
          this.bounceBack(true);
          return;
        }

        if (move.captured) this.recordCapture(move);

        this.clearSelection();
        // ✅ 배치 직후 즉시 뒤집히지 않도록 "이전 시점"으로 먼저 렌더링
        this.renderAll(this.isAIMode() ? null : prevTurn);
        this.renderCaptured();
        this.playImpactEffect(to, !!move.captured, () => {
          const afterFlip = () => {
            this.updateStatus();
            if (this.game.isGameOver()) {
              this.handleGameOverFx();
            } else {
              this.maybeAIMove(false);
            }
          };

          if (!this.isAIMode()) {
            this.animateTurnFlip(this.game.turn(), afterFlip);
          } else {
            afterFlip();
          }
        });
      });
      return;
    }

    const move = this.game.move({ from, to });
    if (!move) {
      playFeedback("error");
      this.bounceBack(true);
      return;
    }

    if (move.captured) this.recordCapture(move);

    this.clearSelection();
    // ✅ 배치 직후 즉시 뒤집히지 않도록 "이전 시점"으로 먼저 렌더링
    this.renderAll(this.isAIMode() ? null : prevTurn);
    this.renderCaptured();
    this.playImpactEffect(move.to, !!move.captured, () => {
      const afterFlip = () => {
        this.updateStatus();
        if (this.game.isGameOver()) {
          this.handleGameOverFx();
        } else {
          this.maybeAIMove(false);
        }
      };

      if (!this.isAIMode()) {
        this.animateTurnFlip(this.game.turn(), afterFlip);
      } else {
        afterFlip();
      }
    });
  }

  recordCapture(move) {
    const capturer = move.color;
    const capturedColor = capturer === "w" ? "b" : "w";
    this.capturedBy[capturer].push({ color: capturedColor, type: move.captured });
  }

  rebuildCapturedFromHistory() {
    this.capturedBy = { w: [], b: [] };
    const history = this.game.history({ verbose: true });
    for (const move of history) {
      if (move.captured) this.recordCapture(move);
    }
  }

  getResultPayload() {
    let winnerColor = null;

    if (this.game.isCheckmate()) {
      const loser = this.game.turn();
      winnerColor = loser === "w" ? "b" : "w";
      return {
        result: `${winnerColor}_win`,
        reason: "checkmate",
        winnerColor,
        skins: { ...this.skins },
        mode: this.mode,
        playerColor: this.playerColor,
        difficulty: this.isAIMode() ? this.aiDifficulty : null,
        gameSessionId: this.gameSessionId,
      };
    }

    if (this.game.isDraw()) {
      return {
        result: "draw",
        reason: "draw",
        winnerColor: null,
        skins: { ...this.skins },
        mode: this.mode,
        playerColor: this.playerColor,
        difficulty: this.isAIMode() ? this.aiDifficulty : null,
        gameSessionId: this.gameSessionId,
      };
    }

    return {
      result: "draw",
      reason: "gameover",
      winnerColor: null,
      skins: { ...this.skins },
      mode: this.mode,
      playerColor: this.playerColor,
      difficulty: this.isAIMode() ? this.aiDifficulty : null,
      gameSessionId: this.gameSessionId,
    };
  }

  recordResultOnce(payload) {
    if (this._resultRecorded || !payload) return;
    this._resultRecorded = true;

    if (this.isAIMode()) {
      recordGameResult({
        mode: "ai",
        result: payload.result,
        difficulty: this.aiDifficulty,
        playerColor: this.playerColor,
      });
      return;
    }

    recordGameResult({
      mode: "pvp",
      result: payload.result,
      winnerColor: payload.winnerColor,
    });
  }

  awardResultOnce(payload) {
    if (this._rewardResolved || !payload) return;
    this._rewardResolved = true;
    const playerWonAI = this.isAIMode()
      && payload.winnerColor
      && payload.winnerColor === this.playerColor;
    payload.reward = playerWonAI
      ? grantCoinsOnce(`ai-win:${this.gameSessionId}`, getAIDifficulty(this.aiDifficulty).reward)
      : { awarded: false, amount: 0 };
  }

  finishToResult(payload) {
    this.recordResultOnce(payload);
    this.scene.start("Result", payload);
  }


  // ✅ 체크메이트/무승부 연출 후 결과 화면으로 이동
  handleGameOverFx() {
    if (this._ending) return;
    this._ending = true;

    const payload = this.getResultPayload();
    this.recordResultOnce(payload);
    this.awardResultOnce(payload);
    if (payload.reason === "checkmate") {
      playFeedback("win");
      const loser = this.game.turn();
      const winner = loser === "w" ? "b" : "w";
      const winnerLabel = winner === "w" ? "WHITE" : "BLACK";

      this.showLineText("CHECKMATE!", {
        sub: `${winnerLabel} WINS`,
        duration: 1100,
        stay: 800,
        y: this.scale.height * 0.4,
      });

      // 라인 연출을 충분히 본 다음 결과 화면으로 넘어가도록 딜레이를 늘린다.
      const timer = this.time.delayedCall(3200, () => {
        this.finishToResult(payload);
      });
      this._gameOverTimers.push(timer);
      return;
    }

    // Draw / 기타 종료
    playFeedback("draw");
    this.showLineText("DRAW", { duration: 900, stay: 700, y: this.scale.height * 0.4 });
    const timer = this.time.delayedCall(1800, () => {
      this.finishToResult(payload);
    });
    this._gameOverTimers.push(timer);
  }

  updateStatus() {
  const turnColor = this.game.turn(); // "w" | "b"
  const turnLabel = t(`side.${turnColor}`);
  const isCheck = this.game.isCheck();
  const extra = isCheck ? t("game.check") : "";
  this.statusText.setText(t("game.turn", { side: turnLabel, check: extra }));

  if (turnColor === "w") {
    this.statusText.setPosition(this.scale.width / 2, 1110).setAngle(0);
  } else {
    this.statusText
      .setPosition(this.scale.width / 2, 174)
      .setAngle(this.isAIMode() ? 0 : 180);
  }

  // ✅ CHECK 라인 텍스트 (상태 진입 시 1회만)
  if (isCheck && !this.game.isCheckmate()) {
    const key = `${turnColor}_check_${this.game.fen()}`;
    if (this._lastCheckKey !== key) {
      this._lastCheckKey = key;
      playFeedback("check");
      this.showLineText(`CHECK! (${turnLabel})`, { duration: 900, stay: 650, y: this.scale.height * 0.36 });
    }
  } else {
    this._lastCheckKey = null;
  }
}

  // ---------- 하이라이트 ----------
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

  clearHighlights() {
    for (const h of this.highlights) h.destroy();
    this.highlights = [];
  }

  snapSelectedBack() {
    const { square, view } = this.selected || {};
    if (!square || !view) return;
    const { x, y } = this.squareToCenter(square);
    view.x = x;
    view.y = y;
  }

  clearSelection() {
    this.snapSelectedBack();
    this.clearHighlights();
    if (this.selected?.view) {
      setSelectedOutline(this.selected.view, false);
      this.selected.view.setDepth(this.selected.view._baseDepth ?? 20);
    }
    this.selected = null;
    this.dragging = false;
    this._dragCandidate = false;
  }

  // ---------- 좌표 ----------
  pointerToSquare(pointer) {
    const x = pointer.x - this.boardX;
    const y = pointer.y - this.boardY;
    if (x < 0 || y < 0) return null;

    const c = Math.floor(x / this.squareSize);
    const r = Math.floor(y / this.squareSize);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;

    if (this.isViewFlipped()) {
      // When the board is flipped, screen (r,c) corresponds to the opposite square.
      // Convert view coords back to board coords before converting to algebraic square.
      return this.rcToSquare(7 - r, 7 - c);
    }

    return this.rcToSquare(r, c);
  }

  rcToSquare(r, c) {
    // Board coordinates never change. Only AI-black uses a fixed flipped view.
    const file = FILES[c];
    const rank = 8 - r;
    return `${file}${rank}`;
  }

  squareToRC(square) {
    const file = square[0];
    const rank = parseInt(square[1], 10);
    let c = FILES.indexOf(file);
    let r = 8 - rank;
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

  // ---------- 턴 방향(즉시 정렬) ----------
  applyTurnPerspective(force = false, perspectiveTurn = null) {
    if (this.isAIMode()) {
      for (const view of this.pieceViews.values()) {
        this.tweens.killTweensOf(view);
        this.setPieceViewOrientation(view, null);
      }
      this._lastTurn = this.game.turn();
      return;
    }

    const turn = perspectiveTurn ?? this.game.turn();
    if (!force && turn === this._lastTurn) return;

    this._perspectiveTurn = turn;
    for (const view of this.pieceViews.values()) {
      this.tweens.killTweensOf(view);
      this.setPieceViewOrientation(view, turn);
    }
    this.renderCaptured();
    this._lastTurn = turn;
  }

  // ---------- 턴 방향(연출: 기물이 원근상 반대편으로 넘어가며 교대) ----------
  animateTurnFlip(targetTurn, onComplete = null) {
    if (this.isAIMode()) { onComplete && onComplete(); return; } // AI 모드는 시점이 고정

    const turn = targetTurn ?? this.game.turn();
    if (turn === this._lastTurn) { onComplete && onComplete(); return; }

    if (this._turnFlipBusy) { onComplete && onComplete(); return; }

    const pieces = Array.from(this.pieceViews.values());
    if (!pieces.length) {
      this._perspectiveTurn = turn;
      this._lastTurn = turn;
      this._turnFlipBusy = false;
      onComplete && onComplete();
      return;
    }

    this._turnFlipBusy = true;

    let finished = false;
    const handoffScale = 0.52;
    const rowDelay = 18;
    const collapseDuration = 180;
    const revealDuration = 250;
    const entries = pieces.map((view) => ({
      view,
      image: view._pieceImage,
      center: view._square ? this.squareToCenter(view._square) : { x: view.x, y: view.y },
      sourceScaleY: view._pieceImage?.scaleY ?? 1,
      sourceOriginX: view._pieceImage?.originX ?? 0.5,
      sourceOriginY: view._pieceImage?.originY ?? 0.5,
      sourceX: view._pieceImage?.x ?? 0,
      sourceY: view._pieceImage?.y ?? 0,
      row: view._square ? this.squareToRC(view._square).r : 3,
      targetScaleY: 1,
      handoffView: null,
    })).filter((entry) => entry.image);

    if (!entries.length) {
      this._perspectiveTurn = turn;
      this.applyTurnPerspective(true, turn);
      this._turnFlipBusy = false;
      onComplete && onComplete();
      return;
    }

    for (const entry of entries) {
      entry.sourceBottomY = entry.sourceY + entry.image.displayHeight * (1 - entry.sourceOriginY);
      entry.sourceTurnSign = Math.cos(entry.view.rotation) >= 0 ? 1 : -1;
      entry.collapseViewY = entry.center.y - entry.sourceTurnSign * entry.sourceBottomY;
    }

    // Prepare the incoming facing before motion starts so the handoff itself
    // only performs tweens and cannot hitch while creating display objects.
    for (const entry of entries) {
      const skin = entry.view._skin ?? this.getRenderSkin(entry.view._color);
      const size = entry.view._pieceSize ?? Math.floor(this.squareSize * 1.02);
      const facing = this.getPieceFacing(entry.view._color, turn);
      const handoffView = createPieceView(
        this,
        entry.center.x,
        entry.center.y,
        size,
        skin,
        entry.view._color,
        entry.view._type,
        facing
      );
      handoffView._square = entry.view._square;
      handoffView._color = entry.view._color;
      handoffView._type = entry.view._type;
      handoffView._skin = skin;
      handoffView._pieceSize = size;
      this.setPieceViewOrientation(handoffView, turn);
      handoffView.setDepth(50 + entry.row);

      entry.handoffView = handoffView;
      const handoffImage = handoffView._pieceImage;
      const handoffBottomY = handoffImage.y + handoffImage.displayHeight * (1 - handoffImage.originY);
      handoffImage.setOrigin(handoffImage.originX, 1);
      handoffImage.setY(handoffBottomY);
      entry.targetTurnSign = Math.cos(handoffView.rotation) >= 0 ? 1 : -1;
      entry.revealViewY = entry.center.y - entry.targetTurnSign * handoffBottomY;
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
      for (const v of this.pieceViews.values()) {
        this.tweens.killTweensOf(v);
        if (v._pieceImage) this.tweens.killTweensOf(v._pieceImage);
        if (v._square) {
          const center = this.squareToCenter(v._square);
          v.setPosition(center.x, center.y);
        }
        v.setAlpha(1);
        v._pieceImage?.setAlpha(1);
        this.setPieceViewOrientation(v, turn);
      }
      for (const entry of entries) {
        if (entry.handoffView?._pieceImage) this.tweens.killTweensOf(entry.handoffView._pieceImage);
        entry.handoffView?.destroy();
        entry.handoffView = null;
      }

      this._perspectiveTurn = turn;
      this.renderCaptured();
      this._lastTurn = turn;
      this._turnFlipBusy = false;
      onComplete && onComplete();
    };

    const timeoutEvt = this.time.delayedCall(900, finalize);
    let collapsed = 0;
    const reveal = () => {
      if (finished) return;
      // Rotate the outgoing artwork first while it is compressed. Its texture
      // stays unchanged and remains fully opaque beneath the incoming facing.
      for (const entry of entries) {
        this.setPieceViewTurnTransform(entry.view, turn);
        entry.view.setY(entry.center.y - entry.targetTurnSign * entry.sourceBottomY);
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
            entry.view.y = Phaser.Math.Linear(entry.outgoingRevealY, entry.center.y, tween.progress);
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
              entry.handoffView.y = Phaser.Math.Linear(entry.revealViewY, entry.center.y, tween.progress);
            }
          },
          onComplete: () => {
            restoreSourceAnchor(entry);
            this.setPieceViewOrientation(entry.view, turn);
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
      entry.view.setPosition(entry.center.x, entry.center.y);
      entry.image.setOrigin(entry.sourceOriginX, 1);
      entry.image.setPosition(entry.sourceX, entry.sourceBottomY);
      this.tweens.add({
        targets: entry.image,
        scaleY: entry.sourceScaleY * handoffScale,
        duration: collapseDuration,
        delay: entry.row * rowDelay,
        ease: "Sine.InOut",
        onUpdate: (tween) => {
          entry.view.y = Phaser.Math.Linear(entry.center.y, entry.collapseViewY, tween.progress);
        },
        onComplete: () => {
          collapsed += 1;
          if (collapsed >= entries.length) reveal();
        },
      });
    }
  }

  // ---------- AI ----------
  cancelPendingAI() {
    if (this._aiTimer) {
      this._aiTimer.remove(false);
      this._aiTimer = null;
    }
    this._aiToken += 1;
    this._aiBusy = false;
  }

  cancelGameOverTimers() {
    for (const timer of this._gameOverTimers || []) timer?.remove(false);
    this._gameOverTimers = [];
  }

  isAIMode() {
    return this.mode === "ai";
  }

  getAIColor() {
    return this.playerColor === "w" ? "b" : "w";
  }

  pieceValue(t) {
    // centipawn-ish values
    switch (t) {
      case "p": return 100;
      case "n": return 320;
      case "b": return 330;
      case "r": return 500;
      case "q": return 900;
      case "k": return 20000;
      default: return 0;
    }
  }

  evaluateMaterial(chess, perspectiveColor) {
    const board = chess.board();
    let sum = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const v = this.pieceValue(p.type);
        sum += (p.color === perspectiveColor) ? v : -v;
      }
    }
    return sum;
  }

  movePayload(move) {
    const payload = { from: move.from, to: move.to };
    if (move.promotion) payload.promotion = move.promotion;
    else if (typeof move.flags === "string" && move.flags.includes("p")) payload.promotion = "q";
    return payload;
  }

  evaluatePosition(chess, perspectiveColor) {
    if (chess.isCheckmate()) {
      return chess.turn() === perspectiveColor ? -1000000 : 1000000;
    }
    if (chess.isDraw()) return 0;

    let score = this.evaluateMaterial(chess, perspectiveColor);
    if (chess.isCheck()) score += chess.turn() === perspectiveColor ? -135 : 135;

    const mobility = chess.moves().length;
    score += (chess.turn() === perspectiveColor ? mobility : -mobility) * 1.5;
    return score;
  }

  moveOrderScore(move) {
    let score = 0;
    if (move.captured) score += this.pieceValue(move.captured) * 10 - this.pieceValue(move.piece);
    if (move.promotion) score += this.pieceValue(move.promotion) * 8;
    if (typeof move.san === "string") {
      if (move.san.includes("#")) score += 1000000;
      else if (move.san.includes("+")) score += 900;
    }
    if (move.flags?.includes("k") || move.flags?.includes("q")) score += 80;
    return score;
  }

  orderedMoves(chess, limit) {
    return chess.moves({ verbose: true })
      .sort((a, b) => this.moveOrderScore(b) - this.moveOrderScore(a))
      .slice(0, limit);
  }

  // 아주 가벼운 1-ply 평가: (캡처/체크 우선) + 수를 둔 뒤의 재료 밸런스 + 상대 최대 캡처 위험 패널티
  scoreAIMove(move, aiColor) {
    const test = new Chess(this.game.fen());

    const payload = { from: move.from, to: move.to };
    // promotion 처리(없으면 q 기본)
    if (move.promotion) payload.promotion = move.promotion;
    else if (typeof move.flags === "string" && move.flags.includes("p")) payload.promotion = "q";

    let made = null;
    try {
      made = test.move(payload);
    } catch (e) {
      return -999999999;
    }
    if (!made) return -999999999;

    let score = 0;

    // 1) 전술: 캡처 / 승급 / 체크 / 체크메이트
    if (made.captured) {
      const capV = this.pieceValue(made.captured);
      score += capV * 4;
      // MVV-LVA 약간(싼 말로 비싼 말 먹기 선호)
      const moverV = this.pieceValue(made.piece);
      score += Math.max(0, capV - moverV);
    }

    if (payload.promotion) {
      // 승급은 강하게(특히 퀸)
      const promoV = this.pieceValue(payload.promotion);
      score += promoV * 2;
    }

    if (test.isCheckmate()) {
      score += 1000000;
      return score;
    }

    if (test.isCheck()) {
      score += 120;
    }

    if (test.isDraw()) {
      // 이기고 있지 않다면 드로우를 피하도록 약한 패널티
      score -= 250;
    }

    // 2) 재료(매우 단순)
    score += this.evaluateMaterial(test, aiColor);

    // 3) 상대가 바로 먹을 수 있는 최대 캡처 위험(아주 얕은 방어)
    //    (상대 입장에서 캡처가 크면 내 수가 위험하다고 가정)
    const oppMoves = test.moves({ verbose: true });
    let oppMaxCap = 0;
    for (const m of oppMoves) {
      if (!m.captured) continue;
      oppMaxCap = Math.max(oppMaxCap, this.pieceValue(m.captured));
    }
    score -= oppMaxCap * 3;

    return score;
  }

  pickBestAIMove(aiColor) {
    const moves = this.game.moves({ verbose: true });
    if (!moves || moves.length === 0) return null;

    let bestScore = -999999999;
    let best = [];

    for (const mv of moves) {
      const sc = this.scoreAIMove(mv, aiColor);
      if (sc > bestScore + 0.0001) {
        bestScore = sc;
        best = [mv];
      } else if (Math.abs(sc - bestScore) <= 0.0001) {
        best.push(mv);
      }
    }

    // 같은 점수 여러 개면 랜덤(패턴 고정 방지)
    return Phaser.Utils.Array.GetRandom(best);
  }

  pickHardAIMove(aiColor) {
    const search = new Chess(this.game.fen());
    const roots = this.orderedMoves(search, HARD_AI_LIMITS.rootMoves);
    if (!roots.length) return null;

    const deadline = performance.now() + HARD_AI_LIMITS.thinkMs;
    let nodes = 0;
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const root of roots) {
      if (performance.now() >= deadline || nodes >= HARD_AI_LIMITS.nodes) break;
      let made = null;
      try { made = search.move(this.movePayload(root)); } catch (e) { made = null; }
      if (!made) continue;
      nodes += 1;

      let score;
      if (search.isGameOver()) {
        score = this.evaluatePosition(search, aiColor);
      } else {
        const replies = this.orderedMoves(search, HARD_AI_LIMITS.replyMoves);
        let worstReply = Infinity;
        let evaluatedReplies = 0;

        for (const reply of replies) {
          // Once a root move is started, evaluate at least one legal reply so Hard
          // never silently degrades to the one-ply Normal policy on slower devices.
          if (evaluatedReplies > 0 && (performance.now() >= deadline || nodes >= HARD_AI_LIMITS.nodes)) break;
          let response = null;
          try { response = search.move(this.movePayload(reply)); } catch (e) { response = null; }
          if (!response) continue;
          nodes += 1;
          evaluatedReplies += 1;
          worstReply = Math.min(worstReply, this.evaluatePosition(search, aiColor));
          search.undo();
        }

        score = evaluatedReplies > 0
          ? worstReply
          : this.evaluatePosition(search, aiColor);
      }

      // Preserve a small tactical preference when minimax scores are otherwise tied.
      score += this.moveOrderScore(root) * 0.015;
      search.undo();

      if (score > bestScore + 0.0001) {
        bestScore = score;
        bestMoves = [root];
      } else if (Math.abs(score - bestScore) <= 0.0001) {
        bestMoves.push(root);
      }
    }

    return bestMoves.length
      ? Phaser.Utils.Array.GetRandom(bestMoves)
      : this.pickBestAIMove(aiColor);
  }

  pickAIMove(aiColor) {
    const difficulty = getAIDifficulty(this.aiDifficulty)?.id || this.aiDifficulty;
    if (difficulty === "easy") {
      const moves = this.game.moves({ verbose: true });
      if (!moves.length) return null;
      return Math.random() < 0.75
        ? Phaser.Utils.Array.GetRandom(moves)
        : this.pickBestAIMove(aiColor);
    }
    if (difficulty === "hard") return this.pickHardAIMove(aiColor);
    return this.pickBestAIMove(aiColor);
  }

isViewFlipped() {
    if (this.isAIMode()) return this.playerColor === "b";
    return false;
  }
maybeAIMove(force = false) {
    if (!this.isAIMode()) return;
    if (this._promoLayer) return;
    if (this._modalOpen) return;
    if (this._ending) return;
    if (this.game.isGameOver()) return;

    const aiColor = this.getAIColor();
    if (this.game.turn() !== aiColor) return;
    if (force) this.cancelPendingAI();
    if (this._aiBusy) return;

    this._aiBusy = true;
    const token = ++this._aiToken;
    const fenAtSchedule = this.game.fen();
    this.clearSelection();
    this.clearHighlights();

    const difficulty = getAIDifficulty(this.aiDifficulty) || AI_DIFFICULTIES?.normal;
    const thinkMs = difficulty?.id === "easy" ? 300 : difficulty?.id === "hard" ? 620 : 380;
    this._aiTimer = this.time.delayedCall(thinkMs, () => {
      try {
        this._aiTimer = null;
        if (token !== this._aiToken) return;
        if (!this.isAIMode() || this._promoLayer || this._modalOpen || this._ending) return;
        if (this.game.isGameOver()) return;
        if (this.game.turn() !== aiColor) return;
        if (this.game.fen() !== fenAtSchedule) return;

        const pick = this.pickAIMove(aiColor);
        if (!pick) {
          this._aiBusy = false;
          return;
        }
        const payload = this.movePayload(pick);

        let moved = null;
        try {
          moved = this.game.move(payload);
        } catch (e) {
          moved = null;
        }
        if (!moved) {
          // 안전장치: 실패하면 1회 더 랜덤 시도
          const moves = this.game.moves({ verbose: true });
          if (!moves.length) return;
          const fallback = Phaser.Utils.Array.GetRandom(moves);
          const p2 = { from: fallback.from, to: fallback.to };
          if (fallback.promotion) p2.promotion = fallback.promotion;
          else if (typeof fallback.flags === "string" && fallback.flags.includes("p")) p2.promotion = "q";
          try {
            moved = this.game.move(p2);
          } catch (e) {
            moved = null;
          }
        }

        if (!moved) return;

        if (moved?.captured) this.recordCapture(moved);

        this.renderAll();
        this.renderCaptured();
        const afterImpact = () => {
          this.updateStatus();
          if (this.game.isGameOver()) this.handleGameOverFx();
        };
        if (moved?.to) this.playImpactEffect(moved.to, !!moved.captured, afterImpact);
        else afterImpact();
      } finally {
        if (token === this._aiToken) this._aiBusy = false;
      }
    });
  }

  // ---------- 타격감 ----------
  playImpactEffect(square, isCapture, onDone = null) {
    playFeedback(isCapture ? "capture" : "move");
    let doneCalled = false;
    const done = () => {
      if (doneCalled) return;
      doneCalled = true;
      try { onDone && onDone(); } catch (e) { /* ignore */ }
    };

    const view = this.pieceViews.get(square);
    const { x, y } = this.squareToCenter(square);

    this.cameras.main.shake(isCapture ? 90 : 55, isCapture ? 0.006 : 0.003);

    const stamp = this.add.graphics().setDepth(999);
    stamp.x = x;
    stamp.y = y - this.squareSize * 0.9;
    stamp.setScale(0.9, 0.9);

    const r = this.squareSize * 0.22;
    stamp.fillStyle(0x000000, isCapture ? 0.22 : 0.16);
    stamp.fillCircle(0, 0, r);
    stamp.lineStyle(3, 0x000000, isCapture ? 0.28 : 0.18);
    stamp.strokeCircle(0, 0, r * 1.25);

    // Dust burst (manual sprites; avoids Phaser ParticleEmitter API differences)
    const spawnDustBurst = () => {
      const texKey = "fx_dust_dot";
      if (!this.textures.exists(texKey)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, 8, 8);
        g.generateTexture(texKey, 16, 16);
        g.destroy();
      }

      const count = isCapture ? 14 : 10;
      const baseY = y + this.squareSize * 0.18;
      const speedMin = isCapture ? 90 : 70;
      const speedMax = isCapture ? 210 : 160;

      for (let i = 0; i < count; i++) {
        const a = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
        const sp = Phaser.Math.FloatBetween(speedMin, speedMax);
        const dx = Math.cos(a) * sp;
        const dy = Math.sin(a) * sp * 0.65 - Phaser.Math.FloatBetween(10, 40);

        const p = this.add.image(x, baseY, texKey).setDepth(998);
        p.setAlpha(Phaser.Math.FloatBetween(0.25, 0.55));
        p.setScale(Phaser.Math.FloatBetween(0.25, 0.6));
        p.setAngle(Phaser.Math.Between(0, 360));

        this.tweens.add({
          targets: p,
          x: x + dx,
          y: baseY + dy,
          alpha: 0,
          scale: p.scale * Phaser.Math.FloatBetween(1.6, 2.4),
          duration: Phaser.Math.Between(220, 360),
          ease: "Quad.Out",
          onComplete: () => p.destroy(),
        });
      }
    };


    this.tweens.add({
      targets: stamp,
      y: y,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 110,
      ease: "Quad.In",
      onComplete: () => {
        spawnDustBurst();
        this.tweens.add({
          targets: stamp,
          alpha: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 160,
          ease: "Quad.Out",
          onComplete: () => stamp.destroy(),
        });
      },
    });

    if (view) {
      // ✅ 스쿼시 이펙트가 다른 tween(턴 정렬/선택 등)과 충돌하면 scale이 남아
      //    말 이미지가 찌그러진 채로 고정되는 경우가 있어 반드시 원복한다.
      const signY = Math.sign(view.scaleY || 1) || 1;
      const baseMag = Math.max(0.01, Math.abs(view.scaleX || 1));

      // 진행 중인 scale tween이 있으면 정리
      this.tweens.killTweensOf(view);

      this.tweens.add({
        targets: view,
        delay: 120,
        scaleX: baseMag * 1.08,
        scaleY: signY * (baseMag * 0.92),
        duration: 90,
        ease: "Quad.Out",
        yoyo: true,
        hold: 20,
        onComplete: () => {
          // ✅ 최종 원복(찌그러짐 방지)
          view.scaleX = baseMag;
          view.scaleY = signY * baseMag;
          done();
        },
      });
    } else {
      // 말 뷰가 없으면(이상 케이스) 일정 시간 후 콜백
      this.time.delayedCall(260, done);
    }

    // 안전: 어떤 이유로든 tween 완료가 안 오면 520ms 뒤에 마감
    this.time.delayedCall(520, done);
  }

  // ---------- 라인 텍스트 FX ----------
showLineText(message, opts = {}) {
  const { width, height } = this.scale;
	  const duration = opts.duration ?? 800;
	  // 기본 stay가 너무 짧으면 연출을 거의 못 봄(특히 체크/체크메이트)
	  const stay = opts.stay ?? 1200;
  const y = opts.y ?? (height * 0.42);

  // 기존 FX 제거
  if (this._lineFxLayer) {
    this._lineFxLayer.destroy();
    this._lineFxLayer = null;
  }

  const layer = this.add.container(0, 0).setDepth(5000);
  this._lineFxLayer = layer;

  // 라인(배경) - 화면 중앙 가로 띠
  const bandH = 74;
  const band = this.add.rectangle(width / 2, y, width, bandH, 0x000000, 0.35);
  band.setOrigin(0.5);
  layer.add(band);

  const txt = this.add.text(width / 2, y, message, {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: "34px",
    color: "#ffffff",
    fontStyle: "900",
    stroke: "#000000",
    strokeThickness: 8,
  }).setOrigin(0.5);
  layer.add(txt);

  layer.alpha = 0;
  layer.y = -10;

  this.tweens.add({
    targets: layer,
    alpha: 1,
    y: 0,
    duration: 140,
    ease: "Quad.Out",
    onComplete: () => {
      this.time.delayedCall(stay, () => {
        this.tweens.add({
          targets: layer,
          alpha: 0,
          duration: duration,
          ease: "Quad.In",
          onComplete: () => {
            if (this._lineFxLayer === layer) this._lineFxLayer = null;
            layer.destroy();
          },
        });
      });
    },
  });
}
  // ---------- 승격 UI (9-slice 공용 + 말 미리보기) ----------
  showPromotionPicker(color, onPick) {
    if (this._promoLayer) return;

    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    this._promoLayer = layer;

    const panelW = 513;
    const panelH = 647;
    const px = width / 2;
    const py = height / 2;

    const panel = addPanel(this, px, py, panelW, panelH, 10001);
    layer.add(panel);

    const title = this.add.text(px, py - 195, t("promotion.title"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "26px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(10002);
    layer.add(title);

    layer.add(this.add.rectangle(px, py - 153, panelW * 0.74, 2, 0xc69d72).setDepth(10002));

    const subtitle = this.add.text(px, py - 110, t("promotion.subtitle"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "23px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(10002);
    layer.add(subtitle);

    const choices = [
      { key: "q", label: "Queen" },
      { key: "r", label: "Rook" },
      { key: "b", label: "Bishop" },
      { key: "n", label: "Knight" },
    ];

    const skinId = this.getRenderSkin(color);
    let selectedChoice = "q";
    let choiceLayer = null;
    const drawChoices = () => {
      choiceLayer?.destroy();
      choiceLayer = this.add.container(0, 0).setDepth(10002);
      const y = py + 49;
      choices.forEach((choice, i) => {
        const x = px - 160 + i * 106.7;
        const selected = choice.key === selectedChoice;
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
        const preview = createPieceView(this, x, y + 2, 100, skinId, color, choice.key);
        const keyLabel = this.add.text(x, y + 84, choice.key.toUpperCase(), {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "24px",
          color: selected ? KUMA_COLORS.teal : KUMA_COLORS.ink,
          fontStyle: "900",
        }).setOrigin(0.5);
        choiceLayer.add([card, topLabel, preview, keyLabel]);
      });
      layer.add(choiceLayer);
    };
    drawChoices();

    const close = (choice) => {
      backdrop.cleanup();
      layer.destroy();
      this._promoLayer = null;
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
}
