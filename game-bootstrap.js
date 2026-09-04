(() => {
  const params = new URLSearchParams(window.location.search);
  const initialHostSession = params.get("hostSession") || "";
  const initialLaunch = params.get("launch") || "";
  const mode = params.get("mode") || "";
  const framed = window.parent !== window;

  if (!framed) {
    const shellUrl = new URL("./", window.location.href);
    if (initialLaunch) shellUrl.searchParams.set("launch", initialLaunch);
    if (mode) shellUrl.searchParams.set("mode", mode);
    shellUrl.searchParams.set("fromGame", "1");
    window.location.replace(shellUrl.href);
    return;
  }

  let errorSent = false;
  let canvasSeen = false;

  const notifyError = (message) => {
    if (errorSent) return;
    errorSent = true;
    const hostSession = window.KumaEmbeddedRuntime?.getHostSession?.() || initialHostSession;
    const launch = window.KumaEmbeddedRuntime?.getLaunch?.() || initialLaunch;
    window.parent.postMessage({
      type: "kuma-game-error",
      hostSession,
      launch,
      message: String(message || "game-runtime-error").slice(0, 240),
    }, window.location.origin);
  };

  window.addEventListener("error", (event) => {
    const source = event.filename || event.target?.src || "";
    if (source) {
      try {
        if (new URL(source, window.location.href).origin !== window.location.origin) return;
      } catch (_error) {
        return;
      }
    }
    const hasCanvas = Boolean(document.querySelector("#game-container canvas"));
    if (hasCanvas) {
      console.warn("[KUMA CHESS] A non-fatal game resource/runtime error was contained.", event.message || source);
      return;
    }
    notifyError(event.message || `resource-load-failed:${source}`);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (document.querySelector("#game-container canvas")) {
      console.warn("[KUMA CHESS] A non-fatal game promise error was contained.", event.reason);
      return;
    }
    notifyError(event.reason?.message || event.reason || "unhandled-promise-rejection");
  });

  window.setTimeout(() => {
    if (!document.querySelector("#game-container canvas")) notifyError("game-canvas-timeout");
  }, 9000);

  window.setInterval(() => {
    const hasCanvas = Boolean(document.querySelector("#game-container canvas"));
    if (hasCanvas) canvasSeen = true;
    else if (canvasSeen) notifyError("game-canvas-removed");
  }, 1000);
})();
