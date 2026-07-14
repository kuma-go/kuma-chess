import { createPieceView } from "../pieceStyles.js?v=20260714-layout22";
import { isSkinUnlocked, readPlayerState, SKIN_SHOP, unlockSkin } from "../playerState.js";
import { skinName, t } from "../i18n.js?v=20260714-layout22";
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
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260714-layout22";

const SHOP = SKIN_SHOP;

export class PieceSelectAI extends Phaser.Scene {
  constructor() {
    super("PieceSelectAI");
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
    this.listLayer = null;
    this.message = null;
    this.renderList();

    addBackButton(this, () => this.scene.start("Start"), 67, height - 68);
    addLargeTextButton(this, width / 2, 1129, t("select.startAI"), "", () => {
      const aiColor = this.playerColor === "w" ? "b" : "w";
      const availableAI = SHOP.filter((skin) => this.isUnlocked(skin.id, aiColor));
      const aiSkin = (Phaser.Utils.Array.GetRandom(availableAI) || SHOP[0]).id;
      const skins = { w: savedSkin.w || "classic", b: savedSkin.b || "classic" };
      skins[this.playerColor] = this.playerSkin;
      skins[aiColor] = aiSkin;
      this.registry.set("gameMode", "ai");
      this.registry.set("playerColor", this.playerColor);
      this.registry.set("pieceSkin", skins);
      this.scene.start("Game");
    }, {
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
    const unlocked = this.isUnlocked(skin.id, color);
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
      const affordable = readPlayerState().coins >= skin.cost;
      const lock = addLock(this, cx - hitW / 2 + 42, cy + 10, 32, 80);
      const coin = addMiniCoin(this, cx - hitW / 2 + 85, cy + 24, skin.cost, 80);
      coin.setAlpha(affordable ? 1 : alpha);
      this.listLayer.add([lock, coin]);
    }
  }

  handlePick(skin, color) {
    if (!this.isUnlocked(skin.id, color)) {
      this.showPurchaseModal(skin, color);
      return;
    }
    this.playerColor = color;
    this.playerSkin = skin.id;
    this.renderList();
  }

  showPurchaseModal(skin, color) {
    if (this.purchaseLayer) return;
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
      cost: skin.cost,
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
        this.flash(t("select.notEnough", { coins: result.coins, cost: skin.cost }), "#9b2d20");
        return;
      }
      this.playerColor = color;
      this.playerSkin = skin.id;
      this.renderList();
      this.flash(t("select.purchased", { color: colorName, skin: localizedSkin }), KUMA_COLORS.teal);
    }, {
      width: 195,
      height: 81,
      fontSize: 24,
      dark: true,
      depth: 10002,
    });
    layer.add([panel, title, divider, preview, message, cancel.button, cancel.title, buy.button, buy.title]);
  }

  flash(message, color) {
    this.message?.destroy();
    this.message = this.add.text(this.scale.width / 2, 182, message, {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "19px",
      color,
      fontStyle: "900",
      stroke: "#fff8ea",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);
    this.tweens.add({
      targets: this.message,
      alpha: 0,
      duration: 420,
      delay: 1200,
      onComplete: () => {
        this.message?.destroy();
        this.message = null;
      },
    });
  }

  isUnlocked(skinId, color) {
    return isSkinUnlocked(skinId, color);
  }

  refreshCoins() {
    this.coinGroup?.destroy();
    this.coinGroup = addCoinPill(this, 34, 34);
  }
}
