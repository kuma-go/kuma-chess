import { ensurePieceAssetsLoaded } from "../pieceAssets.js?v=20260903-online94";
import { createPieceView } from "../pieceStyles.js?v=20260903-online94";
import { acknowledgePieceUnlockNotices, readPlayerState } from "../playerState.js?v=20260903-online94";
import { showRewardLine } from "./KumaUi.js?v=20260903-online94";

const SKIN_NAMES = Object.freeze({
  ko: Object.freeze({ cat: "고양이", brownBear: "브라운 곰", goldBear: "황금 곰" }),
  en: Object.freeze({ cat: "Cat", brownBear: "Brown Bear", goldBear: "Gold Bear" }),
  ja: Object.freeze({ cat: "ネコ", brownBear: "ブラウンベア", goldBear: "ゴールドベア" }),
});

const PIECE_NAMES = Object.freeze({
  ko: Object.freeze({ p: "폰", n: "나이트", b: "비숍", r: "룩", q: "퀸", k: "킹" }),
  en: Object.freeze({ p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" }),
  ja: Object.freeze({ p: "ポーン", n: "ナイト", b: "ビショップ", r: "ルーク", q: "クイーン", k: "キング" }),
});

function unlockMessage(notice, language) {
  const lang = ["ko", "en", "ja"].includes(language) ? language : "ko";
  const skin = SKIN_NAMES[lang][notice.skinId] || notice.skinId;
  const piece = PIECE_NAMES[lang][notice.type] || PIECE_NAMES[lang].k;
  if (lang === "en") return notice.set ? `${skin} set unlocked` : `${skin} ${piece} unlocked`;
  if (lang === "ja") return notice.set ? `${skin}セット獲得` : `${skin} ${piece}獲得`;
  return notice.set ? `${skin} 세트 획득` : `${skin} ${piece} 획득`;
}

export function pieceUnlockSequenceDuration(notices, options = {}) {
  const hold = options.hold ?? 1850;
  return Math.max(0, (Array.isArray(notices) ? notices.length : 0) * (hold + 520));
}

export async function showPieceUnlockNoticeSequence(scene, notices, options = {}) {
  const queue = Array.isArray(notices) ? notices.filter(Boolean) : [];
  if (!queue.length || !scene?.scene?.isActive?.()) return 0;
  await ensurePieceAssetsLoaded(scene, queue.map((notice) => ({
    skin: notice.skinId,
    color: notice.color,
    type: notice.type || "k",
    facing: "front",
  })));
  if (!scene.scene.isActive()) return 0;

  const language = readPlayerState().language || "ko";
  const hold = options.hold ?? 1850;
  const interval = hold + 520;
  queue.forEach((notice, index) => {
    scene.time.delayedCall(index * interval, () => {
      if (!scene.scene.isActive()) return;
      acknowledgePieceUnlockNotices(notice.id);
      const icon = createPieceView(
        scene,
        0,
        0,
        58,
        notice.skinId,
        notice.color,
        notice.type || "k",
        "front",
      );
      showRewardLine(scene, unlockMessage(notice, language), {
        y: options.y,
        depth: options.depth ?? 10120,
        hold,
        showCoin: false,
        icon,
        particleScale: 1.25,
        feedbackType: "purchase",
      });
    });
  });
  return pieceUnlockSequenceDuration(queue, { hold });
}
