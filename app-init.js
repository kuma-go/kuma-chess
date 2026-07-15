if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

(() => {
  let deferredPrompt = null;
  const isStandalone = () => (
    window.matchMedia?.("(display-mode: standalone)")?.matches
    || navigator.standalone === true
  );
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const notify = () => window.dispatchEvent(new CustomEvent("kuma-install-state-changed"));

  window.KumaInstall = {
    getState() {
      const standalone = isStandalone();
      return {
        standalone,
        available: !standalone && (Boolean(deferredPrompt) || isIos),
        nativePrompt: Boolean(deferredPrompt),
        platform: isIos ? "ios" : "browser",
      };
    },
    async request() {
      if (isStandalone()) return { status: "installed" };
      if (!deferredPrompt) return { status: "guide", platform: isIos ? "ios" : "browser" };
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
      notify();
      return { status: choice.outcome === "accepted" ? "accepted" : "dismissed" };
    },
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
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
  if (standalone && screen.orientation?.lock) {
    window.addEventListener("pointerup", () => {
      screen.orientation.lock("portrait-primary").catch(() => {});
    }, { once: true, capture: true });
  }

  syncViewport();
})();
