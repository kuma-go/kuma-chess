import {
  claimDailyReward,
  grantCoinsOnce,
  readPlayerState,
  REWARDS,
  SKIN_SHOP,
} from "../playerState.js?v=20260719-medals35";
import { hasNewMedals, syncContextMedals } from "../medals.js?v=20260719-medals35";
import { setTopAdVisible } from "../adManager.js?v=20260719-medals35";
import { t } from "../i18n.js?v=20260719-medals35";
import {
  addCoinPill,
  addLargeTextButton,
  addSettingsButton,
  createModalBackdrop,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
  showInstallGuide,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260719-medals35";
import { playFeedback } from "../feedback.js?v=20260719-medals35";
import { showPlayInfoPopup } from "../ui/PlayInfoPopup.js?v=20260719-medals35";
import { showMedalAwardSequence } from "../ui/MedalAward.js?v=20260719-medals35";

const BUTTONS = [
  { y: 873, labelKey: "start.puzzle", subKey: "start.puzzleSub", scene: "PuzzleSelect", mode: null },
  { y: 1001, labelKey: "start.ai", subKey: "start.aiSub", scene: "PieceSelectAI", mode: "ai" },
  { y: 1129, labelKey: "start.pvp", subKey: "start.pvpSub", scene: "PieceSelect", mode: "pvp" },
];

export class Start extends Phaser.Scene {
  constructor() {
    super("Start");
    this.coinGroup = null;
  }

  create() {
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
        if (item.mode) this.registry.set("gameMode", item.mode);
        this.scene.start(item.scene);
      }, {
        width: 447,
        height: 108,
        fontSize: 43,
        subFontSize: 16,
        titleFontFamily: KUMA_FONT_SERIF,
        titleFontStyle: "700",
        subFontStyle: "500",
        titleColor: "#342B1F",
        titleOffsetY: -8,
        subOffsetY: 23,
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
      ownedSkinCount: latestState.unlockedSkinColors.length,
      totalSkinCount: SKIN_SHOP.length * 2,
    });
    this.addMedalButton();
    if (medalSync.newlyUnlocked.length) {
      this.time.delayedCall(reward.claimed ? 2850 : 650, () => {
        showMedalAwardSequence(this, medalSync.newlyUnlocked, { y: this.scale.height * 0.48 });
      });
    }
  }

  refreshCoins() {
    this.coinGroup?.destroy();
    this.coinGroup = addCoinPill(this, 34, 36);
  }

  addPlayInfoButton() {
    const x = this.scale.width - 67;
    const button = this.add.image(x, 139, "kuma_ui_btn_rank")
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
      const y = 291;
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
