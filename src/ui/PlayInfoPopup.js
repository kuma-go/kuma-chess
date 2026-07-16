import {
  getPlayStats,
  getSkinUnlockState,
  readPlayerState,
  SKIN_SHOP,
} from "../playerState.js?v=20260716-mobile26";
import { getClearedPuzzleIds, PUZZLES } from "../puzzles.js?v=20260716-mobile26";
import {
  addLargeTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
} from "./KumaUi.js?v=20260716-mobile26";

const COPY = {
  ko: {
    title: "플레이 정보",
    puzzle: "퍼즐",
    cleared: "{total}개 중 {cleared}개 클리어",
    ai: "AI 대전",
    aiTotal: "전체 {played}회",
    easy: "쉬움",
    normal: "보통",
    hard: "어려움",
    aiRecord: "{played}회  {wins}승 {losses}패 {draws}무",
    pvp: "PVP 대전",
    pvpRecord: "{played}회  백 {white}승 · 흑 {black}승 · {draws}무",
    pieces: "보유 기물",
    owned: "총 {total}개 중 {owned}개 보유",
    quests: "퀘스트",
    whiteQuest: "백 고양이 · 퍼즐",
    blackQuest: "흑 고양이 · AI 대전",
    complete: "완료",
    confirm: "확인",
  },
  en: {
    title: "Play Info",
    puzzle: "Puzzles",
    cleared: "{cleared} of {total} cleared",
    ai: "AI Matches",
    aiTotal: "{played} total",
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    aiRecord: "{played} played  {wins}W {losses}L {draws}D",
    pvp: "PVP Matches",
    pvpRecord: "{played} played  White {white} · Black {black} · Draw {draws}",
    pieces: "Piece Sets",
    owned: "{owned} of {total} color sets owned",
    quests: "Quests",
    whiteQuest: "White Cat · Puzzles",
    blackQuest: "Black Cat · AI matches",
    complete: "Complete",
    confirm: "OK",
  },
  ja: {
    title: "プレイ情報",
    puzzle: "パズル",
    cleared: "{total}問中 {cleared}問クリア",
    ai: "AI対戦",
    aiTotal: "合計 {played}回",
    easy: "やさしい",
    normal: "ふつう",
    hard: "むずかしい",
    aiRecord: "{played}回  {wins}勝 {losses}敗 {draws}分",
    pvp: "PVP対戦",
    pvpRecord: "{played}回  白 {white}勝 · 黒 {black}勝 · {draws}分",
    pieces: "所持駒",
    owned: "全{total}種中 {owned}種所持",
    quests: "クエスト",
    whiteQuest: "白ネコ · パズル",
    blackQuest: "黒ネコ · AI対戦",
    complete: "完了",
    confirm: "確認",
  },
};

function format(copy, key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    copy[key]
  );
}

function sumAiStats(ai) {
  return Object.values(ai).reduce((total, item) => ({
    played: total.played + item.played,
    wins: total.wins + item.wins,
    losses: total.losses + item.losses,
    draws: total.draws + item.draws,
  }), { played: 0, wins: 0, losses: 0, draws: 0 });
}

function addLabel(scene, layer, x, y, text, options = {}) {
  const label = scene.add.text(x, y, text, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: `${options.size ?? 20}px`,
    color: options.color ?? KUMA_COLORS.ink,
    fontStyle: options.weight ?? "500",
    align: options.align ?? "left",
  }).setOrigin(options.originX ?? 0, 0.5).setDepth(10003);
  layer.add(label);
  return label;
}

function addSectionRow(scene, layer, copy, key, value, y, valueSize = 21) {
  addLabel(scene, layer, 177, y, copy[key], { size: 21, color: "#92775c", weight: "700" });
  addLabel(scene, layer, 543, y, value, {
    size: valueSize,
    color: KUMA_COLORS.teal,
    weight: "700",
    originX: 1,
    align: "right",
  });
}

function addQuest(scene, layer, label, unlockState, y, copy) {
  const progress = Math.min(unlockState.progress, unlockState.target);
  const ratio = unlockState.target > 0 ? progress / unlockState.target : 1;
  const value = unlockState.unlocked ? copy.complete : `${progress}/${unlockState.target}`;
  addLabel(scene, layer, 177, y, label, { size: 18, color: "#6e5843", weight: "700" });
  addLabel(scene, layer, 543, y, value, {
    size: 18,
    color: unlockState.unlocked ? KUMA_COLORS.teal : "#846648",
    weight: "800",
    originX: 1,
  });
  const trackX = 177;
  const trackY = y + 24;
  const trackW = 366;
  const track = scene.add.rectangle(trackX, trackY, trackW, 7, 0xdcc9ae, 0.72)
    .setOrigin(0, 0.5).setDepth(10003);
  const fill = scene.add.rectangle(trackX, trackY, Math.max(5, trackW * ratio), 7, 0x18a1bb, 1)
    .setOrigin(0, 0.5).setDepth(10004);
  layer.add([track, fill]);
}

