import {
  REWARDS,
  claimDailyReward,
  grantCoinsOnce,
  readPlayerState,
} from "./src/playerState.js?v=20260903-gameplay99";
import {
  getDailyMissionSnapshot,
} from "./src/dailyMissions.js?v=20260903-gameplay99";
import { getMedalSummary, recordAmbientMedalEvent } from "./src/medals.js?v=20260903-gameplay99";
import { readProfileState } from "./src/profileState.js?v=20260903-gameplay99";
import { installFeedbackUnlock, playFeedback } from "./src/feedback.js?v=20260903-gameplay99";
import {
  getMenuBgmPlaybackState,
  installMenuBgm,
  setMenuBgmPlaybackWanted,
  setMenuBgmVolume,
} from "./src/menuBgm.js?v=20260903-gameplay99";
import { applyMainPageContentLanguage } from "./main-page-content-i18n.js?v=20260903-gameplay99";
import { normalizeOnlineRoomCode } from "./src/onlineRoom.js?v=20260903-gameplay99";
import { clearOnlineSession, readOnlineSession, saveOnlineSession } from "./src/onlineSession.js?v=20260903-gameplay99";

const scrollCue = document.getElementById("scroll-cue");
const scrollTop = document.getElementById("scroll-top");
const gameOverlay = document.getElementById("game-overlay");
const gameFrame = document.getElementById("game-frame");
const gameLoading = document.getElementById("game-loading");
const gameLoadingMessage = document.getElementById("game-loading-message");
const retryGame = document.getElementById("retry-game");
const modeDialog = document.getElementById("mode-dialog");
const onlineDialog = document.getElementById("online-dialog");
const onlineCodeInput = document.getElementById("online-code-input");
const installButton = document.getElementById("install-button");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
const POPUP_GAME_LAUNCHES = new Set(["daily", "settings", "info", "profile", "medals"]);
const ASSET_RETRY_VERSION = "20260903-gameplay99";

window.KumaBgmHost = Object.freeze({ getPlaybackState: getMenuBgmPlaybackState });

