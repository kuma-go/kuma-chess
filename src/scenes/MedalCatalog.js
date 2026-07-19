import {
  MEDALS,
  MEDAL_CATEGORIES,
  getMedalEntries,
  markMedalsSeen,
  medalTextureKey,
} from "../medals.js?v=20260719-wakelock36";
import { readPlayerState } from "../playerState.js?v=20260719-wakelock36";
import { t } from "../i18n.js?v=20260719-wakelock36";
import { SpriteButton } from "../ui/SpriteButton.js?v=20260719-wakelock36";
import {
  addLargeTextButton,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  KUMA_FONT_SERIF,
} from "../ui/KumaUi.js?v=20260719-wakelock36";

const UI_ROOT = "assets/kuma/ui/";
const UI_ASSETS = Object.freeze([
  ["kuma_ui_book_bg", "book_bg.webp"],
  ["kuma_ui_book_title_bg", "book_title_bg.webp"],
  ["kuma_ui_medal_slot", "medal_slot.webp"],
  ["kuma_ui_btn_arrow_left", "btn_arrow_left.png"],
  ["kuma_ui_btn_arrow_right", "btn_arrow_right.png"],
  ["kuma_ui_btn_medal", "btn_medal.png"],
  ["kuma_ui_popup", "popup.png"],
  ["kuma_ui_icon_new", "icon_new.svg"],
]);

const MEDAL_ASSET_FILES = Object.freeze({
  "last-pawn-hunter": "메달_마지막병사의반격.webp",
  "queenless-victory": "메달_여왕없는승리.webp",
  "perfect-defense": "메달_완벽한방어.webp",
  "coin-master": "메달_코인.webp",
  "ai-win-streak": "메달_연승의깃발.webp",
  "castling-master": "메달_룩의보호.webp",
  "queen-hunter": "메달_여왕의품격.webp",
  "check-counter": "메달_공격은최선의방어.webp",
  "capture-streak": "메달_몰아치는공격.webp",
  collector: "메달_보물수집가.webp",
  "hint-user": "메달_문제를푸는열쇠.webp",
  "speed-checkmate": "메달_초고속행군.webp",
  "triple-promotion": "메달_승급전문가.webp",
  "online-challenger": "메달_도전장.webp",
  "puzzle-replay-10": "메달_퍼즐공부.webp",
  "puzzle-replay-70": "메달_퍼즐마니아.webp",
  "face-to-face-10": "메달_우정체스.webp",
  "draw-10": "메달_평화주의자.webp",
  "knight-captures-14": "메달_나이트메어.webp",
  "bare-kings-draw-5": "메달_킹대킹.webp",
  "puzzle-10": "메달_퍼즐_01.webp",
  "puzzle-25": "메달_퍼즐_02.webp",
  "puzzle-50": "메달_퍼즐_03.webp",
  "puzzle-75": "메달_퍼즐_04.webp",
  "puzzle-100": "메달_퍼즐_05.webp",
  "rank-25": "메달_브론즈.webp",
  "rank-50": "메달_실버.webp",
  "rank-75": "메달_골드.webp",
  "rank-100": "메달_플레티넘.webp",
});

const BOOK = Object.freeze({ x: 360, y: 706.667, width: 666.667, height: 933.333 });
const TITLE_BAR = Object.freeze({ x: 360, y: 191.333, width: 656, height: 177.333 });
const HEADER = Object.freeze({
  eyebrowY: 195.8,
  categoryY: 215.8,
  arrowY: 209.333,
  arrowLeftX: 128,
  arrowRightX: 592,
  arrowSize: 66.667,
});
const VIEWPORT = Object.freeze({ x: 101.333, y: 307.333, width: 520, height: 620 });
const VIEWPORT_FADE = Object.freeze({ height: 24, steps: 12, transition: 24, color: 0xffe6b7 });
const FIXED_PROGRESS = Object.freeze({ x: 360, y: 966 });
const GRID_COLUMNS = 3;
const GRID_ROW_HEIGHT = 234;
const CARD_WIDTH = 160;
const CARD = Object.freeze({
  unlockedArtY: 77.333,
  unlockedArtWidth: 133.333,
  unlockedArtHeight: 156,
  lockedArtY: 84,
  lockedArtWidth: 120,
  lockedArtHeight: 133.333,
  nameY: 157.2,
  nameFontSize: 20,
  descriptionY: 181.4,
  descriptionFontSize: 16,
  progressY: 204.4,
  progressFontSize: 16,
});
const CONFIRM_BUTTON = Object.freeze({
  x: 360,
  y: 1046,
  width: 194.667,
  height: 81.333,
});

