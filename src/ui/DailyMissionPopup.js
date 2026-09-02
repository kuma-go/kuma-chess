import {
  getDailyMissionSnapshot,
  markDailyMissionsSeen,
} from "../dailyMissions.js?v=20260902-mobile88";
import { readPlayerState } from "../playerState.js?v=20260902-mobile88";
import {
  addMiniCoin,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "./KumaUi.js?v=20260902-mobile88";
import { playFeedback } from "../feedback.js?v=20260902-mobile88";

const COPY = Object.freeze({
  ko: {
    title: "데일리 미션",
    complete: "완료",
    allClear: "완료 보너스",
    reward: (amount) => `데일리 미션 보상   +${amount} COIN`,
    streak: ({ streak, total }) => `연속 ${streak}일  ·  누적 ${total}일`,
  },
  en: {
    title: "DAILY MISSIONS",
    complete: "DONE",
    allClear: "ALL-CLEAR BONUS",
    reward: (amount) => `DAILY MISSION REWARD   +${amount} COIN`,
    streak: ({ streak, total }) => `${streak}-day streak  ·  ${total} ${total === 1 ? "day" : "days"} total`,
  },
  ja: {
    title: "デイリーミッション",
    complete: "完了",
    allClear: "全達成ボーナス",
    reward: (amount) => `デイリーミッション報酬   +${amount} COIN`,
    streak: ({ streak, total }) => `${streak}日連続  ·  累計${total}日`,
  },
});

export function showDailyMissionPopup(scene, options = {}) {
  if (scene.dailyMissionPopup) return scene.dailyMissionPopup;
  const { width, height } = scene.scale;
  const language = readPlayerState().language || "ko";
  const copy = COPY[language] || COPY.ko;
  const snapshot = markDailyMissionsSeen();
  const backdrop = createModalBackdrop(scene, 9700, options.externalBackdrop
    ? { capture: false, dimAlpha: 0.001 }
    : undefined);
  const layer = scene.add.container(0, 0).setDepth(9710);
  let rewardTimer = null;
  let rewardLine = null;
  const centerY = Math.min(height * 0.5, 625);
  const showStreak = snapshot.allComplete;
  const titleY = centerY - (showStreak ? 153 : 141);
  const dividerY = centerY - (showStreak ? 98 : 107);
  const firstRowY = centerY - (showStreak ? 56 : 64);
  const panel = scene.add.image(width / 2, centerY, "kuma_ui_daily_popup")
    .setDisplaySize(638, 428);
  const title = scene.add.text(width / 2, titleY, copy.title, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "29px",
    color: KUMA_COLORS.ink,
    fontStyle: "800",
  }).setOrigin(0.5);
  const divider = scene.add.rectangle(width / 2, dividerY, 378, 2, 0xb88a60, 0.76);
  layer.add([panel, title, divider]);

  const columns = {
    nameX: width / 2 - 188,
    nameWidth: 224,
    progressX: width / 2 + 140,
    progressWidth: 112,
    rewardX: width / 2 + 187,
  };
  snapshot.missions.forEach((mission, index) => {
    const y = firstRowY + index * 68;
    const name = scene.add.text(columns.nameX, y, mission.title, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: mission.complete ? "#9b856d" : "#846648",
      fontStyle: "500",
      align: "left",
      lineSpacing: 0,
      wordWrap: { width: columns.nameWidth, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0, 0.5);
    const progressValue = `${mission.displayProgress}/${mission.target}${mission.complete ? ` ${copy.complete}` : ""}`;
    const progress = scene.add.text(columns.progressX, y, progressValue, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "23px",
      color: mission.complete ? KUMA_COLORS.teal : "#d34f54",
      fontStyle: "600",
    }).setOrigin(1, 0.5);
    fitSingleLine(progress, columns.progressWidth, 18);
    const reward = addMiniCoin(scene, columns.rewardX, y, `+${mission.reward}`, 9712)
      .setAlpha(mission.complete ? 0.58 : 1);
    layer.add([name, progress, reward]);
  });

  const footerY = centerY + 132;
  const footerDivider = scene.add.rectangle(width / 2, footerY - 31, 378, 2, 0xb88a60, 0.76);
  const completedCount = snapshot.missions.filter((mission) => mission.complete).length;
  const footerTitle = scene.add.text(columns.nameX, footerY, copy.allClear, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "23px",
    color: "#342B1F",
    fontStyle: "500",
  }).setOrigin(0, 0.5);
  fitSingleLine(footerTitle, columns.nameWidth, 19);
  const footerProgress = scene.add.text(columns.progressX, footerY, `${completedCount}/3`, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "23px",
    color: snapshot.allComplete ? KUMA_COLORS.teal : "#d34f54",
    fontStyle: "600",
  }).setOrigin(1, 0.5);
  const footerReward = addMiniCoin(
    scene,
    columns.rewardX,
    footerY,
    `+${snapshot.allClearReward}`,
    9712,
  ).setAlpha(snapshot.allComplete ? 0.58 : 1);
  layer.add([footerDivider, footerTitle, footerProgress, footerReward]);

  if (showStreak) {
    const streak = scene.add.text(width / 2, centerY - 121, copy.streak({
      streak: snapshot.currentStreak,
      total: snapshot.totalCompletedDays,
    }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "14px",
      color: "#846648",
      fontStyle: "600",
    }).setOrigin(0.5);
    fitSingleLine(streak, 300, 11);
    layer.add(streak);
  }

  const cleanup = (notify = false) => {
    if (!scene.dailyMissionPopup) return;
    scene.input.off("pointerdown", close);
    layer.destroy(true);
    backdrop.cleanup();
    rewardTimer?.remove(false);
    rewardLine?.destroy(true);
    scene.dailyMissionPopup = null;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    if (notify) options.onClose?.(getDailyMissionSnapshot());
  };
  const close = () => {
    playFeedback("ui");
    cleanup(true);
  };
  const onShutdown = () => cleanup(false);
  scene.input.once("pointerdown", close);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

  scene.dailyMissionPopup = {
    close,
    layer,
    backdrop,
    snapshot,
  };
  if (snapshot.claimedTotal > 0) {
    options.onReward?.(snapshot);
    rewardTimer = scene.time.delayedCall(180, () => {
      rewardTimer = null;
      rewardLine = showRewardLine(scene, copy.reward(snapshot.claimedTotal), {
        y: centerY + 235,
        hold: 2200,
        depth: 9740,
        particleScale: 1.45,
        feedbackType: "reward",
      });
    });
  }
  return scene.dailyMissionPopup;
}

function fitSingleLine(text, maxWidth, minFontSize) {
  if (text.width <= maxWidth) return text;
  const currentFontSize = Number.parseFloat(text.style.fontSize) || minFontSize;
  const fittedFontSize = Math.max(
    minFontSize,
    Math.floor(currentFontSize * (maxWidth / text.width)),
  );
  text.setFontSize(fittedFontSize);
  return text;
}