const WEB_COPY = Object.freeze({
  ko: Object.freeze({
    lang: "ko",
    brand: "쿠마체스",
    dailyAria: "오늘의 미션",
    leftActionsAria: "오늘의 미션",
    mainActionsAria: "메인 기능",
    settingsAria: "설정",
    infoAria: "내 정보",
    medalsAria: "메달 도감",
    medalNoticeAlt: "새 메달",
    installAria: "쿠마체스 설치",
    install: "설치",
    installReward: (amount) => `설치 +${amount}코인`,
    dailyLoginReward: (amount) => `접속 보상 +${amount} 코인`,
    installIos: "공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.",
    installBrowser: "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.",
    playMenuAria: "플레이 모드 선택",
    ai: ["AI와 플레이", "AI와 실력을 겨뤄보세요."],
    pvp: ["마주보고 플레이", "로컬 2인 PVP 플레이"],
    puzzle: ["퍼즐 플레이", "체스퍼즐 짧은 전술문제"],
    online: ["온라인 플레이", "초대 2인 PVP 플레이"],
    documentLinksAria: "문서 바로가기",
    privacy: "개인정보처리방침",
    about: "게임소개 및 게임방법",
    minigamesHeading: "쿠마체스 미니게임",
    minigames: Object.freeze({
      tug: ["왕국 힘겨루기", "밀어내기 알까기 한판"],
      crown: ["왕관 쟁탈전", "왕관을 차지하여 귀환하라"],
      road: ["왕국의 길", "타일로 길 이어가기"],
      "road-puzzle": ["왕국의 길 퍼즐", "길 찾기, 미로찾기"],
      siege: ["왕국 공성전", "공성을 향한 치열한 전투"],
    }),
    directoryHeading: "게임 소개 및 게임방법",
    directoryAria: "게임 소개 및 게임방법",
    directory: Object.freeze([
      ["쿠마체스 이야기", "쿠마체스 소개 및 여정"],
      ["게임 방법", "체스 게임 방법과 룰 설명"],
      ["미니게임 소개", "미니게임 소개와 게임 방법"],
      ["체스 모드 소개", "쿠마체스 다양한 모드 안내"],
      ["기물 소개", "쿠마체스만의 기물 디자인"],
      ["업적과 보상", "도전하고 보상을 획득하세요"],
    ]),
    scrollMore: "아래로 스크롤하여 더 보기",
    scrollTop: "맨 위로",
    loading: "게임을 준비하고 있습니다.",
    loadFailed: "게임을 불러오지 못했습니다.",
    retry: "다시 불러오기",
    frameTitle: "KUMA CHESS 게임",
    close: "닫기",
    modeDefault: "미니게임",
    modeSummary: "플레이 방법을 선택하세요.",
    modeAi: ["AI 대전", "AI와 실력을 겨뤄보세요."],
    modePvp: ["마주보기 모드", "한 기기에서 함께 플레이"],
    modeHome: "메인 화면",
    onlineDialog: Object.freeze({
      title: "온라인 플레이",
      summary: "초대 코드를 공유해 친구와 대국하세요.",
      create: ["초대방 만들기", "새 코드를 만들어 친구에게 공유합니다."],
      join: ["초대 코드 입력", "친구에게 받은 코드로 참가합니다."],
      note: "비랭크 대전 · 코인 및 순위 보상 없음",
      inputTitle: "초대 코드 입력",
      inputGuide: "친구에게 받은 6자리 코드를 입력하세요.",
      enter: "입장",
      cancel: "취소",
      waiting: "상대방을 기다리고 있습니다",
      roomCode: "초대 코드",
      copy: "코드 복사",
      copied: "초대 코드를 복사했습니다.",
      closeRoom: "방 닫기",
      connecting: "온라인 서비스에 연결 중입니다.",
      offline: "온라인 서비스에 연결할 수 없습니다.",
      notFound: "초대방을 찾을 수 없습니다.",
      unavailable: "이미 시작했거나 종료된 방입니다.",
      samePlayer: "같은 기기에서는 이 방에 참가할 수 없습니다.",
      invalid: "6자리 초대 코드를 확인해주세요.",
      failed: "방에 연결하지 못했습니다. 다시 시도해주세요.",
    }),
  }),
  en: Object.freeze({
    lang: "en",
    brand: "KUMA CHESS",
    dailyAria: "Daily Missions",
    leftActionsAria: "Daily Missions",
    mainActionsAria: "Main Features",
    settingsAria: "Settings",
    infoAria: "My profile",
    medalsAria: "Medal Catalog",
    medalNoticeAlt: "New medal",
    installAria: "Install KUMA CHESS",
    install: "Install",
    installReward: (amount) => `Install +${amount} coins`,
    dailyLoginReward: (amount) => `Daily login reward +${amount} coins`,
    installIos: "Tap Share, then choose ‘Add to Home Screen.’",
    installBrowser: "Choose ‘Install app’ or ‘Add to Home Screen’ from the browser menu.",
    playMenuAria: "Choose a Play Mode",
    ai: ["Play vs AI", "Test your skills against the AI."],
    pvp: ["Face-to-Face Play", "Local two-player PvP"],
    puzzle: ["Puzzle Play", "Quick chess tactics"],
    online: ["Online Play", "Invite-only two-player PvP"],
    documentLinksAria: "Document Shortcuts",
    privacy: "Privacy Policy",
    about: "Game Guide",
    minigamesHeading: "KUMA CHESS Mini-Games",
    minigames: Object.freeze({
      tug: ["Kingdom Push Battle", "Flick pieces off the board"],
      crown: ["Crown Clash", "Claim the crown and return"],
      road: ["Royal Road", "Connect a path with tiles"],
      "road-puzzle": ["Royal Road Puzzle", "Paths and mazes"],
      siege: ["Kingdom Siege", "A fierce battle for the castle"],
    }),
    directoryHeading: "Game Guide",
    directoryAria: "Game Guide",
    directory: Object.freeze([
      ["The KUMA CHESS Story", "The story and journey"],
      ["How to Play", "Chess rules and controls"],
      ["Mini-Games", "Mini-game rules and guides"],
      ["Chess Modes", "Explore every chess mode"],
      ["Piece Collection", "Original KUMA CHESS pieces"],
      ["Achievements & Rewards", "Take on challenges and earn rewards"],
    ]),
    scrollMore: "Scroll down to see more",
    scrollTop: "Back to top",
    loading: "Preparing the game.",
    loadFailed: "Could not load the game.",
    retry: "Try Again",
    frameTitle: "KUMA CHESS Game",
    close: "Close",
    modeDefault: "Mini-Game",
    modeSummary: "Choose how to play.",
    modeAi: ["VS AI", "Test your skills against the AI."],
    modePvp: ["Face-to-Face", "Play together on one device"],
    modeHome: "Main Menu",
    onlineDialog: Object.freeze({
      title: "Online Play",
      summary: "Share an invite code and play a friend.",
      create: ["Create Invite Room", "Make a new code to share with a friend."],
      join: ["Enter Invite Code", "Join with a code from your friend."],
      note: "Unranked · No coin or ranking rewards",
      inputTitle: "Enter Invite Code",
      inputGuide: "Enter the 6-character code from your friend.",
      enter: "Join",
      cancel: "Cancel",
      waiting: "Waiting for another player",
      roomCode: "Invite Code",
      copy: "Copy Code",
      copied: "Invite code copied.",
      closeRoom: "Close Room",
      connecting: "Connecting to online services.",
      offline: "Online services are unavailable.",
      notFound: "Invite room not found.",
      unavailable: "This room has started or ended.",
      samePlayer: "This device cannot join its own room.",
      invalid: "Check the 6-character invite code.",
      failed: "Could not connect to the room. Try again.",
    }),
  }),
  ja: Object.freeze({
    lang: "ja",
    brand: "クマチェス",
    dailyAria: "デイリーミッション",
    leftActionsAria: "今日のミッション",
    mainActionsAria: "メイン機能",
    settingsAria: "設定",
    infoAria: "マイプロフィール",
    medalsAria: "メダル図鑑",
    medalNoticeAlt: "新しいメダル",
    installAria: "KUMA CHESSをインストール",
    install: "インストール",
    installReward: (amount) => `インストール +${amount}コイン`,
    dailyLoginReward: (amount) => `ログイン報酬 +${amount}コイン`,
    installIos: "共有ボタンを押し、「ホーム画面に追加」を選んでください。",
    installBrowser: "ブラウザメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。",
    playMenuAria: "プレイモード選択",
    ai: ["AIとプレイ", "AIと腕を競いましょう。"],
    pvp: ["対面プレイ", "ローカル2人対戦"],
    puzzle: ["パズルプレイ", "短いチェス戦術問題"],
    online: ["オンラインプレイ", "招待制2人対戦"],
    documentLinksAria: "ドキュメントへのリンク",
    privacy: "プライバシーポリシー",
    about: "ゲーム紹介・遊び方",
    minigamesHeading: "KUMA CHESS ミニゲーム",
    minigames: Object.freeze({
      tug: ["王国押し合い", "駒をはじき出す対戦"],
      crown: ["王冠争奪戦", "王冠を手にして帰還せよ"],
      road: ["王国の道", "タイルで道をつなぐ"],
      "road-puzzle": ["王国の道 パズル", "道探し・迷路"],
      siege: ["王国攻城戦", "城を巡る激しい戦い"],
    }),
    directoryHeading: "ゲーム紹介・遊び方",
    directoryAria: "ゲーム紹介・遊び方",
    directory: Object.freeze([
      ["KUMA CHESSの物語", "ゲームの紹介と旅"],
      ["遊び方", "チェスのルールと操作"],
      ["ミニゲーム紹介", "ミニゲームの遊び方"],
      ["チェスモード紹介", "さまざまなモードの案内"],
      ["駒コレクション", "KUMA CHESSだけの駒"],
      ["実績と報酬", "挑戦して報酬を獲得"],
    ]),
    scrollMore: "下へスクロールしてもっと見る",
    scrollTop: "一番上へ",
    loading: "ゲームを準備しています。",
    loadFailed: "ゲームを読み込めませんでした。",
    retry: "再読み込み",
    frameTitle: "KUMA CHESS ゲーム",
    close: "閉じる",
    modeDefault: "ミニゲーム",
    modeSummary: "プレイ方法を選んでください。",
    modeAi: ["AI対戦", "AIと腕を競いましょう。"],
    modePvp: ["対面モード", "1台の端末で一緒にプレイ"],
    modeHome: "メイン画面",
    onlineDialog: Object.freeze({
      title: "オンライン対戦",
      summary: "招待コードを共有して友だちと対局します。",
      create: ["招待ルーム作成", "新しいコードを友だちに共有します。"],
      join: ["招待コード入力", "友だちからのコードで参加します。"],
      note: "ランク外 · コイン・ランキング報酬なし",
      inputTitle: "招待コード入力",
      inputGuide: "友だちから受け取った6文字を入力してください。",
      enter: "入場",
      cancel: "キャンセル",
      waiting: "相手を待っています",
      roomCode: "招待コード",
      copy: "コードをコピー",
      copied: "招待コードをコピーしました。",
      closeRoom: "ルームを閉じる",
      connecting: "オンラインサービスに接続中です。",
      offline: "オンラインサービスに接続できません。",
      notFound: "招待ルームが見つかりません。",
      unavailable: "開始済み、または終了したルームです。",
      samePlayer: "同じ端末から自分のルームには参加できません。",
      invalid: "6文字の招待コードを確認してください。",
      failed: "ルームに接続できませんでした。もう一度お試しください。",
    }),
  }),
});

