import { readJsonFromStorage, writeJsonToStorage } from "./storage.js?v=20260902-reward85";

const STORAGE_KEY = "kumaChessMedalsV1";
const BACKUP_STORAGE_KEY = "kumaChessMedalsBackupV1";
const STATE_VERSION = 2;
const PROCESSED_ID_LIMIT = 200;
const LANGUAGES = new Set(["ko", "en", "ja"]);
const MINI_GAME_IDS = Object.freeze(["tug", "crown", "road", "road-puzzle", "siege"]);

export const MEDAL_CATEGORIES = Object.freeze([
  Object.freeze({ id: "kingdom", name: Object.freeze({ ko: "왕국의 승리", en: "Kingdom Victories", ja: "王国の勝利" }) }),
  Object.freeze({ id: "challenge", name: Object.freeze({ ko: "위대한 도전", en: "Great Challenges", ja: "偉大な挑戦" }) }),
  Object.freeze({ id: "puzzle", name: Object.freeze({ ko: "퍼즐의 기록", en: "Puzzle Records", ja: "パズルの記録" }) }),
  Object.freeze({ id: "honor", name: Object.freeze({ ko: "왕국의 명예", en: "Realm Honors", ja: "王国の名誉" }) }),
  Object.freeze({ id: "rank", name: Object.freeze({ ko: "명예의 등급", en: "Ranks of Honor", ja: "名誉のランク" }) }),
]);

