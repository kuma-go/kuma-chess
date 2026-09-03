import { normalizeOnlineRoomCode } from "./onlineRoom.js?v=20260903-gameplay99";

const ONLINE_SESSION_KEY = "kumaChessOnlineSessionV1";

export function readOnlineSession() {
  try {
    const value = JSON.parse(window.localStorage.getItem(ONLINE_SESSION_KEY) || "null");
    const code = normalizeOnlineRoomCode(value?.code);
    const color = value?.color === "b" ? "b" : "w";
    return code.length === 6 ? Object.freeze({ code, color }) : null;
  } catch (_error) {
    return null;
  }
}

export function saveOnlineSession(code, color) {
  const normalizedCode = normalizeOnlineRoomCode(code);
  if (normalizedCode.length !== 6) return null;
  const value = Object.freeze({ code: normalizedCode, color: color === "b" ? "b" : "w" });
  window.localStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(value));
  return value;
}

export function clearOnlineSession(code = "") {
  const current = readOnlineSession();
  const normalizedCode = normalizeOnlineRoomCode(code);
  if (!normalizedCode || current?.code === normalizedCode) window.localStorage.removeItem(ONLINE_SESSION_KEY);
}
