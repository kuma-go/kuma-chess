import { claimDailyReward, readPlayerState } from "../playerState.js?v=20260715-domain04";
import { setTopAdVisible } from "../adManager.js?v=20260715-domain04";
import { t } from "../i18n.js?v=20260715-domain04";
import {
  addCoinPill,
  addLargeTextButton,
  addSettingsButton,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260715-domain04";
import { showPlayInfoPopup } from "../ui/PlayInfoPopup.js?v=20260715-domain04";

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
    const hit = this.add.circle(x, 139, 42, 0xffffff, 0.001)
      .setDepth(931)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => showPlayInfoPopup(this));
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
