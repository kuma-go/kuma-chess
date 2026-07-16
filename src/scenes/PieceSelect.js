import { createPieceView } from "../pieceStyles.js?v=20260716-mobile25";
import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260716-mobile25";
import {
  getSkinUnlockState,
  isSkinUnlocked,
  readPlayerState,
  SKIN_SHOP,
  unlockSkin,
} from "../playerState.js?v=20260716-mobile25";
import { skinName, t } from "../i18n.js?v=20260716-mobile25";
import { SpriteButton } from "../ui/SpriteButton.js?v=20260716-mobile25";
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
} from "../ui/KumaUi.js?v=20260716-mobile25";

const SHOP = SKIN_SHOP;

export class PieceSelect extends Phaser.Scene {
  constructor() {
    super("PieceSelect");
  }

  init() {
    this._sceneRun = (this._sceneRun || 0) + 1;
    this._startingGame = false;
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
    addPageTitle(this, t("select.title"), t("select.subtitle"), 68);

    const saved = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skinW = this.isUnlocked(saved.w, "w") ? saved.w : "classic";
    this.skinB = this.isUnlocked(saved.b, "b") ? saved.b : "classic";
    this.listLayer = null;
    this.message = null;

    this.renderList();

    addBackButton(this, () => this.scene.start("Start"), 67, height - 68);
    addLargeTextButton(this, width / 2, 1129, t("select.start"), "", () => this.startGame(), {
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

  async startGame() {
    if (this._startingGame) return;
    this._startingGame = true;
    const sceneRun = this._sceneRun;
    let loading = null;
    try {
      loading = this.add.text(this.scale.width / 2, 1068, "LOADING...", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "17px",
        color: KUMA_COLORS.ink,
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(160);
      await ensurePieceSetsLoaded(this, [
        { skin: this.skinW, color: "w" },
        { skin: this.skinB, color: "b" },
      ]);
      if (sceneRun !== this._sceneRun || !this.scene.isActive()) return;
      this.registry.set("gameMode", "pvp");
      this.registry.set("pieceSkin", { w: this.skinW, b: this.skinB });
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
    const selected = unlocked && (color === "w" ? this.skinW === skin.id : this.skinB === skin.id);
    const colorName = t(`color.${color}`);
    const alpha = unlocked ? 1 : 0.34;
    const hitW = width;
    const hitH = 92;

    const selectedFrame = this.add.graphics();
    if (selected) {
      selectedFrame.fillStyle(0xfff8ef, 0.18);
      selectedFrame.fillRoundedRect(cx - hitW / 2, cy - hitH / 2, hitW, hitH, 10);
      selectedFrame.lineStyle(3, 0xf0cf82, 1);
      selectedFrame.strokeRoundedRect(cx - hitW / 2, cy - hitH / 2, hitW, hitH, 10);
      this.listLayer.add(selectedFrame);
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
    if (color === "w") this.skinW = skin.id;
    else this.skinB = skin.id;
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
      if (color === "w") this.skinW = skin.id;
      else this.skinB = skin.id;
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

  refreshCoins() {
    this.coinGroup?.destroy();
    this.coinGroup = addCoinPill(this, 34, 34);
  }
}
