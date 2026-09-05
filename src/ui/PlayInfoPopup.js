import {
  getCollectionSkinColorTotal,
  getOwnedCollectionSkinColorCount,
  getPlayStats,
  getSkinUnlockState,
  readPlayerState,
} from "../playerState.js?v=20260906-accountinfo111";
import { readProfileState } from "../profileState.js?v=20260906-accountinfo111";
import { getClearedPuzzleIds, PUZZLES } from "../puzzles.js?v=20260906-accountinfo111";
import { getMedalSummary } from "../medals.js?v=20260906-accountinfo111";
import {
  addLargeTextButton,
  addOutlinedTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "./KumaUi.js?v=20260906-accountinfo111";
import { addProfileAvatar } from "./ProfileAvatar.js?v=20260906-accountinfo111";
import { showProfileEditorPopup } from "./ProfileEditorPopup.js?v=20260906-accountinfo111";
import { showConfirm } from "./ConfirmPopup.js?v=20260906-accountinfo111";

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
    account: "계정 보호",
    accountLocal: "현재 기기에만 저장됨",
    accountLinked: "Google 계정에 백업됨",
    connectGoogle: "Google 계정 연결",
    googleConnected: "Google 계정 연결이 완료되었습니다.",
    googleRestoreTitle: "계정 기록 불러오기",
    googleRestoreMessage: "이 Google 계정에 저장된 기록이 있습니다. 현재 기기의 기록 대신 계정 기록을 불러올까요?",
    googleRestore: "불러오기",
    googleConnecting: "Google 계정에 연결하고 있습니다.",
    googleProviderDisabled: "Firebase에서 Google 로그인을 먼저 활성화해야 합니다.",
    googleDomainMissing: "Firebase 승인 도메인에\nkumachess.com을 추가해주세요.",
    googlePopupBlocked: "로그인 창을 열 수 없습니다.\nChrome 또는 Safari에서 다시 시도해주세요.",
    googleCancelled: "Google 계정 연결을 취소했습니다.",
    googleFailed: "Google 계정에 연결할 수 없습니다.",
    cancel: "취소",
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
    account: "Account protection",
    accountLocal: "Saved on this device only",
    accountLinked: "Backed up to Google",
    connectGoogle: "Connect Google",
    googleConnected: "Your Google account is connected.",
    googleRestoreTitle: "Restore account data",
    googleRestoreMessage: "This Google account has saved progress. Replace this device's current progress with the account backup?",
    googleRestore: "Restore",
    googleConnecting: "Connecting to your Google account...",
    googleProviderDisabled: "Google sign-in must first be enabled in Firebase.",
    googleDomainMissing: "Add kumachess.com to Firebase\nauthorized domains.",
    googlePopupBlocked: "The sign-in window could not open.\nTry again in Chrome or Safari.",
    googleCancelled: "Google account connection was cancelled.",
    googleFailed: "Could not connect your Google account.",
    cancel: "Cancel",
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
    account: "アカウント保護",
    accountLocal: "この端末のみに保存",
    accountLinked: "Googleアカウントにバックアップ済み",
    connectGoogle: "Googleに接続",
    googleConnected: "Googleアカウントに接続しました。",
    googleRestoreTitle: "アカウント記録を復元",
    googleRestoreMessage: "このGoogleアカウントには保存済みの記録があります。現在の端末記録をアカウント記録に置き換えますか？",
    googleRestore: "復元",
    googleConnecting: "Googleアカウントに接続しています。",
    googleProviderDisabled: "FirebaseでGoogleログインを有効にしてください。",
    googleDomainMissing: "Firebaseの承認済みドメインに\nkumachess.comを追加してください。",
    googlePopupBlocked: "ログイン画面を開けません。\nChromeまたはSafariで再試行してください。",
    googleCancelled: "Googleアカウント接続をキャンセルしました。",
    googleFailed: "Googleアカウントに接続できません。",
    cancel: "キャンセル",
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

function cloudApi() {
  try {
    return window.parent?.KumaCloud || window.KumaCloud || null;
  } catch (_error) {
    return window.KumaCloud || null;
  }
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
  let disposed = false;
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
  const contentHeight = 1060;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const content = scene.add.container(0, viewportTop).setDepth(10003);
  layer.add(content);
  let scrollY = 0;

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
  const initialAccount = cloudApi()?.getAccountState?.() || {};
  const accountButtonX = 430;
  const accountButtonY = 198;
  const accountButtonW = 226;
  const accountButtonH = 54;
  addLabel(scene, content, 177, 181, copy.account, {
    size: 17,
    color: "#8e765f",
    weight: "800",
  });
  const accountStatus = addLabel(
    scene,
    content,
    177,
    210,
    initialAccount.googleLinked ? copy.accountLinked : copy.accountLocal,
    {
      size: language === "en" ? 12 : 13,
      color: initialAccount.googleLinked ? KUMA_COLORS.teal : "#a48769",
      weight: "700",
    },
  );
  let accountBusy = false;
  let accountButton = null;
  const postGoogleButtonState = (enabled) => {
    if (!window.parent || window.parent === window) return;
    const sceneY = viewportTop + accountButtonY - scrollY;
    const visible = sceneY - accountButtonH / 2 >= viewportTop
      && sceneY + accountButtonH / 2 <= viewportTop + viewportHeight;
    window.parent.postMessage({
      type: "kuma-google-account-bridge-state",
      open: true,
      googleButton: {
        x: accountButtonX - accountButtonW / 2,
        y: sceneY - accountButtonH / 2,
        width: accountButtonW,
        height: accountButtonH,
        sceneWidth: scene.scale.width,
        sceneHeight: scene.scale.height,
        enabled: Boolean(enabled && visible),
      },
    }, window.location.origin);
  };
  const idleAccountButtonText = () => {
    const state = cloudApi()?.getAccountState?.() || {};
    if (state.googleLinked) return copy.accountLinked;
    return state.canRestoreGoogle ? copy.googleRestore : copy.connectGoogle;
  };
  const setAccountBusy = (busy) => {
    accountBusy = busy;
    const linked = Boolean(cloudApi()?.getAccountState?.().googleLinked);
    accountButton?.setEnabled(!busy && !linked);
    accountButton?.title.setText(busy ? copy.googleConnecting : idleAccountButtonText());
    postGoogleButtonState(!busy && !linked);
  };
  const showGoogleRestoreConfirm = (api) => {
    postGoogleButtonState(false);
    showConfirm(scene, {
      title: copy.googleRestoreTitle,
      message: copy.googleRestoreMessage,
      confirmText: copy.googleRestore,
      cancelText: copy.cancel,
      depth: 12000,
      onConfirm: async () => {
        setAccountBusy(true);
        const restored = await api.restoreExistingGoogleAccount?.().catch(() => ({ ok: false }));
        if (restored?.ok) return;
        setAccountBusy(false);
        showRewardLine(scene, copy.googleFailed, {
          y: scene.scale.height * 0.52, tone: "failure", showCoin: false, depth: 13000,
        });
      },
      onCancel: () => postGoogleButtonState(!accountBusy),
    });
  };
  const handleGoogleResult = (result, api = cloudApi()) => {
    if (disposed || !layer.scene) return;
    if (result?.ok) {
      accountStatus.setText(copy.accountLinked).setColor(KUMA_COLORS.teal);
      accountButton.title.setText(copy.accountLinked);
      accountButton.setEnabled(false);
      postGoogleButtonState(false);
      showRewardLine(scene, copy.googleConnected, {
        y: scene.scale.height * 0.52, showCoin: false, depth: 13000,
      });
      return;
    }
    setAccountBusy(false);
    if (result?.reason === "account-exists" && result?.canRestore) {
      showGoogleRestoreConfirm(api);
      return;
    }
    const message = result?.reason === "provider-disabled"
      ? copy.googleProviderDisabled
      : result?.reason === "unauthorized-domain"
        ? copy.googleDomainMissing
        : result?.reason === "popup-blocked"
          ? copy.googlePopupBlocked
          : result?.reason === "cancelled"
            ? copy.googleCancelled
            : copy.googleFailed;
    showRewardLine(scene, message, {
      y: scene.scale.height * 0.52,
      tone: "failure",
      showCoin: false,
      depth: 13000,
      bandHeight: message.includes("\n") ? 112 : 84,
      fontSize: message.includes("\n") ? 25 : 29,
    });
  };
  const connectGoogleDirectly = async () => {
    if (accountBusy) return;
    const api = cloudApi();
    if (!api?.connectGoogleAccount) {
      handleGoogleResult({ ok: false, reason: "offline" }, api);
      return;
    }
    if (api.getAccountState?.().canRestoreGoogle) {
      showGoogleRestoreConfirm(api);
      return;
    }
    setAccountBusy(true);
    const result = await api.connectGoogleAccount().catch(() => ({ ok: false, reason: "failed" }));
    handleGoogleResult(result, api);
  };
  accountButton = addOutlinedTextButton(scene, accountButtonX, accountButtonY, idleAccountButtonText(), connectGoogleDirectly, {
    width: accountButtonW,
    height: accountButtonH,
    fontSize: language === "en" ? 14 : 16,
    depth: 10004,
    enabled: !initialAccount.googleLinked,
  });
  content.add([accountButton.button, accountButton.title]);
  const onGoogleAccountAction = (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type !== "kuma-google-account-action") return;
    if (event.data.action === "start") {
      setAccountBusy(true);
      return;
    }
    if (event.data.action === "restore-confirm") {
      showGoogleRestoreConfirm(cloudApi());
      return;
    }
    if (event.data.action === "result") {
      handleGoogleResult(event.data.result || { ok: false, reason: "failed" });
    }
  };
  window.addEventListener("message", onGoogleAccountAction);
  postGoogleButtonState(!initialAccount.googleLinked);
  content.add(scene.add.rectangle(360, 238, 366, 2, 0xc9aa87).setDepth(10003));

  addSectionRow(scene, content, copy, "puzzle", format(copy, "cleared", {
    total: PUZZLES.length,
    cleared: Math.min(clearedCount, PUZZLES.length),
  }), 278);

  addSectionRow(scene, content, copy, "ai", format(copy, "aiTotal", aiTotal), 348);
  ["easy", "normal", "hard", "challenge"].forEach((difficulty, index) => {
    const item = stats.ai[difficulty];
    addLabel(scene, content, 206, 393 + index * 42, copy[difficulty], {
      size: 20,
      color: "#846f59",
      weight: "700",
    });
    addLabel(scene, content, 543, 393 + index * 42, format(copy, "aiRecord", item), {
      size: 20,
      color: "#3d3125",
      weight: "500",
      originX: 1,
    });
  });

  addLabel(scene, content, 177, 582, copy.pvp, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addLabel(scene, content, 543, 617, format(copy, "pvpRecord", {
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
  }), 686, 20);

  addSectionRow(scene, content, copy, "medals", format(copy, "medalOwned", {
    total: medals.available,
    owned: medals.unlocked,
  }), 756, 20);
  if (medals.newCount > 0) {
    const badge = scene.add.image(555, 756, "kuma_ui_icon_new")
      .setDisplaySize(18, 24)
      .setDepth(10006);
    content.add(badge);
  }

  addLabel(scene, content, 177, 826, copy.quests, {
    size: 21,
    color: "#92775c",
    weight: "700",
  });
  addQuest(scene, content, copy.whiteQuest, whiteQuest, 882, copy);
  addQuest(scene, content, copy.blackQuest, blackQuest, 968, copy);

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
    const accountSceneY = viewportTop + accountButtonY - scrollY;
    const accountVisible = accountSceneY - accountButtonH / 2 >= viewportTop
      && accountSceneY + accountButtonH / 2 <= viewportTop + viewportHeight;
    accountButton.setEnabled(accountVisible && !accountBusy && !cloudApi()?.getAccountState?.().googleLinked);
    const travel = viewportHeight - thumbHeight;
    scrollThumb.y = viewportTop + thumbHeight / 2 + (maxScroll ? travel * (scrollY / maxScroll) : 0);
    postGoogleButtonState(!accountBusy && !cloudApi()?.getAccountState?.().googleLinked);
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
    if (disposed) return;
    disposed = true;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "kuma-google-account-bridge-state", open: false }, window.location.origin);
    }
    scene.input.off("wheel", onWheel);
    scene.input.off("pointermove", onPointerMove);
    scene.input.off("pointerup", onPointerUp);
    content.clearMask(false);
    contentMask.destroy();
    maskShape.destroy();
    window.removeEventListener("message", onGoogleAccountAction);
    backdrop.cleanup();
    layer.destroy();
    scene.playInfoLayer = null;
    if (invokeCallback) options.onClose?.();
  };
  const confirm = addLargeTextButton(scene, px, py + 290, copy.confirm, "", close, {
    width: 300,
    height: 76,
    fontSize: 25,
    dark: true,
    depth: 10004,
  });
  layer.add([confirm.button, confirm.title]);
}