let lastGameTrigger = null;
let scrollTicking = false;
let gameSession = 0;
let gameReadyTimer = 0;
let gameRuntimeReady = false;
let gameRuntimeBooting = false;
let runtimePreloadSession = "";
let requestedGame = null;
let renderingHomeState = false;
let pendingMinigameLaunch = "";
let activeWebLanguage = "ko";
let onlineBusy = false;
let onlineRoomCode = "";
let onlinePlayerColor = "w";
let onlineUnsubscribe = null;
let onlineTrigger = null;

const MINIGAME_MODE_CARD_ART = Object.freeze({
  tug: "./assets/kuma/web/image%20440.png",
  crown: "./assets/kuma/web/image%20438.png",
  road: "./assets/kuma/web/image%20441.png",
  "road-puzzle": "./assets/kuma/web/image%20437.png",
  siege: "./assets/kuma/web/image%20439.png",
});

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value != null) element.textContent = value;
}

function setPair(selector, pair) {
  if (!pair) return;
  setText(`${selector} strong`, pair[0]);
  setText(`${selector} small`, pair[1]);
}

function currentWebCopy() {
  return WEB_COPY[activeWebLanguage] || WEB_COPY.ko;
}

function renderHomeLanguage(language) {
  activeWebLanguage = WEB_COPY[language] ? language : "ko";
  const copy = currentWebCopy();
  document.documentElement.lang = copy.lang;

  setText(".hero-nameplate", copy.brand);
  document.getElementById("daily-button")?.setAttribute("aria-label", copy.dailyAria);
  document.querySelector(".hero-actions-left")?.setAttribute("aria-label", copy.leftActionsAria);
  document.querySelector(".hero-actions-right")?.setAttribute("aria-label", copy.mainActionsAria);
  document.querySelector("[data-open-settings]")?.setAttribute("aria-label", copy.settingsAria);
  document.querySelector('[data-open-game][data-launch="info"]')?.setAttribute("aria-label", copy.infoAria);
  document.querySelector('[data-open-game][data-launch="medals"]')?.setAttribute("aria-label", copy.medalsAria);
  document.querySelector("#medal-new img")?.setAttribute("alt", copy.medalNoticeAlt);
  installButton?.setAttribute("aria-label", copy.installAria);
  document.querySelector(".play-menu")?.setAttribute("aria-label", copy.playMenuAria);
  setPair('.primary-play-panel [data-launch="ai"]', copy.ai);
  setPair('.primary-play-panel [data-launch="pvp"]', copy.pvp);
  setPair('.secondary-play-grid .secondary-play:nth-child(1)', copy.puzzle);
  setPair('.secondary-play-grid .secondary-play:nth-child(2)', copy.online);

  const documentLinks = document.querySelector(".document-links");
  documentLinks?.setAttribute("aria-label", copy.documentLinksAria);
  const documentLinkItems = documentLinks?.querySelectorAll("a") || [];
  if (documentLinkItems[0]) documentLinkItems[0].textContent = copy.privacy;
  if (documentLinkItems[1]) documentLinkItems[1].textContent = copy.about;

  setText("#minigames > .ornate-heading", copy.minigamesHeading);
  document.querySelectorAll(".minigame-card").forEach((button) => {
    const launch = button.dataset.launch;
    const itemCopy = copy.minigames[launch];
    if (!itemCopy) return;
    setPair(`.minigame-card[data-launch="${launch}"]`, itemCopy);
    button.dataset.title = itemCopy[0];
    button.querySelector("img")?.setAttribute("alt", itemCopy[0]);
  });

  const directory = document.getElementById("directory");
  directory?.setAttribute("aria-label", copy.directoryAria);
  setText("#directory > .ornate-heading", copy.directoryHeading);
  directory?.querySelectorAll(".directory-grid > a").forEach((link, index) => {
    const itemCopy = copy.directory[index];
    if (!itemCopy) return;
    const strong = link.querySelector("strong");
    const small = link.querySelector("small");
    if (strong) strong.textContent = itemCopy[0];
    if (small) small.textContent = itemCopy[1];
  });

  setText("#scroll-cue > span", copy.scrollMore);
  scrollCue?.setAttribute("aria-label", copy.scrollMore);
  setText("#scroll-top > span", copy.scrollTop);
  scrollTop?.setAttribute("aria-label", copy.scrollTop);
  if (gameLoadingMessage && !gameOverlay?.classList.contains("is-failed")) gameLoadingMessage.textContent = copy.loading;
  if (retryGame) retryGame.textContent = copy.retry;
  gameFrame?.setAttribute("title", copy.frameTitle);

  setText("#mode-dialog .dialog-summary", copy.modeSummary);
  setPair('#mode-dialog [data-minigame-mode="ai"]', copy.modeAi);
  setPair('#mode-dialog [data-minigame-mode="pvp"]', copy.modePvp);
  setText("#mode-dialog .mode-home", copy.modeHome);
  document.querySelector("#mode-dialog .mode-home")?.setAttribute("aria-label", copy.modeHome);
  if (!pendingMinigameLaunch) setText("#mode-dialog-title", copy.modeDefault);

  const online = copy.onlineDialog;
  setText("#online-dialog [data-online-title]", online.title);
  setText("#online-dialog [data-online-summary]", online.summary);
  setPair("#online-dialog [data-online-create]", online.create);
  setPair("#online-dialog [data-online-code-open]", online.join);
  setText("#online-dialog [data-online-note]", online.note);
  setText("#online-dialog [data-online-close]", copy.modeHome);
  setText("#online-dialog [data-online-code-title]", online.inputTitle);
  setText("#online-dialog [data-online-code-guide]", online.inputGuide);
  setText("#online-dialog [data-online-back] span", online.cancel);
  setText("#online-dialog [data-online-enter] span", online.enter);
  setText("#online-dialog [data-online-waiting-title]", online.waiting);
  setText("#online-dialog [data-online-room-label]", online.roomCode);
  setText("#online-dialog [data-online-copy] span", online.copy);
  setText("#online-dialog [data-online-cancel-room] span", online.closeRoom);
  onlineCodeInput?.setAttribute("aria-label", online.inputTitle);
  applyMainPageContentLanguage(activeWebLanguage);
}

