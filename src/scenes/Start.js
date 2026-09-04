import {
  claimDailyReward,
  getPieceUnlockNotices,
  getCollectionSkinColorTotal,
  getOwnedCollectionSkinColorCount,
  grantCoinsOnce,
  readPlayerState,
  REWARDS,
} from "../playerState.js?v=20260904-accountpopup108";
import { hasNewMedals, markMedalsSeen, syncContextMedals } from "../medals.js?v=20260904-accountpopup108";
import { getDailyMissionSnapshot } from "../dailyMissions.js?v=20260904-accountpopup108";
import { setTopAdVisible } from "../adManager.js?v=20260904-accountpopup108";
import { t } from "../i18n.js?v=20260904-accountpopup108";
import {
  addCoinPill,
  addLargeTextButton,
  addPanel,
  addSettingsButton,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
  showInstallGuide,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260904-accountpopup108";
import { playFeedback } from "../feedback.js?v=20260904-accountpopup108";
import { showPlayInfoPopup } from "../ui/PlayInfoPopup.js?v=20260904-accountpopup108";
import { showProfileEditorPopup } from "../ui/ProfileEditorPopup.js?v=20260904-accountpopup108";
import { showMedalAwardSequence } from "../ui/MedalAward.js?v=20260904-accountpopup108";
import { showDailyMissionPopup } from "../ui/DailyMissionPopup.js?v=20260904-accountpopup108";
import { pieceUnlockSequenceDuration, showPieceUnlockNoticeSequence } from "../ui/PieceUnlockLine.js?v=20260904-accountpopup108";

const BUTTONS = [
  { y: 704, labelKey: "start.puzzle", subKey: "start.puzzleSub", scene: "PuzzleSelect", mode: null },
  { y: 764, labelKey: "start.ai", subKey: "start.aiSub", scene: "PieceSelectAI", mode: "ai" },
  { y: 824, labelKey: "start.tug", subKey: "start.tugSub", action: "tug", fontSize: 23 },
  { y: 884, labelKey: "start.road", subKey: "start.roadSub", action: "road", fontSize: 23 },
  { y: 944, labelKey: "start.roadPuzzle", subKey: "start.roadPuzzleSub", scene: "RoyalRoadPuzzleSelect", fontSize: 23 },
  { y: 1004, labelKey: "start.crown", subKey: "start.crownSub", action: "crown", fontSize: 23 },
  { y: 1064, labelKey: "start.siege", subKey: "start.siegeSub", action: "siege", fontSize: 23 },
  { y: 1124, labelKey: "start.pvp", subKey: "start.pvpSub", scene: "PieceSelect", mode: "pvp" },
];

export class Start extends Phaser.Scene {
  constructor() {
    super("Start");
    this.coinGroup = null;
  }

  create(data = {}) {
    if (window.KumaEmbeddedRuntime?.isEmbedded) {
      this.createEmbeddedHost(data);
      return;
    }
    const { width, height } = this.scale;
    const state = readPlayerState();
    this.sound.mute = !state.soundEnabled;
    setTopAdVisible(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTopAdVisible(false));

    this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0).setDepth(-20);
    this.add.image(width / 2, 1066, "kuma_ui_main_bottom_bg")
      .setDisplaySize(width, 428)
      .setDepth(-10);
    const logoLayer = this.add.container(width / 2, 220).setDepth(3);
    const logoWidth = 652 * (2 / 3);
    const logoHeight = 430 * (2 / 3);
    const logo = this.add.image(0, 0, "kuma_ui_main_logo_B").setDisplaySize(logoWidth, logoHeight);
    const logoGlow = this.add.image(0, 0, "kuma_ui_main_logo_B")
      .setDisplaySize(logoWidth, logoHeight)
      .setTint(0xffe8a3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    logoLayer.add([logo, logoGlow]);
    this.tweens.add({
      targets: logoLayer,
      y: 214,
      duration: 2400,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: logoLayer,
      scaleX: 1.006,
      scaleY: 1.006,
      duration: 3000,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: logoGlow,
      alpha: 0.24,
      duration: 560,
      delay: 2200,
      hold: 120,
      yoyo: true,
      repeat: -1,
      repeatDelay: 4600,
      ease: "Sine.InOut",
    });
    this.add.image(width / 2, 622, "kuma_ui_main_img")
      .setDisplaySize(width, 540)
      .setDepth(2);
    this.refreshCoins();
    addSettingsButton(this, () => showSettingsPanel(this));
    this.addPlayInfoButton();
    this.addDailyMissionButton();
    this.addInstallButton();
    const consumeInstallReward = () => {
      if (!this.scene.isActive() || !window.KumaInstall?.consumeVerifiedInstall?.()) return;
      const reward = grantCoinsOnce("pwa-install-v1", REWARDS.install);
      if (!reward.awarded) return;
      this.refreshCoins();
      showRewardLine(this, t("install.rewardReceived", { amount: reward.amount }), {
        y: this.scale.height * 0.5,
        hold: 2400,
      });
    };
    window.addEventListener("kuma-install-state-changed", consumeInstallReward);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("kuma-install-state-changed", consumeInstallReward);
    });
    consumeInstallReward();

    for (const item of BUTTONS) {
      addLargeTextButton(this, width / 2, item.y, t(item.labelKey), t(item.subKey), () => {
        if (item.action === "tug") {
          this.showTugModePanel();
          return;
        }
        if (item.action === "road") {
          this.showRoadModePanel();
          return;
        }
        if (item.action === "crown") {
          this.showCrownModePanel();
          return;
        }
        if (item.action === "siege") {
          this.showSiegeModePanel();
          return;
        }
        this.registry.set("pieceSelectTargetScene", "Game");
        if (item.mode) this.registry.set("gameMode", item.mode);
        this.scene.start(item.scene);
      }, {
        width: 447,
        height: 54,
        fontSize: item.fontSize ?? 27,
        subFontSize: 12,
        titleFontFamily: KUMA_FONT_SERIF,
        titleFontStyle: "700",
        subFontStyle: "500",
        titleColor: "#342B1F",
        titleOffsetY: -5,
        subOffsetY: 15,
        depth: 100,
      });
    }

    this.addDocumentLinks(state.language);

    const reward = claimDailyReward();
    if (reward.claimed) {
      this.refreshCoins();
      this.drawRewardToast(t("reward.daily", { amount: reward.amount }));
    }
    const latestState = readPlayerState();
    const medalSync = syncContextMedals({
      coins: latestState.coins,
      ownedSkinCount: getOwnedCollectionSkinColorCount(latestState),
      totalSkinCount: getCollectionSkinColorTotal(),
    });
    const pieceUnlockNotices = getPieceUnlockNotices();
    this.addMedalButton();
    const pieceNoticeDelay = reward.claimed ? 2850 : 650;
    if (pieceUnlockNotices.length) {
      this.time.delayedCall(pieceNoticeDelay, () => {
        showPieceUnlockNoticeSequence(this, pieceUnlockNotices, { y: this.scale.height * 0.5 });
      });
    }
    if (medalSync.newlyUnlocked.length) {
      const medalDelay = pieceNoticeDelay
        + (pieceUnlockNotices.length ? pieceUnlockSequenceDuration(pieceUnlockNotices) + 150 : 0);
      this.time.delayedCall(medalDelay, async () => {
        const confirmedIds = await showMedalAwardSequence(this, medalSync.newlyUnlocked, { y: this.scale.height * 0.48 });
        if (confirmedIds.length) markMedalsSeen(confirmedIds);
      });
    }
    this.consumeWebLaunch();
  }

  createEmbeddedHost(data = {}) {
    const { width, height } = this.scale;
    setTopAdVisible(false);
    const launch = data.embeddedLaunch || "";
    const usesWebBackdrop = ["info", "profile", "settings", "daily"].includes(launch);
    if (usesWebBackdrop) this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    else this.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0).setDepth(-20);

    if (data.embeddedIdle || launch === "preload") return;
    if (launch === "info") {
      this.time.delayedCall(0, () => {
        if (!this.scene.isActive()) return;
        showPlayInfoPopup(this, {
          externalBackdrop: true,
          onClose: () => window.KumaEmbeddedRuntime?.returnHome(),
        });
      });
      return;
    }
    if (launch === "profile") {
      this.time.delayedCall(0, () => {
        if (!this.scene.isActive()) return;
        showProfileEditorPopup(this, {
          externalBackdrop: true,
          onClose: () => window.KumaEmbeddedRuntime?.returnHome(),
        });
      });
      return;
    }
    if (launch === "settings") {
      this.time.delayedCall(0, () => {
        if (!this.scene.isActive()) return;
        showSettingsPanel(this, {
          externalBackdrop: true,
          onClose: () => window.KumaEmbeddedRuntime?.returnHome(),
        });
      });
      return;
    }
    if (launch === "daily") {
      this.time.delayedCall(0, () => {
        if (!this.scene.isActive()) return;
        showDailyMissionPopup(this, {
          externalBackdrop: true,
          onClose: () => window.KumaEmbeddedRuntime?.returnHome(),
        });
      });
      return;
    }

    window.KumaEmbeddedRuntime?.returnHome();
  }

  consumeWebLaunch() {
    const url = new URL(window.location.href);
    const launch = url.searchParams.get("launch");
    if (!launch) return;
    url.searchParams.delete("launch");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    this.time.delayedCall(180, () => {
      if (!this.scene.isActive()) return;
      if (launch === "tug") return this.showTugModePanel();
      if (launch === "road") return this.showRoadModePanel();
      if (launch === "crown") return this.showCrownModePanel();
      if (launch === "siege") return this.showSiegeModePanel();
      if (launch === "road-puzzle") return this.scene.start("RoyalRoadPuzzleSelect");
      if (launch === "info") return showPlayInfoPopup(this);
      if (launch === "profile") return showProfileEditorPopup(this);
      if (launch === "settings") return showSettingsPanel(this);
      if (launch === "daily") {
        return showDailyMissionPopup(this, {
          onReward: () => this.refreshCoins(),
          onClose: () => {
            this.refreshCoins();
            this.addDailyMissionButton();
          },
        });
      }
      if (launch === "puzzle") return this.scene.start("PuzzleSelect");
      if (launch === "ai" || launch === "pvp") {
        this.registry.set("pieceSelectTargetScene", "Game");
        this.registry.set("gameMode", launch);
        return this.scene.start(launch === "ai" ? "PieceSelectAI" : "PieceSelect");
      }
    });
  }

  refreshCoins() {
    this.coinGroup?.destroy();
    this.coinGroup = addCoinPill(this, 34, 36);
  }

  showTugModePanel() {
    this.showMiniGameModePanel({
      titleKey: "tug.modeTitle",
      guideKey: "tug.modeGuide",
      targetScene: "KingdomTug",
      aiKey: "tug.aiMode",
      pvpKey: "tug.pvpMode",
    });
  }

  showRoadModePanel() {
    this.showMiniGameModePanel({
      titleKey: "road.modeTitle",
      guideKey: "road.modeGuide",
      targetScene: "RoyalRoad",
      aiKey: "road.aiMode",
      pvpKey: "road.pvpMode",
    });
  }

  showCrownModePanel() {
    this.showMiniGameModePanel({
      titleKey: "crown.modeTitle",
      guideKey: "crown.modeGuide",
      targetScene: "CrownClash",
      aiKey: "crown.aiMode",
      pvpKey: "crown.pvpMode",
    });
  }

  showSiegeModePanel() {
    this.showMiniGameModePanel({
      titleKey: "siege.modeTitle",
      guideKey: "siege.modeGuide",
      targetScene: "KingdomSiege",
      aiKey: "siege.aiMode",
      pvpKey: "siege.pvpMode",
    });
  }

  showMiniGameModePanel({ titleKey, guideKey, targetScene, aiKey, pvpKey, soloKey = null, soloScene = null }) {
    if (this.miniGameModeLayer) return;
    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 1700);
    const layer = this.add.container(0, 0).setDepth(1710);
    this.miniGameModeLayer = { layer, backdrop };
    const panel = addPanel(this, width / 2, height / 2, 540, soloKey ? 570 : 470, 1711);
    const title = this.add.text(width / 2, height / 2 - 136, t(titleKey), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "34px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(1712);
    const guide = this.add.text(width / 2, height / 2 - 84, t(guideKey), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color: "#80644a",
      fontStyle: "600",
      align: "center",
      wordWrap: { width: 430, useAdvancedWrap: true },
    }).setOrigin(0.5).setDepth(1712);

    const cleanup = () => {
      this.miniGameModeLayer = null;
      layer.destroy(true);
      backdrop.cleanup();
    };
    const start = (mode) => {
      cleanup();
      this.registry.set("pieceSelectTargetScene", targetScene);
      this.registry.set("gameMode", mode);
      this.scene.start(mode === "ai" ? "PieceSelectAI" : "PieceSelect");
    };
    const solo = soloKey ? addLargeTextButton(this, width / 2, height / 2 - 4, t(soloKey), "", () => {
      cleanup();
      this.scene.start(soloScene);
    }, { width: 360, height: 72, fontSize: 25, depth: 1714 }) : null;
    const ai = addLargeTextButton(this, width / 2, height / 2 + (soloKey ? 78 : 2), t(aiKey), "", () => start("ai"), {
      width: 360,
      height: 78,
      fontSize: 27,
      depth: 1714,
    });
    const pvp = addLargeTextButton(this, width / 2, height / 2 + (soloKey ? 160 : 92), t(pvpKey), "", () => start("pvp"), {
      width: 360,
      height: 78,
      fontSize: 27,
      dark: true,
      depth: 1714,
    });
    const cancel = addLargeTextButton(this, width / 2, height / 2 + (soloKey ? 242 : 182), t("common.cancel"), "", cleanup, {
      width: 260,
      height: 64,
      fontSize: 23,
      depth: 1714,
    });
    layer.add([
      panel, title, guide,
      ...(solo ? [solo.button, solo.title] : []),
      ai.button, ai.title,
      pvp.button, pvp.title,
      cancel.button, cancel.title,
    ]);
  }

  addPlayInfoButton() {
    const x = this.scale.width - 67;
    const button = this.add.image(x, 139, "kuma_ui_btn_my")
      .setDisplaySize(67, 67)
      .setDepth(930);
    const hit = this.add.circle(x, 139, 36, 0xffffff, 0.001)
      .setDepth(931)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => showPlayInfoPopup(this));
  }

  addMedalButton() {
    const x = this.scale.width - 67;
    const y = 215;
    this.medalButtonGroup?.destroy();
    const group = this.add.container(x, y).setDepth(930);
    this.medalButtonGroup = group;
    const button = this.add.image(0, 0, "kuma_ui_btn_medal").setDisplaySize(67, 67);
    const hit = this.add.circle(0, 0, 36, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      playFeedback("ui");
      if (this.scene.isActive("MedalCatalog")) return;
      this.medalCatalogBackdrop = createModalBackdrop(this, 940);
      this.scene.launch("MedalCatalog", { parentSceneKey: this.scene.key });
      this.scene.pause();
    });
    group.add([button, hit]);
    if (!hasNewMedals()) return;
    const badge = this.add.image(25, 24, "kuma_ui_icon_new").setDisplaySize(22, 29);
    group.add(badge);
  }

  refreshMedalButton() {
    if (!this.scene.isActive()) return;
    this.addMedalButton();
  }

  addDailyMissionButton() {
    const x = 67;
    const y = 139;
    const snapshot = getDailyMissionSnapshot();
    const completedCount = snapshot.missions.filter((mission) => mission.complete).length;
    if (this.dailyMissionButtonGroup?.list) {
      this.tweens.killTweensOf(this.dailyMissionButtonGroup.list);
    }
    this.dailyMissionButtonGroup?.destroy();
    const group = this.add.container(x, y).setDepth(930);
    this.dailyMissionButtonGroup = group;
    const hasPendingReward = snapshot.pendingRewardTotal > 0;
    const rewardGlow = hasPendingReward
      ? this.add.circle(0, 0, 44, 0xffd65c, 0.18)
        .setStrokeStyle(4, 0xffc640, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
      : null;
    const rewardRing = hasPendingReward
      ? this.add.circle(0, 0, 34, 0xffffff, 0)
        .setStrokeStyle(3, 0xffffcf, 0.9)
      : null;
    const button = this.add.image(0, 0, "kuma_ui_btn_daily").setDisplaySize(67, 67);
    const hit = this.add.circle(0, 0, 36, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      playFeedback("ui");
      showDailyMissionPopup(this, {
        onReward: () => {
          this.refreshCoins();
        },
        onClose: () => {
          this.refreshCoins();
          this.addDailyMissionButton();
        },
      });
    });
    group.add([
      ...(hasPendingReward ? [rewardGlow, rewardRing] : []),
      button,
      hit,
    ]);
    group.add(this.add.text(0, 47, `${completedCount}/3`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: "#846648",
      fontStyle: "600",
    }).setOrigin(0.5));
    if (hasPendingReward) {
      const rewardBadge = this.add.container(0, -44);
      const badgeBack = this.add.graphics();
      badgeBack.fillStyle(0xfff7dd, 0.96);
      badgeBack.fillRoundedRect(-32, -15, 64, 30, 14);
      badgeBack.lineStyle(2, 0xd8a344, 0.92);
      badgeBack.strokeRoundedRect(-32, -15, 64, 30, 14);
      const coin = this.add.image(-17, 0, "kuma_ui_coin_small").setDisplaySize(20, 20);
      const badgeLabel = this.add.text(-4, 0, `+${Math.min(snapshot.pendingRewardTotal, 99)}`, {
        fontFamily: KUMA_FONT_SANS,
        fontSize: snapshot.pendingRewardTotal >= 10 ? "14px" : "16px",
        color: "#4d3519",
        fontStyle: "900",
      }).setOrigin(0, 0.5);
      rewardBadge.add([badgeBack, coin, badgeLabel]);
      const sparkleLeft = this.add.star(-30, -58, 5, 4, 13, 0xffffd6)
        .setAlpha(0.78)
        .setAngle(45);
      const sparkleRight = this.add.star(28, -31, 5, 3, 9, 0xffd665)
        .setAlpha(0.72)
        .setAngle(45);
      group.add([rewardBadge, sparkleLeft, sparkleRight]);
      this.tweens.add({
        targets: [rewardGlow, rewardRing],
        alpha: { from: 0.28, to: 0.9 },
        scaleX: { from: 0.92, to: 1.2 },
        scaleY: { from: 0.92, to: 1.2 },
        duration: 860,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: rewardBadge,
        y: { from: -46, to: -42 },
        scaleX: { from: 1, to: 1.08 },
        scaleY: { from: 1, to: 1.08 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: [sparkleLeft, sparkleRight],
        alpha: { from: 0.35, to: 1 },
        scaleX: { from: 0.72, to: 1.22 },
        scaleY: { from: 0.72, to: 1.22 },
        angle: { from: 22, to: 68 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        repeatDelay: 420,
        ease: "Sine.InOut",
      });
    }
    if (!snapshot.hasNotice) return;
    group.add(this.add.image(25, 24, "kuma_ui_icon_new").setDisplaySize(22, 29));
  }

  addInstallButton() {
    let group = null;
    const draw = () => {
      const install = window.KumaInstall?.getState();
      const shouldShow = install?.available && !install.standalone;
      if (!shouldShow) {
        group?.destroy();
        group = null;
        return;
      }
      if (group) return;

      const x = this.scale.width - 67;
      const y = 367;
      group = this.add.container(x, y).setDepth(930);
      const button = this.add.image(0, 0, "kuma_ui_btn_install").setDisplaySize(67, 67);
      const alreadyClaimed = readPlayerState().rewardClaims.includes("pwa-install-v1");
      const rewardText = install.rewardEligible && !alreadyClaimed
        ? this.add.text(0, 45, t("install.reward", { amount: REWARDS.install }), {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "13px",
          color: "#846648",
          fontStyle: "500",
          align: "center",
          lineSpacing: 1,
          wordWrap: { width: 112, useAdvancedWrap: true },
        }).setOrigin(0.5, 0)
        : null;
      const hit = this.add.circle(0, 0, 36, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", async () => {
        playFeedback("ui");
        const result = await window.KumaInstall?.request();
        if (!this.scene.isActive()) return;
        if (result?.status === "guide") showInstallGuide(this, result.platform);
        draw();
      });
      group.add([button, hit]);
      if (rewardText) group.add(rewardText);
    };

    window.addEventListener("kuma-install-state-changed", draw);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("kuma-install-state-changed", draw);
      group = null;
    });
    draw();
  }

  addDocumentLinks(language) {
    const labels = {
      ko: ["개인정보처리방침", "게임소개 및 게임방법"],
      en: ["Privacy Policy", "About & How to Play"],
      ja: ["プライバシーポリシー", "ゲーム紹介・遊び方"],
    }[language] || ["개인정보처리방침", "게임소개 및 게임방법"];
    const y = this.scale.height - 55;
    const addLink = (x, text, href) => {
      const link = this.add.text(x, y, text, {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "16px",
        color: "#342b1f",
        fontStyle: "500",
      }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
      link.on("pointerdown", () => {
        window.location.href = href;
      });
      return link;
    };
    addLink(this.scale.width / 2 - 105, labels[0], "./privacy.html");
    addLink(this.scale.width / 2 + 105, labels[1], "./guide.html");
    this.add.text(this.scale.width / 2, y, "/", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "16px",
      color: "#342b1f",
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(100);
    this.add.text(this.scale.width / 2, this.scale.height - 24, "© 2026 koseulki. All Rights Reserved.", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "16px",
      color: "#c3aa8f",
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(100);
  }

  drawRewardToast(message) {
    this.time.delayedCall(450, () => {
      showRewardLine(this, message, { y: this.scale.height * 0.52, hold: 2200 });
    });
  }
}