const COPY = Object.freeze({
  ko: { title: "메달 도감", goal: "획득 목표", progress: "진행률", complete: "달성", loading: "메달을 불러오는 중...", empty: "아직 등록된 메달이 없습니다." },
  en: { title: "Medal Catalog", goal: "Goal", progress: "Progress", complete: "Complete", loading: "Loading medals...", empty: "No medals are registered yet." },
  ja: { title: "メダル図鑑", goal: "獲得条件", progress: "進捗", complete: "達成", loading: "メダルを読み込み中...", empty: "登録されたメダルはまだありません。" },
});

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((item) => (Array.isArray(item) ? item : [item]));
}

function categoryId(category, index = 0) {
  if (typeof category === "string") return category;
  return category?.id ?? category?.key ?? category?.category ?? String(index);
}

function localized(value, language) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return String(value[language] ?? value.ko ?? value.en ?? value.ja ?? "");
}

function localizedField(source, field, language) {
  if (!source) return "";
  const suffix = language === "en" ? "En" : language === "ja" ? "Ja" : "Ko";
  return localized(source[`${field}${suffix}`] ?? source[field], language);
}

function translated(key, fallback = "") {
  if (!key) return fallback;
  const value = t(key);
  return value === key ? fallback : value;
}

function medalDefinition(entry) {
  return entry?.medal ?? entry?.definition ?? entry;
}

function medalId(entry) {
  const medal = medalDefinition(entry);
  return String(entry?.id ?? entry?.medalId ?? medal?.id ?? "");
}

function entryCategoryId(entry) {
  const medal = medalDefinition(entry);
  return entry?.categoryId ?? entry?.category ?? medal?.categoryId ?? medal?.category ?? "";
}

function isUnlocked(entry) {
  return entry?.unlocked === true || entry?.isUnlocked === true || entry?.complete === true;
}

function isNew(entry) {
  return isUnlocked(entry) && (
    entry?.isNew === true
    || entry?.new === true
    || entry?.newlyUnlocked === true
    || entry?.seen === false
  );
}

function assetPath(medal) {
  const source = medal?.asset ?? medal?.assetPath ?? medal?.image ?? medal?.src ?? medal?.file;
  if (!source) return `${UI_ROOT}${medal?.id ?? "missing_medal"}.webp`;
  if (/^(?:https?:|data:|\/)/.test(source) || source.startsWith("assets/")) return source;
  if (/\.(?:png|webp|jpe?g)$/i.test(source)) return `${UI_ROOT}${source}`;
  const file = MEDAL_ASSET_FILES[medal.id] || `메달_${source.replaceAll(" ", "_")}.webp`;
  return `${UI_ROOT}${file}`;
}

function progressLabel(entry, language, copy) {
  const direct = localizedField(entry, "progressLabel", language)
    || localizedField(entry, "progressText", language);
  if (direct) return direct;

  const current = Number(entry?.progress ?? entry?.current ?? entry?.value);
  const target = Number(entry?.target ?? entry?.goal ?? entry?.total);
  if (Number.isFinite(current) && Number.isFinite(target) && target > 0) {
    return `${Math.min(Math.max(0, current), target)}/${target}`;
  }
  return isUnlocked(entry) ? copy.complete : "-";
}

export class MedalCatalog extends Phaser.Scene {
  constructor() {
    super("MedalCatalog");
    this.categoryIndex = 0;
    this.scrollY = 0;
    this.maxScroll = 0;
    this.encounteredNewIds = new Set();
    this.revealedIds = new Set();
  }

  init(data = {}) {
    this.parentSceneKey = data.parentSceneKey || null;
  }

  preload() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.failedTextureKeys = new Set();
    this.loadingUi = this.add.container(0, 0).setDepth(2000);

