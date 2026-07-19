const STORAGE_KEY = "kumaChessMedalsV1";
const STATE_VERSION = 1;
const PROCESSED_ID_LIMIT = 200;
const LANGUAGES = new Set(["ko", "en", "ja"]);

export const MEDAL_CATEGORIES = Object.freeze([
  Object.freeze({ id: "kingdom", name: Object.freeze({ ko: "왕국의 승리", en: "Kingdom Victories", ja: "王国の勝利" }) }),
  Object.freeze({ id: "challenge", name: Object.freeze({ ko: "위대한 도전", en: "Great Challenges", ja: "偉大な挑戦" }) }),
  Object.freeze({ id: "puzzle", name: Object.freeze({ ko: "퍼즐의 기록", en: "Puzzle Records", ja: "パズルの記録" }) }),
  Object.freeze({ id: "rank", name: Object.freeze({ ko: "명예의 등급", en: "Ranks of Honor", ja: "名誉のランク" }) }),
]);

function medal(id, category, asset, target, name, description, extra = {}) {
  return Object.freeze({
    id,
    category,
    asset: `메달_${asset}.webp`,
    target,
    name: Object.freeze(name),
    description: Object.freeze(description),
    ...extra,
  });
}

const SKINS = [
  ["bear", "곰", "Bear", "クマ"],
  ["rabbit", "토끼", "Rabbit", "ウサギ"],
  ["cat", "고양이", "Cat", "ネコ"],
  ["wolf", "늑대", "Wolf", "オオカミ"],
  ["sheep", "양", "Sheep", "ヒツジ"],
  ["eagle", "독수리", "Eagle", "ワシ"],
  ["owl", "부엉이", "Owl", "フクロウ"],
  ["capybara", "카피바라", "Capybara", "カピバラ"],
];

const KINGDOM_MEDALS = SKINS.flatMap(([skinId, ko, en, ja]) => [
  medal(
    `skin-${skinId}-w`, "kingdom", `백_${ko}`, 5,
    { ko: `백 ${ko}`, en: `White ${en}`, ja: `白の${ja}` },
    {
      ko: `백 ${ko} 기물로 5승을 달성하세요.`,
      en: `Win 5 games with the White ${en} pieces.`,
      ja: `白の${ja}駒で5勝しましょう。`,
    },
    { skinId, color: "w" },
  ),
  medal(
    `skin-${skinId}-b`, "kingdom", `흑_${ko}`, 5,
    { ko: `흑 ${ko}`, en: `Black ${en}`, ja: `黒の${ja}` },
    {
      ko: `흑 ${ko} 기물로 5승을 달성하세요.`,
      en: `Win 5 games with the Black ${en} pieces.`,
      ja: `黒の${ja}駒で5勝しましょう。`,
    },
    { skinId, color: "b" },
  ),
]);

