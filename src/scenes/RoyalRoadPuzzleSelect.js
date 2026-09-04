import { t } from "../i18n.js?v=20260904-accountpopup108";
import { ROYAL_ROAD_PUZZLE_STAGES } from "../royalRoadPuzzleStages.js?v=20260904-accountpopup108";
import {
  getRoyalRoadPuzzleUnlockCount,
  readRoyalRoadPuzzleProgress,
} from "../royalRoadPuzzleProgress.js?v=20260904-accountpopup108";
import {
  addBackButton,
  addCoinPill,
  addPageTitle,
  addScreenBg,
  addSettingsButton,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260904-accountpopup108";
import { playFeedback } from "../feedback.js?v=20260904-accountpopup108";

const VIEW_TOP = 176;
const VIEW_BOTTOM = 1140;
const CARD_W = 300;
const CARD_H = 120;
const CARD_GAP_Y = 134;

function typeLabel(type) {
  return t(`roadPuzzle.type.${type}`);
}

export class RoyalRoadPuzzleSelect extends Phaser.Scene {
  constructor() {
    super("RoyalRoadPuzzleSelect");
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragDistance = 0;
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this);
    addCoinPill(this, 34, 34);
    addSettingsButton(this, () => showSettingsPanel(this));
    const progress = readRoyalRoadPuzzleProgress();
    const unlockCount = getRoyalRoadPuzzleUnlockCount(ROYAL_ROAD_PUZZLE_STAGES);
    const totalStars = Object.values(progress.records).reduce((sum, record) => sum + (record.stars || 0), 0);
    addPageTitle(this, t("roadPuzzle.selectTitle"), t("roadPuzzle.selectSubtitle", {
      count: unlockCount,
      total: ROYAL_ROAD_PUZZLE_STAGES.length,
      stars: totalStars,
    }), 68);

    this.list = this.add.container(0, 0).setDepth(40);
    ROYAL_ROAD_PUZZLE_STAGES.forEach((stage, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.list.add(this.createCard(50 + CARD_W / 2 + col * 320, 238 + row * CARD_GAP_Y, stage, index, index < unlockCount, progress.records[stage.id]));
    });
    const rows = Math.ceil(ROYAL_ROAD_PUZZLE_STAGES.length / 2);
    this.maxScroll = Math.max(0, 238 + (rows - 1) * CARD_GAP_Y + CARD_H / 2 - VIEW_BOTTOM);
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff, 1).fillRect(0, VIEW_TOP, width, VIEW_BOTTOM - VIEW_TOP);
    this.list.setMask(maskShape.createGeometryMask());
    this.maskShape = maskShape;
    this.scrollThumb = this.add.rectangle(width - 18, VIEW_TOP, 5, 90, 0xb68b52, 0.65).setOrigin(0.5, 0).setDepth(100);
    this.updateScroll();

    this.input.on("wheel", (_pointer, _objects, _dx, deltaY) => this.setScroll(this.scrollY + deltaY * 0.55));
    this.input.on("pointerdown", (pointer) => {
      if (pointer.y < VIEW_TOP || pointer.y > VIEW_BOTTOM) return;
      this.dragStart = { y: pointer.y, scroll: this.scrollY };
      this.dragDistance = 0;
    });
    this.input.on("pointermove", (pointer) => {
      if (!this.dragStart || !pointer.isDown) return;
      this.dragDistance = Math.max(this.dragDistance, Math.abs(pointer.y - this.dragStart.y));
      this.setScroll(this.dragStart.scroll - (pointer.y - this.dragStart.y));
    });
    this.input.on("pointerup", () => { this.dragStart = null; });
    addBackButton(this, () => {
      if (!window.KumaEmbeddedRuntime?.returnHome?.()) this.scene.start("Start");
    }, 67, height - 68);
  }

  createCard(cx, cy, stage, index, unlocked, record) {
    const root = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(unlocked ? 0xfffbf1 : 0xeee5d7, unlocked ? 0.94 : 0.68);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    bg.lineStyle(2, unlocked ? 0xc99e5a : 0xd8c7ae, 1);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    bg.setInteractive(new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerup", () => {
      if (this.dragDistance > 10) return;
      if (!unlocked) {
        playFeedback("wrong");
        return;
      }
      playFeedback("ui");
      this.scene.start("RoyalRoadPuzzle", { stageIndex: index });
    });
    const number = this.add.text(-122, -36, String(index + 1).padStart(2, "0"), {
      fontFamily: KUMA_FONT_SANS, fontSize: "23px", color: unlocked ? "#8b5b17" : "#b9a68b", fontStyle: "900",
    }).setOrigin(0, 0.5);
    const type = this.add.text(122, -36, typeLabel(stage.type), {
      fontFamily: KUMA_FONT_SANS, fontSize: "15px", color: stage.type === "hybrid" ? "#c35d3c" : KUMA_COLORS.teal, fontStyle: "800",
    }).setOrigin(1, 0.5).setAlpha(unlocked ? 1 : 0.45);
    const title = this.add.text(0, -3, stage.title, {
      fontFamily: KUMA_FONT_SANS, fontSize: "20px", color: KUMA_COLORS.ink, fontStyle: "800", align: "center",
      wordWrap: { width: 260, useAdvancedWrap: true },
    }).setOrigin(0.5).setAlpha(unlocked ? 1 : 0.45);
    const crowns = Array.from({ length: 3 }, (_, crownIndex) => this.add.image(
      (crownIndex - 1) * 34,
      38,
      record?.cleared && crownIndex < record.stars ? "kuma_ui_result_crown" : "kuma_ui_result_crown_slot"
    ).setDisplaySize(record?.cleared && crownIndex < record.stars ? 27 : 25, record?.cleared && crownIndex < record.stars ? 28 : 26));
    root.add([bg, number, type, title, ...crowns]);
    if (!unlocked) {
      crowns.forEach((crown) => crown.setVisible(false));
      root.add(this.add.image(0, 34, "kuma_ui_icon_lock").setDisplaySize(42, 42));
    }
    return root;
  }

  setScroll(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.list.y = -this.scrollY;
    this.updateScroll();
  }

  updateScroll() {
    if (!this.scrollThumb) return;
    const height = VIEW_BOTTOM - VIEW_TOP;
    const thumbHeight = Math.max(70, height * (height / (height + this.maxScroll)));
    const ratio = this.maxScroll ? this.scrollY / this.maxScroll : 0;
    this.scrollThumb.setSize(5, thumbHeight).setDisplaySize(5, thumbHeight);
    this.scrollThumb.y = VIEW_TOP + (height - thumbHeight) * ratio;
    this.scrollThumb.setVisible(this.maxScroll > 0);
  }
}
