const SCRIPT_ID = "kuma-adsense-script";

function getConfig() {
  const config = window.KUMA_ADS_CONFIG || {};
  const client = String(config.client || "").trim();
  const topSlot = String(config.topSlot || "").trim();
  return {
    enabled: config.enabled === true,
    client,
    topSlot,
    testMode: config.testMode === true,
    valid: /^ca-pub-\d+$/.test(client) && /^\d+$/.test(topSlot),
  };
}

function loadAdSenseScript(client) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

function buildTopAd(shell, config) {
  if (shell.dataset.ready === "true") return;
  const ad = document.createElement("ins");
  ad.className = "adsbygoogle";
  ad.style.display = "block";
  ad.dataset.adClient = config.client;
  ad.dataset.adSlot = config.topSlot;
  ad.dataset.adFormat = "horizontal";
  ad.dataset.fullWidthResponsive = "true";
  if (config.testMode) ad.dataset.adtest = "on";
  shell.replaceChildren(ad);
  shell.dataset.ready = "true";
  loadAdSenseScript(config.client);
  window.setTimeout(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.warn("KUMA CHESS ad slot was not filled.", error);
    }
  }, 0);
}

export function setTopAdVisible(visible) {
  const shell = document.getElementById("ad-shell");
  if (!shell) return false;
  const config = getConfig();
  const shouldShow = visible === true && config.enabled && config.valid;
  shell.hidden = !shouldShow;
  document.body.classList.toggle("ad-visible", shouldShow);
  if (shouldShow) buildTopAd(shell, config);
  window.dispatchEvent(new Event("resize"));
  return shouldShow;
}

export function isAdSenseConfigured() {
  const config = getConfig();
  return config.enabled && config.valid;
}
