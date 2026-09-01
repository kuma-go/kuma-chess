import { Chess } from "../vendor-chess.js?v=20260902-profile81";
import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260902-profile81";
import { alignBoardPieceView, createPieceView } from "../pieceStyles.js?v=20260902-profile81";
import { playFeedback } from "../feedback.js?v=20260902-profile81";
import { allowScreenSleep, keepScreenAwakeDuringMatch } from "../screenWakeLock.js?v=20260902-profile81";
import {
  addDarkTopBar,
  addChessBoard,
  getChessBoardLayout,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260902-profile81";

const FILES = "abcdefgh";

// Legal's Mate: a compact, dramatic line with a queen sacrifice and checkmate.
const DEMO_LINE = Object.freeze([
  "e2e4", "e7e5",
  "g1f3", "b8c6",
  "f1c4", "d7d6",
  "b1c3", "c8g4",
  "h2h3", "g4h5",
  "f3e5", "h5d1",
  "c4f7", "e8e7",
  "c3d5",
]);

const DEMO_SKINS = Object.freeze({ w: "bear", b: "wolf" });

function readDemoOptions() {
  const params = new URLSearchParams(window.location.search);
  const requestedSpeed = Number(params.get("speed"));
  return {
    loop: params.get("loop") !== "0",
    speed: Number.isFinite(requestedSpeed)
      ? Phaser.Math.Clamp(requestedSpeed, 0.5, 2)
      : 1,
  };
}

export class Demo extends Phaser.Scene {
  constructor() {
    super("Demo");
    this.game = null;
    this.pieceViews = new Map();
    this.capturedBy = { w: [], b: [] };
    this.transient = new Set();
    this.runToken = 0;
    this.ready = false;
  }

  create() {
    const { width, height } = this.scale;
    keepScreenAwakeDuringMatch();
    this.options = readDemoOptions();
    this.game = new Chess();
    this.cameras.main.setBackgroundColor(0xfff8ea);
    this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0).setDepth(-100);

    this.boardLayout = getChessBoardLayout(this, { outerTop: 284, outerWidth: 712 });
    this.squareSize = this.boardLayout.squareSize;
    this.boardX = this.boardLayout.boardX;
    this.boardY = this.boardLayout.boardY;

    this.drawHeader();
    addChessBoard(this, this.boardLayout, 0);
    this.drawSceneCopy();

    this.loadingText = this.add.text(width / 2, height / 2, "KUMA CHESS", {
      fontFamily: KUMA_FONT_SERIF,
      fontSize: "36px",
      color: KUMA_COLORS.ink,
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(100);

    const token = ++this.runToken;
    ensurePieceSetsLoaded(this, [
      { skin: DEMO_SKINS.w, color: "w" },
      { skin: DEMO_SKINS.b, color: "b" },
    ]).then(() => {
      if (!this.scene.isActive() || token !== this.runToken) return;
      this.loadingText?.destroy();
      this.loadingText = null;
      this.ready = true;
      this.resetPosition();
      this.runDemo(token);
    });

    this.input.keyboard?.on("keydown-SPACE", () => {
      if (!this.ready) return;
      this.scene.restart();
    });
    // A tap unlocks mobile audio first (via the global gesture handler), then
    // restarts from frame one so recording begins with synchronized feedback.
    this.input.on("pointerup", () => {
      if (this.ready) this.scene.restart();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.runToken += 1;
      this.clearTransient();
      this.pieceViews.forEach((view) => view.destroy());
      this.pieceViews.clear();
      allowScreenSleep();
      if (window.kumaChessDemo?.scene === this) delete window.kumaChessDemo;
    });

    window.kumaChessDemo = {
      scene: this,
      replay: () => this.scene.restart(),
      pause: () => this.scene.pause(),
      resume: () => this.scene.resume(),
    };
  }

  drawHeader() {
    addDarkTopBar(this, "Kuma Chess", {
      onHome: () => {
        if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
      },
    });
  }

  drawSceneCopy() {
    const { width, height } = this.scale;
    this.turnText = this.add.text(width / 2, 1095, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "31px",
      color: KUMA_COLORS.orange,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(120);

    this.add.image(58, height - 66, "kuma_ui_btn_back")
      .setDisplaySize(72, 72)
      .setDepth(160);
    this.add.text(width - 67, height - 96, "컨셉 끄기", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5).setDepth(160);
    this.add.image(width - 67, height - 56, "kuma_ui_btn_radio_off")
      .setDisplaySize(80, 54)
      .setDepth(160);
  }

  resetPosition() {
    this.game = new Chess();
    this.capturedBy = { w: [], b: [] };
    this.clearTransient();
    this.renderAll();
    this.renderCaptured();
    this.updateStatus();
  }

  renderAll() {
    this.pieceViews.forEach((view) => view.destroy());
    this.pieceViews.clear();

    const board = this.game.board();
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = board[row][col];
        if (!piece) continue;
        const square = `${FILES[col]}${8 - row}`;
        const { x, y } = this.squareToCenter(square);
        const size = Math.floor(this.squareSize * 1.02);
        const skin = DEMO_SKINS[piece.color];
        const facing = piece.color === "w" ? "back" : "front";
        const view = createPieceView(this, x, y, size, skin, piece.color, piece.type, facing);
        alignBoardPieceView(view, size, skin, facing);
        view.setDepth(20 + row);
        view._square = square;
        view._color = piece.color;
        view._type = piece.type;
        view._skin = skin;
        view._facing = facing;
        view._pieceSize = size;
        this.pieceViews.set(square, view);
      }
    }
  }

  squareToCenter(square) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    return {
      x: this.boardX + (file + 0.5) * this.squareSize,
      y: this.boardY + (8 - rank + 0.5) * this.squareSize,
    };
  }

  updateStatus() {
    const side = this.game.turn() === "w" ? "백" : "흑";
    const check = this.game.isCheck() ? " · CHECK" : "";
    this.turnText
      .setText(`${side} 진영 차례${check}`)
      .setPosition(this.scale.width / 2, this.game.turn() === "w" ? 1110 : 174);
  }

  renderCaptured() {
    this.capturedLayer?.destroy();
    this.capturedLayer = this.add.container(0, 0).setDepth(90);

    const boardLeft = this.boardX;
    const boardRight = this.boardX + this.squareSize * 8;
    const topY = Math.max(250, this.boardLayout.outerTop - 58);
    const bottomY = Math.min(this.scale.height - 170, this.boardLayout.outerTop + this.boardLayout.outerHeight + 58);
    const labelStyle = {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
    };
    const topLabel = this.add.text(boardLeft - 18, topY, "처치한 기물 :", labelStyle).setOrigin(0, 0.5);
    const bottomLabel = this.add.text(boardLeft - 18, bottomY, "처치한 기물 :", labelStyle).setOrigin(0, 0.5);
    this.capturedLayer.add([topLabel, bottomLabel]);

    const drawRow = (pieces, y, startX) => {
      pieces.forEach((piece, index) => {
        const skin = DEMO_SKINS[piece.color];
        const facing = piece.color === "w" ? "back" : "front";
        const view = createPieceView(this, startX + index * 44, y, 58, skin, piece.color, piece.type, facing);
        const image = view._pieceImage;
        if (image?.setDisplaySize) {
          image.setPosition(0, 0);
          image.setDisplaySize(44, 66);
        }
        this.capturedLayer.add(view);
      });
    };

    drawRow(this.capturedBy.b, topY, Math.max(boardLeft + 122, topLabel.x + topLabel.width + 18));
    drawRow(this.capturedBy.w, bottomY, Math.max(boardLeft + 122, bottomLabel.x + bottomLabel.width + 18));
  }

  async runDemo(token) {
    await this.wait(800, token);

    for (let index = 0; index < DEMO_LINE.length; index += 1) {
      if (!this.isCurrentRun(token)) return;
      const uci = DEMO_LINE[index];
      const moved = await this.playMove(uci, token);
      if (!moved) return;
      await this.wait(index === 11 || index === 12 ? 720 : 430, token);
    }

    if (!this.isCurrentRun(token)) return;
    this.turnText.setText("CHECKMATE");
    playFeedback("win");
    this.spawnCelebration();
    showRewardLine(this, "CHECKMATE!", {
      y: 650,
      hold: 3000,
      showCoin: false,
      particleScale: 2,
      particleCount: 60,
      feedbackType: "win",
    });
    await this.wait(3900, token);

    if (!this.options.loop || !this.isCurrentRun(token)) return;
    await this.transitionToRestart(token);
    if (!this.isCurrentRun(token)) return;
    this.runDemo(token);
  }

  playMove(uci, token) {
    return new Promise((resolve) => {
      if (!this.isCurrentRun(token)) {
        resolve(false);
        return;
      }

      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const piece = this.game.get(from);
      const sourceView = this.pieceViews.get(from);
      if (!piece || !sourceView) {
        resolve(false);
        return;
      }

      const start = this.squareToCenter(from);
      const end = this.squareToCenter(to);
      const skin = DEMO_SKINS[piece.color];
      const facing = piece.color === "w" ? "back" : "front";
      const size = Math.floor(this.squareSize * 1.02);
      const mover = createPieceView(this, start.x, start.y, size, skin, piece.color, piece.type, facing);
      alignBoardPieceView(mover, size, skin, facing);
      mover.setDepth(300);
      sourceView.setVisible(false);
      this.trackTransient(mover);

      this.addMoveHighlight(from, 0xf0a44a, 0.23);
      this.addMoveHighlight(to, 0xf4c65d, 0.31);

      const duration = Math.round(520 / this.options.speed);
      this.tweens.add({
        targets: mover,
        x: end.x,
        y: end.y,
        scaleX: 1.06,
        scaleY: 1.06,
        duration,
        ease: "Cubic.InOut",
        onComplete: () => {
          if (!this.isCurrentRun(token)) {
            resolve(false);
            return;
          }
          const move = this.game.move({
            from,
            to,
            promotion: uci[4] || "q",
          });
          mover.destroy();
          this.transient.delete(mover);
          if (!move) {
            resolve(false);
            return;
          }

          if (move.captured) {
            const capturedColor = move.color === "w" ? "b" : "w";
            this.capturedBy[move.color].push({ color: capturedColor, type: move.captured });
          }
          this.renderAll();
          this.renderCaptured();
          this.playLandingEffect(to, !!move.captured);
          this.updateStatus();

          if (this.game.isCheck() && !this.game.isCheckmate()) {
            showRewardLine(this, "CHECK!", {
              y: 650,
              hold: 900,
              showCoin: false,
              particleScale: 1.25,
              particleCount: 20,
              feedbackType: "check",
            });
          }
          resolve(true);
        },
      });
    });
  }

  addMoveHighlight(square, color, alpha) {
    const { x, y } = this.squareToCenter(square);
    const highlight = this.add.rectangle(x, y, this.squareSize - 8, this.squareSize - 8, color, alpha)
      .setStrokeStyle(3, color, 0.7)
      .setDepth(8);
    this.trackTransient(highlight);
    this.tweens.add({
      targets: highlight,
      alpha: 0,
      duration: 1150,
      ease: "Quad.Out",
      onComplete: () => {
        highlight.destroy();
        this.transient.delete(highlight);
      },
    });
  }

  playLandingEffect(square, isCapture) {
    playFeedback(isCapture ? "capture" : "move");
    const { x, y } = this.squareToCenter(square);
    this.cameras.main.shake(isCapture ? 95 : 55, isCapture ? 0.006 : 0.003);

    const ring = this.add.circle(x, y, this.squareSize * 0.18, 0xf4c65d, 0.08)
      .setStrokeStyle(isCapture ? 5 : 3, isCapture ? 0xdd8832 : 0xd8a344, 0.9)
      .setDepth(290);
    this.trackTransient(ring);
    this.tweens.add({
      targets: ring,
      scaleX: isCapture ? 2.5 : 1.9,
      scaleY: isCapture ? 2.5 : 1.9,
      alpha: 0,
      duration: isCapture ? 430 : 320,
      ease: "Cubic.Out",
      onComplete: () => {
        ring.destroy();
        this.transient.delete(ring);
      },
    });

    const count = isCapture ? 18 : 10;
    for (let i = 0; i < count; i += 1) {
      const dust = this.add.circle(x, y + this.squareSize * 0.2, Phaser.Math.Between(2, 5), 0xd8b985, 0.72)
        .setDepth(289);
      this.trackTransient(dust);
      const angle = Phaser.Math.FloatBetween(Math.PI, Math.PI * 2);
      const distance = Phaser.Math.Between(28, isCapture ? 84 : 58);
      this.tweens.add({
        targets: dust,
        x: x + Math.cos(angle) * distance,
        y: y + this.squareSize * 0.2 + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: Phaser.Math.Between(260, 460),
        ease: "Quad.Out",
        onComplete: () => {
          dust.destroy();
          this.transient.delete(dust);
        },
      });
    }
  }

  spawnCelebration() {
    const colors = [0xf3c64f, 0xfff3c8, 0xd84c43, 0x1da2b8, 0x5ea95e, 0xe98a35];
    for (let i = 0; i < 72; i += 1) {
      const confetti = this.add.rectangle(
        Phaser.Math.Between(12, this.scale.width - 12),
        Phaser.Math.Between(-160, 40),
        Phaser.Math.Between(12, 24),
        Phaser.Math.Between(7, 15),
        colors[i % colors.length],
        1
      ).setDepth(450).setAngle(Phaser.Math.Between(0, 180));
      this.trackTransient(confetti);
      this.tweens.add({
        targets: confetti,
        x: confetti.x + Phaser.Math.Between(-100, 100),
        y: this.scale.height + 90,
        angle: confetti.angle + Phaser.Math.Between(420, 980),
        duration: Phaser.Math.Between(2500, 3900),
        delay: Phaser.Math.Between(0, 550),
        ease: "Sine.InOut",
        onComplete: () => {
          confetti.destroy();
          this.transient.delete(confetti);
        },
      });
    }
  }

  async transitionToRestart(token) {
    const cover = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xfff8ea, 0)
      .setOrigin(0)
      .setDepth(8000);
    await this.tweenPromise({ targets: cover, alpha: 1, duration: 520, ease: "Quad.InOut" }, token);
    if (!this.isCurrentRun(token)) return;
    this.resetPosition();
    await this.wait(260, token);
    await this.tweenPromise({ targets: cover, alpha: 0, duration: 620, ease: "Quad.InOut" }, token);
    cover.destroy();
    await this.wait(450, token);
  }

  tweenPromise(config, token) {
    return new Promise((resolve) => {
      if (!this.isCurrentRun(token)) {
        resolve(false);
        return;
      }
      this.tweens.add({ ...config, onComplete: () => resolve(true) });
    });
  }

  wait(duration, token) {
    return new Promise((resolve) => {
      if (!this.isCurrentRun(token)) {
        resolve(false);
        return;
      }
      this.time.delayedCall(Math.round(duration / this.options.speed), () => resolve(this.isCurrentRun(token)));
    });
  }

  trackTransient(object) {
    this.transient.add(object);
    return object;
  }

  clearTransient() {
    this.transient.forEach((object) => object?.destroy?.());
    this.transient.clear();
  }

  isCurrentRun(token) {
    return this.scene.isActive() && token === this.runToken;
  }
}
