import { getPlayStats } from "../playerState.js?v=20260904-accountcsp109";
import { recordVerifiedLeaderboardPlacement } from "../medals.js?v=20260904-accountcsp109";
import { readProfileState } from "../profileState.js?v=20260904-accountcsp109";
import {
  addLargeTextButton,
  addThreePatchPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
} from "./KumaUi.js?v=20260904-accountcsp109";
import { addProfileAvatar } from "./ProfileAvatar.js?v=20260904-accountcsp109";

const COPY = {
  ko: {
    title: "체스 순위",
    all: "전체",
    weekly: "주간",
    friends: "친구",
    season: "온라인 기록",
    status: "서버 검증 기록",
    loading: "온라인 기록을 확인하고 있습니다.",
    weeklyBest: "이번 주 최고 기록 · {name} · {score}점",
    currentBest: "현재 최고 기록 · {name} · {time}",
    noRecord: "아직 등록된 온라인 기록이 없습니다.",
    loadError: "온라인 기록을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.",
    rank: "순위",
    nickname: "닉네임",
    wins: "승리수",
    time: "플레이 시간",
    score: "점수",
    unranked: "미등록",
    local: "내 로컬 기록",
    onlineMine: "내 온라인 순위",
    noTime: "집계 전",
    notice: "초대 대국 결과는 서버 검증 후 Elo 점수와 순위에 반영됩니다.",
    allEmpty: "검증된 온라인 대국이 완료되면 전체 순위가 표시됩니다.",
    weeklyEmpty: "주간 순위는 매주 월요일 새로 시작합니다.",
    friendsEmpty: "친구 기능은 계정 연결과 함께 제공될 예정입니다.",
    hall: "명예의 전당",
    back: "돌아가기",
  },
  en: {
    title: "Chess Ranking",
    all: "Overall",
    weekly: "Weekly",
    friends: "Friends",
    season: "Online records",
    status: "Server-verified records",
    loading: "Checking online records...",
    weeklyBest: "Weekly best · {name} · {score} pts",
    currentBest: "Current best · {name} · {time}",
    noRecord: "No online records have been registered yet.",
    loadError: "Online records could not be loaded. Please try again shortly.",
    rank: "Rank",
    nickname: "Nickname",
    wins: "Wins",
    time: "Play time",
    score: "Score",
    unranked: "Unranked",
    local: "Local record",
    onlineMine: "My online rank",
    noTime: "Pending",
    notice: "Invite-match results update Elo ratings after server verification.",
    allEmpty: "Overall rankings appear after a verified online match is completed.",
    weeklyEmpty: "Weekly rankings reset every Monday.",
    friendsEmpty: "Friends rankings will arrive with linked accounts.",
    hall: "Hall of Fame",
    back: "Back",
  },
  ja: {
    title: "チェスランキング",
    all: "全体",
    weekly: "週間",
    friends: "フレンド",
    season: "オンライン記録",
    status: "サーバー認証記録",
    loading: "オンライン記録を確認中です。",
    weeklyBest: "週間最高記録 · {name} · {score}点",
    currentBest: "現在の最高記録 · {name} · {time}",
    noRecord: "登録されたオンライン記録はまだありません。",
    loadError: "オンライン記録を読み込めませんでした。しばらくしてから再度お試しください。",
    rank: "順位",
    nickname: "ニックネーム",
    wins: "勝利数",
    time: "プレイ時間",
    score: "スコア",
    unranked: "未登録",
    local: "ローカル記録",
    onlineMine: "自分のオンライン順位",
    noTime: "集計前",
    notice: "招待対局の結果はサーバー認証後、Eloスコアと順位に反映されます。",
    allEmpty: "認証済みオンライン対局が完了すると全体順位が表示されます。",
    weeklyEmpty: "週間順位は毎週月曜日にリセットされます。",
    friendsEmpty: "フレンド順位はアカウント連携とともに提供予定です。",
    hall: "栄光の殿堂",
    back: "戻る",
  },
};

function addText(scene, layer, x, y, text, options = {}) {
  const label = scene.add.text(x, y, text, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: `${options.size ?? 20}px`,
    color: options.color ?? KUMA_COLORS.ink,
    fontStyle: options.weight ?? "500",
    align: options.align ?? "left",
    wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
  }).setOrigin(options.originX ?? 0, options.originY ?? 0.5).setDepth(options.depth ?? 11004);
  layer.add(label);
  return label;
}

function totalWins(stats) {
  const aiWins = Object.values(stats.ai).reduce((sum, item) => sum + item.wins, 0);
  return aiWins + stats.pvp.wWins + stats.pvp.bWins;
}

function format(text, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text,
  );
}

