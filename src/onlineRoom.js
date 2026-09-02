export const ONLINE_INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeOnlineRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

export function createOnlineRoomCode(randomValues = null) {
  const bytes = randomValues || (() => {
    const values = new Uint8Array(6);
    globalThis.crypto?.getRandomValues?.(values);
    if (!values.some(Boolean)) {
      for (let index = 0; index < values.length; index += 1) {
        values[index] = Math.floor(Math.random() * 256);
      }
    }
    return values;
  })();
  return Array.from(bytes)
    .slice(0, 6)
    .map((value) => ROOM_CODE_ALPHABET[Number(value) % ROOM_CODE_ALPHABET.length])
    .join("");
}

export function normalizeOnlineMove(value) {
  const move = String(value || "").toLowerCase();
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : "";
}

export function onlineMovePayload(move) {
  if (!move?.from || !move?.to) return "";
  return normalizeOnlineMove(`${move.from}${move.to}${move.promotion || ""}`);
}

export function onlineRoomResult(chess) {
  if (!chess?.isGameOver?.()) return Object.freeze({ status: "active", result: "", reason: "" });
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "b" : "w";
    return Object.freeze({ status: "finished", result: `${winner}_win`, reason: "checkmate" });
  }
  return Object.freeze({ status: "finished", result: "draw", reason: "draw" });
}
