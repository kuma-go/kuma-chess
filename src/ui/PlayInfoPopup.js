import {
  getCollectionSkinColorTotal,
  getOwnedCollectionSkinColorCount,
  getPlayStats,
  getSkinUnlockState,
  readPlayerState,
} from "../playerState.js?v=20260902-online92";
import { readProfileState } from "../profileState.js?v=20260902-online92";
import { getClearedPuzzleIds, PUZZLES } from "../puzzles.js?v=20260902-online92";
import { getMedalSummary } from "../medals.js?v=20260902-online92";
import {
  addLargeTextButton,
  addOutlinedTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
} from "./KumaUi.js?v=20260902-online92";
import { addProfileAvatar } from "./ProfileAvatar.js?v=20260902-online92";
import { showProfileEditorPopup } from "./ProfileEditorPopup.js?v=20260902-online92";
import { showLeaderboardPopup } from "./LeaderboardPopup.js?v=20260902-online92";

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
    challenge: "도전",
    aiRecord: "{played}회  {wins}승 {losses}패 {draws}무",
    pvp: "PVP 대전",
    pvpRecord: "{played}회  백 {white}승 · 흑 {black}승 · {draws}무",
    pieces: "보유 기물",
    owned: "총 {total}개 중 {owned}개 보유",
    medals: "메달 도감",
    medalOwned: "총 {total}개 중 {owned}개 획득",
    quests: "퀘스트",
    whiteQuest: "백 고양이 · 퍼즐",
    blackQuest: "흑 고양이 · AI 대전",
    complete: "완료",
    profileChange: "프로필 변경",
    leaderboard: "체스 순위",
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
    challenge: "Challenge",
    aiRecord: "{played} played  {wins}W {losses}L {draws}D",
    pvp: "PVP Matches",
    pvpRecord: "{played} played  White {white} · Black {black} · Draw {draws}",
    pieces: "Piece Sets",
    owned: "{owned} of {total} color sets owned",
    medals: "Medals",
    medalOwned: "{owned} of {total} acquired",
    quests: "Quests",
    whiteQuest: "White Cat · Puzzles",
    blackQuest: "Black Cat · AI matches",
    complete: "Complete",
    profileChange: "Edit profile",
    leaderboard: "Chess Ranking",
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
    challenge: "チャレンジ",
    aiRecord: "{played}回  {wins}勝 {losses}敗 {draws}分",
    pvp: "PVP対戦",
    pvpRecord: "{played}回  白 {white}勝 · 黒 {black}勝 · {draws}分",
    pieces: "所持駒",
    owned: "全{total}種中 {owned}種所持",
    medals: "メダル図鑑",
    medalOwned: "全{total}個中 {owned}個獲得",
    quests: "クエスト",
    whiteQuest: "白ネコ · パズル",
    blackQuest: "黒ネコ · AI対戦",
    complete: "完了",
    profileChange: "プロフィール変更",
    leaderboard: "チェスランキング",
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