function openDialog(dialog, trigger = document.activeElement) {
  if (!dialog) return;
  dialog.returnFocusTarget = trigger;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  dialog.returnFocusTarget?.focus?.({ preventScroll: true });
}

function fitModeButtonLabel(element) {
  if (!element) return;
  element.style.removeProperty("font-size");
  if (element.clientWidth <= 0) return;

  const style = getComputedStyle(element);
  const baseSize = Number.parseFloat(style.fontSize);
  if (!Number.isFinite(baseSize)) return;
  const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const availableWidth = Math.max(0, element.clientWidth - horizontalPadding - 2);
  const text = element.textContent?.trim() || "";
  if (!text) return;
  const probe = fitModeButtonLabel.measureProbe ||= document.createElement("span");
  if (!probe.isConnected) {
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      display: "block",
      width: "max-content",
      visibility: "hidden",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    });
    document.body.append(probe);
  }
  probe.textContent = text;
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontStyle = style.fontStyle;
  probe.style.fontVariant = style.fontVariant;
  probe.style.fontWeight = style.fontWeight;
  probe.style.letterSpacing = style.letterSpacing;
  const measureAt = (fontSize) => {
    probe.style.fontSize = `${fontSize}px`;
    return probe.getBoundingClientRect().width;
  };
  const minimumSize = Math.max(11, baseSize * 0.74);
  let size = baseSize;
  while (measureAt(size) > availableWidth && size > minimumSize) {
    size = Math.max(minimumSize, size - 0.5);
  }
  if (size < baseSize) element.style.fontSize = `${size}px`;
}

function fitModeDialogLabels() {
  modeDialog?.querySelectorAll(".mode-choice-grid strong, .mode-home").forEach(fitModeButtonLabel);
}

function installMinigameImageRecovery() {
  document.querySelectorAll(".minigame-card img, #mode-dialog .mode-card-art").forEach((image) => {
    const retry = () => {
      if (image.dataset.kumaImageRetried === "true") return;
      image.dataset.kumaImageRetried = "true";
      const source = new URL(image.currentSrc || image.src, window.location.href);
      source.searchParams.set("assetVersion", ASSET_RETRY_VERSION);
      image.src = source.href;
    };
    const verify = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        retry();
        return;
      }
      image.decode?.().catch(retry);
    };
    image.addEventListener("error", retry);
    if (image.complete) verify();
    else image.addEventListener("load", verify, { once: true });
  });
}

function ensureHomeMotionStarted() {
  if (reducedMotion) return;
  requestAnimationFrame(() => {
    document.querySelectorAll(".hero-logo-layer, .hero-logo-layer img").forEach((element) => {
      element.getAnimations?.().forEach((animation) => animation.play());
    });
  });
}

function showHomeRewardLine(message) {
  const line = document.getElementById("home-reward-line");
  const label = document.getElementById("home-reward-line-label");
  if (!line || !label || !message) return;
  label.textContent = message;
  line.hidden = false;
  line.getAnimations?.().forEach((animation) => animation.cancel());
  if (reducedMotion) {
    window.setTimeout(() => { line.hidden = true; }, 2200);
    return;
  }
  const animation = line.animate([
    { opacity: 0, transform: "translate(-50%, -50%) scaleX(.05)" },
    { opacity: 1, transform: "translate(-50%, -50%) scaleX(1)", offset: 0.1 },
    { opacity: 1, transform: "translate(-50%, -50%) scaleX(1)", offset: 0.8 },
    { opacity: 0, transform: "translate(-50%, -50%) scaleX(.2)" },
  ], { duration: 2600, easing: "ease", fill: "both" });
  animation.finished.finally(() => { line.hidden = true; });
  playFeedback("reward");
}

function renderHomeState() {
  if (renderingHomeState) return;
  renderingHomeState = true;
  try {
    const state = readPlayerState();
    const daily = getDailyMissionSnapshot();
    const medals = getMedalSummary();
    const completed = daily.missions.filter((mission) => mission.complete).length;

    renderHomeLanguage(state.language);

    const coinCount = document.getElementById("coin-count");
    const dailyCount = document.getElementById("daily-count");
    const dailyNew = document.getElementById("daily-new");
    const dailyRewardEffect = document.getElementById("daily-reward-effect");
    const dailyRewardAmount = document.getElementById("daily-reward-amount");
    const medalNew = document.getElementById("medal-new");
    if (coinCount) coinCount.textContent = String(state.coins);
    if (dailyCount) dailyCount.textContent = `${completed}/${daily.missions.length}`;
    if (dailyNew) dailyNew.hidden = !daily.hasNotice;
    if (dailyRewardEffect) dailyRewardEffect.hidden = daily.pendingRewardTotal <= 0;
    if (dailyRewardAmount) dailyRewardAmount.textContent = `+${Math.min(daily.pendingRewardTotal, 99)}`;
    if (medalNew) medalNew.hidden = medals.newCount <= 0;
    syncInstallButton();
  } finally {
    renderingHomeState = false;
  }
}

function openDaily(event) {
  event?.preventDefault?.();
  openGameLaunch("daily", event?.currentTarget);
}

function openSettings(event) {
  event?.preventDefault?.();
  openGameLaunch("settings", event?.currentTarget);
}

