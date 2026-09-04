const CACHE_NAME = "kuma-chess-20260904-accountpopup108";
const MODULE_VERSION = "20260904-accountpopup108";
const APP_MODULE_PATHS = [
  "./src/ai/challengeEngine.js",
  "./src/ai/challengeWorker.js",
  "./src/adManager.js",
  "./src/dailyMissions.js",
  "./src/feedback.js",
  "./src/i18n.js",
  "./src/main.js",
  "./src/medals.js",
  "./src/menuBgm.js",
  "./src/onlineRoom.js",
  "./src/onlineSession.js",
  "./src/pieceAssets.js",
  "./src/pieceStyles.js",
  "./src/playerState.js",
  "./src/profileCatalog.js",
  "./src/profileState.js",
  "./src/ranking.js",
  "./src/puzzles.js",
  "./src/puzzlesAdvancedA.js",
  "./src/puzzlesAdvancedB.js",
  "./src/crownClashLogic.js",
  "./src/siegeLogic.js",
  "./src/siegeEffects.js",
  "./src/royalRoadLogic.js",
  "./src/royalRoadPuzzleLogic.js",
  "./src/royalRoadPuzzleProgress.js",
  "./src/royalRoadPuzzleStages.js",
  "./src/screenWakeLock.js",
  "./src/storage.js",
  "./src/scenes/Boot.js",
  "./src/scenes/CrownClash.js",
  "./src/scenes/KingdomSiege.js",
  "./src/scenes/Demo.js",
  "./src/scenes/Game.js",
  "./src/scenes/KingdomTug.js",
  "./src/scenes/MedalCatalog.js",
  "./src/scenes/OnlineGame.js",
  "./src/scenes/PieceSelect.js",
  "./src/scenes/PieceSelectAI.js",
  "./src/scenes/Puzzle.js",
  "./src/scenes/PuzzleSelect.js",
  "./src/scenes/Result.js",
  "./src/scenes/RoyalRoad.js",
  "./src/scenes/RoyalRoadPuzzle.js",
  "./src/scenes/RoyalRoadPuzzleSelect.js",
  "./src/scenes/Start.js",
  "./src/ui/ConfirmPopup.js",
  "./src/ui/DailyMissionPopup.js",
  "./src/ui/KumaUi.js",
  "./src/ui/MedalAward.js",
  "./src/ui/NineSlice.js",
  "./src/ui/PieceUnlockLine.js",
  "./src/ui/PlayInfoPopup.js",
  "./src/ui/ProfileAvatar.js",
  "./src/ui/ProfileEditorPopup.js",
  "./src/ui/LeaderboardPopup.js",
  "./src/ui/SpriteButton.js",
  "./src/vendor-chess.js"
];
const VERSIONED_SHELL_PATHS = [
  "./play.html",
  "./app-init.js",
  "./main-page.css",
  "./main-page.js",
  "./firebase-client.js",
  "./main-page-content-i18n.js",
  "./main-page-fallback.js",
  "./game-bootstrap.js"
];
const CORE_FILES = [
  "./",
  "./index.html",
  "./play.html",
  "./manifest.webmanifest",
  "./app-init.js",
  "./ads-config.js",
  "./main-page.css",
  "./main-page.js",
  "./firebase-client.js",
  "./main-page-content-i18n.js",
  "./main-page-fallback.js",
  "./game-bootstrap.js",
  "./privacy.html",
  "./guide.html",
  "./robots.txt",
  "./sitemap.xml",
  "./ads.txt",
  "./docs.css",
  "./docs.js",
  "./phaser.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/kuma/ui/pattern.png",
  "./assets/kuma/ui/pattern_bottom_bg.png",
  "./assets/kuma/ui/btn_daily.png",
  "./assets/kuma/ui/daily_popup.png",
  "./assets/kuma/ui/popup_long.png",
  "./assets/kuma/ui/btn_pop_b_normal.png",
  "./assets/kuma/ui/btn_pop_w_normal.png",
  "./assets/kuma/ui/img_card_pvp.png",
  "./assets/kuma/ui/icon_pvp_add.png",
  "./assets/kuma/ui/icon_pvp_entry.png",
  "./assets/kuma/ui/coin_small.png",
  "./assets/kuma/ui/btn_rankborad.png",
  "./assets/kuma/ui/btn_leaderboard.png",
  "./assets/kuma/ui/btn_my.png",
  "./assets/kuma/ui/btn_rank_tab_on.png",
  "./assets/kuma/ui/btn_rank_tab_off.png",
  "./assets/kuma/ui/pop_3p_top.png",
  "./assets/kuma/ui/pop_3p_center.png",
  "./assets/kuma/ui/pop_3p_bottom.png",
  "./assets/kuma/ui/popup_3Patch_top.png",
  "./assets/kuma/ui/popup_3Patch_center.png",
  "./assets/kuma/ui/popup_3Patch_bottom.png",
  "./assets/kuma/ui/img_partition.png",
  "./assets/kuma/ui/icon_rank_num_01.png",
  "./assets/kuma/ui/icon_rank_num_02.png",
  "./assets/kuma/ui/icon_rank_num_03.png",
  "./assets/kuma/ui/icon_cup.png",
  "./assets/kuma/ui/profile/%ED%94%84%EB%A1%9C%ED%95%84_%EA%B8%B0%EB%B3%B8_01.png",
  "./assets/kuma/ui/profile/%ED%94%84%EB%A1%9C%ED%95%84_%ED%85%8C%EB%91%90%EB%A6%AC_%EA%B8%B0%EB%B3%B8_01.png",
  "./assets/kuma/ui/rect_long.png",
  "./assets/kuma/ui/메달_골드_곰.png",
  "./assets/kuma/ui/메달_브라운_곰.png",
  "./assets/kuma/ui/메달_성실한기사.png",
  "./assets/kuma/ui/메달_왕국의일과.png",
  "./assets/kuma/ui/메달_백일의수련.png",
  "./assets/kuma/ui/메달_AI도전난이도.png",
  "./assets/kuma/ui/메달_Stockfish18Lite.png",
  "./assets/kuma/ui/메달_주간1위.png",
  "./assets/kuma/ui/메달_친구1위.png",
  "./assets/kuma/ui/메달_전체3위.png",
  "./assets/kuma/ui/메달_온라인30회.png",
  "./assets/kuma/ui/메달_친구와20회.png",
  "./assets/kuma/ui/메달_다시하기10회.png",
  "./assets/kuma/ui/btn_arrow_up.png",
  "./assets/kuma/ui/btn_arrow_left.png",
  "./assets/kuma/ui/btn_arrow_right.png",
  "./assets/kuma/ui/img_castle.png",
  "./assets/kuma/ui/icon_lock.png",
  "./assets/kuma/ui/result_crown.png",
  "./assets/kuma/ui/result_crown_slot.png",
  "./assets/kuma/ui/tile_cross.png",
  "./assets/kuma/ui/tile_crossroad.png",
  "./assets/kuma/ui/tile_down_up.png",
  "./assets/kuma/ui/tile_down_up_speed.png",
  "./assets/kuma/ui/tile_down_left.png",
  "./assets/kuma/ui/tile_down_right.png",
  "./assets/kuma/ui/tile_left_up.png",
  "./assets/kuma/ui/tile_right_up.png",
  "./assets/kuma/ui/tile_t_up.png",
  "./assets/kuma/ui/tile_t_down.png",
  "./assets/kuma/ui/tile_t_left.png",
  "./assets/kuma/ui/tile_t_right.png",
  "./assets/kuma/ui/tile_left_end.png",
  "./assets/kuma/ui/tile_right_end.png",
  "./assets/kuma/ui/tile_bomb.png",
  "./assets/kuma/ui/tile_spike.png",
  "./assets/kuma/ui/tile_trap.png",
  "./assets/kuma/ui/chess_board_center_top_shot.png",
  "./assets/kuma/ui/chess_board_center_bottom_shot.png",
  "./assets/kuma/ui/icon_king_crown.png",
  "./assets/kuma/ui/img_potal.png",
  "./assets/kuma/ui/img_item_box.png",
  "./assets/kuma/ui/siege_fx_pawn.png",
  "./assets/kuma/ui/siege_fx_knight.png",
  "./assets/kuma/ui/siege_fx_bishop.png",
  "./assets/kuma/ui/siege_fx_rook.png",
  "./assets/kuma/ui/siege_fx_queen.png",
  "./assets/kuma/ui/siege_fx_king.png",
  "./assets/kuma/ui/ani_dice.png",
  "./assets/kuma/ui/ani_dice_black.png",
  "./assets/kuma/web/Pattern.png",
  "./assets/kuma/web/main_img_B.png",
  "./assets/kuma/web/main_logo_B.png",
  "./assets/kuma/web/main_btn_group.png",
  "./assets/kuma/web/icon_ai.png",
  "./assets/kuma/web/icon_pvp.png",
  "./assets/kuma/web/btn_main_puzzle.png",
  "./assets/kuma/web/btn_main_online.png",
  "./assets/kuma/web/title_bg.png",
  "./assets/kuma/web/btn_daily.png",
  "./assets/kuma/web/btn_daily_new.png",
  "./assets/kuma/web/bottom_scroll.png",
  "./assets/kuma/web/bottom_scroll_left.png",
  "./assets/kuma/web/bottom_scroll_right.png",
  "./assets/kuma/web/btn_upscroll.png",
  "./assets/kuma/web/btn_seting.png",
  "./assets/kuma/web/btn_rank.png",
  "./assets/kuma/web/btn_medal.png",
  "./assets/kuma/web/btn_homeadd.png",
  "./assets/kuma/web/coin_bg.png",
  "./assets/kuma/web/coin_big.png",
  "./assets/kuma/web/icon_new.png",
  "./assets/kuma/web/img_bottom.png",
  "./assets/kuma/web/guide_tug.webp",
  "./assets/kuma/web/guide_road.webp",
  "./assets/kuma/web/guide_crown.webp",
  "./assets/kuma/web/guide_siege.webp",
  "./assets/kuma/web/guide_road_puzzle.webp",
  "./assets/kuma/web/image%20437.png",
  "./assets/kuma/web/image%20438.png",
  "./assets/kuma/web/image%20439.png",
  "./assets/kuma/web/image%20440.png",
  "./assets/kuma/web/image%20441.png",
  "./assets/kuma/web/image%20458.png",
  "./assets/kuma/web/image%20459.png",
  "./assets/kuma/web/image%20460.png",
  "./assets/kuma/web/image%20461.png",
  "./assets/kuma/web/image%20462.png",
  "./assets/kuma/web/image%20463.png",
  "./assets/kuma/web/image%20471.png",
  "./assets/kuma/web/image%20472.png",
  "./assets/kuma/web/image%20473.png",
  "./assets/kuma/web/image%20474.png",
  "./assets/kuma/web/image%20475.png",
  "./assets/kuma/web/image%20476.png",
  "./assets/kuma/web/image%20478.png",
  "./assets/kuma/web/image%20479.png",
  "./assets/kuma/web/image%20488.png",
  "./assets/kuma/web/image%20517.png",
  "./assets/kuma/web/image%20521.png",
  "./assets/kuma/web/image%20522.png",
  "./assets/kuma/web/image%20523.png",
  "./assets/kuma/web/image%20524.png",
  "./assets/kuma/web/image%20525.png",
  "./assets/kuma/web/image%20526.png",
  "./assets/kuma/web/image%20527.png",
  "./assets/kuma/web/image%20528.png",
  "./assets/kuma/web/image%20529.png",
  "./assets/kuma/web/image%20529-1.png",
  "./assets/kuma/web/image%20531.png",
  "./assets/kuma/web/image%20534.png",
  "./assets/kuma/web/image%20535.png",
  "./assets/kuma/web/image%20536.png",
  "./assets/kuma/web/image%20537.png",
  "./assets/kuma/web/image%20538.png",
  "./assets/kuma/web/image%20539.png",
  "./assets/kuma/web/image%20540.png",
  "./assets/kuma/web/image%20541.png",
  "./assets/kuma/web/image%20542.png",
  "./assets/kuma/web/image%20543.png",
  "./assets/kuma/web/imgbox_01.png",
  "./assets/kuma/web/imgbox_02.png",
  "./assets/kuma/web/imgbox_03.png",
  ...VERSIONED_SHELL_PATHS.map((path) => `${path}?v=${MODULE_VERSION}`),
  ...APP_MODULE_PATHS.map((path) => `${path}?v=${MODULE_VERSION}`)
];

