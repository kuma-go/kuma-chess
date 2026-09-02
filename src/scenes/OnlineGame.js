import { Chess } from "../vendor-chess.js?v=20260902-online92";
import { alignBoardPieceView, createPieceView, setSelectedOutline } from "../pieceStyles.js?v=20260902-online92";
import { readProfileState } from "../profileState.js?v=20260902-online92";
import { onlineMovePayload, onlineRoomResult } from "../onlineRoom.js?v=20260902-online92";
import { clearOnlineSession, saveOnlineSession } from "../onlineSession.js?v=20260902-online92";
import { playFeedback } from "../feedback.js?v=20260902-online92";
import { showConfirm } from "../ui/ConfirmPopup.js?v=20260902-online92";
import {
  addChessBoard,
  addDarkTopBar,
  addLargeTextButton,
  addPanel,
  createModalBackdrop,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260902-online92";

const FILES = "abcdefgh";
const COPY = Object.freeze({
  ko: Object.freeze({
    title: "온라인 대전", room: "초대 코드 {code}", you: "나", turn: "내 차례", wait: "상대 차례",
    syncing: "수를 전송하고 있습니다.", reconnecting: "연결을 복구하고 있습니다.",
    moveFailed: "수를 전송하지 못했습니다. 다시 시도해주세요.",
    resignTitle: "대국 나가기", resignMessage: "진행 중인 온라인 대국에서 기권할까요?",
    resign: "기권", cancel: "계속하기", promotion: "승급할 기물을 선택하세요", promotionCancel: "취소",
  }),
  en: Object.freeze({
    title: "Online Match", room: "Invite code {code}", you: "You", turn: "Your turn", wait: "Opponent's turn",
    syncing: "Sending move...", reconnecting: "Restoring connection...",
    moveFailed: "Could not send the move. Try again.",
    resignTitle: "Leave Match", resignMessage: "Resign this online match?",
    resign: "Resign", cancel: "Keep Playing", promotion: "Choose a promotion piece", promotionCancel: "Cancel",
  }),
  ja: Object.freeze({
    title: "オンライン対局", room: "招待コード {code}", you: "自分", turn: "あなたの番", wait: "相手の番",
    syncing: "指し手を送信中です。", reconnecting: "接続を復旧しています。",
    moveFailed: "指し手を送信できませんでした。もう一度お試しください。",
    resignTitle: "対局を終了", resignMessage: "進行中のオンライン対局で投了しますか？",
    resign: "投了", cancel: "続ける", promotion: "昇格する駒を選択", promotionCancel: "キャンセル",
  }),
});

function cloudApi() {
  try {
    return window.parent?.KumaCloud || window.KumaCloud || null;
  } catch (_error) {
    return window.KumaCloud || null;
  }
}

function interpolate(value, values) {
  return Object.entries(values).reduce((result, [key, replacement]) => (
    result.replaceAll(`{${key}}`, String(replacement))
  ), value);
}

function chessFromRoom(room) {
  const replay = new Chess();
  let validReplay = true;
  for (const encoded of room?.moves || []) {
    const move = replay.move({
      from: encoded.slice(0, 2),
      to: encoded.slice(2, 4),
      promotion: encoded.slice(4, 5) || undefined,
    });
    if (!move) {
      validReplay = false;
      break;
    }
  }
  if (validReplay && replay.fen() === room?.fen) return replay;
  try {
    return new Chess(room?.fen);
  } catch (_error) {
    return replay;
  }
}

export class OnlineGame extends Phaser.Scene {
  constructor() {
    super("OnlineGame");
    this.game = null;
    this.room = null;
    this.roomCode = "";
    this.playerColor = "w";
    this.playerUid = "";
    this.pieceViews = new Map();
    this.highlights = [];
    this.selected = null;
    this.syncing = false;
    this.finished = false;
    this.unsubscribeRoom = null;
    this.promotionLayer = null;
    this.dragging = false;
    this.dragStart = null;
    this.modalOpen = false;
    this.demoMode = false;
  }

  init(data = {}) {
    this.room = data.room || null;
    this.roomCode = data.code || data.room?.code || "";
    this.playerColor = data.playerColor === "b" ? "b" : "w";
    this.playerUid = cloudApi()?.getState?.()?.uid || "";
    this.demoMode = data.demo === true;
    this.game = chessFromRoom(this.room);
    this.pieceViews = new Map();
    this.highlights = [];
    this.selected = null;
    this.syncing = false;
    this.finished = false;
    this.unsubscribeRoom = null;
    this.promotionLayer = null;
    this.dragging = false;
    this.dragStart = null;
    this.modalOpen = false;
  }

  create() {
    const profile = readProfileState();
    this.copy = COPY[profile.language] || COPY.ko;
    this.skins = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    if (!this.demoMode) saveOnlineSession(this.roomCode, this.playerColor);
    this.boardLayout = getChessBoardLayout(this, { outerTop: 284, outerWidth: 712 });
    this.squareSize = this.boardLayout.squareSize;
    this.boardX = this.boardLayout.boardX;
    this.boardY = this.boardLayout.boardY;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xfff8ea).setOrigin(0).setDepth(-100);
    addDarkTopBar(this, this.copy.title, { onHome: () => this.confirmResign() });
    this.add.text(this.scale.width / 2, 155, interpolate(this.copy.room, { code: this.roomCode }), {
      fontFamily: KUMA_FONT_SANS, fontSize: "17px", color: "#95795d", fontStyle: "700",
    }).setOrigin(0.5).setDepth(120);
    addChessBoard(this, this.boardLayout, 0);

    this.opponentText = this.add.text(this.scale.width / 2, 205, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "24px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.playerText = this.add.text(this.scale.width / 2, 1055, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "24px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.statusText = this.add.text(this.scale.width / 2, 1100, "", {
      fontFamily: KUMA_FONT_SERIF, fontSize: "28px", color: "#009bb8", fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.connectionText = this.add.text(this.scale.width / 2, 1140, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "17px", color: "#a14c42", fontStyle: "700",
    }).setOrigin(0.5).setDepth(120);

    this.renderPosition();
    this.updateLabels();
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    if (!this.demoMode) {
      this.unsubscribeRoom = cloudApi()?.watchOnlineRoom?.(
        this.roomCode,
        (room) => this.onRoomChanged(room),
        () => this.onConnectionError(),
      ) || null;
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  updateLabels() {
    const isWhite = this.playerColor === "w";
    const playerName = isWhite ? this.room?.hostName : this.room?.guestName;
    const opponentName = isWhite ? this.room?.guestName : this.room?.hostName;
    this.playerText?.setText(`${playerName || this.copy.you} · ${this.playerColor.toUpperCase()}`);
    this.opponentText?.setText(`${opponentName || "Player"} · ${(isWhite ? "b" : "w").toUpperCase()}`);
    if (this.syncing) this.statusText?.setText(this.copy.syncing);
    else this.statusText?.setText(this.game.turn() === this.playerColor ? this.copy.turn : this.copy.wait);
  }

  renderPosition() {
    this.clearSelection();
    for (const view of this.pieceViews.values()) view.destroy();
    this.pieceViews.clear();
    const board = this.game.board();
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const piece = board[row][column];
        if (!piece) continue;
        const square = `${FILES[column]}${8 - row}`;
        const center = this.squareToCenter(square);
        const skin = this.skins[piece.color] || "classic";
        const facing = piece.color === this.playerColor ? "back" : "front";
        const size = Math.floor(this.squareSize * 1.02);
        const view = createPieceView(this, center.x, center.y, size, skin, piece.color, piece.type, facing);
        alignBoardPieceView(view, size, skin, facing);
        view._square = square;
        view._baseDepth = 20 + this.squareToScreenRC(square).row;
        view.setDepth(view._baseDepth);
        view.setInteractive(
          new Phaser.Geom.Rectangle(-this.squareSize / 2, -this.squareSize / 2, this.squareSize, this.squareSize),
          Phaser.Geom.Rectangle.Contains,
        );
        this.pieceViews.set(square, view);
      }
    }
  }

  onPointerDown(pointer) {
    if (this.syncing || this.finished || this.promotionLayer || this.modalOpen || this.game.turn() !== this.playerColor) return;
    const square = this.pointerToSquare(pointer);
    if (!square) return;
    const piece = this.game.get(square);
    const view = this.pieceViews.get(square);
    if (piece?.color === this.playerColor && view) {
      this.selectPiece(square, view);
      this.dragStart = { x: pointer.x, y: pointer.y, square };
      return;
    }
    if (this.selected) void this.tryMove(this.selected.square, square);
  }

  onPointerMove(pointer) {
    if (!pointer.isDown || !this.dragStart || !this.selected?.view || this.syncing) return;
    if (!this.dragging && Math.hypot(pointer.x - this.dragStart.x, pointer.y - this.dragStart.y) < 8) return;
    this.dragging = true;
    this.selected.view.setPosition(pointer.x, pointer.y).setDepth(500);
  }

  onPointerUp(pointer) {
    if (!this.dragStart) return;
    const from = this.dragStart.square;
    const wasDragging = this.dragging;
    this.dragStart = null;
    this.dragging = false;
    if (!wasDragging) return;
    const to = this.pointerToSquare(pointer);
    if (to && to !== from) void this.tryMove(from, to);
    else this.clearSelection();
  }

  selectPiece(square, view) {
    this.clearSelection();
    this.selected = { square, view };
    setSelectedOutline(view, true);
    view.setDepth(500);
    for (const move of this.game.moves({ square, verbose: true })) this.drawHighlight(move.to);
  }

  drawHighlight(square) {
    const topLeft = this.squareToTopLeft(square);
    const marker = this.add.graphics().setDepth(8);
    marker.fillStyle(0xf4c65d, 0.28);
    marker.fillRoundedRect(topLeft.x + 5, topLeft.y + 5, this.squareSize - 10, this.squareSize - 10, 8);
    marker.lineStyle(4, 0xf0a44a, 0.68);
    marker.strokeRoundedRect(topLeft.x + 7, topLeft.y + 7, this.squareSize - 14, this.squareSize - 14, 7);
    this.highlights.push(marker);
  }

  clearSelection() {
    this.highlights.forEach((item) => item.destroy());
    this.highlights = [];
    if (this.selected?.view?.scene) {
      const center = this.squareToCenter(this.selected.square);
      this.selected.view.setPosition(center.x, center.y).setDepth(this.selected.view._baseDepth || 20);
      setSelectedOutline(this.selected.view, false);
    }
    this.selected = null;
    this.dragStart = null;
    this.dragging = false;
  }

  async tryMove(from, to, promotion = "") {
    if (this.syncing || this.game.turn() !== this.playerColor) return;
    const legalMoves = this.game.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!legalMoves.length) {
      playFeedback("error");
      this.clearSelection();
      return;
    }
    const promotes = legalMoves.some((move) => move.promotion || move.flags?.includes("p"));
    if (promotes && !promotion) {
      this.clearSelection();
      this.showPromotionPicker(from, to);
      return;
    }

    const previousFen = this.game.fen();
    const move = this.game.move({ from, to, promotion: promotion || undefined });
    if (!move) return;
    const encoded = onlineMovePayload(move);
    const outcome = onlineRoomResult(this.game);
    const expectedRevision = Number(this.room?.revision) || 0;
    this.syncing = true;
    this.clearSelection();
    this.renderPosition();
    this.updateLabels();
    playFeedback(move.captured ? "capture" : "move");

    if (this.demoMode) {
      this.room = {
        ...this.room,
        fen: this.game.fen(),
        moves: [...(this.room.moves || []), encoded],
        revision: expectedRevision + 1,
      };
      this.syncing = false;
      this.updateLabels();
      return;
    }

    const response = await cloudApi()?.submitOnlineMove?.(this.roomCode, {
      move: encoded,
      fen: this.game.fen(),
      expectedRevision,
      ...outcome,
    });
    if (!this.scene.isActive()) return;
    if (!response?.ok) {
      this.game = new Chess(previousFen);
      this.syncing = false;
      this.renderPosition();
      this.updateLabels();
      showRewardLine(this, this.copy.moveFailed, {
        y: this.scale.height * 0.5, hold: 1800, showCoin: false, tone: "failure",
      });
    }
  }

  showPromotionPicker(from, to) {
    const backdrop = createModalBackdrop(this, 9900);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.promotionLayer = layer;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    layer.add(addPanel(this, centerX, centerY, 600, 510, 10000));
    layer.add(this.add.text(centerX, centerY - 160, this.copy.promotion, {
      fontFamily: KUMA_FONT_SANS, fontSize: "26px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0.5).setDepth(10001));
    const close = () => {
      backdrop.cleanup();
      layer.destroy(true);
      this.promotionLayer = null;
    };
    ["q", "r", "b", "n"].forEach((type, index) => {
      const x = centerX - 210 + index * 140;
      const hit = this.add.circle(x, centerY - 15, 58, 0xfff8e8, 0.82)
        .setStrokeStyle(3, 0xc18a31, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(10001);
      const piece = createPieceView(this, x, centerY - 15, 106, this.skins[this.playerColor] || "classic", this.playerColor, type, "front")
        .setDepth(10002);
      hit.on("pointerup", () => {
        close();
        void this.tryMove(from, to, type);
      });
      layer.add([hit, piece]);
    });
    const cancel = addLargeTextButton(this, centerX, centerY + 160, this.copy.promotionCancel, "", close, {
      width: 310, height: 76, fontSize: 23, depth: 10001,
    });
    layer.add([cancel.button, cancel.title]);
  }

  onRoomChanged(room) {
    if (!this.scene.isActive() || !room) return;
    if (Number(room.revision) < Number(this.room?.revision || 0)) return;
    this.room = room;
    this.syncing = false;
    this.connectionText.setText("");
    this.game = chessFromRoom(room);
    this.renderPosition();
    this.updateLabels();
    if (room.status === "finished" && !this.finished) this.finishMatch(room);
    if (room.status === "cancelled" && !this.finished) this.returnHome();
  }

  onConnectionError() {
    if (!this.scene.isActive() || this.finished) return;
    this.syncing = true;
    this.connectionText.setText(this.copy.reconnecting);
    this.updateLabels();
  }

  finishMatch(room) {
    this.finished = true;
    if (!this.demoMode) clearOnlineSession(this.roomCode);
    this.clearSelection();
    this.statusText.setText(room.result === "draw" ? "DRAW" : room.result === `${this.playerColor}_win` ? "WIN" : "LOSE");
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("Result", {
        result: room.result || "draw",
        reason: room.reason || "draw",
        winnerColor: room.result === "w_win" ? "w" : room.result === "b_win" ? "b" : null,
        skins: { ...this.skins },
        mode: "online",
        playerColor: this.playerColor,
        sourceScene: "OnlineGame",
        gameSessionId: `online:${this.roomCode}:${room.revision}`,
        newlyUnlocked: [],
      });
    });
  }

  confirmResign() {
    if (this.finished) {
      this.returnHome();
      return;
    }
    this.modalOpen = true;
    showConfirm(this, {
      title: this.copy.resignTitle,
      message: this.copy.resignMessage,
      confirmText: this.copy.resign,
      cancelText: this.copy.cancel,
      onConfirm: async () => {
        this.modalOpen = false;
        this.syncing = true;
        this.updateLabels();
        await cloudApi()?.leaveOnlineRoom?.(this.roomCode);
      },
      onCancel: () => {
        this.modalOpen = false;
      },
    });
  }

  returnHome() {
    this.finished = true;
    if (!this.demoMode) clearOnlineSession(this.roomCode);
    if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
  }

  pointerToSquare(pointer) {
    let column = Math.floor((pointer.x - this.boardX) / this.squareSize);
    let row = Math.floor((pointer.y - this.boardY) / this.squareSize);
    if (row < 0 || row > 7 || column < 0 || column > 7) return null;
    if (this.playerColor === "b") {
      row = 7 - row;
      column = 7 - column;
    }
    return `${FILES[column]}${8 - row}`;
  }

  squareToScreenRC(square) {
    let column = FILES.indexOf(square[0]);
    let row = 8 - Number(square[1]);
    if (this.playerColor === "b") {
      row = 7 - row;
      column = 7 - column;
    }
    return { row, column };
  }

  squareToTopLeft(square) {
    const { row, column } = this.squareToScreenRC(square);
    return { x: this.boardX + column * this.squareSize, y: this.boardY + row * this.squareSize };
  }

  squareToCenter(square) {
    const topLeft = this.squareToTopLeft(square);
    return { x: topLeft.x + this.squareSize / 2, y: topLeft.y + this.squareSize / 2 };
  }

  cleanup() {
    this.unsubscribeRoom?.();
    this.unsubscribeRoom = null;
  }
}
