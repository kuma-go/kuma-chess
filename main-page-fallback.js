(() => {
  const startFallback = () => {
    if (document.documentElement.dataset.kumaMainReady === "true") return;
    document.documentElement.dataset.kumaScrollFallback = "true";

    const cue = document.getElementById("scroll-cue");
    const topButton = document.getElementById("scroll-top");
    const gameOverlay = document.getElementById("game-overlay");
    const gameFrame = document.getElementById("game-frame");
    const gameLoadingMessage = document.getElementById("game-loading-message");
    const retryGame = document.getElementById("retry-game");
    const modeDialog = document.getElementById("mode-dialog");
    let pendingMinigameLaunch = "";
    let gameReadyTimer = 0;
    let gameSession = 0;
    let gameRuntimeReady = false;
    let gameRuntimeBooting = false;
    let runtimePreloadSession = "";
    let requestedGame = null;
    let ticking = false;
    const popupGameLaunches = new Set(["daily", "settings", "info", "profile", "medals"]);

    document.documentElement.dataset.kumaActionFallback = "true";

    const isPrimaryReady = () => document.documentElement.dataset.kumaMainReady === "true";
    const claimFallbackClick = (event) => {
      if (isPrimaryReady()) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };

    const resetGameLoading = () => {
      gameOverlay?.classList.remove("is-ready", "is-failed");
      if (gameLoadingMessage) gameLoadingMessage.textContent = "게임을 준비하고 있습니다.";
      if (retryGame) retryGame.hidden = true;
    };

    const showGameLoadError = (recoverReadyFrame = false) => {
      if (!gameOverlay || gameOverlay.hidden) return;
      if (gameOverlay.classList.contains("is-ready") && !recoverReadyFrame) return;
      if (recoverReadyFrame) gameOverlay.classList.remove("is-ready");
      gameOverlay.classList.add("is-failed");
      if (gameLoadingMessage) gameLoadingMessage.textContent = "게임을 불러오지 못했습니다.";
      if (retryGame) retryGame.hidden = false;
    };

    const preloadGameRuntime = (forceReload = false) => {
      if (!gameFrame || (gameRuntimeBooting && !forceReload)) return;
      if (gameRuntimeReady && !forceReload) return;
      gameRuntimeReady = false;
      gameRuntimeBooting = true;
      runtimePreloadSession = `fallback-preload-${++gameSession}`;
      const url = new URL(gameFrame.dataset.src || "./play.html", window.location.href);
      url.searchParams.set("launch", "preload");
      url.searchParams.delete("mode");
      url.searchParams.set("hostSession", runtimePreloadSession);
      if (forceReload) url.searchParams.set("runtimeReload", String(Date.now()));
      gameFrame.src = url.href;
    };

    const dispatchRequestedGame = () => {
      if (!gameRuntimeReady || !requestedGame || !gameFrame?.contentWindow) return;
      resetGameLoading();
      gameFrame.contentWindow.postMessage({
        type: "kuma-game-launch",
        launch: requestedGame.launch,
        mode: requestedGame.mode,
        hostSession: requestedGame.hostSession,
      }, window.location.origin);
      window.clearTimeout(gameReadyTimer);
      gameReadyTimer = window.setTimeout(showGameLoadError, 12000);
    };

    const loadPendingGame = () => {
      if (!requestedGame) return;
      resetGameLoading();
      preloadGameRuntime(true);
      window.clearTimeout(gameReadyTimer);
      gameReadyTimer = window.setTimeout(showGameLoadError, 12000);
    };

    const openGameLaunch = (launch, mode = "") => {
      if (!gameOverlay || !gameFrame) return;
      requestedGame = { launch, mode, hostSession: `fallback-${++gameSession}` };
      gameOverlay.classList.toggle("is-popup", popupGameLaunches.has(launch));
      gameOverlay.classList.toggle("is-content", !popupGameLaunches.has(launch));
      document.body.classList.toggle("game-popup-open", popupGameLaunches.has(launch));
      document.body.classList.remove("game-wallet-open");
      resetGameLoading();
      gameOverlay.hidden = false;
      document.body.classList.add("game-open");
      if (gameRuntimeReady) dispatchRequestedGame();
      else preloadGameRuntime();
    };

    const hideGame = (notifyRuntime = true) => {
      if (!gameOverlay || gameOverlay.hidden) return;
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
    };

    window.KumaWebHomeHost = Object.freeze({
      returnHome() {
        hideGame(false);
      },
    });

    document.querySelectorAll("[data-open-game]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      openGameLaunch(button.dataset.launch || "");
    }));
    document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      openGameLaunch("settings");
    }));
    document.querySelectorAll("#daily-button, [data-open-daily]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      openGameLaunch("daily");
    }));
    document.querySelectorAll("[data-open-minigame]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      pendingMinigameLaunch = button.dataset.launch || "";
      const title = document.getElementById("mode-dialog-title");
      if (title) title.textContent = button.dataset.title || "미니게임";
      if (typeof modeDialog?.showModal === "function") modeDialog.showModal();
      else modeDialog?.setAttribute("open", "");
    }));
    document.querySelectorAll("[data-minigame-mode]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      if (typeof modeDialog?.close === "function") modeDialog.close();
      else modeDialog?.removeAttribute("open");
      if (pendingMinigameLaunch) openGameLaunch(pendingMinigameLaunch, button.dataset.minigameMode || "ai");
    }));
    modeDialog?.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      if (typeof modeDialog.close === "function") modeDialog.close();
      else modeDialog.removeAttribute("open");
      pendingMinigameLaunch = "";
    }));
    window.addEventListener("message", (event) => {
      if (isPrimaryReady()) return;
      if (event.origin !== window.location.origin || event.source !== gameFrame?.contentWindow) return;
      if (event.data?.type === "kuma-game-home") {
        hideGame(false);
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
        window.clearTimeout(gameReadyTimer);
        gameOverlay?.classList.remove("is-failed");
        gameOverlay?.classList.add("is-ready");
        return;
      }
      if (event.data?.type === "kuma-profile-editor-state") {
        document.body.classList.toggle("game-wallet-open", event.data.open === true);
        return;
      }
      if (event.data?.type !== "kuma-game-error") return;
      if (event.data.type === "kuma-game-error") {
        const expectedSession = requestedGame?.hostSession || runtimePreloadSession;
        if (event.data.hostSession && event.data.hostSession !== expectedSession) return;
        console.error("[KUMA CHESS] Game frame failed:", event.data?.message || "unknown error");
        gameRuntimeBooting = false;
        gameRuntimeReady = false;
        showGameLoadError(true);
      }
    });
    retryGame?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      loadPendingGame();
    });

    const sync = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
      const pageHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      const nearBottom = y + window.innerHeight >= pageHeight - 24;
      const cueProgress = Math.min(1, y / 180);
      const showTop = y > Math.max(320, window.innerHeight * 0.45);

      if (cue) {
        const cueWidth = cue.getBoundingClientRect().width || window.innerWidth;
        cue.style.setProperty("--cue-progress", cueProgress.toFixed(3));
        cue.style.setProperty("--cue-offset", `${Math.round(-cueWidth * 0.028 * cueProgress)}px`);
        cue.classList.toggle("is-hidden", nearBottom || cueProgress >= 0.995);
      }
      if (topButton) topButton.hidden = !showTop;
    };

    const requestSync = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    };

    cue?.addEventListener("click", () => window.scrollBy({
      top: Math.max(420, window.innerHeight * 0.86),
      behavior: "smooth",
    }));
    topButton?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync, { passive: true });
    sync();
    preloadGameRuntime();
  };

  window.setTimeout(startFallback, 800);
})();
