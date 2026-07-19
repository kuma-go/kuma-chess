import { createPieceView } from "../pieceStyles.js?v=20260719-medals35";
import { AI_DIFFICULTIES, getAIDifficulty, grantCoinsOnce, readPlayerState } from "../playerState.js?v=20260719-medals35";
import { t } from "../i18n.js?v=20260719-medals35";
import { addDarkTopBar, addLargeTextButton, KUMA_COLORS, showRewardLine } from "../ui/KumaUi.js?v=20260719-medals35";
import { showMedalAwardSequence } from "../ui/MedalAward.js?v=20260719-medals35";

const AI_WIN_REWARDS = Object.freeze({ easy: 5, normal: 15, hard: 35 });
const DIFFICULTY_LABELS = Object.freeze({
  ko: { easy: "쉬움", normal: "보통", hard: "어려움" },
  en: { easy: "EASY", normal: "NORMAL", hard: "HARD" },
  ja: { easy: "かんたん", normal: "ふつう", hard: "むずかしい" },
});

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
    const difficultyId = this.dataIn?.difficulty || this.registry.get("aiDifficulty") || "normal";
    const difficulty = getAIDifficulty(difficultyId) || AI_DIFFICULTIES?.normal || { id: difficultyId };
    const resolvedDifficultyId = difficulty?.id || difficultyId;
    const winReward = Number(difficulty?.reward)
      || AI_WIN_REWARDS[resolvedDifficultyId]
      || AI_WIN_REWARDS.normal;
    const reward = this.dataIn?.reward ?? (playerWonAI
      ? grantCoinsOnce(`ai-win:${this.dataIn.gameSessionId || Date.now()}`, winReward)
      : { awarded: false, amount: 0, coins: readPlayerState().coins });

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

    if (this.dataIn?.mode === "ai") {
      const language = readPlayerState().language || "ko";
      const label = DIFFICULTY_LABELS[language]?.[resolvedDifficultyId]
        || DIFFICULTY_LABELS.en[resolvedDifficultyId]
        || resolvedDifficultyId.toUpperCase();
      const rewardLabel = language === "ko"
        ? `${label} · 승리 보상 ${winReward} COIN`
        : language === "ja"
          ? `${label} · 勝利報酬 ${winReward} COIN`
          : `${label} · WIN REWARD ${winReward} COIN`;
      this.add.text(width / 2, 934, rewardLabel, {
        fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
        fontSize: "19px",
        color: KUMA_COLORS.ink,
        fontStyle: "500",
      }).setOrigin(0.5).setDepth(40);
    }

    if (reward.awarded) {
      this.time.delayedCall(650, () => {
        showRewardLine(this, t("reward.ai", { amount: reward.amount }), {
          y: height * 0.53,
          hold: 2300,
        });
      });
    }
    if (this.dataIn?.newlyUnlocked?.length) {
      this.time.delayedCall(reward.awarded ? 3100 : 700, () => {
        showMedalAwardSequence(this, this.dataIn.newlyUnlocked, { y: height * 0.47 });
      });
    }

    const yBtn = height - 165;
    addLargeTextButton(this, width / 2 - 165, yBtn, t("result.retry"), "", () => {
      if (this.dataIn?.mode) this.registry.set("gameMode", this.dataIn.mode);
      if (this.dataIn?.playerColor) this.registry.set("playerColor", this.dataIn.playerColor);
      if (this.dataIn?.difficulty) this.registry.set("aiDifficulty", this.dataIn.difficulty);
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
