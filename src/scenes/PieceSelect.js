import { createPieceView } from "../pieceStyles.js?v=20260904-accountbridge110";
import { ensurePieceSetsLoaded } from "../pieceAssets.js?v=20260904-accountbridge110";
import {
  getGoldBearProgress,
  getPieceUnlockNotices,
  getSkinUnlockState,
  isSkinUnlocked,
  readPlayerState,
  SKIN_SHOP,
  unlockGoldBearPiece,
  unlockSkin,
} from "../playerState.js?v=20260904-accountbridge110";
import { skinName, t } from "../i18n.js?v=20260904-accountbridge110";
import { SpriteButton } from "../ui/SpriteButton.js?v=20260904-accountbridge110";
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
} from "../ui/KumaUi.js?v=20260904-accountbridge110";
import { showPieceUnlockNoticeSequence } from "../ui/PieceUnlockLine.js?v=20260904-accountbridge110";

const SHOP = SKIN_SHOP;
const COMPACT_SHOP = SHOP.length > 9;
const VIEW_TOP = 190;
const VIEW_BOTTOM = 1040;
const ROW_TOP = 225;
const ROW_GAP = 96;

export class PieceSelect extends Phaser.Scene {
  constructor() {
    super("PieceSelect");
    this.scrollY = 0;
    this.maxScroll = 0;
    this.draggingList = false;
    this.pointerStartY = 0;
    this.scrollStartY = 0;
    this.dragDistance = 0;
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
    this.targetScene = this.registry.get("pieceSelectTargetScene") || "Game";
    const isTug = this.targetScene === "KingdomTug";
    const isRoad = this.targetScene === "RoyalRoad";
    const isCrown = this.targetScene === "CrownClash";
    const isSiege = this.targetScene === "KingdomSiege";
    const titleKey = isTug ? "tug.selectTitle" : isRoad ? "road.selectTitle" : isCrown ? "crown.selectTitle" : isSiege ? "siege.selectTitle" : "select.title";
    const subtitleKey = isTug ? "tug.selectSubtitle" : isRoad ? "road.selectSubtitle" : isCrown ? "crown.selectSubtitle" : isSiege ? "siege.selectSubtitle" : "select.subtitle";
    addPageTitle(this, t(titleKey), t(subtitleKey), 68);

    const saved = this.registry.get("pieceSkin") || { w: "classic", b: "classic" };
    this.skinW = this.isUnlocked(saved.w, "w") ? saved.w : "classic";
    this.skinB = this.isUnlocked(saved.b, "b") ? saved.b : "classic";
    this.listLayer = null;
    this.message = null;

    this.renderList();
    this.registerScrollInput();

    addBackButton(this, () => {
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    }, 67, height - 68);
    const startKey = isTug ? "tug.start" : isRoad ? "road.start" : isCrown ? "crown.start" : isSiege ? "siege.start" : "select.start";
    addLargeTextButton(this, width / 2, 1129, t(startKey), "", () => this.startGame(), {
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
      this.scene.start(this.targetScene || "Game");
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
    this.maskShape?.destroy();
    this.scrollThumb?.destroy();
    const { width } = this.scale;
    this.listLayer = this.add.container(0, 0).setDepth(50);
    const leftX = 197;
    const rightX = width - 197;
    let y = ROW_TOP;

    SHOP.forEach((skin) => {
      this.drawSkinRow(leftX, y, 320, skin, "w");
      this.drawSkinRow(rightX, y, 320, skin, "b");
      y += ROW_GAP;
      if (skin.id === "goldBear" && !getSkinUnlockState("goldBear", "w").unlocked) {
        y += this.drawGoldBearInlinePanel(y + 12, "w") + 26;
      }
    });
    const contentBottom = y + 20;
    this.maxScroll = Math.max(0, contentBottom - VIEW_BOTTOM);

    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, VIEW_TOP, width, VIEW_BOTTOM - VIEW_TOP);
    this.listLayer.setMask(maskShape.createGeometryMask());
    this.maskShape = maskShape;

    this.scrollThumb = this.add.rectangle(width - 23, VIEW_TOP, 5, 100, 0xb68b52, 0.62)
      .setOrigin(0.5, 0)
      .setDepth(115);
    this.setScroll(this.scrollY);
  }

  drawSkinRow(cx, cy, width, skin, color) {
    const unlockState = getSkinUnlockState(skin.id, color);
    const unlocked = unlockState.unlocked;
    const selected = unlocked && (color === "w" ? this.skinW === skin.id : this.skinB === skin.id);
    const colorName = t(`color.${color}`);
    const alpha = unlocked ? 1 : 0.34;
    const hitW = width;
    const hitH = 92;

    if (selected) {
      const selectedFrame = this.add.rectangle(cx, cy, hitW, hitH, 0xfff8ef, 0.18)
        .setStrokeStyle(3, 0xf0cf82, 1);
      this.listLayer.add(selectedFrame);
    }

    const hit = this.add.rectangle(cx, cy, hitW, hitH, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      if (this.dragDistance > 8) return;
      this.handlePick(skin, color);
    });

    const iconSize = 60;
    const icon = createPieceView(this, cx - hitW / 2 + 42, cy, iconSize, skin.id, color, "k");
    icon.setAlpha(alpha);
    icon.setDepth(55 + (cy / 1000));

    const label = this.add.text(cx - hitW / 2 + 85, cy - (unlocked ? 0 : COMPACT_SHOP ? 8 : 12), `${colorName} ${skinName(skin)}`, {
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
    if (!unlockState.unlocked && skin.id === "goldBear") {
      this.setScroll(this.maxScroll);
      return;
    }
    if (!unlockState.unlocked && skin.id === "brownBear") {
      showRewardLine(this, t("select.hiddenWait"), {
        tone: "failure",
        showCoin: false,
      });
      return;
    }
    if (!unlockState.unlocked && unlockState.purchasable) {
      this.showPurchaseModal(skin, color);
      return;
    }
    if (!unlockState.unlocked) return;
    if (color === "w") this.skinW = skin.id;
    else this.skinB = skin.id;
    this.renderList();
  }

  registerScrollInput() {
    this.input.on("wheel", (_pointer, _objects, _dx, deltaY) => {
      if (this.purchaseLayer) return;
      this.setScroll(this.scrollY + deltaY * 0.55);
    });
    this.input.on("pointerdown", (pointer) => {
      if (this.purchaseLayer || pointer.y < VIEW_TOP || pointer.y > VIEW_BOTTOM) return;
      this.draggingList = true;
      this.pointerStartY = pointer.y;
      this.scrollStartY = this.scrollY;
      this.dragDistance = 0;
    });
    this.input.on("pointermove", (pointer) => {
      if (!this.draggingList || !pointer.isDown) return;
      this.dragDistance = Math.max(this.dragDistance, Math.abs(pointer.y - this.pointerStartY));
      this.setScroll(this.scrollStartY - (pointer.y - this.pointerStartY));
    });
    this.input.on("pointerup", () => {
      this.draggingList = false;
    });
    this.input.on("pointerupoutside", () => {
      this.draggingList = false;
    });
  }

  setScroll(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    if (this.listLayer) this.listLayer.y = -this.scrollY;
    this.updateScrollThumb();
  }

  updateScrollThumb() {
    if (!this.scrollThumb) return;
    const viewportHeight = VIEW_BOTTOM - VIEW_TOP;
    const totalHeight = viewportHeight + this.maxScroll;
    const thumbHeight = Math.max(72, viewportHeight * (viewportHeight / totalHeight));
    const travel = viewportHeight - thumbHeight;
    const ratio = this.maxScroll > 0 ? this.scrollY / this.maxScroll : 0;
    this.scrollThumb.setSize(5, thumbHeight).setDisplaySize(5, thumbHeight);
    this.scrollThumb.y = VIEW_TOP + travel * ratio;
    this.scrollThumb.setVisible(this.maxScroll > 0);
  }

  drawGoldBearInlinePanel(topY, color) {
    const { width } = this.scale;
    const progress = getGoldBearProgress();
    const panelW = width - 72;
    const panelH = 282;
    const panelX = width / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0xf1e7d6, 0.74);
    panel.fillRoundedRect(panelX - panelW / 2, topY, panelW, panelH, 12);
    this.listLayer.add(panel);

    const guide = this.add.text(panelX, topY + 38, t("select.goldBearGuide", {
      owned: progress.owned,
      total: progress.total,
    }), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "20px",
      color: "#8d6b4d",
      fontStyle: "900",
      align: "center",
    }).setOrigin(0.5);
    this.listLayer.add(guide);

    progress.pieces.forEach((piece, index) => {
      const x = panelX - 250 + index * 100;
      this.drawGoldBearInlinePiece(x, topY + 158, piece, color);
    });
    return panelH;
  }