const CHALLENGE_MEDALS = [
  medal("last-pawn-hunter", "challenge", "마지막병사의반격", 30,
    { ko: "마지막 병사의 반격", en: "Last Pawn Standing", ja: "最後の兵士の反撃" },
    { ko: "마지막 남은 폰으로 상대 기물을 30회 잡으세요.", en: "Make 30 captures with your last remaining pawn.", ja: "最後に残ったポーンで30回駒を取りましょう。" }),
  medal("queenless-victory", "challenge", "여왕없는승리", 10,
    { ko: "여왕 없는 승리", en: "Queenless Victory", ja: "クイーンなき勝利" },
    { ko: "내 퀸이 없는 상태로 AI 대전에서 10승을 달성하세요.", en: "Win 10 AI games after losing your queen.", ja: "自分のクイーンがない状態でAI戦に10勝しましょう。" }),
  medal("perfect-defense", "challenge", "완벽한방어", 3,
    { ko: "완벽한 방어", en: "Perfect Defense", ja: "完全防御" },
    { ko: "체크를 받거나 왕을 움직이지 않고 AI 대전에서 3승을 달성하세요.", en: "Win 3 AI games without being checked or moving your king.", ja: "チェックされず、キングも動かさずにAI戦で3勝しましょう。" }),
  medal("coin-master", "challenge", "코인", 10000,
    { ko: "코인", en: "Coin Master", ja: "コイン" },
    { ko: "코인을 10,000개 보유하세요.", en: "Hold 10,000 coins.", ja: "コインを10,000枚集めましょう。" }),
  medal("ai-win-streak", "challenge", "연승의깃발", 10,
    { ko: "연승의 깃발", en: "Banner of Victory", ja: "連勝の旗" },
    { ko: "AI 대전에서 10연승을 달성하세요.", en: "Win 10 AI games in a row.", ja: "AI戦で10連勝しましょう。" }),
  medal("castling-master", "challenge", "룩의보호", 10,
    { ko: "룩의 보호", en: "Rook's Protection", ja: "ルークの守り" },
    { ko: "AI 대전에서 캐슬링을 10회 하세요.", en: "Castle 10 times in AI games.", ja: "AI戦でキャスリングを10回しましょう。" }),
  medal("queen-hunter", "challenge", "여왕의품격", 50,
    { ko: "여왕의 품격", en: "The Queen's Grace", ja: "女王の品格" },
    { ko: "AI 대전에서 퀸으로 상대 기물을 50회 잡으세요.", en: "Make 50 captures with your queen in AI games.", ja: "AI戦でクイーンを使って50回駒を取りましょう。" }),
  medal("check-counter", "challenge", "공격은최선의방어", 50,
    { ko: "공격은 최선의 방어", en: "Attack Is the Best Defense", ja: "攻撃は最大の防御" },
    { ko: "체크를 받은 상태에서 상대 기물을 50회 잡으세요.", en: "Make 50 captures while getting out of check.", ja: "チェックされている状態から50回駒を取りましょう。" }),
  medal("capture-streak", "challenge", "몰아치는공격", 1,
    { ko: "몰아치는 공격", en: "Relentless Attack", ja: "畳みかける攻撃" },
    { ko: "한 AI 대전에서 내 차례마다 5회 연속으로 기물을 잡으세요.", en: "Capture on 5 consecutive turns in one AI game.", ja: "1回のAI戦で5手連続で駒を取りましょう。" }),
  medal("collector", "challenge", "보물수집가", 1,
    { ko: "보물 수집가", en: "Treasure Collector", ja: "宝物コレクター" },
    { ko: "획득 가능한 기본 메달과 18가지 기물 색상을 모두 모으세요.", en: "Collect every available base medal and all 18 piece colors.", ja: "獲得可能な基本メダルと18種類の駒カラーをすべて集めましょう。" },
    { collector: true }),
  medal("hint-user", "challenge", "문제를푸는열쇠", 30,
    { ko: "문제를 푸는 열쇠", en: "Key to the Puzzle", ja: "問題を解く鍵" },
    { ko: "서로 다른 퍼즐 플레이에서 힌트를 30회 사용하세요.", en: "Use a hint in 30 separate puzzle sessions.", ja: "別々のパズルプレイでヒントを30回使いましょう。" }),
  medal("speed-checkmate", "challenge", "초고속행군", 1,
    { ko: "초고속 행군", en: "Lightning March", ja: "超高速進軍" },
    { ko: "1분 안에 AI를 체크메이트하세요.", en: "Checkmate the AI in under one minute.", ja: "1分以内にAIをチェックメイトしましょう。" }),
  medal("triple-promotion", "challenge", "승급전문가", 1,
    { ko: "승급 전문가", en: "Promotion Expert", ja: "昇格の達人" },
    { ko: "한 AI 대전에서 폰을 3회 승급하세요.", en: "Promote 3 pawns in one AI game.", ja: "1回のAI戦でポーンを3回昇格させましょう。" }),
  medal("online-challenger", "challenge", "도전장", 10,
    { ko: "도전장", en: "The Challenge", ja: "挑戦状" },
    { ko: "온라인 대전을 10회 완료하세요. 현재 이용할 수 없습니다.", en: "Complete 10 online games. This mode is currently unavailable.", ja: "オンライン対戦を10回完了しましょう。現在は利用できません。" },
    { unavailable: true }),
  medal("puzzle-replay-10", "challenge", "퍼즐공부", 10,
    { ko: "퍼즐 공부", en: "Puzzle Study", ja: "パズル復習" },
    { ko: "이미 클리어한 퍼즐을 10회 다시 완료하세요.", en: "Replay and complete cleared puzzles 10 times.", ja: "クリア済みパズルを10回もう一度完成しましょう。" }),
  medal("puzzle-replay-70", "challenge", "퍼즐마니아", 70,
    { ko: "퍼즐 마니아", en: "Puzzle Mania", ja: "パズルマニア" },
    { ko: "이미 클리어한 퍼즐을 70회 다시 완료하세요.", en: "Replay and complete cleared puzzles 70 times.", ja: "クリア済みパズルを70回もう一度完成しましょう。" }),
  medal("face-to-face-10", "challenge", "우정체스", 10,
    { ko: "우정 체스", en: "Friendly Chess", ja: "友情チェス" },
    { ko: "마주보기 2인 대전을 10회 완료하세요.", en: "Complete 10 face-to-face games.", ja: "対面2人対戦を10回完了しましょう。" }),
  medal("draw-10", "challenge", "평화주의자", 10,
    { ko: "평화주의자", en: "Pacifist", ja: "平和主義者" },
    { ko: "대전을 10회 무승부로 마치세요.", en: "Finish 10 games in a draw.", ja: "対戦を10回引き分けで終えましょう。" }),
  medal("knight-captures-14", "challenge", "나이트메어", 1,
    { ko: "나이트메어", en: "Knightmare", ja: "ナイトメア" },
    { ko: "한 AI 대전에서 나이트로 기물을 14회 잡으세요.", en: "Make 14 captures with knights in a single AI game.", ja: "1回のAI戦でナイトを使って14回駒を取りましょう。" }),
  medal("bare-kings-draw-5", "challenge", "킹대킹", 5,
    { ko: "킹 대 킹", en: "King vs. King", ja: "キング対キング" },
    { ko: "킹만 남은 상태로 5회 무승부를 기록하세요.", en: "Draw 5 games with only the two kings remaining.", ja: "キングだけが残った状態で5回引き分けましょう。" }),
];

