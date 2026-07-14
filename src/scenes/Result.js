import { createPieceView } from "../pieceStyles.js?v=20260714-layout22";
import { grantCoinsOnce, readPlayerState, REWARDS } from "../playerState.js";
import { t } from "../i18n.js?v=20260714-layout22";
import { addDarkTopBar, addLargeTextButton, KUMA_COLORS, showRewardLine } from "../ui/KumaUi.js?v=20260714-layout22";

export class Result extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  init(data) {
    this.dataIn = data || { result: "draw", reason: "" };
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0);
    addDarkTopBar(this, "Kuma Chess");

    const result = this.dataIn?.result;
    const title = this._resultText(result);
    const playerWonAI =
      this.dataIn?.mode === "ai" &&
      this.dataIn?.playerColor &&
      this.dataIn?.winnerColor === this.dataIn.playerColor;
    const reward = playerWonAI
      ? grantCoinsOnce(`ai-win:${this.dataIn.gameSessionId || Date.now()}`, REWARDS.aiWin)
      : { awarded: false, amount: 0, coins: readPlayerState().coins };

    const winnerColor =
      this.dataIn?.winnerColor ??
      (result === "w_win" ? "w" : result === "b_win" ? "b" : null);
    const skins = this.dataIn?.skins || this.registry.get("pieceSkin") || { w: "classic", b: "classic" };

    if (winnerColor) {
      this.spawnCelebration();
      const skinId = skins[winnerColor] || "classic";
      const king = createPieceView(this, width / 2, 472, 430, skinId, winnerColor, "k", "front");
      king.setDepth(20);
    }

    this.add.text(width / 2, 830, title, {
      fontFamily: '"Noto Serif KR", "Noto Serif", Georgia, serif',
      fontSize: "58px",
      color: KUMA_COLORS.orange,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(40);

    const stats = this.dataIn?.mode === "ai"
      ? (playerWonAI ? t("result.aiWin") : t("result.aiEnd"))
      : this.reasonText(this.dataIn?.reason);
    this.add.text(width / 2, 895, stats, {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "25px",
      color: KUMA_COLORS.orange,
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(40);

    if (reward.awarded) {
      this.time.delayedCall(650, () => {
        showRewardLine(this, t("reward.ai", { amount: reward.amount }), {
          y: height * 0.53,
          hold: 2300,
        });
      });
    }

    const yBtn = height - 165;
    addLargeTextButton(this, width / 2 - 165, yBtn, t("result.retry"), "", () => {
      if (this.dataIn?.mode) this.registry.set("gameMode", this.dataIn.mode);
      if (this.dataIn?.playerColor) this.registry.set("playerColor", this.dataIn.playerColor);
      this.registry.set("pieceSkin", skins);
      this.scene.start("Game");
    }, { width: 300, height: 82, fontSize: 25, depth: 80 });

    addLargeTextButton(this, width / 2 + 165, yBtn, t("result.main"), "", () => {
      this.scene.start("Start");
    }, { width: 300, height: 82, fontSize: 25, dark: true, depth: 80 });
  }

  refreshLanguage() {
    this.scene.restart(this.dataIn);
  }

  spawnCelebration() {
    const { width, height } = this.scale;
    const colors = [0xf3c64f, 0xfff3c8, 0xd84c43, 0x1da2b8, 0x5ea95e, 0xe98a35];

    for (let i = 0; i < 82; i += 1) {
      const confetti = this.add.rectangle(
        Phaser.Math.Between(18, width - 18),
        Phaser.Math.Between(-220, Math.floor(height * 0.62)),
        Phaser.Math.Between(10, 22),
        Phaser.Math.Between(6, 14),
        colors[i % colors.length],
        1
      ).setDepth(14).setAngle(Phaser.Math.Between(0, 180));
      const startX = confetti.x;
      this.tweens.add({
        targets: confetti,
        x: startX + Phaser.Math.Between(-90, 90),
        y: height + 70,
        angle: confetti.angle + Phaser.Math.Between(360, 900),
        duration: Phaser.Math.Between(2600, 4400),
        delay: Phaser.Math.Between(0, 900),
        repeat: -1,
        ease: "Sine.InOut",
      });
    }

    for (let i = 0; i < 34; i += 1) {
      const burst = this.add.rectangle(
        width / 2,
        610,
        Phaser.Math.Between(10, 20),
        Phaser.Math.Between(6, 14),
        colors[(i + 2) % colors.length],
        1
      ).setDepth(46).setAngle(Phaser.Math.Between(0, 180));
      const direction = Phaser.Math.FloatBetween(-Math.PI, 0);
      const distance = Phaser.Math.Between(150, 360);
      this.tweens.add({
        targets: burst,
        x: width / 2 + Math.cos(direction) * distance,
        y: 610 + Math.sin(direction) * distance + Phaser.Math.Between(90, 220),
        angle: burst.angle + Phaser.Math.Between(240, 720),
        alpha: 0,
        duration: Phaser.Math.Between(1100, 1800),
        delay: Phaser.Math.Between(80, 420),
        ease: "Cubic.Out",
        onComplete: () => burst.destroy(),
      });
    }
  }

  _resultText(r) {
    if (r === "w_win") return "WHITE WIN";
    if (r === "b_win") return "BLACK WIN";
    return "DRAW";
  }

  reasonText(reason) {
    if (reason === "checkmate") return t("result.checkmate");
    if (reason === "resign") return t("result.resign");
    if (reason === "draw") return t("result.draw");
    return t("result.end");
  }
}
