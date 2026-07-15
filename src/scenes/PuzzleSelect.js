import { getPuzzleUnlockCount, isPuzzleUnlocked, REWARDS } from "../playerState.js?v=20260715-domain04";
import { isPuzzleCleared, PUZZLES } from "../puzzles.js?v=20260715-domain04";
import { puzzleTags, puzzleText, t } from "../i18n.js?v=20260715-domain04";
import {
  addBackButton,
  addCoinPill,
  addFooter,
  addLock,
  addMiniCoin,
  addPageTitle,
  addScreenBg,
  addSettingsButton,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showSettingsPanel,
} from "../ui/KumaUi.js?v=20260715-domain04";

const CARD_HEIGHT = 98;
const CARD_GAP = 113;
const VIEW_TOP = 176;
const VIEW_BOTTOM = 1110;

export class PuzzleSelect extends Phaser.Scene {
  constructor() {
    super("PuzzleSelect");
    this.scrollY = 0;
    this.maxScroll = 0;
    this.draggingList = false;
    this.pointerStartY = 0;
    this.scrollStartY = 0;
    this.dragDistance = 0;
  }

  create() {
    const { width, height } = this.scale;
    addScreenBg(this);
    addCoinPill(this, 34, 34);
    addSettingsButton(this, () => showSettingsPanel(this));

    const unlockCount = getPuzzleUnlockCount(PUZZLES);
    addPageTitle(this, t("puzzle.title"), t("puzzle.listSub", {
      count: unlockCount,
      total: PUZZLES.length,
    }), 68);

    this.lockMessage = null;
    this.scrollLayer = this.add.container(0, 0).setDepth(40);
    const cardWidth = 598;
    const firstCenterY = 225;

    PUZZLES.forEach((puzzle, index) => {
      const card = this.drawPuzzleCard(width / 2, firstCenterY + index * CARD_GAP, cardWidth, CARD_HEIGHT, puzzle, index);
      this.scrollLayer.add(card);
    });

    const contentBottom = firstCenterY + (PUZZLES.length - 1) * CARD_GAP + CARD_HEIGHT / 2;
    this.maxScroll = Math.max(0, contentBottom - VIEW_BOTTOM);

    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, VIEW_TOP, width, VIEW_BOTTOM - VIEW_TOP);
    this.scrollLayer.setMask(maskShape.createGeometryMask());
    this.maskShape = maskShape;

    this.scrollThumb = this.add.rectangle(width - 23, VIEW_TOP, 5, 100, 0xb68b52, 0.62)
      .setOrigin(0.5, 0)
      .setDepth(90);
    this.updateScrollThumb();

    this.input.on("wheel", (_pointer, _objects, _dx, deltaY) => {
      this.setScroll(this.scrollY + deltaY * 0.55);
    });
    this.input.on("pointerdown", (pointer) => {
      if (pointer.y < VIEW_TOP || pointer.y > VIEW_BOTTOM) return;
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

    addBackButton(this, () => this.scene.start("Start"), 67, height - 68);
    addFooter(this);
  }

  setScroll(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.scrollLayer.y = -this.scrollY;
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

  drawPuzzleCard(cx, cy, w, h, puzzle, index) {
    const unlocked = isPuzzleUnlocked(index, PUZZLES);
    const cleared = isPuzzleCleared(puzzle.id);
    const group = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0xfffbf2, unlocked ? 0.86 : 0.5);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, unlocked ? 0xc59d76 : 0xe3d3bd, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerup", () => {
      if (this.dragDistance > 8) return;
      if (!unlocked) {
        this.flashLockMessage(t("puzzle.locked"));
        return;
      }
      this.scene.start("Puzzle", { puzzleIndex: index });
    });

    const alpha = unlocked ? 1 : 0.45;
    const number = this.add.text(-w / 2 + 35, 0, String(index + 1).padStart(2, "0"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "25px",
      color: "#61400f",
      fontStyle: "900",
    }).setOrigin(0, 0.5).setAlpha(alpha);
    const title = this.add.text(-w / 2 + 96, -13, puzzleText(puzzle, "title"), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "21px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0, 0.5).setAlpha(alpha);
    const tags = this.add.text(-w / 2 + 96, 18, puzzleTags(puzzle.tags).join(" / "), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "16px",
      color: KUMA_COLORS.ink,
      fontStyle: "500",
    }).setOrigin(0, 0.5).setAlpha(alpha * 0.78);

    group.add([bg, number, title, tags]);

    if (!unlocked) {
      const lock = addLock(this, 0, 0, 34, 1);
      const lockLabel = this.add.text(w / 2 - 74, 0, "LOCK", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "21px",
        color: "#decbb0",
        fontStyle: "900",
      }).setOrigin(0.5).setAlpha(0.9);
      group.add([lock, lockLabel]);
      return group;
    }

    if (cleared) {
      const clear = this.add.text(w / 2 - 74, 0, "CLEAR", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "23px",
        color: KUMA_COLORS.teal,
        fontStyle: "900",
      }).setOrigin(0.5);
      group.add(clear);
    } else {
      const label = this.add.text(w / 2 - 122, 0, t("puzzle.reward"), {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "16px",
        color: KUMA_COLORS.ink,
        fontStyle: "700",
      }).setOrigin(0, 0.5);
      const coin = addMiniCoin(this, w / 2 - 50, 0, REWARDS.puzzle, 1);
      group.add([label, coin]);
    }
    return group;
  }

  flashLockMessage(message) {
    this.lockMessage?.destroy();
    this.lockMessage = this.add.text(this.scale.width / 2, 154, message, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "18px",
      color: "#9b5b1a",
      fontStyle: "800",
      stroke: "#fff8ea",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(300);
    this.tweens.add({
      targets: this.lockMessage,
      alpha: 0,
      duration: 420,
      delay: 1200,
      onComplete: () => {
        this.lockMessage?.destroy();
        this.lockMessage = null;
      },
    });
  }
}
