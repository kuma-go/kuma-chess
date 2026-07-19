let wakeLock = null;
let wakeLockRequest = null;
let matchActive = false;

function isWakeLockAvailable() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

async function requestWakeLock() {
  if (!matchActive || wakeLock || wakeLockRequest || document.visibilityState !== "visible") {
    return Boolean(wakeLock);
  }
  if (!isWakeLockAvailable()) return false;

  wakeLockRequest = navigator.wakeLock.request("screen")
    .then(async (lock) => {
      if (!matchActive) {
        await lock.release();
        return false;
      }

      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      }, { once: true });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      wakeLockRequest = null;
    });

  return wakeLockRequest;
}

export function keepScreenAwakeDuringMatch() {
  matchActive = true;
  void requestWakeLock();
}

export function allowScreenSleep() {
  matchActive = false;
  const lock = wakeLock;
  wakeLock = null;
  if (lock) void lock.release().catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && matchActive) {
    void requestWakeLock();
  }
});