const PUZZLE_MEDALS = [10, 25, 50, 75, 100].map((target, index) => medal(
  `puzzle-${target}`, "puzzle", `퍼즐_0${index + 1}`, target,
  { ko: `퍼즐 ${target}`, en: `Puzzle ${target}`, ja: `パズル ${target}` },
  {
    ko: `서로 다른 퍼즐 ${target}개를 클리어하세요.`,
    en: `Clear ${target} unique puzzles.`,
    ja: `異なるパズルを${target}問クリアしましょう。`,
  },
  { puzzleMilestone: true },
));

const RANK_NAMES = {
  25: { asset: "브론즈", ko: "브론즈", en: "Bronze", ja: "ブロンズ" },
  50: { asset: "실버", ko: "실버", en: "Silver", ja: "シルバー" },
  75: { asset: "골드", ko: "골드", en: "Gold", ja: "ゴールド" },
  100: { asset: "플레티넘", ko: "플레티넘", en: "Platinum", ja: "プラチナ" },
};

const RANK_MEDALS = [25, 50, 75, 100].map((target) => medal(
  `rank-${target}`, "rank", RANK_NAMES[target].asset, target, RANK_NAMES[target],
  {
    ko: `획득 가능한 일반 메달의 ${target}%를 모으세요.`,
    en: `Collect ${target}% of all available non-rank medals.`,
    ja: `獲得可能な通常メダルの${target}%を集めましょう。`,
  },
  { rankPercent: target },
));