function syncInstallButton() {
  if (!installButton) return;
  const copy = currentWebCopy();
  const install = window.KumaInstall?.getState?.();
  const alreadyClaimed = readPlayerState().rewardClaims.includes("pwa-install-v1");
  installButton.hidden = !install?.available || install.standalone;
  const label = document.getElementById("install-label");
  if (label) label.textContent = install?.rewardEligible && !alreadyClaimed
    ? copy.installReward(REWARDS.install)
    : copy.install;
}

function consumeInstallReward() {
  if (!window.KumaInstall?.consumeVerifiedInstall?.()) return;
  grantCoinsOnce("pwa-install-v1", REWARDS.install);
  renderHomeState();
}

async function requestInstall() {
  const copy = currentWebCopy();
  const result = await window.KumaInstall?.request?.();
  if (result?.status === "guide") {
    window.alert(result.platform === "ios"
      ? copy.installIos
      : copy.installBrowser);
  }
  consumeInstallReward();
  syncInstallButton();
}

function syncScrollControls() {
  scrollTicking = false;
  const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  const nearBottom = y + window.innerHeight >= pageHeight - 24;
  if (nearBottom && pageHeight > window.innerHeight * 1.5) {
    recordAmbientMedalEvent({ eventId: "main-page-full-scroll:v1", type: "thorough-visitor" });
  }
  const showTop = y > Math.max(320, window.innerHeight * 0.45);
  const cueProgress = Math.min(1, y / 180);
  if (scrollCue) {
    scrollCue.style.setProperty("--cue-progress", cueProgress.toFixed(3));
    const cueWidth = scrollCue.getBoundingClientRect().width || window.innerWidth;
    scrollCue.style.setProperty("--cue-offset", `${Math.round(-cueWidth * 0.028 * cueProgress)}px`);
    scrollCue.classList.toggle("is-hidden", nearBottom || cueProgress >= 0.995);
    scrollCue.setAttribute("aria-hidden", String(nearBottom || cueProgress >= 0.995));
  }
  if (scrollTop) {
    scrollTop.hidden = !showTop;
    scrollTop.setAttribute("aria-hidden", String(!showTop));
  }
}

function requestScrollSync() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(syncScrollControls);
}

function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  [420, 900].forEach((delay) => window.setTimeout(() => {
    if (Math.abs(target.getBoundingClientRect().top) > 2) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, delay));
}

function markGameReady() {
  window.clearTimeout(gameReadyTimer);
  gameOverlay?.classList.remove("is-failed");
  gameOverlay?.classList.add("is-ready");
}

function resetGameLoading() {
  gameOverlay?.classList.remove("is-ready", "is-failed");
  if (gameLoadingMessage) gameLoadingMessage.textContent = currentWebCopy().loading;
  if (retryGame) retryGame.hidden = true;
}

function showGameLoadError(recoverReadyFrame = false) {
  if (!gameOverlay || gameOverlay.hidden) return;
  if (gameOverlay.classList.contains("is-ready") && !recoverReadyFrame) return;
  if (recoverReadyFrame) gameOverlay.classList.remove("is-ready");
  gameOverlay.classList.add("is-failed");
  if (gameLoadingMessage) gameLoadingMessage.textContent = currentWebCopy().loadFailed;
  if (retryGame) retryGame.hidden = false;
}

function preloadGameRuntime(forceReload = false) {
  if (!gameFrame || (gameRuntimeBooting && !forceReload)) return;
  if (gameRuntimeReady && !forceReload) return;
  gameRuntimeReady = false;
  gameRuntimeBooting = true;
  runtimePreloadSession = `preload-${++gameSession}`;
  const url = new URL(gameFrame.dataset.src || "./play.html", window.location.href);
  url.searchParams.set("launch", "preload");
  url.searchParams.delete("mode");
  url.searchParams.set("hostSession", runtimePreloadSession);
  if (forceReload) url.searchParams.set("runtimeReload", String(Date.now()));
  gameFrame.src = url.href;
}

function dispatchRequestedGame() {
  if (!gameRuntimeReady || !requestedGame || !gameFrame?.contentWindow) return;
  resetGameLoading();
  gameFrame.contentWindow.postMessage({
    type: "kuma-game-launch",
    launch: requestedGame.launch,
    mode: requestedGame.mode,
    hostSession: requestedGame.hostSession,
    payload: requestedGame.payload,
  }, window.location.origin);
  window.clearTimeout(gameReadyTimer);
  gameReadyTimer = window.setTimeout(showGameLoadError, 12000);
}

function loadPendingGame() {
  if (!requestedGame) return;
  resetGameLoading();
  preloadGameRuntime(true);
  window.clearTimeout(gameReadyTimer);
  gameReadyTimer = window.setTimeout(showGameLoadError, 12000);
}

function openGameLaunch(launch, trigger, mode = "", payload = null) {
  lastGameTrigger = trigger || document.activeElement;
  if (!gameOverlay || !gameFrame) return;
  requestedGame = {
    launch,
    mode,
    hostSession: String(++gameSession),
    payload,
  };
  gameOverlay.classList.toggle("is-popup", POPUP_GAME_LAUNCHES.has(launch));
  gameOverlay.classList.toggle("is-content", !POPUP_GAME_LAUNCHES.has(launch));
  document.body.classList.toggle("game-popup-open", POPUP_GAME_LAUNCHES.has(launch));
  document.body.classList.remove("game-wallet-open");
  resetGameLoading();
  gameOverlay.hidden = false;
  document.body.classList.add("game-open");
  setMenuBgmPlaybackWanted(true);
  if (gameRuntimeReady) dispatchRequestedGame();
  else preloadGameRuntime();
  gameFrame?.focus({ preventScroll: true });
}

function openGame(event) {
  event?.preventDefault?.();
  openGameLaunch(event?.currentTarget?.dataset?.launch || "", event?.currentTarget);
}

function openMinigameMode(event) {
  event?.preventDefault?.();
  pendingMinigameLaunch = event.currentTarget.dataset.launch || "";
  const copy = currentWebCopy();
  const cardArt = MINIGAME_MODE_CARD_ART[pendingMinigameLaunch] || MINIGAME_MODE_CARD_ART.tug;
  modeDialog.querySelectorAll(".mode-card-art").forEach((image) => {
    image.src = cardArt;
  });
  document.getElementById("mode-dialog-title").textContent = copy.minigames[pendingMinigameLaunch]?.[0]
    || event.currentTarget.dataset.title
    || copy.modeDefault;
  openDialog(modeDialog, event.currentTarget);
  requestAnimationFrame(fitModeDialogLabels);
}