    const label = this.add.text(width / 2, height / 2 - 34, COPY[this.getLanguage()].loading, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "20px",
      color: KUMA_COLORS.ink,
      fontStyle: "700",
    }).setOrigin(0.5);
    const track = this.add.rectangle(width / 2, height / 2 + 12, 300, 8, 0xd8c6aa, 0.65);
    const fill = this.add.rectangle(width / 2 - 150, height / 2 + 12, 1, 8, 0xb8862b)
      .setOrigin(0, 0.5);
    this.loadingUi.add([label, track, fill]);

    this.onLoadProgress = (value) => {
      if (fill.active) fill.width = Math.max(1, 300 * value);
    };
    this.onLoadError = (file) => this.failedTextureKeys.add(file?.key);
    this.load.on("progress", this.onLoadProgress);
    this.load.on("loaderror", this.onLoadError);

    for (const [key, file] of UI_ASSETS) {
      if (!this.textures.exists(key)) this.load.image(key, `${UI_ROOT}${file}`);
    }
    for (const medal of asArray(MEDALS)) {
      if (!medal?.id) continue;
      const key = medalTextureKey(medal.id);
      if (!this.textures.exists(key)) this.load.image(key, assetPath(medal));
    }
  }

  create() {
    this.loadingUi?.destroy();
    this.loadingUi = null;
    this.load.off("progress", this.onLoadProgress);
    this.load.off("loaderror", this.onLoadError);

    this.language = this.getLanguage();
    this.copy = COPY[this.language];
    this.categories = asArray(MEDAL_CATEGORIES);
    this.categoryIndex = Phaser.Math.Clamp(this.categoryIndex, 0, Math.max(0, this.categories.length - 1));
    this.encounteredNewIds = new Set();
    this.revealedIds = new Set();
    this.hasMarkedSeen = false;
    this.dragPointerId = null;
    this.lastDragY = 0;

    const { width, height } = this.scale;
    this.addSafeImage(BOOK.x, BOOK.y, "kuma_ui_book_bg", BOOK.width, BOOK.height, -10);
    this.addSafeImage(TITLE_BAR.x, TITLE_BAR.y, "kuma_ui_book_title_bg", TITLE_BAR.width, TITLE_BAR.height, 20);

    this.add.text(width / 2, HEADER.eyebrowY, "KUMA CHESS MEDAL COLLECTION", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "11px",
      color: "#8d6755",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(31);

    this.categoryTitle = this.add.text(width / 2, HEADER.categoryY, "", {
      fontFamily: KUMA_FONT_SERIF,
      fontSize: "27px",
      color: "#4b310c",
      fontStyle: "700",
      align: "center",
      wordWrap: { width: 400, useAdvancedWrap: true },
    }).setOrigin(0.5).setDepth(31);
    this.pageText = this.add.text(FIXED_PROGRESS.x, FIXED_PROGRESS.y, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "17px",
      color: "#8d6755",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(31);
    this.categoryNewBadge = this.addNewBadge(0, HEADER.categoryY, 31);

    this.leftArrow = this.addArrowButton(HEADER.arrowLeftX, HEADER.arrowY, "kuma_ui_btn_arrow_left", -1);
    this.rightArrow = this.addArrowButton(HEADER.arrowRightX, HEADER.arrowY, "kuma_ui_btn_arrow_right", 1);
    this.leftArrowNewBadge = this.addNewBadge(HEADER.arrowLeftX + 26.3, HEADER.arrowY + 22.2, 34);
    this.rightArrowNewBadge = this.addNewBadge(HEADER.arrowRightX + 26.3, HEADER.arrowY + 22.2, 34);

    this.maskShape = this.add.graphics().setVisible(false);
    this.maskShape.fillStyle(0xffffff).fillRect(
      VIEWPORT.x,
      VIEWPORT.y,
      VIEWPORT.width,
      VIEWPORT.height
    );
    this.gridMask = this.maskShape.createGeometryMask();
    this.gridLayer = this.add.container(VIEWPORT.x, VIEWPORT.y).setDepth(10).setMask(this.gridMask);
    this.createViewportFades();

    this.dragZone = this.add.zone(
      VIEWPORT.x + VIEWPORT.width / 2,
      VIEWPORT.y + VIEWPORT.height / 2,
      VIEWPORT.width,
      VIEWPORT.height
    ).setDepth(19).setInteractive({ useHandCursor: false });
    this.installScrollInput();

    addLargeTextButton(this, CONFIRM_BUTTON.x, CONFIRM_BUTTON.y, t("common.confirm"), "", () => this.leave(), {
      width: CONFIRM_BUTTON.width,
      height: CONFIRM_BUTTON.height,
      dark: true,
      fontSize: 29,
      titleFontFamily: KUMA_FONT_SANS,
      titleFontStyle: "700",
      titleColor: "#f9f6cc",
      depth: 100,
    });

    this.renderCategory();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  getLanguage() {
    const language = readPlayerState().language;
    return COPY[language] ? language : "ko";
  }

  addSafeImage(x, y, key, width, height, depth) {
    if (!this.textures.exists(key) || this.failedTextureKeys?.has(key)) return null;
    return this.add.image(x, y, key).setDisplaySize(width, height).setDepth(depth);
  }

  addArrowButton(x, y, key, direction) {
    if (this.textures.exists(key) && !this.failedTextureKeys?.has(key)) {
      const button = new SpriteButton(this, x, y, {
        normal: key,
        hover: key,
        pressed: key,
      }, () => this.switchCategory(direction));
      button.setScaleTo(HEADER.arrowSize, HEADER.arrowSize).setDepth(32);
      return button;
    }

    const fallback = this.add.container(x, y).setDepth(32);
    const bg = this.add.circle(0, 0, 27, 0xe7c98f, 0.9).setStrokeStyle(2, 0x71461f);
    const glyph = this.add.text(direction < 0 ? -1 : 1, -2, direction < 0 ? "<" : ">", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: "#4b2d14",
      fontStyle: "700",
    }).setOrigin(0.5);
    const hit = this.add.circle(0, 0, 31, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.switchCategory(direction));
    fallback.add([bg, glyph, hit]);
    return fallback;
  }

  addNewBadge(x, y, depth = 40) {
    if (this.textures.exists("kuma_ui_icon_new") && !this.failedTextureKeys?.has("kuma_ui_icon_new")) {
      return this.add.image(x, y, "kuma_ui_icon_new")
        .setDisplaySize(16, 22)
        .setDepth(depth)
        .setVisible(false);
    }
    return this.add.text(x, y, "N", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "10px",
      color: "#ffffff",
      backgroundColor: "#c92d28",
      fontStyle: "700",
      padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setDepth(depth).setVisible(false);
  }

  createViewportFades() {
    this.viewportFades = this.add.container(0, 0).setDepth(18);
    this.topViewportFade = this.add.container(0, 0).setVisible(false).setAlpha(0);
    this.bottomViewportFade = this.add.container(0, 0).setVisible(false).setAlpha(0);
    this.viewportFades.add([this.topViewportFade, this.bottomViewportFade]);
    const stripHeight = VIEWPORT_FADE.height / VIEWPORT_FADE.steps;

    for (let index = 0; index < VIEWPORT_FADE.steps; index += 1) {
      const topAlpha = 0.94 * (1 - index / VIEWPORT_FADE.steps);
      const bottomAlpha = 0.94 * ((index + 1) / VIEWPORT_FADE.steps);
      const top = this.add.rectangle(
        VIEWPORT.x,
        VIEWPORT.y + index * stripHeight,
        VIEWPORT.width,
        stripHeight + 0.5,
        VIEWPORT_FADE.color,
        topAlpha
      ).setOrigin(0, 0);
      const bottom = this.add.rectangle(
        VIEWPORT.x,
        VIEWPORT.y + VIEWPORT.height - VIEWPORT_FADE.height + index * stripHeight,
        VIEWPORT.width,
        stripHeight + 0.5,
        VIEWPORT_FADE.color,
        bottomAlpha
      ).setOrigin(0, 0);
      this.topViewportFade.add(top);
      this.bottomViewportFade.add(bottom);
    }
  }

  updateViewportFades() {
    if (!this.topViewportFade || !this.bottomViewportFade) return;
    if (this.maxScroll <= 0) {
      this.topViewportFade.setVisible(false).setAlpha(0);
      this.bottomViewportFade.setVisible(false).setAlpha(0);
      return;
    }

    const topAlpha = Phaser.Math.Clamp(this.scrollY / VIEWPORT_FADE.transition, 0, 1);
    const bottomAlpha = Phaser.Math.Clamp(
      (this.maxScroll - this.scrollY) / VIEWPORT_FADE.transition,
      0,
      1
    );
    this.topViewportFade.setVisible(topAlpha > 0).setAlpha(topAlpha);
    this.bottomViewportFade.setVisible(bottomAlpha > 0).setAlpha(bottomAlpha);
  }

  switchCategory(direction) {
    if (this.categories.length < 2) return;
    this.categoryIndex = Phaser.Math.Wrap(
      this.categoryIndex + direction,
      0,
      this.categories.length
    );
    this.renderCategory();
  }

  getCategoryEntries(category) {
    const id = categoryId(category, this.categoryIndex);
    let result = getMedalEntries(this.language);

    if (result && !Array.isArray(result) && typeof result === "object" && Array.isArray(result[id])) {
      result = result[id];
    }
    let entries = asArray(result);
    const categorized = entries.filter((entry) => String(entryCategoryId(entry)) === String(id));
    if (categorized.length > 0) entries = categorized;

    const ids = category?.medalIds ?? category?.ids;
    if (Array.isArray(ids)) {
      const allowed = new Set(ids.map(String));
      entries = entries.filter((entry) => allowed.has(medalId(entry)));
    }
    return entries;
  }

  getCategoryTitle(category) {
    const id = categoryId(category, this.categoryIndex);
    const direct = localizedField(category, "title", this.language)
      || localizedField(category, "name", this.language)
      || localizedField(category, "label", this.language);
    return translated(category?.titleKey ?? category?.nameKey, direct)
      || translated(`medals.category.${id}`, String(id));
  }

  renderCategory() {
    this.closeMedalDetail(false);
    this.gridLayer.removeAll(true);
    this.scrollY = 0;
    this.gridLayer.y = VIEWPORT.y;

    const category = this.categories[this.categoryIndex];
    const entries = category == null ? [] : this.getCategoryEntries(category);
    this.currentEntries = entries;
    this.categoryTitle.setText(category == null ? this.copy.title : this.getCategoryTitle(category));
    this.pageText.setText(`${this.copy.progress}  ${entries.filter(isUnlocked).length} / ${entries.length}`);
    const currentHasNew = entries.some(isNew);
    this.categoryNewBadge
      .setPosition(this.categoryTitle.x + this.categoryTitle.width / 2 + 11, HEADER.categoryY)
      .setVisible(currentHasNew);
    const categoriesWithNew = this.categories.map((item) => this.getCategoryEntries(item).some(isNew));
    let hasNewToLeft = false;
    let hasNewToRight = false;
    categoriesWithNew.forEach((hasNew, index) => {
      if (!hasNew || index === this.categoryIndex) return;
      const rightSteps = (index - this.categoryIndex + this.categories.length) % this.categories.length;
      const leftSteps = (this.categoryIndex - index + this.categories.length) % this.categories.length;
      if (leftSteps < rightSteps) hasNewToLeft = true;
      else hasNewToRight = true;
    });
    this.leftArrowNewBadge.setVisible(hasNewToLeft);
    this.rightArrowNewBadge.setVisible(hasNewToRight);

    if (entries.length === 0) {
      const empty = this.add.text(VIEWPORT.width / 2, 170, this.copy.empty, {
        fontFamily: KUMA_FONT_SANS,
        fontSize: "18px",
        color: KUMA_COLORS.muted,
        fontStyle: "500",
        align: "center",
      }).setOrigin(0.5);
      this.gridLayer.add(empty);
      this.maxScroll = 0;
      this.updateViewportFades();
      return;
    }

    entries.forEach((entry, index) => {
      const column = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const x = (VIEWPORT.width / GRID_COLUMNS) * (column + 0.5);
      const y = row * GRID_ROW_HEIGHT;
      this.drawMedalCard(entry, x, y);
    });

    const rows = Math.ceil(entries.length / GRID_COLUMNS);
    const contentHeight = rows * GRID_ROW_HEIGHT;
    this.maxScroll = Math.max(0, contentHeight - VIEWPORT.height + 6);
    this.updateViewportFades();
  }

  drawMedalCard(entry, x, y) {
    const id = medalId(entry);
    const medal = medalDefinition(entry);
    const unlocked = isUnlocked(entry);
    const fresh = isNew(entry);
    const card = this.add.container(x, y);
    const artKey = unlocked && id ? medalTextureKey(id) : "kuma_ui_medal_slot";
    let art = null;

    if (this.textures.exists(artKey) && !this.failedTextureKeys?.has(artKey)) {
      art = this.add.image(0, unlocked ? CARD.unlockedArtY : CARD.lockedArtY, artKey);
      if (unlocked) art.setDisplaySize(CARD.unlockedArtWidth, CARD.unlockedArtHeight);
      else art.setDisplaySize(CARD.lockedArtWidth, CARD.lockedArtHeight).setAlpha(0.9);
      card.add(art);
    } else {
      const placeholder = this.add.graphics();
      placeholder.fillStyle(unlocked ? 0xd6aa55 : 0xc9b092, 0.48);
      placeholder.fillCircle(0, CARD.lockedArtY, 60);
      placeholder.lineStyle(2, unlocked ? 0x916425 : 0xa88c6e, 0.7);
      placeholder.strokeCircle(0, CARD.lockedArtY, 58);
      card.add(placeholder);
    }

    const nameFallback = localizedField(medal, "name", this.language) || id;
    const name = translated(medal?.nameKey ?? entry?.nameKey, nameFallback);
    const nameText = this.add.text(0, CARD.nameY, name, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: `${CARD.nameFontSize}px`,
      color: "#342b1f",
      fontStyle: "700",
      align: "center",
      wordWrap: { width: CARD_WIDTH, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0.5, 0);
    card.add(nameText);

    if (fresh && id) {
      this.encounteredNewIds.add(id);
      const badge = this.addNewBadge(-CARD_WIDTH / 2 + 7, nameText.y + 8, 1).setVisible(true);
      card.add(badge);
      this.revealNewCard(card, art, id);
    }

    this.gridLayer.add(card);
  }

  revealNewCard(card, art, id) {
    if (this.revealedIds.has(id)) return;
    this.revealedIds.add(id);
    card.setScale(0.94).setAlpha(0.72);
    this.tweens.add({
      targets: card,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 430,
      ease: "Back.Out",
    });

    if (!art) return;
    const glow = this.add.image(art.x, art.y, art.texture.key)
      .setDisplaySize(art.displayWidth * 1.04, art.displayHeight * 1.04)
      .setTint(0xffe6a0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    card.addAt(glow, 0);
    this.tweens.add({
      targets: glow,
      alpha: 0.45,
      duration: 260,
      hold: 100,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => glow.destroy(),
    });
  }

  installScrollInput() {
    this.onDragStart = (pointer) => {
      if (this.detailLayer) return;
      this.dragPointerId = pointer.id;
      this.lastDragY = pointer.y;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    };
    this.onDragMove = (pointer) => {
      if (pointer.id !== this.dragPointerId || !pointer.isDown) return;
      const delta = pointer.y - this.lastDragY;
      this.lastDragY = pointer.y;
      this.setScroll(this.scrollY - delta);
    };
    this.onDragEnd = (pointer) => {
      if (pointer.id !== this.dragPointerId) return;
      const isTap = Math.hypot(pointer.x - this.dragStartX, pointer.y - this.dragStartY) < 10;
      this.dragPointerId = null;
      if (isTap) this.openMedalAt(pointer.x, pointer.y);
    };
    this.onWheel = (pointer, gameObjects, deltaX, deltaY) => {
      const inside = Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height),
        pointer.x,
        pointer.y
      );
      if (inside) this.setScroll(this.scrollY + deltaY * 0.65);
    };

    this.dragZone.on("pointerdown", this.onDragStart);
    this.input.on("pointermove", this.onDragMove);
    this.input.on("pointerup", this.onDragEnd);
    this.input.on("pointerupoutside", this.onDragEnd);
    this.input.on("wheel", this.onWheel);
  }

  setScroll(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.gridLayer.y = VIEWPORT.y - this.scrollY;
    this.updateViewportFades();
  }

  openMedalAt(pointerX, pointerY) {
    if (this.detailLayer || !this.currentEntries?.length) return;
    if (pointerX < VIEWPORT.x || pointerX > VIEWPORT.x + VIEWPORT.width) return;
    if (pointerY < VIEWPORT.y || pointerY > VIEWPORT.y + VIEWPORT.height) return;
    const columnWidth = VIEWPORT.width / GRID_COLUMNS;
    const column = Phaser.Math.Clamp(Math.floor((pointerX - VIEWPORT.x) / columnWidth), 0, GRID_COLUMNS - 1);
    const row = Math.floor((pointerY - VIEWPORT.y + this.scrollY) / GRID_ROW_HEIGHT);
    const entry = this.currentEntries[row * GRID_COLUMNS + column];
    if (entry) this.showMedalDetail(entry);
  }

  showMedalDetail(entry) {
    const medal = medalDefinition(entry);
    const id = medalId(entry);
    const unlocked = isUnlocked(entry);
    const nameFallback = localizedField(medal, "name", this.language) || id;
    const name = translated(medal?.nameKey ?? entry?.nameKey, nameFallback);
    const descriptionFallback = localizedField(medal, "description", this.language)
      || localizedField(entry, "description", this.language);
    const description = translated(medal?.descriptionKey ?? entry?.descriptionKey, descriptionFallback);
    this.detailBackdrop = createModalBackdrop(this, 480);
    const layer = this.add.container(0, 0).setDepth(500);
    this.detailLayer = layer;
    const panel = this.add.image(360, 648, "kuma_ui_popup").setDisplaySize(510, 448);
    const artKey = unlocked && id ? medalTextureKey(id) : "kuma_ui_medal_slot";
    const art = this.textures.exists(artKey)
      ? this.add.image(360, 532, artKey).setDisplaySize(unlocked ? 102 : 92, unlocked ? 120 : 102)
      : null;
    const title = this.add.text(360, 610, name, {
      fontFamily: KUMA_FONT_SERIF,
      fontSize: "26px",
      color: "#342b1f",
      fontStyle: "700",
      align: "center",
      wordWrap: { width: 390, useAdvancedWrap: true },
    }).setOrigin(0.5);
    const goalLabel = this.add.text(360, 652, this.copy.goal, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "16px",
      color: "#92775c",
      fontStyle: "700",
    }).setOrigin(0.5);
    const goal = this.add.text(360, 684, description, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "20px",
      color: "#4f3d2c",
      fontStyle: "500",
      align: "center",
      lineSpacing: 3,
      wordWrap: { width: 394, useAdvancedWrap: true },
      maxLines: 3,
    }).setOrigin(0.5);
    const progress = this.add.text(360, 750, `${this.copy.progress}  ${progressLabel(entry, this.language, this.copy)}`, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color: unlocked ? "#079bbb" : "#846648",
      fontStyle: "700",
    }).setOrigin(0.5);
    const close = addLargeTextButton(this, 360, 813, t("common.confirm"), "", () => this.closeMedalDetail(true, id), {
      width: 174,
      height: 66,
      dark: true,
      fontSize: 24,
      titleFontFamily: KUMA_FONT_SANS,
      titleFontStyle: "700",
      titleColor: "#f9f6cc",
      depth: 502,
    });
    this.detailBackdrop.dim.on("pointerup", () => this.closeMedalDetail(true, id));
    layer.add(panel);
    if (art) layer.add(art);
    layer.add([title, goalLabel, goal, progress, close.button, close.title]);
    layer.setAlpha(0).setScale(0.98);
    this.tweens.add({ targets: layer, alpha: 1, scaleX: 1, scaleY: 1, duration: 180, ease: "Sine.Out" });
  }

  closeMedalDetail(markSeen = true, id = null) {
    if (!this.detailLayer) return;
    this.detailLayer.destroy();
    this.detailLayer = null;
    this.detailBackdrop?.cleanup();
    this.detailBackdrop = null;
    if (!markSeen || !id) return;
    markMedalsSeen([id]);
    this.encounteredNewIds.delete(id);
    this.renderCategory();
  }

  markEncounteredSeen() {
    if (this.hasMarkedSeen) return;
    this.hasMarkedSeen = true;
    markMedalsSeen();
  }

  leave() {
    this.closeMedalDetail(false);
    this.markEncounteredSeen();
    const parent = this.parentSceneKey ? this.scene.get(this.parentSceneKey) : null;
    if (parent) {
      parent.medalCatalogBackdrop?.cleanup();
      parent.medalCatalogBackdrop = null;
      this.scene.stop();
      parent.scene.resume();
      parent.refreshMedalButton?.();
      return;
    }
    this.scene.start("Start");
  }

  shutdown() {
    this.closeMedalDetail(false);
    this.markEncounteredSeen();
    this.load.off("progress", this.onLoadProgress);
    this.load.off("loaderror", this.onLoadError);
    this.dragZone?.off("pointerdown", this.onDragStart);
    this.input.off("pointermove", this.onDragMove);
    this.input.off("pointerup", this.onDragEnd);
    this.input.off("pointerupoutside", this.onDragEnd);
    this.input.off("wheel", this.onWheel);
    this.gridLayer?.clearMask(false);
    this.gridMask?.destroy();
    this.maskShape?.destroy();
    this.gridMask = null;
    this.maskShape = null;
  }
}
