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
    const onlineDialog = document.getElementById("online-dialog");
    const onlineCodeInput = document.getElementById("online-code-input");
    let pendingMinigameLaunch = "";
    let gameReadyTimer = 0;
    let gameSession = 0;
    let gameRuntimeReady = false;
    let gameRuntimeBooting = false;
    let runtimePreloadSession = "";
    let requestedGame = null;
    let ticking = false;
    let onlineBusy = false;
    let onlineRoomCode = "";
    let onlinePlayerColor = "w";
    let onlineUnsubscribe = null;
    const popupGameLaunches = new Set(["daily", "settings", "info", "profile", "medals"]);
    const onlineSessionKey = "kumaChessOnlineSessionV1";

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
        payload: requestedGame.payload,
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

    const openGameLaunch = (launch, mode = "", payload = null) => {
      if (!gameOverlay || !gameFrame) return;
      requestedGame = { launch, mode, payload, hostSession: `fallback-${++gameSession}` };
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

    const normalizeOnlineCode = (value) => String(value || "")
      .toUpperCase()
      .replace(/[^A-HJ-NP-Z2-9]/g, "")
      .slice(0, 6);

    const readOnlineSession = () => {
      try {
        const value = JSON.parse(window.localStorage.getItem(onlineSessionKey) || "null");
        const code = normalizeOnlineCode(value?.code);
        return code.length === 6 ? { code, color: value?.color === "b" ? "b" : "w" } : null;
      } catch (_error) {
        return null;
      }
    };

    const saveOnlineSession = (code, color) => {
      const value = { code: normalizeOnlineCode(code), color: color === "b" ? "b" : "w" };
      if (value.code.length === 6) window.localStorage.setItem(onlineSessionKey, JSON.stringify(value));
    };

    const setOnlineStatus = (selector, message = "") => {
      const element = onlineDialog?.querySelector(selector);
      if (element) element.textContent = message;
    };

    const setOnlineView = (view) => {
      if (onlineDialog) onlineDialog.dataset.onlineViewState = view;
      onlineDialog?.querySelectorAll("[data-online-view]").forEach((section) => {
        section.hidden = section.dataset.onlineView !== view;
      });
    };

    const setOnlineBusy = (value) => {
      onlineBusy = Boolean(value);
      if (onlineDialog) onlineDialog.dataset.onlineBusy = String(onlineBusy);
      onlineDialog?.querySelectorAll("button, input").forEach((control) => {
        control.disabled = onlineBusy && !control.matches("[data-online-close]");
      });
    };

    const stopOnlineWatch = () => {
      onlineUnsubscribe?.();
      onlineUnsubscribe = null;
    };

    const onlineErrorMessage = (reason) => {
      if (reason === "room-not-found") return "초대방을 찾을 수 없습니다.";
      if (reason === "room-unavailable") return "이미 시작했거나 종료된 방입니다.";
      if (reason === "same-player") return "같은 기기에서는 이 방에 참가할 수 없습니다.";
      if (reason === "invalid-code") return "6자리 초대 코드를 확인해주세요.";
      if (["permission-denied", "unavailable", "offline", "watch-failed"].includes(reason)) {
        return "온라인 서비스에 연결할 수 없습니다.";
      }
      return "방에 연결하지 못했습니다. 다시 시도해주세요.";
    };

    const launchOnlineMatch = (room) => {
      if (!room || room.status !== "active") return;
      stopOnlineWatch();
      if (typeof onlineDialog?.close === "function") onlineDialog.close();
      else onlineDialog?.removeAttribute("open");
      openGameLaunch("online-game", "", {
        room,
        code: onlineRoomCode || room.code,
        playerColor: onlinePlayerColor,
      });
    };

    const watchOnlineRoom = (code, color) => {
      stopOnlineWatch();
      onlineRoomCode = normalizeOnlineCode(code);
      onlinePlayerColor = color === "b" ? "b" : "w";
      const cloud = window.KumaCloud;
      if (!cloud?.watchOnlineRoom || onlineRoomCode.length !== 6) {
        setOnlineBusy(false);
        setOnlineStatus("[data-online-waiting-status]", "온라인 서비스에 연결할 수 없습니다.");
        return;
      }
      onlineUnsubscribe = cloud.watchOnlineRoom(
        onlineRoomCode,
        (room) => {
          if (!room) {
            window.localStorage.removeItem(onlineSessionKey);
            stopOnlineWatch();
            setOnlineBusy(false);
            setOnlineView("entry");
            setOnlineStatus("[data-online-entry-status]", "초대방을 찾을 수 없습니다.");
            return;
          }
          if (room.status === "active") {
            launchOnlineMatch(room);
            return;
          }
          if (room.status !== "waiting") {
            window.localStorage.removeItem(onlineSessionKey);
            stopOnlineWatch();
            setOnlineBusy(false);
            setOnlineView("entry");
            setOnlineStatus("[data-online-entry-status]", "이미 시작했거나 종료된 방입니다.");
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
    };

    const openOnlineDialog = () => {
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
      if (typeof onlineDialog?.showModal === "function") onlineDialog.showModal();
      else onlineDialog?.setAttribute("open", "");
      if (session) watchOnlineRoom(session.code, session.color);
    };

    const closeOnlineDialog = () => {
      stopOnlineWatch();
      if (typeof onlineDialog?.close === "function") onlineDialog.close();
      else onlineDialog?.removeAttribute("open");
    };

    const createOnlineRoom = async () => {
      if (onlineBusy) return;
      const cloud = window.KumaCloud;
      if (!cloud?.createOnlineRoom) {
        setOnlineStatus("[data-online-entry-status]", "온라인 서비스에 연결할 수 없습니다.");
        return;
      }
      setOnlineBusy(true);
      setOnlineStatus("[data-online-entry-status]", "온라인 서비스에 연결 중입니다.");
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
        watchOnlineRoom(result.code, result.color);
      } catch (_error) {
        setOnlineBusy(false);
        setOnlineStatus("[data-online-entry-status]", "온라인 서비스에 연결할 수 없습니다.");
      }
    };

    const joinOnlineRoom = async () => {
      if (onlineBusy) return;
      const code = normalizeOnlineCode(onlineCodeInput?.value);
      if (onlineCodeInput) onlineCodeInput.value = code;
      if (code.length !== 6) {
        setOnlineStatus("[data-online-code-status]", "6자리 초대 코드를 확인해주세요.");
        return;
      }
      const cloud = window.KumaCloud;
      if (!cloud?.joinOnlineRoom) {
        setOnlineStatus("[data-online-code-status]", "온라인 서비스에 연결할 수 없습니다.");
        return;
      }
      setOnlineBusy(true);
      setOnlineStatus("[data-online-code-status]", "온라인 서비스에 연결 중입니다.");
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
        setOnlineStatus("[data-online-code-status]", "온라인 서비스에 연결할 수 없습니다.");
      }
    };

    const cancelOnlineRoom = async () => {
      if (onlineBusy || !onlineRoomCode) return;
      const code = onlineRoomCode;
      stopOnlineWatch();
      setOnlineBusy(true);
      setOnlineStatus("[data-online-waiting-status]", "온라인 서비스에 연결 중입니다.");
      try {
        await window.KumaCloud?.leaveOnlineRoom?.(code);
      } finally {
        window.localStorage.removeItem(onlineSessionKey);
        onlineRoomCode = "";
        setOnlineBusy(false);
        setOnlineView("entry");
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
    document.querySelectorAll("[data-open-online]").forEach((button) => button.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      openOnlineDialog();
    }));
    onlineDialog?.querySelector("[data-online-create]")?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      void createOnlineRoom();
    });
    onlineDialog?.querySelector("[data-online-code-open]")?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      setOnlineView("code");
      setOnlineStatus("[data-online-code-status]", "");
      if (onlineCodeInput) onlineCodeInput.value = "";
      window.setTimeout(() => onlineCodeInput?.focus(), 0);
    });
    onlineDialog?.querySelector("[data-online-back]")?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      setOnlineView("entry");
    });
    onlineDialog?.querySelector("[data-online-close]")?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      closeOnlineDialog();
    });
    onlineDialog?.querySelector("[data-online-copy]")?.addEventListener("click", async (event) => {
      if (!claimFallbackClick(event)) return;
      try {
        await navigator.clipboard.writeText(onlineRoomCode);
        setOnlineStatus("[data-online-waiting-status]", "초대 코드를 복사했습니다.");
      } catch (_error) {
        setOnlineStatus("[data-online-waiting-status]", onlineRoomCode);
      }
    });
    onlineDialog?.querySelector("[data-online-cancel-room]")?.addEventListener("click", (event) => {
      if (!claimFallbackClick(event)) return;
      void cancelOnlineRoom();
    });
    onlineDialog?.querySelector(".online-code-form")?.addEventListener("submit", (event) => {
      if (!claimFallbackClick(event)) return;
      void joinOnlineRoom();
    });
    onlineCodeInput?.addEventListener("input", () => {
      if (isPrimaryReady()) return;
      onlineCodeInput.value = normalizeOnlineCode(onlineCodeInput.value);
      setOnlineStatus("[data-online-code-status]", "");
    });
    onlineDialog?.addEventListener("click", (event) => {
      if (event.target !== onlineDialog || !claimFallbackClick(event)) return;
      closeOnlineDialog();
    });
    onlineDialog?.addEventListener("close", stopOnlineWatch);
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