function chooseMinigameMode(event) {
  const launch = pendingMinigameLaunch;
  const trigger = modeDialog?.returnFocusTarget;
  const mode = event.currentTarget.dataset.minigameMode;
  closeDialog(modeDialog);
  if (launch && ["ai", "pvp"].includes(mode)) openGameLaunch(launch, trigger, mode);
}

function onlineErrorMessage(reason) {
  const copy = currentWebCopy().onlineDialog;
  if (reason === "room-not-found") return copy.notFound;
  if (reason === "room-unavailable") return copy.unavailable;
  if (reason === "same-player") return copy.samePlayer;
  if (reason === "invalid-code") return copy.invalid;
  if (["permission-denied", "unavailable", "offline", "watch-failed"].includes(reason)) return copy.offline;
  return copy.failed;
}

function setOnlineStatus(selector, message = "") {
  const element = onlineDialog?.querySelector(selector);
  if (element) element.textContent = message;
}

function setOnlineView(view) {
  if (onlineDialog) onlineDialog.dataset.onlineViewState = view;
  onlineDialog?.querySelectorAll("[data-online-view]").forEach((section) => {
    section.hidden = section.dataset.onlineView !== view;
  });
}

function setOnlineBusy(value) {
  onlineBusy = Boolean(value);
  if (onlineDialog) onlineDialog.dataset.onlineBusy = String(onlineBusy);
  onlineDialog?.querySelectorAll("button, input").forEach((control) => {
    control.disabled = onlineBusy && !control.matches("[data-online-close]");
  });
}

function stopOnlineWatch() {
  onlineUnsubscribe?.();
  onlineUnsubscribe = null;
}

function launchOnlineMatch(room) {
  if (!room || room.status !== "active") return;
  stopOnlineWatch();
  const payload = {
    room,
    code: onlineRoomCode || room.code,
    playerColor: onlinePlayerColor,
  };
  closeDialog(onlineDialog);
  openGameLaunch("online-game", onlineTrigger, "", payload);
}

function watchOnlineRoom(code, color) {
  stopOnlineWatch();
  onlineRoomCode = normalizeOnlineRoomCode(code);
  onlinePlayerColor = color === "b" ? "b" : "w";
  const cloud = window.KumaCloud;
  if (!cloud?.watchOnlineRoom || onlineRoomCode.length !== 6) {
    setOnlineBusy(false);
    setOnlineStatus("[data-online-waiting-status]", currentWebCopy().onlineDialog.offline);
    return;
  }
  onlineUnsubscribe = cloud.watchOnlineRoom(
    onlineRoomCode,
    (room) => {
      if (!room) {
        clearOnlineSession(onlineRoomCode);
        stopOnlineWatch();
        setOnlineBusy(false);
        setOnlineView("entry");
        setOnlineStatus("[data-online-entry-status]", currentWebCopy().onlineDialog.notFound);
        return;
      }
      if (room.status === "active") {
        launchOnlineMatch(room);
        return;
      }
      if (room.status !== "waiting") {
        clearOnlineSession(onlineRoomCode);
        stopOnlineWatch();
        setOnlineBusy(false);
        setOnlineView("entry");
        setOnlineStatus("[data-online-entry-status]", currentWebCopy().onlineDialog.unavailable);
        return;
      }
      setOnlineBusy(false);
      setOnlineView("waiting");
      setOnlineStatus("[data-online-waiting-status]", "");
    },
    (reason) => {
      setOnlineBusy(false);
      setOnlineStatus("[data-online-waiting-status]", onlineErrorMessage(reason));
    },
  );
}

function openOnlineDialog(event) {
  event?.preventDefault?.();
  onlineTrigger = event?.currentTarget || document.activeElement;
  setOnlineBusy(false);
  setOnlineStatus("[data-online-entry-status]", "");
  setOnlineStatus("[data-online-code-status]", "");
  setOnlineStatus("[data-online-waiting-status]", "");
  const session = readOnlineSession();
  if (session) {
    onlineRoomCode = session.code;
    onlinePlayerColor = session.color;
    setOnlineView("waiting");
    const codeLabel = onlineDialog?.querySelector("[data-online-room-code]");
    if (codeLabel) codeLabel.textContent = session.code;
    setOnlineBusy(true);
  } else {
    onlineRoomCode = "";
    onlinePlayerColor = "w";
    setOnlineView("entry");
  }
  openDialog(onlineDialog, onlineTrigger);
  if (session) watchOnlineRoom(session.code, session.color);
}

function closeOnlineDialog() {
  stopOnlineWatch();
  closeDialog(onlineDialog);
}

async function createOnlineRoom() {
  if (onlineBusy) return;
  const cloud = window.KumaCloud;
  if (!cloud?.createOnlineRoom) {
    setOnlineStatus("[data-online-entry-status]", currentWebCopy().onlineDialog.offline);
    return;
  }
  setOnlineBusy(true);
  setOnlineStatus("[data-online-entry-status]", currentWebCopy().onlineDialog.connecting);
  try {
    const result = await cloud.createOnlineRoom();
    if (!result?.ok) {
      setOnlineBusy(false);
      setOnlineStatus("[data-online-entry-status]", onlineErrorMessage(result?.reason));
      return;
    }
    onlineRoomCode = result.code;
    onlinePlayerColor = result.color;
    saveOnlineSession(result.code, result.color);
    const codeLabel = onlineDialog?.querySelector("[data-online-room-code]");
    if (codeLabel) codeLabel.textContent = result.code;
    setOnlineView("waiting");
    setOnlineStatus("[data-online-waiting-status]", currentWebCopy().onlineDialog.connecting);
    watchOnlineRoom(result.code, result.color);
  } catch (_error) {
    setOnlineBusy(false);
    setOnlineStatus("[data-online-entry-status]", currentWebCopy().onlineDialog.offline);
  }
}

function showOnlineCodeEntry() {
  if (onlineBusy) return;
  setOnlineView("code");
  setOnlineStatus("[data-online-code-status]", "");
  if (onlineCodeInput) onlineCodeInput.value = "";
  window.setTimeout(() => onlineCodeInput?.focus(), 0);
}

