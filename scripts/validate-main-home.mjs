import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("main-page.css");
const main = read("main-page.js");
const mainContentI18n = read("main-page-content-i18n.js");
const fallback = read("main-page-fallback.js");
const bootstrap = read("game-bootstrap.js");
const play = read("play.html");
const gameMain = read("src/main.js");
const gameScene = read("src/scenes/Game.js");
const startScene = read("src/scenes/Start.js");
const settingsUi = read("src/ui/KumaUi.js");
const dailyUi = read("src/ui/DailyMissionPopup.js");
const playInfoUi = read("src/ui/PlayInfoPopup.js");
const leaderboardUi = read("src/ui/LeaderboardPopup.js");
const medalCatalog = read("src/scenes/MedalCatalog.js");
const appInit = read("app-init.js");
const menuBgm = read("src/menuBgm.js");
const pieceUnlockLine = read("src/ui/PieceUnlockLine.js");
const playerState = read("src/playerState.js");
const worker = read("sw.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngSize(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  assert(buffer.toString("ascii", 1, 4) === "PNG", `${file} is not a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const gameActions = ["daily-button", 'data-launch="info"', 'data-launch="medals"', 'data-launch="ai"', 'data-launch="pvp"', "data-open-online", 'data-launch="puzzle"', 'data-launch="road-puzzle"'];
for (const marker of gameActions) assert(html.includes(marker), `Missing game action for ${marker}`);

assert(html.includes("assets/kuma/web/icon_ai.png"), "AI icon is not connected");
assert(html.includes("assets/kuma/web/icon_pvp.png"), "PVP icon is not connected");
assert((html.match(/class="mode-card-art"/g) || []).length === 2, "Mode selector must render two illustration cards");
for (const [launch, image] of Object.entries({ tug: 440, crown: 438, road: 441, "road-puzzle": 437, siege: 439 })) {
  assert(main.includes(`${launch.includes("-") ? `"${launch}"` : launch}: "./assets/kuma/web/image%204${String(image).slice(-2)}.png"`), `${launch} is missing its matching mode card`);
}
const minigameGuides = ["guide_tug.webp", "guide_road.webp", "guide_crown.webp", "guide_siege.webp", "guide_road_puzzle.webp"];
for (const guide of minigameGuides) {
  assert(fs.existsSync(path.join(root, "assets/kuma/web", guide)), `${guide} is missing`);
  assert(html.includes(`./assets/kuma/web/${guide}`), `${guide} is not shown on the main page`);
  assert(worker.includes(`"./assets/kuma/web/${guide}"`), `${guide} is missing from the offline cache`);
}
assert(html.indexOf('id="minigame-guide"') > html.indexOf('id="guide"')
  && html.indexOf('id="minigame-guide"') < html.indexOf('id="modes"'),
"Mini-game guides must sit between the chess guide and game modes");
assert(html.includes('id="minigame-guide-dialog"') && html.includes("data-start-minigame-guide"), "The pre-game guide dialog is missing");
assert(main.includes("showMinigameGuide(launch, mode, trigger)")
  && main.includes("startPendingMinigameGuide")
  && fallback.includes("showMinigameGuide(pendingMinigameLaunch"),
"Mini-game guide confirmation is not connected to primary and fallback launches");
assert(main.includes('modeDialog.querySelectorAll(".mode-card-art")') && main.includes("image.src = cardArt"), "Mode cards do not update when the selected minigame changes");
assert(html.includes('class="mode-home"') && !html.includes('id="mode-dialog" class="web-dialog mode-dialog">\n      <div class="dialog-panel">\n        <button'), "Mode dialog must use the in-art main button without a close icon");
assert(!html.includes("mode-piece"), "Legacy piece icons remain in the play selector");
assert(html.includes("scroll-cue-ornament-left") && html.includes("scroll-cue-ornament-right"), "Scroll cue ornaments are missing");
assert(html.includes('class="secondary-play" type="button" data-open-online'), "Online play action is not enabled");
assert(html.includes('class="hero-art" src="./assets/kuma/web/main_img_B.png"'), "Main image does not use main_img_B");
assert(html.includes('data-src="./play.html?v='), "Game shell URL is not cache-busted");
assert(play.includes("game-bootstrap.js?v="), "Game frame error bootstrap is missing");
assert(!html.includes('href="./play.html?launch='), "Game actions can still leave the web shell directly");
assert(!html.includes('id="close-game"'), "The game shell still adds an unrelated top-right close button");
assert(!html.includes('id="daily-dialog"') && !html.includes('id="settings-dialog"'), "Duplicate HTML daily/settings dialogs remain in the web shell");
assert(html.includes('id="home-reward-line"') && html.includes('id="home-reward-line-label"'),
  "The web home is missing visible daily-login reward feedback");

const shellVersion = html.match(/main-page\.js\?v=([^"']+)/)?.[1];
const frameVersion = html.match(/data-src="\.\/play\.html\?v=([^"']+)/)?.[1];
const playVersion = play.match(/src\/main\.js\?v=([^"']+)/)?.[1];
const workerVersion = worker.match(/MODULE_VERSION = "([^"]+)"/)?.[1];
assert(shellVersion && [frameVersion, playVersion, workerVersion].every((version) => version === shellVersion), "Web shell, game frame, and service worker versions are inconsistent");
assert([...gameMain.matchAll(/\?v=([^"']+)/g)].every((match) => match[1] === shellVersion), "Game module imports use a stale version");

assert(pngSize("assets/kuma/web/icon_ai.png").join("x") === "44x84", "AI icon dimensions changed");
assert(pngSize("assets/kuma/web/icon_pvp.png").join("x") === "69x63", "PVP icon dimensions changed");
assert(pngSize("assets/kuma/web/coin_bg.png").join("x") === "230x70", "Coin background dimensions changed");
assert(pngSize("assets/kuma/ui/img_partition.png").join("x") === "620x73", "Section partition dimensions changed");

assert(css.includes("grid-template-columns: 50.93cqw 45.37cqw"), "Primary play split no longer matches 550/490");
assert(css.includes('.primary-play-panel > [data-launch="ai"] { padding-left: 23.43cqw; }'), "AI icon position changed");
assert(css.includes('.primary-play-panel > [data-launch="pvp"] { padding-left: 3.43cqw; }'), "PVP icon position changed");
assert(css.includes("left: 14.05cqw;"), "Puzzle and online label alignment changed");
assert(css.includes(".coin-pill .coin-pill-bg"), "Coin background specificity guard is missing");
assert(css.includes("width: 21.3cqw") && css.includes("height: 6.48cqw")
  && css.includes("min-height: 0") && css.includes("object-fit: contain"),
  "The home coin display must preserve the supplied 230x70 artwork ratio");
assert(css.includes("@media (hover: none) and (pointer: coarse)") && css.includes("user-select: none"),
  "Touch controls must not retain focus outlines or allow accidental text selection");
assert(play.includes('input, textarea, [contenteditable="true"]') && play.includes("user-select: none"),
  "The game shell must prevent accidental selection while preserving text input editing");
assert(css.includes("border: 0;") && css.includes(".ornate-heading"), "Ornate heading reset is missing");
assert(css.includes(".scroll-cue .scroll-cue-ornament-right { right: calc(var(--content-width) * .1676); left: auto; }"), "Right scroll ornament alignment changed");
assert(css.includes("background: transparent;") && css.includes(".play-menu"), "Main image fade is covered by the play menu");
assert(css.includes("body::after { display: none; }"), "Side pattern is covered at the page bottom");
assert(css.includes("#mode-dialog") && css.includes("aspect-ratio: 790 / 990"), "Minigame mode dialog is not using the supplied long-popup ratio");
assert(css.includes('background-image: url("./assets/kuma/ui/popup_long.png")'), "Minigame mode dialog is missing popup_long artwork");
assert(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") && css.includes("height: 51.72%"), "Mode illustration cards do not match the supplied layout");
assert(css.includes("background: #fbf1db") && css.includes("border: 4px solid #d9a968"), "Mode icon medallions do not match the supplied colors and stroke");
assert(css.includes('background: url("./assets/kuma/ui/btn_pop_b_normal.png")'), "Mode home button does not use the supplied dark button art");
assert(worker.includes('"./assets/kuma/ui/popup_long.png"') && worker.includes('"./assets/kuma/ui/btn_pop_b_normal.png"'), "Mode popup artwork is missing from the offline cache");

assert(main.includes("nearBottom") && main.includes('scrollTop.hidden = !showTop'), "Primary scroll controls are incomplete");
assert(main.includes('document.documentElement.dataset.kumaMainReady = "true"'), "Main ready marker is missing");
assert(main.includes('initialUrl.searchParams.delete("shell")') && main.includes("hasShellMarker"), "The cache-busting shell marker is not cleaned after recovery");
assert(fallback.includes("kumaScrollFallback") && fallback.includes("window.scrollTo"), "Scroll fallback is incomplete");
assert(fallback.includes("kumaActionFallback") && fallback.includes("openGameLaunch"), "Game action fallback is incomplete");
assert(main.includes("showGameLoadError") && !main.includes("setTimeout(markGameReady"), "Primary game overlay can reveal an unready iframe");
assert(main.includes("preloadGameRuntime") && main.includes('type: "kuma-game-launch"') && main.includes("runtimePreloadSession"), "Primary game overlay does not reuse a preheated runtime");
assert(main.includes("window.KumaWebHomeHost") && main.includes('type === "kuma-game-home"') && main.includes('type: "kuma-game-suspend"'), "Primary game overlay is missing the unified home return flow");
assert(main.includes("options.hostSession !== requestedGame?.hostSession") && main.includes("event.data.hostSession !== requestedGame.hostSession"), "Stale embedded home messages can close a newer game session");
assert(main.includes("event.data.hostSession !== expectedSession") && fallback.includes("event.data.hostSession !== expectedSession"), "Stale embedded errors can fail a newer game session");
assert(main.includes('openGameLaunch("daily"') && main.includes('openGameLaunch("settings"'), "Daily/settings buttons do not use the existing game UI");
assert(main.includes("POPUP_GAME_LAUNCHES") && fallback.includes("popupGameLaunches"), "Popup launches do not preserve the web home backdrop");
assert(main.includes('new Set(["daily", "settings", "info", "profile", "medals"])') && fallback.includes('new Set(["daily", "settings", "info", "profile", "medals"])'), "Profile and medal catalogs are not treated as web-home popups");
assert(main.includes("WEB_COPY") && main.includes("renderHomeLanguage(state.language)"), "The web home does not follow the saved language");
assert(main.includes("const dailyLoginReward = claimDailyReward()")
  && main.includes("showHomeRewardLine(currentWebCopy().dailyLoginReward(dailyLoginReward.amount))"),
"The web home must surface a successfully claimed daily-login reward");
assert(main.includes("fitModeButtonLabel") && main.includes('width: "max-content"') && main.includes("probe.getBoundingClientRect().width") && main.includes("measureAt(size) > availableWidth"), "Long mode button labels are not fitted to their available width");
assert(main.includes("applyMainPageContentLanguage(activeWebLanguage)") && mainContentI18n.includes("#guide .guide-intro") && mainContentI18n.includes("#rewards .reward-6"), "Lower guide content does not follow the saved language");
assert(css.includes(".game-overlay.is-popup") && css.includes("backdrop-filter: blur(7px)") && css.includes(".game-overlay {\n  position: fixed") && css.includes("background: transparent;"), "Popup blur or persistent side pattern styling is missing");
assert(html.includes('assets/kuma/ui/img_partition.png') && !html.includes('<div class="section-rule" aria-hidden="true"><span>'), "Guide partitions do not use the supplied img_partition artwork");
assert(css.includes(".game-wallet-open .coin-pill")
  && main.includes('event.data?.type === "kuma-profile-editor-state"')
  && main.includes('classList.toggle("game-wallet-open", event.data.open === true)'),
"The shared coin display must only rise while the profile editor is open");
assert(html.includes('assets/kuma/ui/btn_my.png') && startScene.includes('"kuma_ui_btn_my"'), "The profile/play-info entry does not use btn_my");
assert(!html.includes('data-launch="ranking"') && !main.includes('"ranking"') && !startScene.includes("showLeaderboardPopup") && !playInfoUi.includes("showLeaderboardPopup"), "Public ranking entry points must remain hidden until the verified service is activated");
assert(leaderboardUi.includes("entries.slice(3, 10)") && leaderboardUi.includes("formatPlayTime(entry.playTimeSeconds"), "Leaderboard rows 4 through 10 are not rendered");
assert(leaderboardUi.includes("copy.loadError") && leaderboardUi.includes("if (!entries.length) return;"), "Leaderboard error and empty states are not separated");
assert(leaderboardUi.includes('texturePrefix: "kuma_ui_popup_3Patch"') && leaderboardUi.includes('"kuma_ui_btn_tab_on"'), "Leaderboard does not use the shared panel and tab resources");
assert(gameMain.includes("transparent: isEmbedded"), "Embedded Phaser canvas cannot reveal the web home behind popups");
assert(startScene.includes('launch === "daily"') && startScene.includes("showDailyMissionPopup(this") && startScene.includes('launch === "settings"') && startScene.includes("showSettingsPanel(this") && startScene.includes("externalBackdrop: true"), "Embedded Start does not reuse the original daily/settings UI over the web backdrop");
assert(settingsUi.includes("options.externalBackdrop") && dailyUi.includes("options.externalBackdrop") && playInfoUi.includes("options.externalBackdrop"), "Embedded popup UI still paints a separate solid backdrop");
assert(settingsUi.includes("options.onClose?.({ applied: apply })"), "Embedded settings cannot return to the web home after closing");
assert(settingsUi.includes("addSettingsPanelArt") && settingsUi.includes("1130 * panelScale"), "Settings panel does not follow the supplied 790x1130 layout");
assert(settingsUi.includes("couponBox.strokeRoundedRect") && settingsUi.includes("ss(457)"), "Settings coupon action does not use the supplied outlined button");
assert(gameScene.includes("this.capturedBy[this.getAIColor()]") && !gameScene.includes("this.opponentColor()"), "AI chess still calls the removed opponentColor helper");
assert(medalCatalog.includes("syncContextMedals({"), "Direct medal launches do not synchronize collection progress");
assert(medalCatalog.includes('getLaunch?.() === "medals"') && medalCatalog.includes('setBackgroundColor("rgba(0,0,0,0)")'), "Embedded medal catalog does not reveal the blurred web home");
assert(medalCatalog.includes("openMedalAt(pointer.x, pointer.y)") && medalCatalog.includes("showMedalDetail(entry)") && medalCatalog.includes("progressLabel(entry, this.language, this.copy)"), "Medal details are not available from a card click");
const medalCardRenderer = medalCatalog.slice(
  medalCatalog.indexOf("drawMedalCard(entry, x, y)"),
  medalCatalog.indexOf("revealNewCard(card, art, id)")
);
assert(!medalCardRenderer.includes("descriptionText") && !medalCardRenderer.includes("progressText"), "Medal goals or progress leaked into the catalog list");
assert(fallback.includes("preloadGameRuntime") && fallback.includes('type: "kuma-game-launch"') && fallback.includes("runtimePreloadSession"), "Fallback does not reuse a preheated runtime");
assert(fallback.includes("window.KumaWebHomeHost") && fallback.includes('type === "kuma-game-home"') && fallback.includes('type: "kuma-game-suspend"'), "Fallback is missing the unified home return flow");
assert(gameMain.includes("KumaWebHomeHost?.returnHome") && gameMain.includes('type: "kuma-game-home"'), "Embedded game cannot return directly to the web home");
assert(gameMain.includes('event.key !== "Escape"') && gameMain.includes("returnToWebHome();"), "Escape cannot return a focused embedded game to the web home");
assert(bootstrap.includes("kuma-game-error") && bootstrap.includes("game-canvas-timeout"), "Game frame failures are not reported to the web shell");
assert(bootstrap.includes("window.location.replace(shellUrl.href)") && bootstrap.includes('shellUrl.searchParams.set("fromGame", "1")'), "Top-level game navigation can remain on an empty pattern shell");
assert(bootstrap.includes("game-canvas-removed") && main.includes("showGameLoadError(true)") && fallback.includes("showGameLoadError(true)"), "A removed game canvas can leave only the pattern visible");
assert(css.includes('background-image: url("./assets/kuma/web/Pattern.png")') && css.includes(".game-overlay iframe") && css.includes("background: transparent"), "Embedded screens do not preserve the web side pattern");
assert(play.includes("#ambient-background") && play.includes("display: none") && play.includes("background: transparent"), "The game frame still covers the web side pattern");
assert(worker.includes('"./main-page-fallback.js"'), "Scroll fallback is not cached");
assert(worker.includes('"./game-bootstrap.js"'), "Game error bootstrap is not cached");
assert(worker.includes('fetch(event.request, { cache: "no-store" })'), "HTML navigation can reuse a stale game shell");
assert(worker.includes('url.pathname.endsWith("/play.html")') && worker.includes('caches.match("./play.html")'), "Offline game navigation falls back to the web home");
assert(worker.includes('client.frameType === "top-level"') && worker.includes("return client.navigate(shellUrl.href)"), "A stale top-level game client is not returned to the web shell");
assert(worker.includes('"./assets/kuma/web/icon_ai.png"') && worker.includes('"./assets/kuma/web/icon_pvp.png"'), "Play icons are not cached");
assert(appInit.includes('nextUrl.searchParams.set("shell", shellVersion)') && appInit.includes('main-page.css?v=${shellVersion}'), "A mixed cached shell is not forced onto the current document version");
assert(appInit.includes("refreshPending") && appInit.includes('window.addEventListener("kuma-game-closed"'), "A service-worker update can reload an active game");
assert(main.includes('new CustomEvent("kuma-game-closed")') && fallback.includes('new CustomEvent("kuma-game-closed")'), "The game shell does not release a deferred service-worker refresh");
assert(menuBgm.includes('!document.body?.classList.contains("game-open")'), "Active iframe play can count toward the idle-listening medal");
assert(playerState.includes("getPieceUnlockNotices") && playerState.includes("acknowledgePieceUnlockNotices"), "Piece unlock notices cannot wait for confirmed display");
assert(pieceUnlockLine.includes("acknowledgePieceUnlockNotices(notice.id)"), "Piece unlock notices are consumed before their line message is shown");

console.log("Validated main home: source assets, exact controls, in-shell launches, and scroll behavior.");
