import { createPieceView } from "../pieceStyles.js?v=20260715-mobile09";
import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260715-mobile09";
import {
  AI_DIFFICULTIES,
  DEFAULT_AI_DIFFICULTY,
  getSkinUnlockState,
  isSkinUnlocked,
  readPlayerState,
  SKIN_SHOP,
  unlockSkin,
} from "../playerState.js?v=20260715-mobile09";
import { skinName, t } from "../i18n.js?v=20260715-mobile09";
import {
  addBackButton,
  addCoinPill,
  createModalBackdrop,
  addFooter,
  addLargeTextButton,
  addLock,
  addMiniCoin,
  addPageTitle,
  addPanel,
  addScreenBg,
  addSettingsButton,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
  showRewardLine,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260715-mobile09";

const SHOP = SKIN_SHOP;

const DIFFICULTY_COPY = {
  ko: {
    title: "AI 난이도 선택",
    guide: "대전 할 AI의 수준을 고르세요.",
    cancel: "취소",
    start: "시작",
    reward: "승리보상",
    easy: { audience: "초보자", name: "쉬움" },
    normal: { audience: "일반인", name: "보통" },
    hard: { audience: "고수", name: "어려움" },
  },
  en: {
    title: "AI DIFFICULTY",
    guide: "Choose the strength of your opponent.",
    cancel: "CANCEL",
    start: "START",
    reward: "WIN REWARD",
    easy: { audience: "BEGINNER", name: "EASY" },
    normal: { audience: "PLAYER", name: "NORMAL" },
    hard: { audience: "EXPERT", name: "HARD" },
  },
  ja: {
    title: "AI難易度選択",
    guide: "対戦するAIの強さを選んでください。",
    cancel: "キャンセル",
    start: "開始",
    reward: "勝利報酬",
    easy: { audience: "初心者", name: "かんたん" },
    normal: { audience: "一般", name: "ふつう" },
    hard: { audience: "上級者", name: "むずかしい" },
  },
};

export class PieceSelectAI extends Phaser.Scene {
  constructor() {
    super("PieceSelectAI");
  }

  init() {
    this._sceneRun = (this._sceneRun || 0) + 1;
    this._startingGame = false;
    this.difficultyModalLayer = null;
    this.purchaseLayer = null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._sceneRun += 1;
      this._startingGame = false;
    });
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this, "bg_select");
    this.refreshCoins();
    addSettingsButton(this, () => showSettingsPanel(this));
    addPageTitle(this, t("select.aiTitle"), t("select.aiSubtitle"), 68);

    const savedSkin = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.playerColor = this.registry.get("playerColor") || "w";
    this.playerSkin = savedSkin[this.playerColor] || "classic";
    if (!this.isUnlocked(this.playerSkin, this.playerColor)) this.playerSkin = "classic";
    const savedDifficulty = this.registry.get("aiDifficulty");
    this.aiDifficulty = AI_DIFFICULTIES[savedDifficulty] ? savedDifficulty : DEFAULT_AI_DIFFICULTY;
    this.registry.set("aiDifficulty", this.aiDifficulty);
    this.listLayer = null;
    this.message = null;
    this.renderList();

    addBackButton(this, () => this.scene.start("Start"), 67, height - 68);
    addLargeTextButton(this, width / 2, 1129, t("select.startAI"), "", () => this.showDifficultyModal(savedSkin), {
      width: 447,
      height: 108,
      fontSize: 43,
      titleFontFamily: KUMA_FONT_SERIF,
      titleFontStyle: "700",
      titleColor: "#342B1F",
      depth: 120,
    });
    addFooter(this, true);
  }

  async startGame(savedSkin) {
    if (this._startingGame) return;
    this._startingGame = true;
    const sceneRun = this._sceneRun;
    let loading = null;
    try {
      const aiColor = this.playerColor === "w" ? "b" : "w";
      const availableAI = SHOP.filter((skin) => this.isUnlocked(skin.id, aiColor));
      const aiSkin = (Phaser.Utils.Array.GetRandom(availableAI) || SHOP[0]).id;
      const skins = { w: savedSkin.w || "classic", b: savedSkin.b || "classic" };
      skins[this.playerColor] = this.playerSkin;
      skins[aiColor] = aiSkin;
      loading = this.add.text(this.scale.width / 2, 1068, "LOADING...", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "17px",
        color: KUMA_COLORS.ink,
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(160);
      await ensurePieceSetsLoaded(this, [
        { skin: skins.w, color: "w" },
        { skin: skins.b, color: "b" },
      ]);
      if (sceneRun !== this._sceneRun || !this.scene.isActive()) return;
      this.registry.set("gameMode", "ai");
      this.registry.set("aiDifficulty", this.aiDifficulty);
      this.registry.set("playerColor", this.playerColor);
      this.registry.set("pieceSkin", skins);
      this.scene.start("Game");
    } catch (error) {
      if (this.scene.isActive()) {
        showRewardLine(this, t("select.loadFailed"), {
          tone: "failure",
          showCoin: false,
        });
      }
    } finally {
      loading?.destroy();
      this._startingGame = false;
    }
  }

  renderList() {
    this.listLayer?.destroy();
    const { width } = this.scale;
    this.listLayer = this.add.container(0, 0).setDepth(50);
    const leftX = 197;
    const rightX = width - 197;
    const rowTop = 223;
    const rowGap = 93;
    SHOP.forEach((skin, i) => {
      const y = rowTop + i * rowGap;
      this.drawSkinRow(leftX, y, 320, skin, "w");
      this.drawSkinRow(rightX, y, 320, skin, "b");
    });
  }

  drawSkinRow(cx, cy, width, skin, color) {
    const unlockState = getSkinUnlockState(skin.id, color);
    const unlocked = unlockState.unlocked;
    const selected = unlocked && this.playerColor === color && this.playerSkin === skin.id;
    const colorName = t(`color.${color}`);
    const alpha = unlocked ? 1 : 0.34;
    const hitW = width;
    const hitH = 92;

    if (selected) {
      const frame = this.add.graphics();
      frame.fillStyle(0xfff8ef, 0.18);
      frame.fillRoundedRect(cx - hitW / 2, cy - hitH / 2, hitW, hitH, 10);
      frame.lineStyle(3, 0xf0cf82, 1);
      frame.strokeRoundedRect(cx - hitW / 2, cy - hitH / 2, hitW, hitH, 10);
      this.listLayer.add(frame);
    }

    const hit = this.add.rectangle(cx, cy, hitW, hitH, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.handlePick(skin, color));

    const iconSize = 60;
    const icon = createPieceView(this, cx - hitW / 2 + 42, cy, iconSize, skin.id, color, "k");
    icon.setAlpha(alpha);
    icon.setDepth(55 + (cy / 1000));
    const label = this.add.text(cx - hitW / 2 + 85, cy - (unlocked ? 0 : 12), `${colorName} ${skinName(skin)}`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: selected ? KUMA_COLORS.teal : KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0, 0.5).setAlpha(alpha);
    this.listLayer.add([hit, icon, label]);

    if (!unlocked) {
      const affordable = unlockState.purchasable && readPlayerState().coins >= unlockState.cost;
      const lock = addLock(this, cx - hitW / 2 + 42, cy + 10, 32, 80);
      this.listLayer.add(lock);
      if (unlockState.purchasable) {
        const coin = addMiniCoin(this, cx - hitW / 2 + 85, cy + 24, unlockState.cost, 80);
        coin.setAlpha(affordable ? 1 : alpha);
        this.listLayer.add(coin);
      } else {
        const quest = this.add.text(cx - hitW / 2 + 85, cy + 24, unlockState.questLabel, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "16px",
          color: KUMA_COLORS.ink,
          fontStyle: "500",
        }).setOrigin(0, 0.5).setAlpha(0.78);
        this.listLayer.add(quest);
      }
    }
  }

  handlePick(skin, color) {
    const unlockState = getSkinUnlockState(skin.id, color);
    if (!unlockState.unlocked && unlockState.purchasable) {
      this.showPurchaseModal(skin, color);
      return;
    }
    if (!unlockState.unlocked) return;
    this.playerColor = color;
    this.playerSkin = skin.id;
    this.renderList();
  }

  showPurchaseModal(skin, color) {
    if (this.purchaseLayer) return;
    const unlockState = getSkinUnlockState(skin.id, color);
    if (!unlockState.purchasable) return;
    const cost = unlockState.cost;
    const { width, height } = this.scale;
    const backdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.purchaseLayer = layer;
    const modalCoins = addCoinPill(this, 34, 34, 10020);
    const panelW = Math.min(514, width * 0.86);
    const panelH = 447;
    const px = width / 2;
    const py = height / 2;
    const panel = addPanel(this, px, py, panelW, panelH, 10001);
    const title = this.add.text(px, py - 112, t("select.purchase"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(10002);
    const divider = this.add.rectangle(px, py - 76, panelW * 0.72, 2, 0xc69d72).setDepth(10002);
    const preview = createPieceView(this, px, py - 28, 72, skin.id, color, "k");
    preview.setDepth(10002);
    const colorName = t(`color.${color}`);
    const localizedSkin = skinName(skin);
    const message = this.add.text(px, py + 52, t("select.purchaseMessage", {
      cost,
      color: colorName,
      skin: localizedSkin,
    }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "24px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(10002);
    const close = () => {
      modalCoins.destroy();
      backdrop.cleanup();
      layer.destroy();
      this.purchaseLayer = null;
    };
    const cancel = addLargeTextButton(this, px - 105, py + 143, t("common.cancel"), "", close, {
      width: 187,
      height: 81,
      fontSize: 24,
      depth: 10002,
    });
    const buy = addLargeTextButton(this, px + 105, py + 143, t("common.buy"), "", () => {
      const result = unlockSkin(skin.id, color);
      this.refreshCoins();
      close();
      if (!result.ok) {
        showRewardLine(this, t("select.notEnough", { coins: result.coins, cost }), {
          tone: "failure",
          showCoin: false,
        });
        return;
      }
      this.playerColor = color;
      this.playerSkin = skin.id;
      this.renderList();
      showRewardLine(this, t("select.purchased", { color: colorName, skin: localizedSkin }), {
        showCoin: false,
        particleScale: 1.3,
        feedbackType: "purchase",
      });
    }, {
      width: 195,
      height: 81,
      fontSize: 24,
      dark: true,
      depth: 10002,
    });
    layer.add([panel, title, divider, preview, message, cancel.button, cancel.title, buy.button, buy.title]);
  }

  isUnlocked(skinId, color) {
    return isSkinUnlocked(skinId, color);
  }

  showDifficultyModal(savedSkin) {
    if (this.difficultyModalLayer || this._startingGame) return;
    const { width, height } = this.scale;
    const language = readPlayerState().language;
    const copy = DIFFICULTY_COPY[language] || DIFFICULTY_COPY.ko;
    const px = width / 2;
    const py = height / 2 + 4;
    const panelW = Math.min(527, width * 0.82);
    const panelH = 660;
    let selectedDifficulty = this.aiDifficulty;
    const backdrop = createModalBackdrop(this, 9990);
    const layer = this.add.container(0, 0).setDepth(10000);
    this.difficultyModalLayer = layer;

    const panel = addPanel(this, px, py, panelW, panelH, 10001);
    const title = this.add.text(px, py - 201, copy.title, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: KUMA_COLORS.ink,
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(10002);
    const divider = this.add.rectangle(px, py - 175, panelW * 0.72, 2, 0xc69d72)
      .setDepth(10002);
    const guide = this.add.text(px, py - 112, copy.guide, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: language === "en" ? "21px" : "23px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
      align: "center",
    }).setOrigin(0.5).setDepth(10002);
    const cards = this.add.container(0, 0).setDepth(10003);
    layer.add([panel, title, divider, guide, cards]);

    const renderCards = () => {
      cards.removeAll(true);
      ["easy", "normal", "hard"].forEach((id, index) => {
        const x = [px - 127, px, px + 127][index];
        const y = py + 45;
        const selected = id === selectedDifficulty;
        const box = this.add.graphics();
        box.fillStyle(selected ? 0xfff0c0 : 0xfff8e9, selected ? 0.62 : 0.42);
        box.fillRoundedRect(x - 60, y - 110, 120, 220, 7);
        box.lineStyle(2, selected ? 0xd2a55f : 0xc49f78, 1);
        box.strokeRoundedRect(x - 60, y - 110, 120, 220, 7);
        box.setInteractive(
          new Phaser.Geom.Rectangle(x - 60, y - 110, 120, 220),
          Phaser.Geom.Rectangle.Contains
        );
        box.input.cursor = "pointer";
        box.on("pointerdown", () => {
          selectedDifficulty = id;
          renderCards();
        });
        const audience = this.add.text(x, y - 85, copy[id].audience, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: language === "en" ? "14px" : "16px",
          color: selected ? KUMA_COLORS.teal : "#846f59",
          fontStyle: "500",
        }).setOrigin(0.5);
        const name = this.add.text(x, y - 2, copy[id].name, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: language === "en" ? "23px" : "25px",
          color: selected ? KUMA_COLORS.teal : KUMA_COLORS.ink,
          fontStyle: "900",
        }).setOrigin(0.5);
        const reward = this.add.text(x, y + 72, copy.reward, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: language === "en" ? "12px" : "14px",
          color: "#846f59",
          fontStyle: "500",
        }).setOrigin(0.5);
        const coin = this.add.image(x - 15, y + 94, "kuma_ui_coin_small").setDisplaySize(18, 18);
        const amount = this.add.text(x - 2, y + 94, `+${AI_DIFFICULTIES[id].reward}`, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "17px",
          color: KUMA_COLORS.ink,
          fontStyle: "700",
        }).setOrigin(0, 0.5);
        cards.add([box, audience, name, reward, coin, amount]);
      });
    };

    const close = () => {
      backdrop.cleanup();
      layer.destroy();
      this.difficultyModalLayer = null;
    };
    const cancel = addLargeTextButton(this, px - 106, py + 239, copy.cancel, "", close, {
      width: 187,
      height: 81,
      fontSize: 24,
      depth: 10004,
    });
    const start = addLargeTextButton(this, px + 103, py + 239, copy.start, "", () => {
      this.aiDifficulty = selectedDifficulty;
      this.registry.set("aiDifficulty", selectedDifficulty);
      close();
      this.startGame(savedSkin);
    }, {
      width: 195,
      height: 81,
      fontSize: 24,
      dark: true,
      depth: 10004,
    });
    layer.add([cancel.button, cancel.title, start.button, start.title]);
    renderCards();
  }

  refreshCoins() {
    this.coinGroup?.destroy();
    this.coinGroup = addCoinPill(this, 34, 34);
  }
}