const INSTALL_ASSET_FILES = new Set([
  "./assets/kuma/web/Pattern.png",
  "./assets/kuma/web/main_img_B.png",
  "./assets/kuma/web/main_logo_B.png",
  "./assets/kuma/web/main_btn_group.png",
  "./assets/kuma/web/icon_ai.png",
  "./assets/kuma/web/icon_pvp.png",
  "./assets/kuma/web/btn_main_puzzle.png",
  "./assets/kuma/web/btn_main_online.png",
  "./assets/kuma/web/title_bg.png",
  "./assets/kuma/web/btn_daily.png",
  "./assets/kuma/web/btn_daily_new.png",
  "./assets/kuma/web/btn_seting.png",
  "./assets/kuma/web/btn_medal.png",
  "./assets/kuma/web/coin_bg.png",
  "./assets/kuma/web/coin_big.png",
  "./assets/kuma/web/icon_new.png",
  "./assets/kuma/web/img_bottom.png",
]);
const INSTALL_FILES = CORE_FILES.filter((path) => (
  !path.startsWith("./assets/kuma/") || INSTALL_ASSET_FILES.has(path)
));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(INSTALL_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => Promise.all(
        clients
          .filter((client) => client.frameType === "top-level" && new URL(client.url).pathname.endsWith("/play.html"))
          .map((client) => {
            const clientUrl = new URL(client.url);
            const shellUrl = new URL("./", self.registration.scope);
            ["launch", "mode"].forEach((name) => {
              const value = clientUrl.searchParams.get(name);
              if (value) shellUrl.searchParams.set(name, value);
            });
            shellUrl.searchParams.set("fromGame", "1");
            return client.navigate(shellUrl.href);
          })
      )),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Let the browser handle media range requests and streaming semantics directly.
  if (url.pathname.includes("/assets/audio/")) return;

  if (event.request.mode === "navigate") {
    const navigationCacheKey = new Request(`${url.origin}${url.pathname}`);
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(navigationCacheKey, copy);
        return response;
      }).catch(async () => {
        const cached = await caches.match(navigationCacheKey);
        if (cached) return cached;
        if (url.pathname.endsWith("/play.html")) return caches.match("./play.html");
        return caches.match("./index.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then(async (response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, copy);
        return response;
      });
    })
  );
});