function addSectionRow(scene, layer, copy, key, value, y, valueSize = 22) {
  addLabel(scene, layer, 177, y, copy[key], { size: 22, color: "#92775c", weight: "700" });
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
  addLabel(scene, layer, 177, y, label, { size: 20, color: "#6e5843", weight: "700" });
  addLabel(scene, layer, 543, y, value, {
    size: 20,
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

export function showPlayInfoPopup(scene, options = {}) {
  if (scene.playInfoLayer) return;

  const stats = getPlayStats();
  const player = readPlayerState();
  const profile = readProfileState(player);
  const language = player.language;
  const copy = COPY[language] || COPY.ko;
  const clearedCount = new Set(getClearedPuzzleIds()).size;
  const aiTotal = sumAiStats(stats.ai);
  const owned = getOwnedCollectionSkinColorCount();
  const totalSets = getCollectionSkinColorTotal();
  const whiteQuest = getSkinUnlockState("cat", "w");
  const blackQuest = getSkinUnlockState("cat", "b");
  const medals = getMedalSummary();

  const backdrop = createModalBackdrop(scene, 9990, options.externalBackdrop
    ? { capture: false, dimAlpha: 0.001 }
    : undefined);
  const layer = scene.add.container(0, 0).setDepth(10000);
  scene.playInfoLayer = layer;
  const px = scene.scale.width / 2;
  const py = scene.scale.height / 2;
  const panelW = Math.min(640, scene.scale.width - 52);
  const panelH = Math.min(896, scene.scale.height - 118);
  const panel = scene.textures.exists("kuma_ui_book_bg")
    ? scene.add.image(px, py, "kuma_ui_book_bg").setDisplaySize(panelW, panelH).setDepth(10001)
    : addPanel(scene, px, py, panelW, panelH, 10001);
  layer.add(panel);

  addLabel(scene, layer, px, py - 350, copy.title, {
    size: 29,
    weight: "900",
    originX: 0.5,
  });
  const divider = scene.add.rectangle(px, py - 316, panelW * 0.62, 2, 0xc69d72)
    .setDepth(10002);
  layer.add(divider);

  const viewportTop = py - 288;
  const viewportHeight = 526;
  const contentHeight = 980;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const content = scene.add.container(0, viewportTop).setDepth(10003);
  layer.add(content);

  addProfileAvatar(scene, content, 232, 78, profile, { size: 112, maxFrameScale: 1.35, depth: 10004 });
  addLabel(scene, content, 316, 53, profile.displayName, {
    size: profile.displayName.length > 12 ? 20 : 24,
    color: KUMA_COLORS.teal,
    weight: "800",
  });
  const openProfileEditor = () => {
    close(false);
    showProfileEditorPopup(scene, {
      externalBackdrop: options.externalBackdrop,
      onClose: () => showPlayInfoPopup(scene, options),
    });
  };
  const profileButton = addOutlinedTextButton(scene, 426, 113, copy.profileChange, openProfileEditor, {
    width: 260, height: 58, fontSize: 20, depth: 10004,
  });
  content.add([profileButton.button, profileButton.title]);
  content.add(scene.add.rectangle(360, 162, 366, 2, 0xc9aa87).setDepth(10003));

  addSectionRow(scene, content, copy, "puzzle", format(copy, "cleared", {
    total: PUZZLES.length,
    cleared: Math.min(clearedCount, PUZZLES.length),
  }), 202);

  addSectionRow(scene, content, copy, "ai", format(copy, "aiTotal", aiTotal), 272);
  ["easy", "normal", "hard", "challenge"].forEach((difficulty, index) => {
    const item = stats.ai[difficulty];
    addLabel(scene, content, 206, 317 + index * 42, copy[difficulty], {
      size: 20,
      color: "#846f59",
      weight: "700",
    });
    addLabel(scene, content, 543, 317 + index * 42, format(copy, "aiRecord", item), {
      size: 20,
      color: "#3d3125",
      weight: "500",
      originX: 1,
    });
  });

  addLabel(scene, content, 177, 506, copy.pvp, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addLabel(scene, content, 543, 541, format(copy, "pvpRecord", {
    played: stats.pvp.played,
    white: stats.pvp.wWins,
    black: stats.pvp.bWins,
    draws: stats.pvp.draws,
  }), {
    size: language === "en" ? 17 : 19,
    color: "#3d3125",
    weight: "500",
    originX: 1,
    align: "right",
  });

  addSectionRow(scene, content, copy, "pieces", format(copy, "owned", {
    total: totalSets,
    owned,
  }), 610, 20);

  addSectionRow(scene, content, copy, "medals", format(copy, "medalOwned", {
    total: medals.available,
    owned: medals.unlocked,
  }), 680, 20);
  if (medals.newCount > 0) {
    const badge = scene.add.image(555, 680, "kuma_ui_icon_new")
      .setDisplaySize(18, 24)
      .setDepth(10006);
    content.add(badge);
  }

  addLabel(scene, content, 177, 750, copy.quests, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addQuest(scene, content, copy.whiteQuest, whiteQuest, 806, copy);
  addQuest(scene, content, copy.blackQuest, blackQuest, 892, copy);

  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(px - panelW * 0.38, viewportTop, panelW * 0.76, viewportHeight);
  const contentMask = maskShape.createGeometryMask();
  content.setMask(contentMask);

  const hit = scene.add.rectangle(px, viewportTop + viewportHeight / 2, panelW * 0.78, viewportHeight, 0xffffff, 0.001)
    .setDepth(10002)
    .setInteractive({ useHandCursor: true });
  layer.add(hit);
  const profileHit = scene.add.rectangle(426, viewportTop + 113, 260, 58, 0xffffff, 0.001)
    .setDepth(10006)
    .setInteractive({ useHandCursor: true });
  profileHit.on("pointerdown", openProfileEditor);
  const profileAvatarHit = scene.add.circle(232, viewportTop + 78, 62, 0xffffff, 0.001)
    .setDepth(10006)
    .setInteractive({ useHandCursor: true });
  profileAvatarHit.on("pointerdown", openProfileEditor);
  layer.add([profileHit, profileAvatarHit]);
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
    profileHit.y = viewportTop + 113 - scrollY;
    profileAvatarHit.y = viewportTop + 78 - scrollY;
    const profileVisible = profileHit.y >= viewportTop + 22 && profileHit.y <= viewportTop + viewportHeight - 22;
    const avatarVisible = profileAvatarHit.y >= viewportTop + 62 && profileAvatarHit.y <= viewportTop + viewportHeight - 62;
    profileHit.setVisible(profileVisible);
    if (profileVisible && !profileHit.input?.enabled) profileHit.setInteractive({ useHandCursor: true });
    if (!profileVisible && profileHit.input?.enabled) profileHit.disableInteractive();
    profileAvatarHit.setVisible(avatarVisible);
    if (avatarVisible && !profileAvatarHit.input?.enabled) profileAvatarHit.setInteractive({ useHandCursor: true });
    if (!avatarVisible && profileAvatarHit.input?.enabled) profileAvatarHit.disableInteractive();
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

  const close = (invokeCallback = true) => {
    scene.input.off("wheel", onWheel);
    scene.input.off("pointermove", onPointerMove);
    scene.input.off("pointerup", onPointerUp);
    content.clearMask(false);
    contentMask.destroy();
    maskShape.destroy();
    backdrop.cleanup();
    layer.destroy();
    scene.playInfoLayer = null;
    if (invokeCallback) options.onClose?.();
  };
  const leaderboard = addLargeTextButton(scene, px - 125, py + 290, copy.leaderboard, "", () => {
    close(false);
    showLeaderboardPopup(scene, {
      externalBackdrop: options.externalBackdrop,
      onClose: () => showPlayInfoPopup(scene, options),
    });
  }, {
    width: 230,
    height: 76,
    fontSize: language === "en" ? 20 : 23,
    depth: 10004,
  });
  const confirm = addLargeTextButton(scene, px + 125, py + 290, copy.confirm, "", close, {
    width: 210,
    height: 76,
    fontSize: 25,
    dark: true,
    depth: 10004,
  });
  layer.add([leaderboard.button, leaderboard.title, confirm.button, confirm.title]);
}
