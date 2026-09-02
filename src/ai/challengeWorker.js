import { Chess } from "../vendor-chess.js?v=20260902-frame86";
import { chooseChallengeMove } from "./challengeEngine.js?v=20260902-frame86";

self.onmessage = (event) => {
  const { requestId, fen, aiColor, limits } = event.data || {};
  try {
    const chess = new Chess(fen);
    const result = chooseChallengeMove(chess, aiColor === "w" ? "w" : "b", limits);
    self.postMessage({ requestId, ok: true, ...result });
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: String(error?.message || error || "search failed") });
  }
};
