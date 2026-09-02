(() => {
  if (window.self !== window.top
    || !("serviceWorker" in navigator)
    || (location.protocol !== "https:" && location.hostname !== "localhost")) return;

  const shellVersion = "20260902-online92";
  const reloadKey = `kuma-sw-controller-${shellVersion}`;
  let reloading = false;
  let refreshPending = false;

  const reloadFreshShell = (useSessionGuard = true) => {
    if (reloading) return;
    if (useSessionGuard) {
      try {
        if (window.sessionStorage.getItem(reloadKey) === "1") return;
        window.sessionStorage.setItem(reloadKey, "1");
      } catch (_error) {
        // A single in-memory guard still prevents a reload loop without storage.
      }
    }
    reloading = true;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("shell", shellVersion);
    window.location.replace(nextUrl.href);
  };

  if (document.body?.dataset.kumaShell === "web"
    && !document.querySelector(`link[href*="main-page.css?v=${shellVersion}"]`)) {
    reloadFreshShell(false);
    return;
  }

  const reloadWhenGameIsClosed = () => {
    const gameOverlay = document.getElementById("game-overlay");
    if (gameOverlay && !gameOverlay.hidden) {
      refreshPending = true;
      return;
    }
    refreshPending = false;
    reloadFreshShell(true);
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadWhenGameIsClosed();
  });
  window.addEventListener("kuma-game-closed", () => {
    if (refreshPending) reloadWhenGameIsClosed();
  });

  (async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch (_error) {
      // The game remains available online when service workers are unsupported or blocked.
    }
  })();
})();

(() => {
  if (window.self !== window.top) {
    try {
      if (window.parent.KumaInstall) {
        window.KumaInstall = window.parent.KumaInstall;
        return;
      }
    } catch (error) {
      // Cross-origin embedding falls back to the local install state below.
    }
  }

  let deferredPrompt = null;
  let verifiedInstallPending = false;
  const VERIFIED_INSTALL_KEY = "kumaPwaVerifiedInstallPending";
  const isStandalone = () => (
    window.matchMedia?.("(display-mode: standalone)")?.matches
    || navigator.standalone === true
  );
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installPreview = ["localhost", "127.0.0.1"].includes(location.hostname)
    && new URLSearchParams(location.search).get("preview") === "install-button";
  const notify = () => window.dispatchEvent(new CustomEvent("kuma-install-state-changed"));

  window.KumaInstall = {
    getState() {
      const standalone = isStandalone();
      return {
        standalone,
        available: !standalone && (Boolean(deferredPrompt) || isIos || installPreview),
        nativePrompt: Boolean(deferredPrompt),
        rewardEligible: !isIos && (Boolean(deferredPrompt) || installPreview),
        platform: isIos ? "ios" : "browser",
      };
    },
    async request() {
      if (isStandalone()) return { status: "installed" };
      if (installPreview && !deferredPrompt) return { status: "guide", platform: "browser" };
      if (!deferredPrompt) return { status: "guide", platform: isIos ? "ios" : "browser" };
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
      notify();
      return { status: choice.outcome === "accepted" ? "accepted" : "dismissed" };
    },
    consumeVerifiedInstall() {
      if (isIos) return false;
      let pending = verifiedInstallPending;
      try {
        pending = pending || window.localStorage.getItem(VERIFIED_INSTALL_KEY) === "1";
        window.localStorage.removeItem(VERIFIED_INSTALL_KEY);
      } catch (error) {
        // The in-memory marker still works when storage is unavailable.
      }
      verifiedInstallPending = false;
      return pending;
    },
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", (event) => {
    deferredPrompt = null;
    if (!isIos && event.isTrusted) {
      verifiedInstallPending = true;
      try {
        window.localStorage.setItem(VERIFIED_INSTALL_KEY, "1");
      } catch (error) {
        // Keep the trusted marker in memory when storage is unavailable.
      }
    }
    notify();
  });
})();

(() => {
  let resizeTimer = 0;
  const root = document.documentElement;

  const syncViewport = () => {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth);
    const height = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight);
    const left = Math.round(viewport?.offsetLeft || 0);
    const top = Math.round(viewport?.offsetTop || 0);

    root.style.setProperty("--kuma-vw", `${Math.max(1, width)}px`);
    root.style.setProperty("--kuma-vh", `${Math.max(1, height)}px`);
    root.style.setProperty("--kuma-vv-left", `${left}px`);
    root.style.setProperty("--kuma-vv-top", `${top}px`);
    window.dispatchEvent(new CustomEvent("kuma-viewport-changed", {
      detail: { width, height, left, top },
    }));
  };

  const scheduleSync = () => {
    window.clearTimeout(resizeTimer);
    syncViewport();
    requestAnimationFrame(syncViewport);
    resizeTimer = window.setTimeout(syncViewport, 180);
  };

  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", () => {
    scheduleSync();
    window.setTimeout(syncViewport, 420);
  }, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleSync, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleSync, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleSync();
  });

  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  const isGameShell = document.body?.dataset.kumaShell !== "web";
  if (standalone && isGameShell && screen.orientation?.lock) {
    window.addEventListener("pointerup", () => {
      screen.orientation.lock("portrait-primary").catch(() => {});
    }, { once: true, capture: true });
  }

  syncViewport();
})();