function showOnlineEntry() {
  if (onlineBusy) return;
  setOnlineStatus("[data-online-code-status]", "");
  setOnlineView("entry");
}

async function joinOnlineRoom(event) {
  event?.preventDefault?.();
  if (onlineBusy) return;
  const code = normalizeOnlineRoomCode(onlineCodeInput?.value);
  if (onlineCodeInput) onlineCodeInput.value = code;
  if (code.length !== 6) {
    setOnlineStatus("[data-online-code-status]", currentWebCopy().onlineDialog.invalid);
    return;
  }
  const cloud = window.KumaCloud;
  if (!cloud?.joinOnlineRoom) {
    setOnlineStatus("[data-online-code-status]", currentWebCopy().onlineDialog.offline);
    return;
  }
  setOnlineBusy(true);
  setOnlineStatus("[data-online-code-status]", currentWebCopy().onlineDialog.connecting);
  try {
    const result = await cloud.joinOnlineRoom(code);
    if (!result?.ok) {
      setOnlineBusy(false);
      setOnlineStatus("[data-online-code-status]", onlineErrorMessage(result?.reason));
      return;
    }
    onlineRoomCode = result.code;
    onlinePlayerColor = result.color;
    saveOnlineSession(result.code, result.color);
    const codeLabel = onlineDialog?.querySelector("[data-online-room-code]");
    if (codeLabel) codeLabel.textContent = result.code;
    setOnlineView("waiting");
    watchOnlineRoom(result.code, result.color);
  } catch (_error) {
    setOnlineBusy(false);
    setOnlineStatus("[data-online-code-status]", currentWebCopy().onlineDialog.offline);
  }
}

async function copyOnlineCode() {
  try {
    await navigator.clipboard.writeText(onlineRoomCode);
    setOnlineStatus("[data-online-waiting-status]", currentWebCopy().onlineDialog.copied);
  } catch (_error) {
    setOnlineStatus("[data-online-waiting-status]", onlineRoomCode);
  }
}

async function cancelOnlineRoom() {
  if (onlineBusy || !onlineRoomCode) return;
  const code = onlineRoomCode;
  stopOnlineWatch();
  setOnlineBusy(true);
  setOnlineStatus("[data-online-waiting-status]", currentWebCopy().onlineDialog.connecting);
  try {
    await window.KumaCloud?.leaveOnlineRoom?.(code);
  } finally {
    clearOnlineSession(code);
    onlineRoomCode = "";
    setOnlineBusy(false);
    setOnlineStatus("[data-online-entry-status]", "");
    setOnlineView("entry");
  }
}

function hideGame(options = {}) {
  if (!gameOverlay || gameOverlay.hidden) return;
  if (options?.hostSession && options.hostSession !== requestedGame?.hostSession) return;
  const notifyRuntime = options?.notifyRuntime !== false;
  gameOverlay.hidden = true;
  resetGameLoading();
  document.body.classList.remove("game-open");
  document.body.classList.remove("game-popup-open");
  document.body.classList.remove("game-wallet-open");
  window.dispatchEvent(new CustomEvent("kuma-game-closed"));
  window.clearTimeout(gameReadyTimer);
  requestedGame = null;
  gameOverlay.classList.remove("is-popup", "is-content");
  if (notifyRuntime) {
    gameFrame?.contentWindow?.postMessage({ type: "kuma-game-suspend" }, window.location.origin);
  }
  setMenuBgmPlaybackWanted(true);
  renderHomeState();
  lastGameTrigger?.focus?.({ preventScroll: true });
}

window.KumaWebHomeHost = Object.freeze({
  returnHome(payload = {}) {
    hideGame({ notifyRuntime: false, hostSession: payload.hostSession });
  },
});

function createAd(container, slot, format) {
  if (!container || !/^\d+$/.test(String(slot || ""))) return;
  const config = window.KUMA_ADS_CONFIG;
  const ad = document.createElement("ins");
  ad.className = "adsbygoogle";
  ad.dataset.adClient = config.client;
  ad.dataset.adSlot = slot;
  ad.dataset.adFormat = format;
  ad.dataset.fullWidthResponsive = "true";
  container.append(ad);
  container.hidden = false;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (_error) {
    container.hidden = true;
  }
}

function loadMainAdSenseScript(client) {
  if (document.getElementById("kuma-adsense-script")) return;
  const script = document.createElement("script");
  script.id = "kuma-adsense-script";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);
}

