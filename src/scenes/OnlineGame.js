import { Chess } from "../vendor-chess.js?v=20260904-accountfix104";
import { alignBoardPieceView, createPieceView, setSelectedOutline } from "../pieceStyles.js?v=20260904-accountfix104";
import { readProfileState } from "../profileState.js?v=20260904-accountfix104";
import { onlineMovePayload, onlineRoomResult } from "../onlineRoom.js?v=20260904-accountfix104";
import { clearOnlineSession, saveOnlineSession } from "../onlineSession.js?v=20260904-accountfix104";
import { playFeedback } from "../feedback.js?v=20260904-accountfix104";
import { showConfirm } from "../ui/ConfirmPopup.js?v=20260904-accountfix104";
import { addProfileAvatar } from "../ui/ProfileAvatar.js?v=20260904-accountfix104";
import { recordOnlineGameCompletion } from "../medals.js?v=20260904-accountfix104";
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
} from "../ui/KumaUi.js?v=20260904-accountfix104";

const FILES = "abcdefgh";
const COPY = Object.freeze({
  ko: Object.freeze({
    title: "온라인 대전", room: "초대 코드 {code}", you: "나", turn: "내 차례", wait: "상대 차례",
    captured: "잡은 기물",
    syncing: "수를 전송하고 있습니다.", reconnecting: "연결을 복구하고 있습니다.",
    moveFailed: "수를 전송하지 못했습니다. 다시 시도해주세요.",
    resignTitle: "대국 나가기", resignMessage: "진행 중인 온라인 대국에서 기권할까요?",
    resign: "기권", cancel: "계속하기", promotion: "승급할 체스말 선택",
    promotionSubtitle: "폰을 승급할 체스말을 선택하세요.", promotionCancel: "취소", promotionChange: "변경",
  }),
  en: Object.freeze({
    title: "Online Match", room: "Invite code {code}", you: "You", turn: "Your turn", wait: "Opponent's turn",
    captured: "Captured",
    syncing: "Sending move...", reconnecting: "Restoring connection...",
    moveFailed: "Could not send the move. Try again.",
    resignTitle: "Leave Match", resignMessage: "Resign this online match?",
    resign: "Resign", cancel: "Keep Playing", promotion: "Choose Promotion",
    promotionSubtitle: "Choose the piece for this pawn.", promotionCancel: "Cancel", promotionChange: "Change",
  }),
  ja: Object.freeze({
    title: "オンライン対局", room: "招待コード {code}", you: "自分", turn: "あなたの番", wait: "相手の番",
    captured: "取った駒",
    syncing: "指し手を送信中です。", reconnecting: "接続を復旧しています。",
    moveFailed: "指し手を送信できませんでした。もう一度お試しください。",
    resignTitle: "対局を終了", resignMessage: "進行中のオンライン対局で投了しますか？",
    resign: "投了", cancel: "続ける", promotion: "昇格する駒を選択",
    promotionSubtitle: "ポーンを昇格させる駒を選んでください。", promotionCancel: "キャンセル", promotionChange: "変更",
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
    this.capturedBy = { w: [], b: [] };
    this.capturedLayer = null;
    this._lastCheckKey = "";
    this._lineFxLayer = null;
    this._resultTimer = null;
    this._playerAvatarSignature = "";
    this._opponentAvatarSignature = "";
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
    this.capturedBy = { w: [], b: [] };
    this.capturedLayer = null;
    this._lastCheckKey = "";
    this._lineFxLayer = null;
    this._resultTimer = null;
    this._playerAvatarSignature = "";
    this._opponentAvatarSignature = "";
    this.gameStartedAt = data.room?.updatedAtMs || data.room?.createdAtMs || Date.now();
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
    this.add.text(this.scale.width / 2, 137, interpolate(this.copy.room, { code: this.roomCode }), {
      fontFamily: KUMA_FONT_SANS, fontSize: "17px", color: "#95795d", fontStyle: "700",
    }).setOrigin(0.5).setDepth(120);
    addChessBoard(this, this.boardLayout, 0);

    this.opponentAvatar = addProfileAvatar(this, null, 0, 0, {}, {
      size: 64, maxFrameScale: 1.2, depth: 120,
    });
    this.playerAvatar = addProfileAvatar(this, null, 0, 0, profile, {
      size: 64, maxFrameScale: 1.2, depth: 120,
    });
    this.opponentText = this.add.text(0, 190, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "24px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0, 0.5).setDepth(120);
    this.playerText = this.add.text(0, 1086, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "24px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0, 0.5).setDepth(120);
    this.statusText = this.add.text(this.scale.width / 2, 1160, "", {
      fontFamily: KUMA_FONT_SERIF, fontSize: "28px", color: "#009bb8", fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);
    this.connectionText = this.add.text(this.scale.width / 2, 1202, "", {
      fontFamily: KUMA_FONT_SANS, fontSize: "17px", color: "#a14c42", fontStyle: "700",
    }).setOrigin(0.5).setDepth(120);

    this.renderPosition();
    this.rebuildCapturedFromHistory();
    this.renderCaptured();
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
    const playerProfile = { avatar: isWhite ? this.room?.hostAvatar : this.room?.guestAvatar };
    const opponentProfile = { avatar: isWhite ? this.room?.guestAvatar : this.room?.hostAvatar };
    this.updateIdentityAvatar("player", this.playerAvatar, playerProfile);
    this.updateIdentityAvatar("opponent", this.opponentAvatar, opponentProfile);
    this.layoutIdentity(
      this.playerAvatar,
      this.playerText,
      `${playerName || this.copy.you} · ${this.playerColor.toUpperCase()}`,
      1086,
    );
    this.layoutIdentity(
      this.opponentAvatar,
      this.opponentText,
      `${opponentName || "Player"} · ${(isWhite ? "b" : "w").toUpperCase()}`,
      190,
    );
    if (this.syncing) this.statusText?.setText(this.copy.syncing);
    else {
      const turn = this.game.turn() === this.playerColor ? this.copy.turn : this.copy.wait;
      this.statusText?.setText(`${turn}${this.game.isCheck() ? " · CHECK" : ""}`);
    }
  }

  layoutIdentity(avatar, text, label, y) {
    if (!avatar?.container || !text) return;
    text.setText(label);
    const avatarSize = 64;
    const gap = 12;
    const totalWidth = avatarSize + gap + text.width;
    const startX = Math.max(42, (this.scale.width - totalWidth) / 2);
    avatar.container.setPosition(startX + avatarSize / 2, y);
    text.setPosition(startX + avatarSize + gap, y);
  }

  updateIdentityAvatar(slot, avatar, profile) {
    const signature = `${profile?.avatar?.portraitId || ""}:${profile?.avatar?.frameId || ""}`;
    const key = slot === "player" ? "_playerAvatarSignature" : "_opponentAvatarSignature";
    if (this[key] === signature) return;
    this[key] = signature;
    avatar?.setProfile(profile);
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

  rebuildCapturedFromHistory() {
    this.capturedBy = { w: [], b: [] };
    for (const move of this.game.history({ verbose: true })) {
      if (!move.captured) continue;
      this.capturedBy[move.color].push({
        color: move.color === "w" ? "b" : "w",
        type: move.captured,
      });
    }
  }

  renderCaptured() {
    this.capturedLayer?.destroy(true);
    this.capturedLayer = this.add.container(0, 0).setDepth(110);
    const opponentColor = this.playerColor === "w" ? "b" : "w";
    const rows = [
      { y: 250, pieces: this.capturedBy[opponentColor] || [] },
      { y: 1014, pieces: this.capturedBy[this.playerColor] || [] },
    ];
    const labelX = this.boardX + 8;
    const iconsStartX = this.boardX + 124;
    const maxX = this.boardX + this.squareSize * 8 - 10;

    rows.forEach(({ y, pieces }) => {
      const label = this.add.text(labelX, y, this.copy.captured, {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "16px",
        color: "#8e765f",
        fontStyle: "700",
      }).setOrigin(0, 0.5);
      this.capturedLayer.add(label);
      const gap = pieces.length > 1
        ? Math.min(38, (maxX - iconsStartX) / (pieces.length - 1))
        : 0;
      pieces.forEach((piece, index) => {
        const icon = createPieceView(
          this,
          iconsStartX + gap * index,
          y,
          pieces.length > 10 ? 32 : 36,
          this.skins[piece.color] || "classic",
          piece.color,
          piece.type,
          "front",
        );
        icon.setDepth(111);
        this.capturedLayer.add(icon);
      });
    });
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
      this.rebuildCapturedFromHistory();
      this.renderCaptured();
      this.updateLabels();
      this.showCheckNotice();
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
    if (this.promotionLayer) return;
    const backdrop = createModalBackdrop(this, 9900);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.promotionLayer = layer;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const panelW = 513;
    const panelH = 647;
    layer.add(addPanel(this, centerX, centerY, panelW, panelH, 10001));
    layer.add(this.add.text(centerX, centerY - 195, this.copy.promotion, {
      fontFamily: KUMA_FONT_SANS, fontSize: "26px", color: KUMA_COLORS.ink, fontStyle: "900",
    }).setOrigin(0.5).setDepth(10002));
    layer.add(this.add.rectangle(centerX, centerY - 153, panelW * 0.74, 2, 0xc69d72).setDepth(10002));
    layer.add(this.add.text(centerX, centerY - 110, this.copy.promotionSubtitle, {
      fontFamily: KUMA_FONT_SANS, fontSize: "23px", color: KUMA_COLORS.ink, fontStyle: "800",
    }).setOrigin(0.5).setDepth(10002));

    const choices = [
      { key: "q", label: "Queen" },
      { key: "r", label: "Rook" },
      { key: "b", label: "Bishop" },
      { key: "n", label: "Knight" },
    ];
    let selectedChoice = "q";
    let choiceLayer = null;
    const drawChoices = () => {
      choiceLayer?.destroy(true);
      choiceLayer = this.add.container(0, 0).setDepth(10002);
      const y = centerY + 49;
      choices.forEach((choice, index) => {
        const x = centerX - 160 + index * 106.7;
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
        const piece = createPieceView(
          this,
          x,
          y + 2,
          100,
          this.skins[this.playerColor] || "classic",
          this.playerColor,
          choice.key,
          "front",
        );
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

    const close = (choice = null) => {
      backdrop.cleanup();
      layer.destroy(true);
      this.promotionLayer = null;
      if (choice) void this.tryMove(from, to, choice);
    };
    const cancel = addLargeTextButton(this, centerX - 106, centerY + 243, this.copy.promotionCancel, "", () => close(), {
      width: 187, height: 81, fontSize: 24, depth: 10002,
    });
    const change = addLargeTextButton(this, centerX + 103, centerY + 243, this.copy.promotionChange, "", () => close(selectedChoice), {
      width: 195, height: 81, fontSize: 24, dark: true, depth: 10002,
    });
    layer.add([cancel.button, cancel.title, change.button, change.title]);
  }

  onRoomChanged(room) {
    if (!this.scene.isActive() || !room) return;
    if (Number(room.revision) < Number(this.room?.revision || 0)) return;
    this.room = room;
    this.syncing = false;
    this.connectionText.setText("");
    this.game = chessFromRoom(room);
    this.renderPosition();
    this.rebuildCapturedFromHistory();
    this.renderCaptured();
    this.updateLabels();
    if (room.status === "active") this.showCheckNotice();
    if (room.status === "finished" && !this.finished) this.finishMatch(room);
    if (room.status === "cancelled" && !this.finished) this.returnHome();
  }

  showCheckNotice() {
    if (!this.game.isCheck() || this.game.isCheckmate()) {
      this._lastCheckKey = "";
      return;
    }
    const key = this.game.fen();
    if (this._lastCheckKey === key) return;
    this._lastCheckKey = key;
    playFeedback("check");
    this.showLineText("CHECK!", { y: this.scale.height * 0.39, stay: 650 });
  }

  showLineText(message, options = {}) {
    this._lineFxLayer?.destroy(true);
    const y = options.y ?? this.scale.height * 0.42;
    const stay = options.stay ?? 1000;
    const duration = options.duration ?? 700;
    const layer = this.add.container(0, -10).setDepth(5000).setAlpha(0);
    this._lineFxLayer = layer;
    layer.add(this.add.rectangle(this.scale.width / 2, y, this.scale.width, 74, 0x000000, 0.35));
    layer.add(this.add.text(this.scale.width / 2, y, message, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 8,
    }).setOrigin(0.5));
    this.tweens.add({
      targets: layer,
      alpha: 1,
      y: 0,
      duration: 140,
      ease: "Quad.Out",
      onComplete: () => {
        this.time.delayedCall(stay, () => {
          if (!layer.scene) return;
          this.tweens.add({
            targets: layer,
            alpha: 0,
            duration,
            ease: "Quad.In",
            onComplete: () => {
              if (this._lineFxLayer === layer) this._lineFxLayer = null;
              layer.destroy(true);
            },
          });
        });
      },
    });
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
    const checkmate = room.reason === "checkmate";
    const draw = room.result === "draw";
    if (checkmate) {
      playFeedback("win");
      this.showLineText("CHECKMATE!", { y: this.scale.height * 0.4, stay: 800, duration: 1100 });
    } else if (draw) {
      playFeedback("draw");
      this.showLineText("DRAW", { y: this.scale.height * 0.4, stay: 700, duration: 900 });
    }
    const delay = checkmate ? 3200 : draw ? 1800 : 900;
    const medalResult = this.demoMode
      ? { newlyUnlocked: [] }
      : recordOnlineGameCompletion({
        eventId: `${room.code || this.roomCode}:round:${Math.max(1, Number(room.round) || 1)}`,
      });
    this._resultTimer = this.time.delayedCall(delay, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("Result", {
        result: room.result || "draw",
        reason: room.reason || "draw",
        winnerColor: room.result === "w_win" ? "w" : room.result === "b_win" ? "b" : null,
        skins: { ...this.skins },
        mode: "online",
        playerColor: this.playerColor,
        roomCode: this.roomCode,
        onlineRoom: { ...room },
        sourceScene: "OnlineGame",
        gameSessionId: `online:${this.roomCode}:${room.revision}`,
        history: this.game.history({ verbose: true }),
        finalPieces: this.game.board(),
        durationMs: Math.max(0, Date.now() - this.gameStartedAt),
        newlyUnlocked: medalResult.newlyUnlocked,
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
    this._resultTimer?.remove?.(false);
    this._resultTimer = null;
    this._lineFxLayer?.destroy(true);
    this._lineFxLayer = null;
  }
}