  drawGoldBearInlinePiece(x, y, piece, color) {
    const icon = createPieceView(this, x, y - 42, 52, "goldBear", color, piece.id);
    icon.setAlpha(piece.unlocked ? 1 : 0.24);
    const name = this.add.text(x, y + 4, piece.nameEn, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "16px",
      color: piece.unlocked ? KUMA_COLORS.teal : "#846a51",
      fontStyle: "800",
    }).setOrigin(0.5);
    let status = null;
    if (piece.unlocked) {
      status = this.add.text(x, y + 36, t("select.pieceComplete"), {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "15px",
        color: KUMA_COLORS.teal,
        fontStyle: "900",
      }).setOrigin(0.5);
    } else if (piece.unlockType === "coin") {
      status = addMiniCoin(this, x - 24, y + 36, piece.cost, 80);
    } else {
      status = this.add.text(x, y + 36, piece.requirementLabel, {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "13px",
        color: KUMA_COLORS.ink,
        fontStyle: "800",
        align: "center",
        wordWrap: { width: 94 },
      }).setOrigin(0.5);
    }
    const hit = this.add.rectangle(x, y - 1, 94, 140, 0xffffff, 0.001);
    const canClick = !piece.unlocked && (piece.unlockType === "coin" || piece.ready);
    if (canClick) {
      hit.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        if (this.dragDistance > 8) return;
        const result = unlockGoldBearPiece(piece.id);
        this.refreshCoins();
        if (!result.ok) {
          const cost = result.cost || piece.cost || piece.target || 0;
          const msg = result.reason === "coins"
            ? t("select.notEnough", { coins: result.coins, cost })
            : piece.requirementLabel;
          showRewardLine(this, msg, { tone: "failure", showCoin: false });
          return;
        }
        const keepScroll = this.scrollY;
        this.renderList();
        this.setScroll(keepScroll);
        const notices = getPieceUnlockNotices();
        if (notices.length) showPieceUnlockNoticeSequence(this, notices);
        else showRewardLine(this, result.setUnlocked
          ? t("select.goldBearSetUnlocked")
          : t("select.goldBearPieceDone", { piece: piece.nameKo }), {
          showCoin: false,
          particleScale: 1.2,
          feedbackType: "purchase",
        });
      });
    }
    this.listLayer.add([icon, name, status, hit]);
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