function relativeTime(timestamp, language) {
  if (!timestamp) return language === "en" ? "recently" : language === "ja" ? "少し前" : "얼마 전";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return language === "en" ? "just now" : language === "ja" ? "たった今" : "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return language === "en" ? `${minutes}m ago` : language === "ja" ? `${minutes}分前` : `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === "en" ? `${hours}h ago` : language === "ja" ? `${hours}時間前` : `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return language === "en" ? `${days}d ago` : language === "ja" ? `${days}日前` : `${days}일 전`;
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(timestamp));
}

function formatPlayTime(seconds, language) {
  const totalMinutes = Math.max(0, Math.floor((Number(seconds) || 0) / 60));
  if (totalMinutes < 60) {
    if (language === "ko") return `${totalMinutes}분`;
    if (language === "ja") return `${totalMinutes}分`;
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === "ko") return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  if (language === "ja") return minutes ? `${hours}時間 ${minutes}分` : `${hours}時間`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function cloudApi() {
  try {
    return window.parent?.KumaCloud || window.KumaCloud || null;
  } catch (_error) {
    return window.KumaCloud || null;
  }
}

export function showLeaderboardPopup(scene, options = {}) {
  if (scene.leaderboardLayer) return;
  const profile = readProfileState();
  const stats = getPlayStats();
  const copy = COPY[profile.language] || COPY.ko;
  let activeTab = "weekly";
  let loadToken = 0;
  let disposed = false;
  let refreshEvent = null;

  const backdrop = createModalBackdrop(scene, 10990, options.externalBackdrop
    ? { capture: false, dimAlpha: 0.001 }
    : undefined);
  const layer = scene.add.container(0, 0).setDepth(11000);
  scene.leaderboardLayer = layer;
  const px = scene.scale.width / 2;
  const py = scene.scale.height / 2;
  const panelW = Math.min(668, scene.scale.width - 28);
  const panelH = Math.min(1140, scene.scale.height - 44);
  const panelTop = py - panelH / 2;
  const panel = addThreePatchPanel(scene, px, py, panelW, panelH, 11001, {
    texturePrefix: "kuma_ui_popup_3Patch",
    sourceWidth: 1836,
    topSourceHeight: 452,
    bottomSourceHeight: 536,
  });
  if (panel) layer.add(panel);

  addText(scene, layer, px, panelTop + 43, copy.title, {
    size: 34, color: "#fff4d7", weight: "900", originX: 0.5,
  });

  const tabLayer = scene.add.container(0, 0).setDepth(11004);
  layer.add(tabLayer);
  const emptyText = addText(scene, layer, px, panelTop + 605, copy.loading, {
    size: 19, color: "#8b7158", weight: "600", align: "center", originX: 0.5, wrap: 500,
  });

  function renderTabs() {
    tabLayer.removeAll(true);
    ["all", "weekly", "friends"].forEach((id, index) => {
      const x = px - 206 + index * 206;
      const selected = activeTab === id;
      const bg = scene.add.nineslice(
        x,
        panelTop + 133,
        selected ? "kuma_ui_btn_tab_on" : "kuma_ui_btn_tab_off",
        null,
        190,
        56,
        24,
        24,
        0,
        0,
      )
        .setInteractive({ useHandCursor: true });
      const label = scene.add.text(x, panelTop + 133, copy[id], {
        fontFamily: KUMA_FONT_SANS, fontSize: "21px", color: selected ? "#3d2b1d" : "#80684f", fontStyle: "800",
      }).setOrigin(0.5);
      bg.on("pointerdown", () => {
        activeTab = id;
        renderTabs();
        loadRanking();
      });
      tabLayer.add([bg, label]);
    });
  }

  addText(scene, layer, px - 255, panelTop + 190, copy.season, {
    size: 18, color: "#6e563e", weight: "800",
  });
  addText(scene, layer, px + 255, panelTop + 190, copy.status, {
    size: profile.language === "en" ? 15 : 17, color: KUMA_COLORS.teal, weight: "700", originX: 1,
  });

  const spotlight = addText(scene, layer, px, panelTop + 222, copy.loading, {
    size: profile.language === "en" ? 16 : 18,
    color: "#9b6928", weight: "800", originX: 0.5, align: "center",
  });

  const podiumY = panelTop + 335;
  const podiumLayer = scene.add.container(0, 0).setDepth(11004);
  layer.add(podiumLayer);
  const podiumSlots = [
    { x: px - 175, key: "kuma_ui_icon_rank_num_02", size: 86 },
    { x: px, key: "kuma_ui_icon_rank_num_01", size: 106 },
    { x: px + 175, key: "kuma_ui_icon_rank_num_03", size: 86 },
  ];

  function renderPodium(entries = []) {
    podiumLayer.removeAll(true);
    if (!entries.length) return;
    const entryIndexes = [1, 0, 2];
    podiumSlots.forEach((slot, slotIndex) => {
      const entry = entries[entryIndexes[slotIndex]];
      podiumLayer.add(scene.add.circle(slot.x, podiumY, slot.size / 2, 0xf4e5cc, 0.7)
        .setStrokeStyle(3, 0xc7a57c, 0.7));
      podiumLayer.add(scene.add.image(slot.x, podiumY - slot.size / 2 - 22, slot.key).setDisplaySize(50, 50));
      if (entry) {
        addProfileAvatar(scene, podiumLayer, slot.x, podiumY, {
          displayName: entry.displayName,
          avatar: entry.avatar,
        }, { size: slot.size - 8, maxFrameScale: 1.3, depth: 11005 });
      }
      const name = scene.add.text(slot.x, podiumY + slot.size / 2 + 20, entry?.displayName || "—", {
        fontFamily: KUMA_FONT_SANS,
        fontSize: entry?.displayName?.length > 10 ? "15px" : "19px",
        color: entry ? "#4a3523" : "#a48b70",
        fontStyle: "800",
      }).setOrigin(0.5);
      const score = scene.add.text(slot.x, podiumY + slot.size / 2 + 46, entry ? `${entry.score}` : "", {
        fontFamily: KUMA_FONT_SANS, fontSize: "16px", color: "#b18335", fontStyle: "900",
      }).setOrigin(0.5);
      podiumLayer.add([name, score]);
    });
  }

  async function loadRanking(options = {}) {
    const silent = options.silent === true;
    const token = ++loadToken;
    if (!silent) {
      renderPodium([]);
      renderTableRows([]);
      spotlight.setText(copy.loading);
      emptyText.setText(copy.loading);
    }
    if (activeTab === "friends") {
      spotlight.setText(copy.noRecord);
      emptyText.setText(copy.friendsEmpty);
      renderTableRows([]);
      return;
    }
    const api = cloudApi();
    if (!api?.getLeaderboard) {
      if (silent) return;
      spotlight.setText(copy.loadError);
      emptyText.setText(copy.loadError);
      renderTableRows([]);
      return;
    }
    try {
      const result = await api.getLeaderboard(activeTab === "all" ? "all" : "weekly");
      if (token !== loadToken || !layer.scene) return;
      const entries = result.entries || [];
      if (result.viewerRank > 0) {
        recordVerifiedLeaderboardPlacement({
          eventId: result.season,
          period: result.period,
          rank: result.viewerRank,
        });
      }
      renderPodium(entries);
      renderTableRows(entries);
      if (!entries.length) {
        spotlight.setText(copy.noRecord);
        emptyText.setText(copy[`${activeTab}Empty`]);
        return;
      }
      const best = entries[0];
      spotlight.setText(activeTab === "weekly"
        ? format(copy.weeklyBest, { name: best.displayName, score: best.score })
        : format(copy.currentBest, { name: best.displayName, time: relativeTime(best.updatedAtMs, profile.language) }));
      emptyText.setText("");
    } catch (_error) {
      if (token !== loadToken || !layer.scene) return;
      if (silent) return;
      spotlight.setText(copy.noRecord);
      emptyText.setText(copy.loadError);
      renderPodium([]);
      renderTableRows([]);
    }
  }

  const tableTop = panelTop + 650;
  layer.add(scene.add.rectangle(px, tableTop, panelW - 80, 56, 0xead8bb, 0.72)
    .setStrokeStyle(1, 0xc9a77e, 0.8).setDepth(11003));
  const columns = [
    { x: px - 265, text: copy.rank, origin: 0 },
    { x: px - 160, text: copy.nickname, origin: 0 },
    { x: px + 64, text: copy.wins, origin: 0.5 },
    { x: px + 166, text: copy.time, origin: 0.5 },
    { x: px + 277, text: copy.score, origin: 1 },
  ];
  columns.forEach((column) => addText(scene, layer, column.x, tableTop, column.text, {
    size: profile.language === "en" ? 16 : 18, color: "#6f5942", weight: "800", originX: column.origin,
  }));
  const tableRowsLayer = scene.add.container(0, 0).setDepth(11004);
  layer.add(tableRowsLayer);

  function renderTableRows(entries = []) {
    tableRowsLayer.removeAll(true);
    const rankedRows = entries.slice(3, 10);
    if (rankedRows.length) {
      rankedRows.forEach((entry, index) => {
        const rowY = tableTop + 44 + index * 31;
        tableRowsLayer.add(scene.add.rectangle(
          px, rowY, panelW - 80, 31, entry.isCurrentUser ? 0xffe5a7 : index % 2 ? 0xfff9ed : 0xfff3dc, 0.82,
        ).setStrokeStyle(entry.isCurrentUser ? 2 : 1, entry.isCurrentUser ? 0xd5a447 : 0xd7c2a3, 0.8));
        addText(scene, tableRowsLayer, px - 252, rowY, String(index + 4), {
          size: 17, color: "#6c5339", weight: "800", originX: 0.5,
        });
        addText(scene, tableRowsLayer, px - 205, rowY, entry.displayName, {
          size: entry.displayName.length > 13 ? 14 : 17, color: "#3b2c20", weight: "800",
        });
        addText(scene, tableRowsLayer, px + 64, rowY, String(entry.wins), {
          size: 17, color: "#6c5339", weight: "700", originX: 0.5,
        });
        addText(scene, tableRowsLayer, px + 166, rowY, formatPlayTime(entry.playTimeSeconds, profile.language), {
          size: profile.language === "en" ? 14 : 15, color: "#79634d", weight: "700", originX: 0.5,
        });
        addText(scene, tableRowsLayer, px + 277, rowY, String(entry.score), {
          size: 18, color: "#b18335", weight: "900", originX: 1,
        });
      });
      return;
    }

    const viewerIndex = entries.findIndex((entry) => entry.isCurrentUser);
    const viewerEntry = viewerIndex >= 0 ? entries[viewerIndex] : null;
    const rowY = tableTop + 78;
    tableRowsLayer.add(scene.add.rectangle(px, rowY, panelW - 80, 92, 0xfff2d4, 0.9)
      .setStrokeStyle(3, 0xd5a447, 0.9));
    addText(scene, tableRowsLayer, px - 252, rowY - 13, viewerEntry ? String(viewerIndex + 1) : copy.unranked, {
      size: 14, color: "#8b6e50", weight: "800", originX: 0.5,
    });
    addText(scene, tableRowsLayer, px - 252, rowY + 16, viewerEntry ? copy.onlineMine : copy.local, {
      size: 11, color: "#b28b55", weight: "700", originX: 0.5,
    });
    const viewerProfile = viewerEntry || profile;
    addProfileAvatar(scene, tableRowsLayer, px - 180, rowY, viewerProfile, { size: 62, maxFrameScale: 1.3, depth: 11005 });
    addText(scene, tableRowsLayer, px - 139, rowY, viewerProfile.displayName, {
      size: viewerProfile.displayName.length > 12 ? 16 : 19, color: "#3b2c20", weight: "800",
    });
    addText(scene, tableRowsLayer, px + 64, rowY, String(viewerEntry?.wins ?? totalWins(stats)), {
      size: 20, color: "#6c5339", weight: "800", originX: 0.5,
    });
    addText(scene, tableRowsLayer, px + 166, rowY, viewerEntry
      ? formatPlayTime(viewerEntry.playTimeSeconds, profile.language)
      : copy.noTime, {
      size: 16, color: "#8f765e", weight: "700", originX: 0.5,
    });
    addText(scene, tableRowsLayer, px + 277, rowY, viewerEntry ? String(viewerEntry.score) : "—", {
      size: 23, color: "#b18335", weight: "900", originX: 1,
    });
  }

  addText(scene, layer, px, panelTop + 900, copy.notice, {
    size: profile.language === "en" ? 16 : 17, color: "#927b64", weight: "600", align: "center", originX: 0.5, wrap: 540,
  });
  const hallBg = scene.add.image(px, panelTop + 970, "kuma_ui_btn_rankborad")
    .setDisplaySize(370, 86).setAlpha(0.72).setDepth(11004);
  const hallIcon = scene.add.image(px - 112, panelTop + 970, "kuma_ui_icon_cup")
    .setDisplaySize(35, 35).setAlpha(0.72).setDepth(11005);
  addText(scene, layer, px + 12, panelTop + 970, copy.hall, {
    size: 24, color: "#6e5842", weight: "800", originX: 0.5, depth: 11005,
  });
  layer.add([hallBg, hallIcon]);

  const dispose = (invokeCallback = true) => {
    if (disposed) return;
    disposed = true;
    loadToken += 1;
    refreshEvent?.remove?.(false);
    refreshEvent = null;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    backdrop.cleanup();
    if (layer.scene) layer.destroy();
    scene.leaderboardLayer = null;
    if (invokeCallback) options.onClose?.();
  };
  const onShutdown = () => dispose(false);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  const close = () => dispose(true);
  const back = addLargeTextButton(scene, px, panelTop + 1060, copy.back, "", close, {
    width: 300, height: 76, fontSize: 25, dark: true, depth: 11004,
  });
  layer.add([back.button, back.title]);
  renderTabs();
  loadRanking();
  refreshEvent = scene.time.addEvent({
    delay: 15000,
    loop: true,
    callback: () => {
      if (!disposed && activeTab !== "friends") loadRanking({ silent: true });
    },
  });
}