function installAds() {
  const config = window.KUMA_ADS_CONFIG;
  const hasValidClient = /^ca-pub-\d+$/.test(String(config?.client || ""));
  const hasValidSlot = [config?.sideSlot, config?.inlineSlot].some((slot) => /^\d+$/.test(String(slot || "")));
  if (!config?.enabled || !hasValidClient || !hasValidSlot) return;
  loadMainAdSenseScript(String(config.client));
  createAd(document.querySelector('[data-ad-position="left"]'), config.sideSlot, "vertical");
  createAd(document.querySelector('[data-ad-position="right"]'), config.sideSlot, "vertical");
  document.querySelectorAll(".inline-ad").forEach((container) => createAd(container, config.inlineSlot, "auto"));
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("button:not(:disabled), a[href]");
    if (control) playFeedback("ui");
  });
  if (document.documentElement.dataset.kumaScrollFallback !== "true") {
    scrollCue?.addEventListener("click", () => window.scrollBy({
      top: Math.max(420, window.innerHeight * 0.86),
      behavior: reducedMotion ? "auto" : "smooth",
    }));
    scrollTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));
  }
  document.querySelectorAll("[data-scroll-target]").forEach((button) => button.addEventListener("click", () => {
    scrollToSection(button.dataset.scrollTarget);
  }));
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((link) => link.addEventListener("click", (event) => {
    const selector = link.getAttribute("href");
    if (!document.querySelector(selector)) return;
    event.preventDefault();
    history.replaceState(null, "", selector);
    scrollToSection(selector);
  }));
  document.querySelectorAll("[data-open-game]").forEach((button) => button.addEventListener("click", openGame));
  document.querySelectorAll("[data-open-minigame]").forEach((button) => button.addEventListener("click", openMinigameMode));
  document.querySelectorAll("[data-minigame-mode]").forEach((button) => button.addEventListener("click", chooseMinigameMode));
  document.querySelectorAll("[data-open-online]").forEach((button) => button.addEventListener("click", openOnlineDialog));
  onlineDialog?.querySelector("[data-online-create]")?.addEventListener("click", () => void createOnlineRoom());
  onlineDialog?.querySelector("[data-online-code-open]")?.addEventListener("click", showOnlineCodeEntry);
  onlineDialog?.querySelector("[data-online-back]")?.addEventListener("click", showOnlineEntry);
  onlineDialog?.querySelector("[data-online-close]")?.addEventListener("click", closeOnlineDialog);
  onlineDialog?.querySelector("[data-online-copy]")?.addEventListener("click", () => void copyOnlineCode());
  onlineDialog?.querySelector("[data-online-cancel-room]")?.addEventListener("click", () => void cancelOnlineRoom());
  onlineDialog?.querySelector(".online-code-form")?.addEventListener("submit", (event) => void joinOnlineRoom(event));
  onlineCodeInput?.addEventListener("input", () => {
    onlineCodeInput.value = normalizeOnlineRoomCode(onlineCodeInput.value);
    setOnlineStatus("[data-online-code-status]", "");
  });
  document.querySelectorAll("[data-open-daily]").forEach((button) => button.addEventListener("click", openDaily));
  document.getElementById("daily-button")?.addEventListener("click", openDaily);
  document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", openSettings));
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  modeDialog?.addEventListener("click", (event) => {
    if (event.target === modeDialog) closeDialog(modeDialog);
  });
  onlineDialog?.addEventListener("click", (event) => {
    if (event.target === onlineDialog) closeOnlineDialog();
  });
  onlineDialog?.addEventListener("close", stopOnlineWatch);
  installButton?.addEventListener("click", requestInstall);
  retryGame?.addEventListener("click", loadPendingGame);
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== gameFrame?.contentWindow) return;
    if (event.data?.type === "kuma-game-home") {
      if (!requestedGame || event.data.hostSession !== requestedGame.hostSession) return;
      hideGame({ notifyRuntime: false, hostSession: event.data.hostSession });
      return;
    }
    if (event.data?.type === "kuma-game-ready") {
      if (event.data.launch === "preload") {
        if (event.data.hostSession && event.data.hostSession !== runtimePreloadSession) return;
        gameRuntimeBooting = false;
        gameRuntimeReady = true;
        if (requestedGame && gameOverlay && !gameOverlay.hidden) dispatchRequestedGame();
        return;
      }
      if (!requestedGame || event.data.hostSession !== requestedGame.hostSession) return;
      markGameReady();
      return;
    }
    if (["kuma-player-state-changed", "kuma-profile-changed"].includes(event.data?.type)) {
      renderHomeState();
      return;
    }
    if (event.data?.type === "kuma-profile-editor-state") {
      document.body.classList.toggle("game-wallet-open", event.data.open === true);
      return;
    }
    if (event.data?.type !== "kuma-game-error") return;
    const expectedSession = requestedGame?.hostSession || runtimePreloadSession;
    if (event.data.hostSession && event.data.hostSession !== expectedSession) return;
    console.error("[KUMA CHESS] Game frame failed:", event.data?.message || "unknown error");
    gameRuntimeBooting = false;
    gameRuntimeReady = false;
    showGameLoadError(true);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gameOverlay && !gameOverlay.hidden) hideGame();
  });
  window.addEventListener("scroll", requestScrollSync, { passive: true });
  window.addEventListener("resize", requestScrollSync, { passive: true });
  const refreshHomeState = () => {
    renderHomeState();
    setMenuBgmVolume(readProfileState(readPlayerState()).bgmVolume);
  };
  window.addEventListener("focus", refreshHomeState);
  window.addEventListener("storage", refreshHomeState);
  window.addEventListener("kuma-state-changed", refreshHomeState);
  window.addEventListener("kuma-profile-changed", refreshHomeState);
  window.addEventListener("kuma-install-state-changed", () => {
    consumeInstallReward();
    syncInstallButton();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderHomeState(); });
}

installFeedbackUnlock();
installMenuBgm();
setMenuBgmVolume(readProfileState(readPlayerState()).bgmVolume);
const dailyLoginReward = claimDailyReward();
consumeInstallReward();
installMinigameImageRecovery();
bindEvents();
syncScrollControls();
renderHomeState();
if (dailyLoginReward.claimed) {
  showHomeRewardLine(currentWebCopy().dailyLoginReward(dailyLoginReward.amount));
}
ensureHomeMotionStarted();
document.documentElement.dataset.kumaMainReady = "true";
window.addEventListener("pageshow", ensureHomeMotionStarted, { passive: true });
window.addEventListener("load", installAds, { once: true });
const scheduleRuntimePreload = () => preloadGameRuntime();
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(scheduleRuntimePreload, { timeout: 1400 });
} else {
  window.setTimeout(scheduleRuntimePreload, 500);
}

const initialUrl = new URL(window.location.href);
const initialLaunch = initialUrl.searchParams.get("launch") || "";
const initialMode = initialUrl.searchParams.get("mode") || "";
const validInitialLaunches = new Set(["ai", "pvp", "puzzle", "road-puzzle", "info", "profile", "medals", "daily", "settings", "online", "tug", "crown", "road", "siege"]);
const hasShellMarker = initialUrl.searchParams.has("shell");
if (hasShellMarker) initialUrl.searchParams.delete("shell");
if (validInitialLaunches.has(initialLaunch)) {
  initialUrl.searchParams.delete("launch");
  initialUrl.searchParams.delete("mode");
  initialUrl.searchParams.delete("fromGame");
  window.history.replaceState(null, "", `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`);
  window.setTimeout(() => {
    if (initialLaunch === "online") {
      openOnlineDialog();
      return;
    }
    if (["tug", "crown", "road", "siege"].includes(initialLaunch) && !initialMode) {
      pendingMinigameLaunch = initialLaunch;
      document.getElementById("mode-dialog-title").textContent = currentWebCopy().minigames[initialLaunch]?.[0]
        || currentWebCopy().modeDefault;
      openDialog(modeDialog, null);
      return;
    }
    openGameLaunch(initialLaunch, null, initialMode);
  }, 0);
} else if (hasShellMarker) {
  window.history.replaceState(null, "", `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`);
}
