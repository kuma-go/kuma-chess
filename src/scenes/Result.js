import { createPieceView } from "../pieceStyles.js?v=20260906-inviteshare112";
import { AI_DIFFICULTIES, getPieceUnlockNotices, getAIDifficulty, grantCoinsOnce, readPlayerState } from "../playerState.js?v=20260906-inviteshare112";
import { t } from "../i18n.js?v=20260906-inviteshare112";
import {
  addDarkTopBar,
  addLargeTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "../ui/KumaUi.js?v=20260906-inviteshare112";
import { markMedalsSeen, recordOnlineRematch } from "../medals.js?v=20260906-inviteshare112";
import { showMedalAwardSequence } from "../ui/MedalAward.js?v=20260906-inviteshare112";
import { showPieceUnlockNoticeSequence } from "../ui/PieceUnlockLine.js?v=20260906-inviteshare112";
import { addProfileAvatar } from "../ui/ProfileAvatar.js?v=20260906-inviteshare112";
import { saveOnlineSession } from "../onlineSession.js?v=20260906-inviteshare112";

const AI_WIN_REWARDS = Object.freeze({ easy: 5, normal: 15, hard: 35, challenge: 100 });
const DIFFICULTY_LABELS = Object.freeze({
  ko: { easy: "쉬움", normal: "보통", hard: "어려움", challenge: "도전" },
  en: { easy: "EASY", normal: "NORMAL", hard: "HARD", challenge: "CHALLENGE" },
  ja: { easy: "かんたん", normal: "ふつう", hard: "むずかしい", challenge: "挑戦" },
});

function cloudApi() {
  try {
    return window.parent?.KumaCloud || window.KumaCloud || null;
  } catch (_error) {
    return window.KumaCloud || null;
  }
}

export class Result extends Phaser.Scene {
  constructor() {
    super("Result");
    this.unsubscribeRoom = null;
    this.rematchPopup = null;
    this.latestOnlineRoom = null;
    this.playerUid = "";
    this.startingRematch = false;
    this.suppressDeclinedNotice = false;
  }

  init(data) {
    this.dataIn = data || { result: "draw", reason: "" };
    this.unsubscribeRoom = null;
    this.rematchPopup = null;
    this.latestOnlineRoom = this.dataIn?.onlineRoom || null;
    this.playerUid = cloudApi()?.getState?.()?.uid || "";
    this.startingRematch = false;
    this.suppressDeclinedNotice = false;
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
    const reward = playerWonAI
      ? this.dataIn?.reward ?? grantCoinsOnce(`ai-win:${this.dataIn.gameSessionId || Date.now()}`, winReward)
      : { awarded: false, amount: 0, coins: readPlayerState().coins };

    const winnerColor =
      this.dataIn?.winnerColor ??
      (result === "w_win" ? "w" : result === "b_win" ? "b" : null);
    const skins = this.dataIn?.skins || this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    const isOnline = this.dataIn?.mode === "online";

    if (winnerColor) {
      this.spawnCelebration();
      const skinId = skins[winnerColor] || "classic";
      const king = createPieceView(this, width / 2, 472, 430, skinId, winnerColor, "k", "front");
      king.setDepth(20);
    }

    this.add.text(width / 2, isOnline ? 850 : 830, title, {
      fontFamily: '"Noto Serif KR", "Noto Serif", Georgia, serif',
      fontSize: "58px",
      color: KUMA_COLORS.orange,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(40);

    const sourceScene = this.dataIn?.sourceScene || "Game";
    const isTug = sourceScene === "KingdomTug";
    const isRoad = sourceScene === "RoyalRoad";
    const isCrown = sourceScene === "CrownClash";
    const isSiege = sourceScene === "KingdomSiege";
    const stats = isTug || isRoad || isCrown || isSiege
      ? this.reasonText(this.dataIn?.reason, this.dataIn)
      : this.dataIn?.mode === "ai"
      ? (playerWonAI ? t("result.aiWin") : t("result.aiEnd"))
      : this.reasonText(this.dataIn?.reason, this.dataIn);
    if (isOnline && winnerColor) {
      this.addOnlineWinnerIdentity(winnerColor, 925);
    } else {
      this.add.text(width / 2, isOnline ? 915 : 895, stats, {
        fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
        fontSize: "25px",
        color: KUMA_COLORS.orange,
        fontStyle: "500",
      }).setOrigin(0.5).setDepth(40);
    }

    if (playerWonAI) {
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

    const pieceUnlockNotices = getPieceUnlockNotices();
    const newlyUnlockedMedals = Array.from(new Set(this.dataIn?.newlyUnlocked || []));

    const yBtn = height - 165;
    const playerWonOnline = result === `${this.dataIn?.playerColor}_win`;
    const onlineActionLabel = t(playerWonOnline ? "result.rematch" : "result.revenge");
    const retryAction = addLargeTextButton(this, width / 2 - 165, yBtn, isOnline ? onlineActionLabel : t("result.retry"), "", () => {
      if (isOnline) {
        void this.requestRematch();
        return;
      }
      if (this.dataIn?.mode) this.registry.set("gameMode", this.dataIn.mode);
      if (this.dataIn?.playerColor) this.registry.set("playerColor", this.dataIn.playerColor);
      if (this.dataIn?.difficulty) this.registry.set("aiDifficulty", this.dataIn.difficulty);
      this.registry.set("pieceSkin", skins);
      this.registry.set("pieceSelectTargetScene", sourceScene);
      this.scene.start(sourceScene);
    }, { width: 300, height: 82, fontSize: 25, depth: 80 });

    const mainAction = addLargeTextButton(this, width / 2 + 165, yBtn, t("result.main"), "", () => {
      if (this.rematchPopup?.kind === "waiting") void this.cancelRematch(true);
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    }, { width: 300, height: 82, fontSize: 25, dark: true, depth: 80 });

    const setActionsEnabled = (enabled) => {
      [retryAction, mainAction].forEach((action) => {
        action.button.setEnabled(enabled);
        action.title.setAlpha(enabled ? 1 : 0.55);
      });
    };
    this.setActionsEnabled = setActionsEnabled;
    const showSecondaryNotices = () => {
      if (!this.scene.isActive()) return;
      if (reward.awarded) {
        showRewardLine(this, t("reward.ai", { amount: reward.amount }), {
          y: height * 0.53,
          hold: 2300,
        });
      }
      if (pieceUnlockNotices.length) {
        const delay = reward.awarded ? 2450 : 150;
        this.time.delayedCall(delay, () => {
          showPieceUnlockNoticeSequence(this, pieceUnlockNotices, { y: height * 0.5 });
        });
      }
    };

    if (newlyUnlockedMedals.length) {
      // A medal is the primary result reward. Keep navigation disabled until the
      // player has seen it so a fast retry cannot cancel the scheduled sequence.
      setActionsEnabled(false);
      this.time.delayedCall(500, async () => {
        const confirmedIds = await showMedalAwardSequence(this, newlyUnlockedMedals, { y: height * 0.47 });
        if (confirmedIds.length) markMedalsSeen(confirmedIds);
        if (!this.scene.isActive()) return;
        setActionsEnabled(true);
        showSecondaryNotices();
      });
    } else {
      this.time.delayedCall(650, showSecondaryNotices);
    }

    if (isOnline && this.dataIn?.roomCode && cloudApi()?.watchOnlineRoom) {
      this.unsubscribeRoom = cloudApi().watchOnlineRoom(
        this.dataIn.roomCode,
        (room) => this.onOnlineRoomChanged(room),
        () => showRewardLine(this, t("result.rematchFailed"), {
          y: height * 0.52, hold: 1800, showCoin: false, tone: "failure",
        }),
      );
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupOnlineResult());
  }

  addOnlineWinnerIdentity(winnerColor, y) {
    const room = this.dataIn?.onlineRoom || {};
    const winnerUid = winnerColor === "w" ? room.whiteUid : room.blackUid;
    const isHost = winnerUid && winnerUid === room.hostUid;
    const displayName = (isHost ? room.hostName : room.guestName) || "Player";
    const avatar = isHost ? room.hostAvatar : room.guestAvatar;
    const text = this.add.text(0, y, displayName, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0, 0.5).setDepth(42);
    const avatarSize = 70;
    const gap = 14;
    const startX = (this.scale.width - avatarSize - gap - text.width) / 2;
    addProfileAvatar(this, null, startX + avatarSize / 2, y, { avatar }, {
      size: avatarSize,
      maxFrameScale: 1.2,
      depth: 42,
    });
    text.setX(startX + avatarSize + gap);
  }

  async requestRematch() {
    const api = cloudApi();
    if (!api?.requestOnlineRematch || !this.dataIn?.roomCode) return;
    this.setActionsEnabled?.(false);
    const response = await api.requestOnlineRematch(this.dataIn.roomCode);
    if (!this.scene.isActive()) return;
    if (!response?.ok) {
      this.setActionsEnabled?.(true);
      showRewardLine(this, t("result.rematchFailed"), {
        y: this.scale.height * 0.52, hold: 1800, showCoin: false, tone: "failure",
      });
      return;
    }
    this.showRematchPopup("waiting");
  }

  async acceptRematch() {
    const response = await cloudApi()?.acceptOnlineRematch?.(this.dataIn.roomCode);
    if (!this.scene.isActive() || response?.ok) return;
    this.clearRematchPopup();
    this.setActionsEnabled?.(true);
    showRewardLine(this, t("result.rematchFailed"), {
      y: this.scale.height * 0.52, hold: 1800, showCoin: false, tone: "failure",
    });
  }

  async cancelRematch(silent = false) {
    this.suppressDeclinedNotice = silent || this.rematchPopup?.kind === "waiting";
    const response = await cloudApi()?.cancelOnlineRematch?.(this.dataIn.roomCode);
    if (!this.scene.isActive()) return;
    this.clearRematchPopup();
    this.setActionsEnabled?.(true);
    if (!response?.ok && !silent) {
      showRewardLine(this, t("result.rematchFailed"), {
        y: this.scale.height * 0.52, hold: 1800, showCoin: false, tone: "failure",
      });
    }
  }

  async onOnlineRoomChanged(room) {
    if (!this.scene.isActive() || !room) return;
    const previousRequester = this.latestOnlineRoom?.rematchRequesterUid || "";
    this.latestOnlineRoom = room;
    if (room.status === "active" && !this.startingRematch) {
      const playerColor = room.whiteUid === this.playerUid ? "w" : room.blackUid === this.playerUid ? "b" : "";
      if (!playerColor) return;
      this.startingRematch = true;
      this.clearRematchPopup();
      saveOnlineSession(room.code, playerColor);
      const medalResult = recordOnlineRematch({
        eventId: `${room.code}:round:${Math.max(1, Number(room.round) || 1)}`,
      });
      if (medalResult.newlyUnlocked.length) {
        const confirmedIds = await showMedalAwardSequence(this, medalResult.newlyUnlocked, {
          y: this.scale.height * 0.47,
        });
        if (confirmedIds.length) markMedalsSeen(confirmedIds);
        if (!this.scene.isActive()) return;
      }
      this.scene.start("OnlineGame", { code: room.code, room, playerColor });
      return;
    }
    if (room.status !== "finished") return;
    const requester = room.rematchRequesterUid || "";
    if (requester === this.playerUid) {
      this.showRematchPopup("waiting");
    } else if (requester) {
      this.showRematchPopup("incoming");
    } else {
      const wasWaiting = previousRequester === this.playerUid;
      this.clearRematchPopup();
      this.setActionsEnabled?.(true);
      if (wasWaiting && !this.suppressDeclinedNotice) {
        showRewardLine(this, t("result.rematchDeclined"), {
          y: this.scale.height * 0.52, hold: 1800, showCoin: false,
        });
      }
      this.suppressDeclinedNotice = false;
    }
  }

  showRematchPopup(kind) {
    if (this.rematchPopup?.kind === kind) return;
    this.clearRematchPopup();
    this.setActionsEnabled?.(false);
    const { width, height } = this.scale;
    const depth = 10000;
    const backdrop = createModalBackdrop(this, depth - 10);
    const layer = this.add.container(0, 0).setDepth(depth);
    const panelW = Math.min(514, width * 0.86);
    const panelH = 447;
    const px = width / 2;
    const py = height / 2;
    layer.add(addPanel(this, px, py, panelW, panelH, depth + 1));
    layer.add(this.add.text(px, py - 110, t("result.rematchTitle"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: "#352719",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(depth + 2));
    layer.add(this.add.text(px, py - 20, t(kind === "waiting" ? "result.rematchWaiting" : "result.rematchIncoming"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: "#352719",
      fontStyle: "600",
      align: "center",
      lineSpacing: 6,
      wordWrap: { width: panelW * 0.82 },
    }).setOrigin(0.5).setDepth(depth + 2));
    const buttonY = py + 143;
    if (kind === "waiting") {
      const cancel = addLargeTextButton(this, px, buttonY, t("result.rematchCancel"), "", () => void this.cancelRematch(true), {
        width: 270, height: 81, fontSize: 22, depth: depth + 2,
      });
      layer.add([cancel.button, cancel.title]);
    } else {
      const decline = addLargeTextButton(this, px - 105, buttonY, t("result.rematchDecline"), "", () => void this.cancelRematch(), {
        width: 187, height: 81, fontSize: 22, depth: depth + 2,
      });
      const accept = addLargeTextButton(this, px + 105, buttonY, t("result.rematchAccept"), "", () => void this.acceptRematch(), {
        width: 195, height: 81, fontSize: 22, dark: true, depth: depth + 2,
      });
      layer.add([decline.button, decline.title, accept.button, accept.title]);
    }
    this.rematchPopup = { kind, layer, backdrop };
  }

  clearRematchPopup() {
    if (!this.rematchPopup) return;
    this.rematchPopup.backdrop.cleanup();
    this.rematchPopup.layer.destroy(true);
    this.rematchPopup = null;
  }

  cleanupOnlineResult() {
    this.unsubscribeRoom?.();
    this.unsubscribeRoom = null;
    this.clearRematchPopup();
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

  reasonText(reason, data = {}) {
    if (reason === "checkmate") return t("result.checkmate");
    if (reason === "pushout") return t("tug.kingOut");
    if (reason === "roadComplete") return t("road.complete");
    if (reason === "roadDraw") return t("road.draw");
    if (reason === "crownComplete") return t("crown.complete");
    if (reason === "siegeComplete") return t("siege.complete");
    if (reason === "siegeTimeout") {
      return t("siege.timeResult", {
        white: data?.castleHp?.w ?? 0,
        black: data?.castleHp?.b ?? 0,
      });
    }
    if (reason === "timeout") {
      return t("tug.timeResult", {
        white: data?.remainingPieces?.w ?? 0,
        black: data?.remainingPieces?.b ?? 0,
      });
    }
    if (reason === "resign") return t("result.resign");
    if (reason === "draw") return t("result.draw");
    return t("result.end");
  }
}