export const MEDALS = Object.freeze([
  ...KINGDOM_MEDALS,
  ...CHALLENGE_MEDALS,
  ...PUZZLE_MEDALS,
  ...RANK_MEDALS,
]);

const MEDAL_BY_ID = new Map(MEDALS.map((item) => [item.id, item]));
const SKIN_MEDAL_BY_KEY = new Map(KINGDOM_MEDALS.map((item) => [`${item.skinId}:${item.color}`, item]));
const BASE_MEDALS = MEDALS.filter((item) => item.category !== "rank" && !item.collector && !item.unavailable);

export function medalTextureKey(id) {
  return `kuma_medal_${String(id || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function emptyState() {
  return {
    version: STATE_VERSION,
    progress: {},
    unlockedAt: {},
    newIds: [],
    currentWinStreak: 0,
    skinWins: {},
    processedGameIds: [],
    processedHintSessionIds: [],
    processedPuzzleSessionIds: [],
    context: { coins: 0, ownedSkinCount: 0, totalSkinCount: 18 },
  };
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeId(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().slice(0, 160);
}

function boundedIds(value) {
  const source = Array.isArray(value) ? value : [];
  const unique = [];
  const seen = new Set();
  for (let index = source.length - 1; index >= 0 && unique.length < PROCESSED_ID_LIMIT; index -= 1) {
    const id = normalizeId(source[index]);
    if (id && !seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique.reverse();
}

function normalizeState(source) {
  const state = emptyState();
  const input = source && typeof source === "object" ? source : {};
  const legacyMedals = input.medals && typeof input.medals === "object" ? input.medals : {};
  const rawProgress = input.progress && typeof input.progress === "object" ? input.progress : {};

  for (const item of MEDALS) {
    const legacy = legacyMedals[item.id];
    const value = rawProgress[item.id] ?? (legacy && typeof legacy === "object" ? legacy.progress : legacy);
    const progress = count(value);
    if (progress) state.progress[item.id] = progress;
  }

  const rawUnlockedAt = input.unlockedAt && typeof input.unlockedAt === "object" ? input.unlockedAt : {};
  const legacyUnlocked = new Set([
    ...(Array.isArray(input.unlocked) ? input.unlocked : []),
    ...(Array.isArray(input.unlockedIds) ? input.unlockedIds : []),
  ]);
  for (const item of MEDALS) {
    const legacy = legacyMedals[item.id];
    const rawTime = rawUnlockedAt[item.id] ?? (legacy && typeof legacy === "object" ? legacy.unlockedAt : 0);
    const unlocked = legacyUnlocked.has(item.id) || rawTime || (legacy && legacy.unlocked === true);
    if (unlocked && !item.unavailable) state.unlockedAt[item.id] = count(rawTime) || Date.now();
  }

  state.newIds = boundedIds(input.newIds).filter((id) => MEDAL_BY_ID.has(id) && state.unlockedAt[id]);
  state.currentWinStreak = count(input.currentWinStreak ?? input.winStreak);
  const rawSkinWins = input.skinWins && typeof input.skinWins === "object" ? input.skinWins : {};
  for (const key of SKIN_MEDAL_BY_KEY.keys()) {
    const wins = count(rawSkinWins[key]);
    if (wins) state.skinWins[key] = wins;
  }

  state.processedGameIds = boundedIds(input.processedGameIds ?? input.processedGames);
  state.processedHintSessionIds = boundedIds(input.processedHintSessionIds ?? input.processedHintIds);
  state.processedPuzzleSessionIds = boundedIds(input.processedPuzzleSessionIds ?? input.processedPuzzleIds);
  const context = input.context && typeof input.context === "object" ? input.context : input;
  state.context = {
    coins: count(context.coins),
    ownedSkinCount: count(context.ownedSkinCount),
    totalSkinCount: Math.max(18, count(context.totalSkinCount) || 18),
  };
  return state;
}

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (_error) {
    return null;
  }
}

function saveState(state) {
  const normalized = normalizeState(state);
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (_error) {
    // Medal progress is optional when storage is blocked or full.
  }
  return normalized;
}

function unlock(state, id, newlyUnlocked, now) {
  const item = MEDAL_BY_ID.get(id);
  if (!item || item.unavailable || state.unlockedAt[id]) return;
  state.unlockedAt[id] = now;
  if (!state.newIds.includes(id)) state.newIds.push(id);
  newlyUnlocked.push(id);
}

function evaluate(state) {
  const newlyUnlocked = [];
  const now = Date.now();

  for (const [key, item] of SKIN_MEDAL_BY_KEY) {
    state.progress[item.id] = Math.max(count(state.progress[item.id]), count(state.skinWins[key]));
  }
  state.progress["coin-master"] = Math.max(count(state.progress["coin-master"]), state.context.coins);

  for (const item of MEDALS) {
    if (item.category === "rank" || item.collector || item.unavailable) continue;
    if (count(state.progress[item.id]) >= item.target) unlock(state, item.id, newlyUnlocked, now);
  }

  const unlockedBase = BASE_MEDALS.reduce((total, item) => total + Number(Boolean(state.unlockedAt[item.id])), 0);
  const basePercent = BASE_MEDALS.length ? Math.floor((unlockedBase / BASE_MEDALS.length) * 100) : 0;
  for (const item of RANK_MEDALS) {
    state.progress[item.id] = basePercent;
    if (basePercent >= item.target) unlock(state, item.id, newlyUnlocked, now);
  }

  const ownsAllColors = state.context.totalSkinCount >= 18
    && state.context.ownedSkinCount >= state.context.totalSkinCount;
  const ownsAllBaseMedals = unlockedBase === BASE_MEDALS.length;
  state.progress.collector = ownsAllColors && ownsAllBaseMedals ? 1 : 0;
  if (state.progress.collector) unlock(state, "collector", newlyUnlocked, now);
  state.newIds = boundedIds(state.newIds).filter((id) => state.unlockedAt[id]);
  return newlyUnlocked;
}

export function readMedalState() {
  let source = null;
  let raw = "";
  try {
    raw = storage()?.getItem(STORAGE_KEY) || "";
    source = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    source = null;
  }
  const state = normalizeState(source);
  evaluate(state);
  const serialized = JSON.stringify(state);
  if (serialized !== raw) {
    try {
      storage()?.setItem(STORAGE_KEY, serialized);
    } catch (_error) {
      // Reading remains safe in privacy modes that reject storage writes.
    }
  }
  return state;
}

function update(mutator) {
  const state = readMedalState();
  mutator(state);
  const newlyUnlocked = evaluate(state);
  return { newlyUnlocked, state: saveState(state) };
}

function languageId(language) {
  return LANGUAGES.has(language) ? language : "ko";
}

export function getMedalEntries(language = "ko") {
  const lang = languageId(language);
  const state = readMedalState();
  return MEDALS.map((item) => {
    const progress = count(state.progress[item.id]);
    return {
      ...item,
      medal: item,
      name: item.name[lang],
      description: item.description[lang],
      progress,
      displayProgress: Math.min(progress, item.target),
      unlocked: Boolean(state.unlockedAt[item.id]),
      unlockedAt: state.unlockedAt[item.id] || null,
      isNew: state.newIds.includes(item.id),
      unavailable: item.unavailable === true,
    };
  });
}

export function getMedalSummary() {
  const state = readMedalState();
  const available = MEDALS.filter((item) => !item.unavailable);
  const unlocked = available.filter((item) => state.unlockedAt[item.id]).length;
  const byCategory = {};
  for (const category of MEDAL_CATEGORIES) {
    const items = available.filter((item) => item.category === category.id);
    const categoryUnlocked = items.filter((item) => state.unlockedAt[item.id]).length;
    byCategory[category.id] = { total: items.length, unlocked: categoryUnlocked };
  }
  return {
    total: MEDALS.length,
    available: available.length,
    unlocked,
    locked: available.length - unlocked,
    percent: available.length ? Math.floor((unlocked / available.length) * 100) : 0,
    newCount: state.newIds.length,
    byCategory,
  };
}

export function hasNewMedals() {
  return readMedalState().newIds.length > 0;
}

export function markMedalsSeen(ids = null) {
  const state = readMedalState();
  if (ids == null) {
    state.newIds = [];
  } else {
    const seen = new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeId));
    state.newIds = state.newIds.filter((id) => !seen.has(id));
  }
  return saveState(state);
}

function rememberId(list, rawId) {
  const id = normalizeId(rawId);
  if (!id || list.includes(id)) return false;
  list.push(id);
  if (list.length > PROCESSED_ID_LIMIT) list.splice(0, list.length - PROCESSED_ID_LIMIT);
  return true;
}

function addProgress(state, id, amount = 1) {
  if (!MEDAL_BY_ID.has(id) || MEDAL_BY_ID.get(id).unavailable) return;
  state.progress[id] = count(state.progress[id]) + count(amount);
}

function colorId(value, fallback = "") {
  if (value === "w" || value === "white" || value === "White") return "w";
  if (value === "b" || value === "black" || value === "Black") return "b";
  return fallback;
}

function otherColor(color) {
  return color === "b" ? "w" : "b";
}

function winnerFromRecord(record, playerColor) {
  const explicit = colorId(record.winnerColor);
  if (explicit) return explicit;
  const result = String(record.result || "").toLowerCase();
  if (["win", "wins", "victory"].includes(result)) return playerColor;
  if (["loss", "losses", "defeat"].includes(result)) return otherColor(playerColor);
  if (result.includes("w_win") || result === "white") return "w";
  if (result.includes("b_win") || result === "black") return "b";
  return "";
}

function isDrawRecord(record, winnerColor) {
  if (winnerColor) return false;
  const result = String(record.result || "draw").toLowerCase();
  return result === "draw" || result.includes("draw") || result.includes("stalemate")
    || result.includes("repetition") || result.includes("insufficient");
}

function moveColor(move) {
  return colorId(move?.color);
}

function pieceType(value) {
  const type = String(value || "").toLowerCase();
  const names = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
  return names[type] || ("pnbrqk".includes(type) && type.length === 1 ? type : "");
}

function isCapture(move) {
  const flags = String(move?.flags || "");
  return Boolean(pieceType(move?.captured) || flags.includes("c") || flags.includes("e") || String(move?.san || "").includes("x"));
}

function isCastle(move) {
  const san = String(move?.san || "").replace(/0/g, "O");
  const flags = String(move?.flags || "");
  return pieceType(move?.piece) === "k" && (flags.includes("k") || flags.includes("q") || san.startsWith("O-O"));
}

function wasInCheck(history, index) {
  const move = history[index] || {};
  if (move.wasInCheck === true || move.inCheckBefore === true || move.beforeCheck === true) return true;
  const previous = history[index - 1];
  return Boolean(previous && moveColor(previous) !== moveColor(move) && /[+#]/.test(String(previous.san || "")));
}

function flattenPieces(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    for (const item of value) flattenPieces(item, output);
    return output;
  }
  if (typeof value !== "object") return output;
  const type = pieceType(value.type ?? value.piece);
  const color = colorId(value.color);
  if (type && color) output.push({ type, color });
  else for (const child of Object.values(value)) flattenPieces(child, output);
  return output;
}

function analyzeHistory(historyInput, playerColor, finalPiecesInput) {
  const history = Array.isArray(historyInput) ? historyInput.filter((move) => move && typeof move === "object") : [];
  const counts = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  };
  let lastPawnCaptures = 0;
  let queenCaptures = 0;
  let checkCaptures = 0;
  let castles = 0;
  let promotions = 0;
  let piecesLost = 0;
  let wasChecked = false;
  let kingMoves = 0;
  let captureRun = 0;
  let maxCaptureRun = 0;
  let knightCaptures = 0;

  history.forEach((move, index) => {
    const actor = moveColor(move);
    if (!actor) return;
    const opponent = otherColor(actor);
    const movingPiece = pieceType(move.piece);
    const captured = pieceType(move.captured) || (isCapture(move) && String(move.flags || "").includes("e") ? "p" : "");
    const capture = isCapture(move);

    if (actor === playerColor) {
      if (wasInCheck(history, index)) wasChecked = true;
      if (movingPiece === "k") kingMoves += 1;
      if (capture) {
        captureRun += 1;
        maxCaptureRun = Math.max(maxCaptureRun, captureRun);
        if (movingPiece === "p" && counts[actor].p === 1) lastPawnCaptures += 1;
        if (movingPiece === "q") queenCaptures += 1;
        if (wasInCheck(history, index)) checkCaptures += 1;
        if (movingPiece === "n") knightCaptures += 1;
      } else {
        captureRun = 0;
      }
      if (isCastle(move)) castles += 1;
      if (pieceType(move.promotion) || (movingPiece === "p" && String(move.flags || "").includes("p"))) promotions += 1;
    } else if (capture) {
      piecesLost += 1;
      captureRun = 0;
    }

    if (captured && counts[opponent][captured] > 0) counts[opponent][captured] -= 1;
    const promoted = pieceType(move.promotion);
    if (promoted && movingPiece === "p") {
      counts[actor].p = Math.max(0, counts[actor].p - 1);
      counts[actor][promoted] += 1;
    }
  });

  const finalPieces = flattenPieces(finalPiecesInput);
  const finalCounts = finalPieces.length
    ? finalPieces.reduce((result, item) => {
      result[item.color][item.type] += 1;
      return result;
    }, { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } })
    : counts;
  const allRemaining = Object.values(finalCounts.w).reduce((sum, value) => sum + value, 0)
    + Object.values(finalCounts.b).reduce((sum, value) => sum + value, 0);
  const lastMove = history[history.length - 1];

  return {
    lastPawnCaptures,
    queenCaptures,
    checkCaptures,
    castles,
    promotions,
    piecesLost,
    wasChecked,
    kingMoves,
    maxCaptureRun,
    knightCaptures,
    queenless: finalCounts[playerColor].q === 0,
    bareKings: allRemaining === 2 && finalCounts.w.k === 1 && finalCounts.b.k === 1,
    checkmate: Boolean(lastMove && /#/.test(String(lastMove.san || ""))),
  };
}

function skinForColor(skins, color) {
  const value = skins && typeof skins === "object" ? skins[color] : "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.id || value.skinId || value.skin || "";
  return "";
}

function recordSkinWin(state, skins, color) {
  const skinId = normalizeId(skinForColor(skins, color));
  const key = `${skinId}:${color}`;
  if (!SKIN_MEDAL_BY_KEY.has(key)) return;
  state.skinWins[key] = count(state.skinWins[key]) + 1;
}

export function recordCompletedGame(record = {}) {
  const gameSessionId = normalizeId(record.gameSessionId);
  if (!gameSessionId) return { newlyUnlocked: [], state: readMedalState() };

  return update((state) => {
    if (!rememberId(state.processedGameIds, gameSessionId)) return;
    const mode = ["pvp", "local", "face-to-face", "face_to_face"].includes(String(record.mode || "").toLowerCase()) ? "pvp" : "ai";
    const playerColor = colorId(record.playerColor, "w");
    const winnerColor = winnerFromRecord(record, playerColor);
    const draw = isDrawRecord(record, winnerColor);
    const humanWon = mode === "ai" && winnerColor === playerColor;

    if (winnerColor && (mode === "pvp" || humanWon)) recordSkinWin(state, record.skins, winnerColor);
    if (draw) addProgress(state, "draw-10");

    const metrics = analyzeHistory(record.history, playerColor, record.finalPieces);
    const bareKings = record.bareKings === true || metrics.bareKings;
    if (draw && bareKings) addProgress(state, "bare-kings-draw-5");

    if (mode === "pvp") {
      addProgress(state, "face-to-face-10");
      return;
    }

    state.currentWinStreak = humanWon ? state.currentWinStreak + 1 : 0;
    state.progress["ai-win-streak"] = Math.max(count(state.progress["ai-win-streak"]), state.currentWinStreak);
    addProgress(state, "last-pawn-hunter", metrics.lastPawnCaptures);
    addProgress(state, "castling-master", metrics.castles);
    addProgress(state, "queen-hunter", metrics.queenCaptures);
    addProgress(state, "check-counter", metrics.checkCaptures);
    if (metrics.maxCaptureRun >= 5) addProgress(state, "capture-streak");
    if (metrics.promotions >= 3) addProgress(state, "triple-promotion");
    if (metrics.knightCaptures >= 14) addProgress(state, "knight-captures-14");

    if (humanWon) {
      if (metrics.queenless) addProgress(state, "queenless-victory");
      if (!metrics.wasChecked && metrics.kingMoves === 0) addProgress(state, "perfect-defense");
      const duration = Number(record.durationMs);
      const checkmate = metrics.checkmate || String(record.result || "").toLowerCase().includes("checkmate")
        || String(record.reason || "").toLowerCase() === "checkmate";
      if (checkmate && Number.isFinite(duration) && duration >= 0 && duration < 60000) {
        addProgress(state, "speed-checkmate");
      }
    }
  });
}

export function recordPuzzleHint({ sessionId } = {}) {
  const id = normalizeId(sessionId);
  if (!id) return { newlyUnlocked: [], state: readMedalState() };
  return update((state) => {
    if (rememberId(state.processedHintSessionIds, id)) addProgress(state, "hint-user");
  });
}

export function recordPuzzleCompletion({ sessionId, firstClear, totalCleared } = {}) {
  const id = normalizeId(sessionId);
  if (!id) return { newlyUnlocked: [], state: readMedalState() };
  return update((state) => {
    if (!rememberId(state.processedPuzzleSessionIds, id)) return;
    const suppliedTotal = Number(totalCleared);
    const previousTotal = Math.max(...PUZZLE_MEDALS.map((item) => count(state.progress[item.id])), 0);
    const uniqueClears = Number.isFinite(suppliedTotal)
      ? Math.max(previousTotal, count(suppliedTotal))
      : previousTotal + Number(firstClear === true);
    for (const item of PUZZLE_MEDALS) state.progress[item.id] = uniqueClears;
    if (firstClear === false) {
      addProgress(state, "puzzle-replay-10");
      addProgress(state, "puzzle-replay-70");
    }
  });
}

export function syncContextMedals({ coins, ownedSkinCount, totalSkinCount } = {}) {
  return update((state) => {
    const coinValue = Number(coins);
    if (Number.isFinite(coinValue)) {
      state.context.coins = Math.max(state.context.coins, count(coinValue));
      state.progress["coin-master"] = Math.max(count(state.progress["coin-master"]), count(coinValue));
    }
    const ownedValue = Number(ownedSkinCount);
    if (Number.isFinite(ownedValue)) state.context.ownedSkinCount = Math.max(state.context.ownedSkinCount, count(ownedValue));
    const totalValue = Number(totalSkinCount);
    if (Number.isFinite(totalValue) && totalValue > 0) state.context.totalSkinCount = Math.max(18, count(totalValue));
  });
}