function medal(id, category, asset, target, name, description, extra = {}) {
  return Object.freeze({
    id,
    category,
    asset: extra.assetFile || `메달_${asset}.webp`,
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

const SPECIAL_KINGDOM_MEDALS = [
  medal("gold-bear", "kingdom", "골드_곰", 5,
    { ko: "황금 곰의 영광", en: "Glory of the Gold Bear", ja: "ゴールドベアの栄光" },
    {
      ko: "황금 곰 기물 세트로 5승을 달성하세요.",
      en: "Win 5 games with the complete Gold Bear set.",
      ja: "ゴールドベアの駒セットで5勝しましょう。",
    },
    { assetFile: "메달_골드_곰.png", specialSkinId: "goldBear" }),
  medal("brown-bear", "kingdom", "브라운_곰", 5,
    { ko: "브라운 곰의 영광", en: "Glory of the Brown Bear", ja: "ブラウンベアの栄光" },
    {
      ko: "브라운 곰 기물 세트로 5승을 달성하세요.",
      en: "Win 5 games with the Brown Bear set.",
      ja: "ブラウンベアの駒セットで5勝しましょう。",
    },
    {
      assetFile: "메달_브라운_곰.png",
      specialSkinId: "brownBear",
      countsTowardCollection: false,
    }),
];

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
  medal("coin-master", "honor", "코인", 10000,
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
  medal("collector", "honor", "보물수집가", 1,
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
    {
      ko: "온라인 대전을 10회 완료하세요. 현재 이용할 수 없습니다.",
      en: "Complete 10 online games. This mode is currently unavailable.",
      ja: "オンライン対戦を10回完了しましょう。現在は利用できません。",
    },
    { unavailable: true }),
  medal("challenge-ai-victory", "honor", "AI도전난이도", 1,
    { ko: "최후의 도전자", en: "The Final Challenger", ja: "最後の挑戦者" },
    { ko: "도전 난이도 AI를 체크메이트하고 승리하세요.", en: "Checkmate and defeat the Challenge AI.", ja: "挑戦難易度のAIをチェックメイトして勝利しましょう。" },
    { assetFile: "메달_AI도전난이도.png" }),
  medal("stockfish-18-lite-victory", "honor", "Stockfish18Lite", 1,
    { ko: "왕국 최강자", en: "Champion of the Realm", ja: "王国最強者" },
    {
      ko: "추후 추가될 Stockfish 18 Lite 최고 난이도에 승리하세요.",
      en: "Defeat the upcoming Stockfish 18 Lite challenge.",
      ja: "今後追加されるStockfish 18 Lite最高難易度に勝利しましょう。",
    },
    { assetFile: "메달_Stockfish18Lite.png", unavailable: true, countsTowardCollection: false }),
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
  medal("diligent-knight", "honor", "성실한기사", 7,
    { ko: "성실한 기사", en: "The Diligent Knight", ja: "誠実な騎士" },
    {
      ko: "데일리 미션을 7일 연속 모두 완료하세요.",
      en: "Complete every daily mission for 7 consecutive days.",
      ja: "デイリーミッションを7日連続ですべて達成しましょう。",
    },
    { assetFile: "메달_성실한기사.png", dailyMetric: "streak" }),
  medal("kingdom-routine", "honor", "왕국의일과", 30,
    { ko: "왕국의 일과", en: "The Kingdom's Routine", ja: "王国の日課" },
    {
      ko: "데일리 미션을 모두 완료한 날을 30일 달성하세요.",
      en: "Fully complete daily missions on 30 days.",
      ja: "デイリーミッションをすべて達成した日を30日記録しましょう。",
    },
    { assetFile: "메달_왕국의일과.png", dailyMetric: "totalDays" }),
  medal("hundred-day-training", "honor", "백일의수련", 100,
    { ko: "백일의 수련", en: "One Hundred Days of Training", ja: "百日の修練" },
    {
      ko: "데일리 미션을 모두 완료한 날을 100일 달성하세요.",
      en: "Fully complete daily missions on 100 days.",
      ja: "デイリーミッションをすべて達成した日を100日記録しましょう。",
    },
    { assetFile: "메달_백일의수련.png", dailyMetric: "totalDays" }),
];

const MINI_GAME_MEDALS = [
  medal("king-power", "challenge", "왕의힘", 1,
    { ko: "왕의 힘", en: "The King's Power", ja: "王の力" },
    { ko: "한 게임에서 킹으로 상대 기물 5개를 잡으세요.", en: "Capture 5 pieces with your king in one game.", ja: "1局でキングを使って相手の駒を5個取りましょう。" },
    { assetFile: "메달_왕의힘.png" }),
  medal("minigame-explorer", "challenge", "미니게임경험자", MINI_GAME_IDS.length,
    { ko: "미니게임 경험자", en: "Mini-Game Explorer", ja: "ミニゲーム体験者" },
    { ko: "모든 미니게임을 한 번 이상 완료하세요.", en: "Complete every mini-game at least once.", ja: "すべてのミニゲームを1回以上完了しましょう。" },
    { assetFile: "메달_미니게임경험자.png", minigameMeta: true }),
  medal("minigame-enthusiast", "honor", "미니게임마니아", 1,
    { ko: "미니게임 마니아", en: "Mini-Game Enthusiast", ja: "ミニゲームマニア" },
    { ko: "미니게임 경험자 메달과 모든 미니게임 도전 메달을 획득하세요.", en: "Earn the explorer medal and every mini-game challenge medal.", ja: "体験者メダルとすべてのミニゲーム挑戦メダルを獲得しましょう。" },
    { assetFile: "메달_미니게임마니아.png", minigameMeta: true }),
  medal("tug-underdog", "challenge", "힘겨루기최약체", 50,
    { ko: "힘겨루기 최약체", en: "Push Battle Underdog", ja: "力比べ最弱" },
    { ko: "왕국 힘겨루기 AI 대전에서 50회 패배하세요.", en: "Lose 50 Kingdom Push Battle matches against the AI.", ja: "王国押し合いのAI戦で50回敗北しましょう。" },
    { assetFile: "메달_힘겨루기최약체.png", minigameId: "tug" }),
  medal("tug-winner", "challenge", "힘겨루기우승자", 50,
    { ko: "힘겨루기 우승자", en: "Push Battle Winner", ja: "力比べの勝者" },
    { ko: "왕국 힘겨루기에서 50회 승리하세요.", en: "Win 50 Kingdom Push Battle matches.", ja: "王国押し合いで50回勝利しましょう。" },
    { assetFile: "메달_힘겨루기우승자.png", minigameId: "tug" }),
  medal("tug-champion", "challenge", "힘겨루기챔피언", 100,
    { ko: "힘겨루기 챔피언", en: "Push Battle Champion", ja: "力比べチャンピオン" },
    { ko: "왕국 힘겨루기에서 100회 승리하세요.", en: "Win 100 Kingdom Push Battle matches.", ja: "王国押し合いで100回勝利しましょう。" },
    { assetFile: "메달_힘겨루기챔피언.png", minigameId: "tug" }),
  medal("tug-technician", "challenge", "힘겨루기기술자", 1,
    { ko: "힘겨루기 기술자", en: "Push Battle Technician", ja: "力比べの技巧派" },
    { ko: "내 기물을 하나도 잃지 않고 왕국 힘겨루기에서 승리하세요.", en: "Win a Kingdom Push Battle without losing a piece.", ja: "自分の駒を1つも失わずに王国押し合いで勝利しましょう。" },
    { assetFile: "메달_힘겨루기기술자.png", minigameId: "tug" }),
  medal("crown-thief", "challenge", "왕관도둑", 30,
    { ko: "왕관 도둑", en: "Crown Thief", ja: "王冠泥棒" },
    { ko: "왕관 쟁탈전에서 상대가 든 왕관을 30회 빼앗으세요.", en: "Steal the carried crown 30 times in Crown Clash.", ja: "王冠争奪戦で相手が持つ王冠を30回奪いましょう。" },
    { assetFile: "메달_왕관도둑.png", minigameId: "crown" }),
  medal("crown-first", "challenge", "마이프레셔", 30,
    { ko: "마이프레셔", en: "My Precious", ja: "マイ・プレシャス" },
    { ko: "왕관 쟁탈전에서 중앙 왕관을 먼저 30회 차지하세요.", en: "Be the first to claim the center crown 30 times.", ja: "王冠争奪戦で中央の王冠を先に30回獲得しましょう。" },
    { assetFile: "메달_마이프레셔.png", minigameId: "crown" }),
  medal("crown-champion", "challenge", "왕관쟁탈챔피언", 50,
    { ko: "왕관 쟁탈 챔피언", en: "Crown Clash Champion", ja: "王冠争奪チャンピオン" },
    { ko: "왕관 쟁탈전에서 50회 승리하세요.", en: "Win 50 Crown Clash matches.", ja: "王冠争奪戦で50回勝利しましょう。" },
    { assetFile: "메달_왕관쟁탈챔피언.png", minigameId: "crown" }),
  medal("crown-lost", "challenge", "여기있습니다", 30,
    { ko: "여기 있습니다", en: "Here It Is", ja: "ここにあります" },
    { ko: "왕관 쟁탈전에서 들고 있던 왕관을 상대에게 30회 빼앗기세요.", en: "Have your carried crown stolen 30 times in Crown Clash.", ja: "王冠争奪戦で持っていた王冠を相手に30回奪われましょう。" },
    { assetFile: "메달_여기있습니다.png", minigameId: "crown" }),
  medal("road-lost", "challenge", "길치", 30,
    { ko: "길치", en: "Lost Traveler", ja: "方向音痴" },
    { ko: "왕국의 길 AI 대전에서 30회 패배하세요.", en: "Lose 30 Royal Road matches against the AI.", ja: "王国の道のAI戦で30回敗北しましょう。" },
    { assetFile: "메달_길치.png", minigameId: "road" }),
  medal("road-puzzle-wins", "challenge", "지도를가진자", 20,
    { ko: "지도를 가진 자", en: "Bearer of the Map", ja: "地図を持つ者" },
    { ko: "서로 다른 왕국의 길 퍼즐 20개를 완료하세요.", en: "Complete 20 unique Royal Road puzzles.", ja: "異なる王国の道パズルを20個クリアしましょう。" },
    { assetFile: "메달_지도를가진자.png", minigameId: "road-puzzle" }),
  medal("road-wins-30", "challenge", "지름길은여기요", 30,
    { ko: "지름길은 여기요", en: "The Shortcut Is Here", ja: "近道はこちら" },
    { ko: "왕국의 길에서 30회 승리하세요.", en: "Win 30 Royal Road matches.", ja: "王国の道で30回勝利しましょう。" },
    { assetFile: "메달_지름길은여기요.png", minigameId: "road" }),
  medal("road-wins-40", "challenge", "고속도로", 40,
    { ko: "고속도로", en: "Royal Highway", ja: "王国ハイウェイ" },
    { ko: "왕국의 길에서 40회 승리하세요.", en: "Win 40 Royal Road matches.", ja: "王国の道で40回勝利しましょう。" },
    { assetFile: "메달_고속도로.png", minigameId: "road" }),
  medal("road-wins-50", "challenge", "승리의길", 50,
    { ko: "승리의 길", en: "Road to Victory", ja: "勝利への道" },
    { ko: "왕국의 길에서 50회 승리하세요.", en: "Win 50 Royal Road matches.", ja: "王国の道で50回勝利しましょう。" },
    { assetFile: "메달_승리의길.png", minigameId: "road" }),
  medal("road-navigation", "challenge", "네비게이션", 1,
    { ko: "네비게이션", en: "Royal Navigation", ja: "ナビゲーション" },
    { ko: "왕국의 길 퍼즐 모든 스테이지에서 왕관 3개를 획득하세요.", en: "Earn 3 crowns on every Royal Road puzzle stage.", ja: "王国の道パズルの全ステージで王冠を3個獲得しましょう。" },
    { assetFile: "메달_네비게이션.png", minigameId: "road-puzzle" }),
  medal("siege-defender", "challenge", "수성전문가", 20,
    { ko: "수성 전문가", en: "Castle Defense Expert", ja: "籠城の達人" },
    { ko: "공성전에서 아군 진영에 침입한 적을 20회 처치하세요.", en: "Defeat 20 enemies that enter your defense zone in Kingdom Siege.", ja: "王国攻城戦で味方の防衛区域に侵入した敵を20回倒しましょう。" },
    { assetFile: "메달_수성전문가.png", minigameId: "siege" }),
  medal("siege-breaker", "challenge", "공성전문가", 50,
    { ko: "공성 전문가", en: "Siege Expert", ja: "攻城の達人" },
    { ko: "공성전에서 적의 성을 격파하여 50회 승리하세요.", en: "Win 50 Kingdom Siege matches by destroying the enemy castle.", ja: "王国攻城戦で敵の城を破壊して50回勝利しましょう。" },
    { assetFile: "메달_공성전문가.png", minigameId: "siege" }),
  medal("siege-one-class", "challenge", "집요한전쟁꾼", 30,
    { ko: "집요한 전쟁꾼", en: "Relentless Warlord", ja: "執念の戦士" },
    { ko: "한 종류의 병과만 직접 소환하여 공성전에서 30회 승리하세요.", en: "Win 30 siege matches after summoning only one unit class.", ja: "1種類の兵科だけを召喚して攻城戦で30回勝利しましょう。" },
    { assetFile: "메달_집요한전쟁꾼.png", minigameId: "siege" }),
  medal("siege-all-classes", "challenge", "함께싸우자", 10,
    { ko: "함께 싸우자", en: "Fight Together", ja: "共に戦おう" },
    { ko: "모든 병과를 직접 소환하여 공성전에서 10회 승리하세요.", en: "Win 10 siege matches after summoning every unit class.", ja: "すべての兵科を召喚して攻城戦で10回勝利しましょう。" },
    { assetFile: "메달_함께싸우자.png", minigameId: "siege" }),
  medal("portal-uses-10", "challenge", "포탈의맛", 10,
    { ko: "포탈의 맛", en: "A Taste of Portals", ja: "ポータルの味" },
    { ko: "미니게임에서 포탈을 10회 사용하세요.", en: "Use portals 10 times in mini-games.", ja: "ミニゲームでポータルを10回使いましょう。" },
    { assetFile: "메달_포탈의맛.png", minigameId: "all" }),
  medal("portal-uses-30", "challenge", "홍길동", 30,
    { ko: "홍길동", en: "Royal Wanderer", ja: "神出鬼没" },
    { ko: "미니게임에서 포탈을 30회 사용하세요.", en: "Use portals 30 times in mini-games.", ja: "ミニゲームでポータルを30回使いましょう。" },
    { assetFile: "메달_홍길동.png", minigameId: "all" }),
  medal("portal-uses-50", "challenge", "순간이동능력자", 50,
    { ko: "순간이동 능력자", en: "Teleport Master", ja: "瞬間移動の達人" },
    { ko: "미니게임에서 포탈을 50회 사용하세요.", en: "Use portals 50 times in mini-games.", ja: "ミニゲームでポータルを50回使いましょう。" },
    { assetFile: "메달_순간이동능력자.png", minigameId: "all" }),
  medal("item-uses-50", "challenge", "아이템전", 50,
    { ko: "아이템전", en: "Item Battle", ja: "アイテム戦" },
    { ko: "미니게임에서 아이템 상자 효과를 50회 사용하세요.", en: "Trigger 50 item-box effects in mini-games.", ja: "ミニゲームでアイテムボックス効果を50回発動しましょう。" },
    { assetFile: "메달_아이템전.png", minigameId: "all" }),
  medal("siege-points-1500", "challenge", "힘을모아", 1500,
    { ko: "힘을 모아", en: "Gather Your Strength", ja: "力を合わせて" },
    { ko: "한 공성전에서 왕관 포인트 1,500을 달성하세요.", en: "Reach 1,500 crown points in a single siege match.", ja: "1回の攻城戦で王冠ポイント1,500に到達しましょう。" },
    { assetFile: "메달_힘을모아.png", minigameId: "siege" }),
  medal("bgm-track", "challenge", "배경음악뭐지", 1,
    { ko: "배경음악 뭐지?", en: "What Is This Music?", ja: "このBGMは何？" },
    { ko: "메인 화면에서 배경음악 한 곡을 끝까지 들으세요.", en: "Listen to one full background track on the main screen.", ja: "メイン画面でBGMを1曲最後まで聴きましょう。" },
    { assetFile: "메달_배경음악뭐지.png" }),
  medal("bgm-idle-30", "challenge", "음악감상", 1,
    { ko: "음악 감상", en: "Music Appreciation", ja: "音楽鑑賞" },
    { ko: "조작 없이 배경음악을 30분 연속 감상하세요.", en: "Listen to background music for 30 uninterrupted minutes without input.", ja: "操作せずにBGMを30分間連続で聴きましょう。" },
    { assetFile: "메달_음악감상.png" }),
  medal("thorough-visitor", "challenge", "꼼꼼한사람", 1,
    { ko: "꼼꼼한 사람", en: "Thorough Visitor", ja: "隅々まで見る人" },
    { ko: "메인 화면의 하단 설명과 연락처까지 모두 스크롤하세요.", en: "Scroll through the full main page, including the guide and contact section.", ja: "説明とお問い合わせを含むメイン画面の最後までスクロールしましょう。" },
    { assetFile: "메달_꼼꼼한사람.png" }),
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
  ...SPECIAL_KINGDOM_MEDALS,
  ...CHALLENGE_MEDALS,
  ...MINI_GAME_MEDALS,
  ...PUZZLE_MEDALS,
  ...RANK_MEDALS,
]);

const MEDAL_BY_ID = new Map(MEDALS.map((item) => [item.id, item]));
const SKIN_MEDAL_BY_KEY = new Map(KINGDOM_MEDALS.map((item) => [`${item.skinId}:${item.color}`, item]));
const BASE_MEDALS = MEDALS.filter((item) => item.category !== "rank"
  && !item.collector
  && !item.unavailable
  && item.countsTowardCollection !== false);
const MINI_GAME_COMPLETION_MEDALS = MINI_GAME_MEDALS.filter((item) => (
  item.id !== "minigame-enthusiast"
  && !["king-power", "bgm-track", "bgm-idle-30", "thorough-visitor"].includes(item.id)
));

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
    processedMiniGameIds: [],
    processedEventIds: [],
    miniGamesPlayed: {},
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
  state.processedMiniGameIds = boundedIds(input.processedMiniGameIds);
  state.processedEventIds = boundedIds(input.processedEventIds);
  const rawMiniGamesPlayed = input.miniGamesPlayed && typeof input.miniGamesPlayed === "object"
    ? input.miniGamesPlayed
    : {};
  for (const id of MINI_GAME_IDS) {
    if (rawMiniGamesPlayed[id]) state.miniGamesPlayed[id] = true;
  }
  const context = input.context && typeof input.context === "object" ? input.context : input;
  state.context = {
    coins: count(context.coins),
    ownedSkinCount: count(context.ownedSkinCount),
    totalSkinCount: Math.max(18, count(context.totalSkinCount) || 18),
  };
  return state;
}

function saveState(state) {
  const normalized = normalizeState(state);
  writeJsonToStorage([STORAGE_KEY, BACKUP_STORAGE_KEY], normalized);
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
  state.progress["minigame-explorer"] = MINI_GAME_IDS.reduce(
    (total, id) => total + Number(Boolean(state.miniGamesPlayed[id])),
    0,
  );

  for (const item of MEDALS) {
    if (item.category === "rank" || item.collector || item.unavailable) continue;
    if (count(state.progress[item.id]) >= item.target) unlock(state, item.id, newlyUnlocked, now);
  }

  const hasEveryMiniGameMedal = MINI_GAME_COMPLETION_MEDALS.every((item) => state.unlockedAt[item.id]);
  state.progress["minigame-enthusiast"] = hasEveryMiniGameMedal ? 1 : 0;
  if (hasEveryMiniGameMedal) unlock(state, "minigame-enthusiast", newlyUnlocked, now);

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
  const saved = readJsonFromStorage([STORAGE_KEY, BACKUP_STORAGE_KEY], null);
  const state = normalizeState(saved.value);
  evaluate(state);
  const serialized = JSON.stringify(state);
  if (saved.recovered || serialized !== saved.raw) {
    writeJsonToStorage([STORAGE_KEY, BACKUP_STORAGE_KEY], state);
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
  let kingCaptures = 0;

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
        if (movingPiece === "k") kingCaptures += 1;
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
    kingCaptures,
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
  if (["goldBear", "gold-bear", "gold_bear"].includes(skinId)) {
    addProgress(state, "gold-bear");
  }
  if (["brownBear", "brown-bear", "brown_bear"].includes(skinId)) {
    addProgress(state, "brown-bear");
  }
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
    const difficulty = ["easy", "normal", "hard", "challenge"].includes(record.difficulty)
      ? record.difficulty
      : "normal";

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
    if (metrics.kingCaptures >= 5) addProgress(state, "king-power");

    if (humanWon) {
      if (difficulty === "challenge") addProgress(state, "challenge-ai-victory");
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

export function recordDailyMissionDay({ currentStreak, totalCompletedDays } = {}) {
  return update((state) => {
    const streak = count(currentStreak);
    const totalDays = count(totalCompletedDays);
    state.progress["diligent-knight"] = Math.max(
      count(state.progress["diligent-knight"]),
      streak,
    );
    state.progress["kingdom-routine"] = Math.max(
      count(state.progress["kingdom-routine"]),
      totalDays,
    );
    state.progress["hundred-day-training"] = Math.max(
      count(state.progress["hundred-day-training"]),
      totalDays,
    );
  });
}

function isTrackedMiniGameWin(mode, winnerColor, playerColor) {
  if (!winnerColor) return false;
  return mode === "pvp" || winnerColor === playerColor;
}

export function recordMiniGameCompletion(record = {}) {
  const sessionId = normalizeId(record.sessionId ?? record.gameSessionId);
  const gameId = normalizeId(record.gameId);
  if (!sessionId || !MINI_GAME_IDS.includes(gameId)) {
    return { newlyUnlocked: [], state: readMedalState() };
  }

  return update((state) => {
    if (!rememberId(state.processedMiniGameIds, `${gameId}:${sessionId}`)) return;
    state.miniGamesPlayed[gameId] = true;

    const mode = ["pvp", "local", "face-to-face", "face_to_face"].includes(String(record.mode || "").toLowerCase())
      ? "pvp"
      : "ai";
    const playerColor = colorId(record.playerColor, "w");
    const winnerColor = colorId(record.winnerColor);
    const won = isTrackedMiniGameWin(mode, winnerColor, playerColor);
    const lost = mode === "ai" && Boolean(winnerColor) && winnerColor !== playerColor;
    const stats = record.stats && typeof record.stats === "object" ? record.stats : {};
    const portalUses = count(stats.portalUses);
    const itemUses = count(stats.itemUses);

    for (const id of ["portal-uses-10", "portal-uses-30", "portal-uses-50"]) {
      addProgress(state, id, portalUses);
    }
    addProgress(state, "item-uses-50", itemUses);

    if (gameId === "tug") {
      if (won) {
        addProgress(state, "tug-winner");
        addProgress(state, "tug-champion");
        if (stats.noPiecesLost === true) addProgress(state, "tug-technician");
      }
      if (lost) addProgress(state, "tug-underdog");
    } else if (gameId === "crown") {
      if (won) addProgress(state, "crown-champion");
      addProgress(state, "crown-thief", count(stats.crownStolen));
      addProgress(state, "crown-first", count(stats.crownFirst));
      addProgress(state, "crown-lost", count(stats.crownLost));
    } else if (gameId === "road") {
      if (won) {
        addProgress(state, "road-wins-30");
        addProgress(state, "road-wins-40");
        addProgress(state, "road-wins-50");
      }
      if (lost) addProgress(state, "road-lost");
    } else if (gameId === "road-puzzle") {
      if (stats.firstClear === true) addProgress(state, "road-puzzle-wins");
      if (stats.allStars === true) state.progress["road-navigation"] = 1;
    } else if (gameId === "siege") {
      addProgress(state, "siege-defender", count(stats.defenseSaves));
      if (won && stats.castleDestroyed === true) addProgress(state, "siege-breaker");
      const summonedTypes = new Set(Array.isArray(stats.summonedTypes) ? stats.summonedTypes.map(normalizeId).filter(Boolean) : []);
      if (won && summonedTypes.size === 1) addProgress(state, "siege-one-class");
      if (won && summonedTypes.size >= 6) addProgress(state, "siege-all-classes");
      state.progress["siege-points-1500"] = Math.max(
        count(state.progress["siege-points-1500"]),
        count(stats.maxCrownPoints),
      );
    }
  });
}

export function recordAmbientMedalEvent({ eventId, type } = {}) {
  const id = normalizeId(eventId);
  const metric = normalizeId(type);
  if (!id || !["bgm-track", "bgm-idle-30", "thorough-visitor"].includes(metric)) {
    return { newlyUnlocked: [], state: readMedalState() };
  }
  return update((state) => {
    if (!rememberId(state.processedEventIds, id)) return;
    state.progress[metric] = Math.max(1, count(state.progress[metric]));
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