export function showPlayInfoPopup(scene) {
  if (scene.playInfoLayer) return;

  const stats = getPlayStats();
  const language = readPlayerState().language;
  const copy = COPY[language] || COPY.ko;
  const clearedCount = new Set(getClearedPuzzleIds()).size;
  const aiTotal = sumAiStats(stats.ai);
  const owned = SKIN_SHOP.reduce((count, skin) => (
    count
      + Number(getSkinUnlockState(skin.id, "w").unlocked)
      + Number(getSkinUnlockState(skin.id, "b").unlocked)
  ), 0);
  const totalSets = SKIN_SHOP.length * 2;
  const whiteQuest = getSkinUnlockState("cat", "w");
  const blackQuest = getSkinUnlockState("cat", "b");

  const backdrop = createModalBackdrop(scene, 9990);
  const layer = scene.add.container(0, 0).setDepth(10000);
  scene.playInfoLayer = layer;
  const px = scene.scale.width / 2;
  const py = scene.scale.height / 2 + 4;
  const panelW = Math.min(527, scene.scale.width * 0.82);
  const panelH = Math.min(660, scene.scale.height - 160);
  const panel = addPanel(scene, px, py, panelW, panelH, 10001);
  layer.add(panel);

  addLabel(scene, layer, px, py - 201, copy.title, {
    size: 29,
    weight: "900",
    originX: 0.5,
  });
  const divider = scene.add.rectangle(px, py - 175, panelW * 0.72, 2, 0xc69d72)
    .setDepth(10002);
  layer.add(divider);

  const viewportTop = py - 151;
  const viewportHeight = 331;
  const contentHeight = 708;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const content = scene.add.container(0, viewportTop).setDepth(10003);
  layer.add(content);

  addSectionRow(scene, content, copy, "puzzle", format(copy, "cleared", {
    total: PUZZLES.length,
    cleared: Math.min(clearedCount, PUZZLES.length),
  }), 24);

  addSectionRow(scene, content, copy, "ai", format(copy, "aiTotal", aiTotal), 94);
  ["easy", "normal", "hard"].forEach((difficulty, index) => {
    const item = stats.ai[difficulty];
    addLabel(scene, content, 206, 139 + index * 42, copy[difficulty], {
      size: 18,
      color: "#846f59",
      weight: "700",
    });
    addLabel(scene, content, 543, 139 + index * 42, format(copy, "aiRecord", item), {
      size: 18,
      color: "#3d3125",
      weight: "500",
      originX: 1,
    });
  });

  addLabel(scene, content, 177, 281, copy.pvp, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addLabel(scene, content, 543, 316, format(copy, "pvpRecord", {
    played: stats.pvp.played,
    white: stats.pvp.wWins,
    black: stats.pvp.bWins,
    draws: stats.pvp.draws,
  }), {
    size: language === "en" ? 15 : 17,
    color: "#3d3125",
    weight: "500",
    originX: 1,
    align: "right",
  });

  addSectionRow(scene, content, copy, "pieces", format(copy, "owned", {
    total: totalSets,
    owned,
  }), 384, 19);

  addLabel(scene, content, 177, 454, copy.quests, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addQuest(scene, content, copy.whiteQuest, whiteQuest, 510, copy);
  addQuest(scene, content, copy.blackQuest, blackQuest, 596, copy);

  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(px - panelW * 0.38, viewportTop, panelW * 0.76, viewportHeight);
  const contentMask = maskShape.createGeometryMask();
  content.setMask(contentMask);

  const hit = scene.add.rectangle(px, viewportTop + viewportHeight / 2, panelW * 0.78, viewportHeight, 0xffffff, 0.001)
    .setDepth(10005)
    .setInteractive({ useHandCursor: true });
  layer.add(hit);
  const scrollTrack = scene.add.rectangle(px + panelW * 0.39, viewportTop + viewportHeight / 2, 4, viewportHeight, 0xc9af91, 0.38)
    .setDepth(10004);
  const thumbHeight = Math.max(76, viewportHeight * (viewportHeight / contentHeight));
  const scrollThumb = scene.add.rectangle(px + panelW * 0.39, viewportTop + thumbHeight / 2, 5, thumbHeight, 0xa98764, 0.76)
    .setDepth(10005);
  layer.add([scrollTrack, scrollThumb]);

  let scrollY = 0;
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  const updateScroll = (next) => {
    scrollY = Phaser.Math.Clamp(next, 0, maxScroll);
    content.y = viewportTop - scrollY;
    const travel = viewportHeight - thumbHeight;
    scrollThumb.y = viewportTop + thumbHeight / 2 + (maxScroll ? travel * (scrollY / maxScroll) : 0);
  };
  const onWheel = (pointer, gameObjects, deltaX, deltaY) => {
    if (
      pointer.x >= px - panelW * 0.39 && pointer.x <= px + panelW * 0.39
      && pointer.y >= viewportTop && pointer.y <= viewportTop + viewportHeight
    ) updateScroll(scrollY + deltaY * 0.45);
  };
  const onPointerMove = (pointer) => {
    if (dragging && pointer.isDown) updateScroll(dragStartScroll - (pointer.y - dragStartY));
  };
  const onPointerUp = () => { dragging = false; };
  hit.on("pointerdown", (pointer) => {
    dragging = true;
    dragStartY = pointer.y;
    dragStartScroll = scrollY;
  });
  scene.input.on("wheel", onWheel);
  scene.input.on("pointermove", onPointerMove);
  scene.input.on("pointerup", onPointerUp);
  updateScroll(0);

  const close = () => {
    scene.input.off("wheel", onWheel);
    scene.input.off("pointermove", onPointerMove);
    scene.input.off("pointerup", onPointerUp);
    content.clearMask(false);
    contentMask.destroy();
    maskShape.destroy();
    backdrop.cleanup();
    layer.destroy();
    scene.playInfoLayer = null;
  };
  const confirm = addLargeTextButton(scene, px, py + 239, copy.confirm, "", close, {
    width: 210,
    height: 76,
    fontSize: 27,
    dark: true,
    depth: 10004,
  });
  layer.add([confirm.button, confirm.title]);
}
