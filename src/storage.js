export function storage() {
  try {
    return globalThis.window?.localStorage || globalThis.localStorage || null;
  } catch (_error) {
    return null;
  }
}

export function readJsonFromStorage(keys, fallback = null) {
  const store = storage();
  if (!store) return { value: fallback, raw: "", recovered: false, key: "" };
  for (const key of keys) {
    try {
      const raw = store.getItem(key) || "";
      if (!raw) continue;
      return { value: JSON.parse(raw), raw, recovered: key !== keys[0], key };
    } catch (_error) {
      // Keep trying backup keys before falling back.
    }
  }
  return { value: fallback, raw: "", recovered: false, key: "" };
}

export function writeJsonToStorage(keys, value) {
  const serialized = JSON.stringify(value);
  const store = storage();
  if (!store) return serialized;
  for (const key of keys) {
    try {
      store.setItem(key, serialized);
    } catch (_error) {
      // Local progress is optional; gameplay should continue even if storage is unavailable.
    }
  }
  return serialized;
}
