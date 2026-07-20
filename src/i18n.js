import { readPlayerState } from "./playerState.js?v=20260720-puzzles100hint37";

const TEXT = {
  ko: {
    "start.puzzle": "PUZZLE", "start.puzzleSub": "짧은 전술 문제",
    "start.ai": "AI START", "start.aiSub": "혼자 플레이(랜덤AI)",
    "start.pvp": "START", "start.pvpSub": "마주보고 2인 플레이",
    "reward.daily": "접속 보상 +{amount}", "reward.ai": "AI 승리 보상  +{amount} COIN",
    "settings.title": "설정", "settings.language": "언어", "settings.sound": "효과음", "settings.bgmVolume": "배경음악",
    "settings.vibration": "진동", "settings.contact": "문의/제작 carksk@naver.com", "common.cancel": "취소", "common.apply": "적용",
    "common.buy": "구입", "common.change": "변경", "common.back": "뒤로", "common.confirm": "확인",
    "install.title": "홈 화면에 추가", "install.ios": "브라우저의 공유 버튼을 누른 뒤\n'홈 화면에 추가'를 선택하세요.",
    "install.browser": "브라우저 메뉴에서\n'앱 설치' 또는 '홈 화면에 추가'를 선택하세요.",
    "install.reward": "설치 완료\n+{amount} 코인", "install.rewardReceived": "홈 화면 추가 보상 +{amount} 코인!",
    "footer.contact": "제작/제보 carksk@naver.com 카카오ID : carksk2",
    "puzzle.title": "퍼즐", "puzzle.listSub": "순서대로 클리어해서 다음 문제를 여세요 ({count}/{total})",
    "puzzle.locked": "이전 퍼즐을 먼저 클리어하세요.", "puzzle.reward": "보상",
    "puzzle.menu": "퍼즐 메뉴", "puzzle.next": "다음 퍼즐", "puzzle.hintNotice": "힌트를 확인하세요. (-{cost} 코인)",
    "puzzle.hintAgain": "이미 구매한 힌트입니다.", "puzzle.hintNotEnough": "힌트에 필요한 코인이 부족합니다. ({coins}/{cost})",
    "puzzle.progress": "퍼즐 {current}/{total}  ·  단계 {step}/{steps}", "puzzle.clear": "퍼즐 클리어!",
    "puzzle.tryAnother": "다른 수를 찾아보세요.", "puzzle.illegal": "지금은 둘 수 없는 수입니다.",
    "puzzle.wrong": "아깝습니다. 다시 시도해보세요.", "puzzle.correct": "정답!",
    "select.title": "체스말 선택", "select.subtitle": "WHITE / BLACK 각각 체스말을 고르세요.",
    "select.aiTitle": "AI 대전 설정", "select.aiSubtitle": "WHITE / BLACK 내 색상과 체스말을 고르세요.",
    "select.start": "START GAME", "select.startAI": "START AI GAME", "select.purchase": "체스말 구입",
    "select.purchaseMessage": "{cost} 코인으로 '{color} {skin}'\n체스말을 구입하시겠습니까?",
    "select.notEnough": "코인이 부족합니다 ({coins}/{cost})", "select.purchased": "{color} {skin} 구입 완료",
    "select.loadFailed": "기물을 불러오지 못했습니다. 다시 시도해 주세요.",
    "color.w": "백", "color.b": "흑", "side.w": "백 진영", "side.b": "흑 진영",
    "game.homeTitle": "메인으로 이동", "game.homeMessage": "정말 메인으로 돌아갈까요?\n진행 중인 게임은 종료됩니다.",
    "game.move": "이동", "game.conceptOff": "컨셉 끄기", "game.undoUnavailable": "무를 수 없습니다.",
    "game.captured": "처치한 기물 :", "game.turn": "{side} 차례 입니다.{check}", "game.check": " - 체크!",
    "promotion.title": "승급할 체스말 선택", "promotion.subtitle": "폰을 승급할 체스말을 선택하세요.",
    "result.aiWin": "AI 대전 승리", "result.aiEnd": "AI 대전 종료", "result.retry": "다시 하기",
    "result.main": "메인 화면", "result.checkmate": "체크메이트", "result.resign": "기권",
    "result.draw": "무승부", "result.end": "게임 종료",
  },
  en: {
    "start.puzzle": "PUZZLE", "start.puzzleSub": "Quick tactical challenges",
    "start.ai": "AI START", "start.aiSub": "Solo play (random AI)",
    "start.pvp": "START", "start.pvpSub": "Face-to-face two-player game",
    "reward.daily": "Daily reward +{amount}", "reward.ai": "AI win reward  +{amount} COIN",
    "settings.title": "Settings", "settings.language": "Language", "settings.sound": "SFX", "settings.bgmVolume": "BGM Volume",
    "settings.vibration": "Vibration", "settings.contact": "Contact carksk@naver.com", "common.cancel": "Cancel", "common.apply": "Apply",
    "common.buy": "Buy", "common.change": "Change", "common.back": "Back", "common.confirm": "Confirm",
    "install.title": "Add to Home Screen", "install.ios": "Tap the browser's Share button, then choose\n'Add to Home Screen.'",
    "install.browser": "Open the browser menu and choose\n'Install app' or 'Add to Home Screen.'",
    "install.reward": "Install reward\n+{amount} coins", "install.rewardReceived": "Home screen reward +{amount} coins!",
    "footer.contact": "Contact carksk@naver.com  Kakao ID: carksk2",
    "puzzle.title": "Puzzle", "puzzle.listSub": "Clear each puzzle in order to unlock the next ({count}/{total})",
    "puzzle.locked": "Clear the previous puzzle first.", "puzzle.reward": "Reward",
    "puzzle.menu": "Puzzle Menu", "puzzle.next": "Next Puzzle", "puzzle.hintNotice": "Hint unlocked. (-{cost} coins)",
    "puzzle.hintAgain": "This hint is already unlocked.", "puzzle.hintNotEnough": "Not enough coins for a hint. ({coins}/{cost})",
    "puzzle.progress": "Puzzle {current}/{total}  ·  Step {step}/{steps}", "puzzle.clear": "PUZZLE CLEAR!",
    "puzzle.tryAnother": "Find another move.", "puzzle.illegal": "That move is not available now.",
    "puzzle.wrong": "Almost. Try again.", "puzzle.correct": "Correct!",
    "select.title": "Choose Pieces", "select.subtitle": "Choose separate WHITE and BLACK piece sets.",
    "select.aiTitle": "AI Match Setup", "select.aiSubtitle": "Choose your color and piece set.",
    "select.start": "START GAME", "select.startAI": "START AI GAME", "select.purchase": "Buy Piece Set",
    "select.purchaseMessage": "Buy the '{color} {skin}' piece set\nfor {cost} coins?",
    "select.notEnough": "Not enough coins ({coins}/{cost})", "select.purchased": "{color} {skin} purchased",
    "select.loadFailed": "Could not load the pieces. Please try again.",
    "color.w": "White", "color.b": "Black", "side.w": "White", "side.b": "Black",
    "game.homeTitle": "Return to Main", "game.homeMessage": "Return to the main screen?\nThe current game will end.",
    "game.move": "Move", "game.conceptOff": "Concept Off", "game.undoUnavailable": "No move to undo.",
    "game.captured": "Captured:", "game.turn": "{side} to move.{check}", "game.check": " Check!",
    "promotion.title": "Choose Promotion", "promotion.subtitle": "Choose the piece for this pawn.",
    "result.aiWin": "AI match won", "result.aiEnd": "AI match ended", "result.retry": "Play Again",
    "result.main": "Main Menu", "result.checkmate": "Checkmate", "result.resign": "Resigned",
    "result.draw": "Draw", "result.end": "Game Over",
  },
  ja: {
    "start.puzzle": "パズル", "start.puzzleSub": "短い戦術問題",
    "start.ai": "AI 対戦", "start.aiSub": "ひとりでプレイ（ランダムAI）",
    "start.pvp": "START", "start.pvpSub": "向かい合って2人プレイ",
    "reward.daily": "ログイン報酬 +{amount}", "reward.ai": "AI勝利報酬  +{amount} COIN",
    "settings.title": "設定", "settings.language": "言語", "settings.sound": "効果音", "settings.bgmVolume": "BGM音量",
    "settings.vibration": "振動", "settings.contact": "お問い合わせ carksk@naver.com", "common.cancel": "取消", "common.apply": "適用",
    "common.buy": "購入", "common.change": "変更", "common.back": "戻る", "common.confirm": "確認",
    "install.title": "ホーム画面に追加", "install.ios": "ブラウザの共有ボタンを押し、\n「ホーム画面に追加」を選択してください。",
    "install.browser": "ブラウザのメニューから\n「アプリをインストール」を選択してください。",
    "install.reward": "インストール完了\n+{amount}コイン", "install.rewardReceived": "ホーム画面追加ボーナス +{amount}コイン!",
    "footer.contact": "お問い合わせ carksk@naver.com  Kakao ID: carksk2",
    "puzzle.title": "パズル", "puzzle.listSub": "順番にクリアして次の問題を開放 ({count}/{total})",
    "puzzle.locked": "前のパズルを先にクリアしてください。", "puzzle.reward": "報酬",
    "puzzle.menu": "パズルメニュー", "puzzle.next": "次のパズル", "puzzle.hintNotice": "ヒントを開放しました。(-{cost}コイン)",
    "puzzle.hintAgain": "このヒントは開放済みです。", "puzzle.hintNotEnough": "ヒントに必要なコインが足りません。({coins}/{cost})",
    "puzzle.progress": "パズル {current}/{total}  ·  手順 {step}/{steps}", "puzzle.clear": "パズルクリア！",
    "puzzle.tryAnother": "別の手を探してください。", "puzzle.illegal": "今はその手を指せません。",
    "puzzle.wrong": "惜しいです。もう一度。", "puzzle.correct": "正解！",
    "select.title": "駒を選択", "select.subtitle": "白と黒、それぞれの駒を選んでください。",
    "select.aiTitle": "AI対戦設定", "select.aiSubtitle": "自分の色と駒を選んでください。",
    "select.start": "ゲーム開始", "select.startAI": "AI対戦開始", "select.purchase": "駒を購入",
    "select.purchaseMessage": "{cost}コインで「{color} {skin}」の\n駒を購入しますか？",
    "select.notEnough": "コインが足りません ({coins}/{cost})", "select.purchased": "{color} {skin}を購入しました",
    "select.loadFailed": "駒を読み込めませんでした。もう一度お試しください。",
    "color.w": "白", "color.b": "黒", "side.w": "白陣営", "side.b": "黒陣営",
    "game.homeTitle": "メインへ戻る", "game.homeMessage": "メイン画面へ戻りますか？\n進行中のゲームは終了します。",
    "game.move": "移動", "game.conceptOff": "コンセプトOFF", "game.undoUnavailable": "戻せる手がありません。",
    "game.captured": "取った駒：", "game.turn": "{side}の番です。{check}", "game.check": " チェック！",
    "promotion.title": "昇格する駒を選択", "promotion.subtitle": "ポーンを昇格させる駒を選んでください。",
    "result.aiWin": "AI対戦 勝利", "result.aiEnd": "AI対戦 終了", "result.retry": "もう一度",
    "result.main": "メイン画面", "result.checkmate": "チェックメイト", "result.resign": "投了",
    "result.draw": "引き分け", "result.end": "ゲーム終了",
  },
};

const PUZZLES = {
  mate_scholar: { en: ["First Checkmate", "WHITE: Target the weak f7 square and finish in one move.", "Move the queen to f7; the king has no escape."], ja: ["最初のチェックメイト", "WHITE：弱いf7を狙い、一手で決めましょう。", "クイーンをf7へ動かすと、キングの逃げ場がありません。"] },
  fools_mate: { en: ["Fastest Mate", "BLACK: Use the open diagonal to checkmate immediately.", "The black queen on h4 cannot be stopped."], ja: ["最速メイト", "BLACK：開いた対角線ですぐにメイトしましょう。", "黒クイーンをh4へ動かします。"] },
  back_rank_mate: { en: ["Back-Rank Mate", "WHITE: Trap the king on the back rank with your rook.", "The pawns block every escape square."], ja: ["バックランクメイト", "WHITE：ルークで最終列のキングを閉じ込めましょう。", "相手のポーンが逃げ道をふさいでいます。"] },
  rook_takes_queen: { en: ["Free Queen", "WHITE: Use the open file to capture the most valuable piece.", "The e-file is open for the rook."], ja: ["クイーンを取る", "WHITE：開いた縦列から最も価値の高い駒を取りましょう。", "eファイルはルークに開いています。"] },
  answer_check: { en: ["Answer the Check", "WHITE: Stop the check and capture the enemy queen.", "The queen or rook can capture on e2."], ja: ["チェックへの対応", "WHITE：チェックを防ぎながら相手のクイーンを取りましょう。", "クイーンかルークでe2を取れます。"] },
  knight_fork: { en: ["Knight Fork", "WHITE: Check with the knight while attacking the queen.", "Knights jump instead of moving in straight lines."], ja: ["ナイトフォーク", "WHITE：ナイトでチェックしながらクイーンを狙いましょう。", "ナイトは駒を飛び越えて動けます。"] },
  castle_safe: { en: ["Castle to Safety", "WHITE: Protect the king by castling.", "Move the king two squares right for kingside castling."], ja: ["安全にキャスリング", "WHITE：キャスリングでキングを守りましょう。", "キングを右へ2マス動かします。"] },
  promotion_queen: { en: ["Promotion", "WHITE: Advance the pawn and promote it to a queen.", "Move the a-pawn to a8 and choose Queen."], ja: ["昇格", "WHITE：ポーンを進めてクイーンに昇格させましょう。", "aポーンをa8へ進め、クイーンを選びます。"] },
  rook_file_mate: { en: ["Open-File Mate", "WHITE: Raise the rook to the last rank and trap the king.", "The a-file is completely open."], ja: ["オープンファイルメイト", "WHITE：ルークを最終列へ進めてキングを閉じ込めましょう。", "aファイルが完全に開いています。"] },
  black_back_rank: { en: ["Queen Back-Rank Mate", "BLACK: Invade the first rank with the queen and mate the boxed-in white king.", "Qd1# controls both side escapes while the three pawns block the king's front squares."], ja: ["クイーンのバックランクメイト", "BLACK：クイーンで1段目に侵入し、閉じ込められた白キングをメイトしてください。", "Qd1#なら3つのポーンが前方をふさぎ、クイーンが左右の逃げ道を支配します。"] },
  bishop_takes_queen: { en: ["Bishop Diagonal", "WHITE: Capture the most valuable piece on the diagonal.", "The bishop on c4 attacks d5."], ja: ["ビショップの対角線", "WHITE：対角線上の最も価値の高い駒を取りましょう。", "c4のビショップはd5を攻撃します。"] },
  black_promotion: { en: ["Black Knight Underpromotion Fork", "BLACK: Promote to a knight and attack the king and queen at once.", "c1=N+ checks the king on e2 while also attacking the queen on b3."], ja: ["黒のナイト・アンダープロモーション", "BLACK：ナイトに昇格し、キングとクイーンを同時に攻撃してください。", "c1=N+はe2のキングにチェックしながらb3のクイーンも攻撃します。"] },
  queen_takes_rook: { en: ["Queen Takes Rook", "WHITE: Answer the check while capturing the rook.", "The queen can move to e2."], ja: ["クイーンでルークを取る", "WHITE：チェックを防ぎながらルークを取りましょう。", "クイーンをe2へ動かせます。"] },
  knight_takes_rook: { en: ["Knight Counterattack", "WHITE: Capture the attacking piece with the knight.", "The knight can jump from d4 to e2."], ja: ["ナイトの反撃", "WHITE：ナイトで攻撃している駒を取りましょう。", "ナイトはd4からe2へ跳べます。"] },
  rook_defense: { en: ["Rook Defense", "WHITE: Stop the check and remove the enemy rook.", "Capture e2 with the rook on the same file."], ja: ["ルークで防御", "WHITE：チェックを防ぎながら相手のルークを取りましょう。", "同じファイルのルークでe2を取ります。"] },
  black_queen_capture: { en: ["Black Queen Counter", "BLACK: Answer the check while capturing the white queen.", "The black queen can move to e2."], ja: ["黒クイーンの反撃", "BLACK：チェックを防ぎながら白クイーンを取りましょう。", "黒クイーンをe2へ動かせます。"] },
  en_passant: { en: ["En Passant", "WHITE: Capture the black pawn that just advanced two squares.", "Move the pawn on e5 diagonally to d6."], ja: ["アンパッサン", "WHITE：直前に2マス進んだ黒ポーンを特別な方法で取りましょう。", "e5のポーンをd6へ斜めに動かします。"] },
  smothered_mate: { en: ["Smothered Mate", "WHITE: Checkmate the king trapped by its own pieces with a knight.", "Move the knight from e5 to f7."], ja: ["スマザードメイト", "WHITE：自分の駒に囲まれたキングをナイトでメイトしましょう。", "e5のナイトをf7へ動かします。"] },
  pin_knight: { en: ["Pin the Knight", "WHITE: Use the bishop to pin the knight in front of its king.", "Move the bishop to b5; the king is behind the knight."], ja: ["ナイトをピン", "WHITE：ビショップでナイトをキングの前に固定しましょう。", "ビショップをb5へ動かすと、ナイトの後ろにキングがいます。"] },
  bishop_skewer: { en: ["Bishop Skewer", "WHITE: Attack the king first and target the rook behind it.", "Move the bishop to b4 to line up the king and rook."], ja: ["ビショップのスキュアー", "WHITE：先にキングを攻撃し、その後ろのルークを狙いましょう。", "ビショップをb4へ動かします。"] },
  queen_double_attack: { en: ["Queen Double Attack", "WHITE: Give check while attacking the rook at the same time.", "Move the queen to h5 to target the king and h8 rook."], ja: ["クイーンの両取り", "WHITE：チェックと同時にルークも攻撃しましょう。", "クイーンをh5へ動かします。"] },
  discovered_check: { en: ["Discovered Check", "WHITE: Move the bishop and open the rook's attack on the king.", "Move the bishop from e4 to b7 to clear the e-file."], ja: ["ディスカバードチェック", "WHITE：ビショップを動かし、後ろのルークの攻撃路を開きましょう。", "e4のビショップをb7へ動かします。"] },
  knight_underpromotion: { en: ["Knight Underpromotion", "WHITE: Promote the pawn to a knight to give immediate check.", "Choose Knight, not Queen, on e8."], ja: ["ナイトへのアンダープロモーション", "WHITE：ポーンをナイトに昇格させてチェックしましょう。", "e8ではクイーンではなくナイトを選びます。"] },
  black_castle_long: { en: ["Queenside Castling Check", "BLACK: Castle queenside to move the king and open a rook check at the same time.", "O-O-O+ places the king on c8 and the rook on d8, checking the white king on d1."], ja: ["チェックになるロングキャスリング", "BLACK：ロングキャスリングでキングを動かし、同時にルークのチェックを開いてください。", "O-O-O+でキングはc8、ルークはd8へ移動し、d1の白キングをチェックします。"] },
};

const SKIN_JA = { classic: "基本", bear: "クマ", rabbit: "ウサギ", cat: "ネコ", wolf: "オオカミ", sheep: "ヒツジ", eagle: "ワシ", owl: "フクロウ", capybara: "カピバラ" };
const TAGS = {
  en: { beginner: "beginner", capture: "capture", check: "check", fork: "fork", knight: "knight", rule: "rule", castle: "castle", promotion: "promotion", rook: "rook", bishop: "bishop", queen: "queen", "en-passant": "en passant", pin: "pin", skewer: "skewer", "double-attack": "double attack", "discovered-check": "discovered check", underpromotion: "underpromotion", "two-step": "two-step", sacrifice: "sacrifice", deflection: "deflection", removal: "remove defender", clearance: "clearance", attack: "attack", "mate-in-2": "mate in 2", "back-rank": "back rank", invasion: "invasion" },
  ja: { beginner: "初級", capture: "駒取り", check: "チェック", fork: "フォーク", knight: "ナイト", rule: "ルール", castle: "キャスリング", promotion: "昇格", rook: "ルーク", bishop: "ビショップ", queen: "クイーン", "en-passant": "アンパッサン", pin: "ピン", skewer: "スキュアー", "double-attack": "両取り", "discovered-check": "ディスカバードチェック", underpromotion: "アンダープロモーション", "two-step": "2手", sacrifice: "サクリファイス", deflection: "そらし", removal: "守備駒の排除", clearance: "クリアランス", attack: "攻撃", "mate-in-2": "2手メイト", "back-rank": "バックランク", invasion: "侵入" },
};

const TAG_GLOSSARY = {
  castle: "castling",
  promotion: "promotion",
  rook: "rook",
  bishop: "bishop",
  queen: "queen",
  knight: "knight",
  fork: "knightFork",
  "en-passant": "enPassant",
  pin: "pin",
  skewer: "skewer",
  "double-attack": "doubleAttack",
  "discovered-check": "discoveredCheck",
  underpromotion: "underpromotion",
  "back-rank": "backRankMate",
};

const PUZZLE_GLOSSARY = {
  mate_scholar: "checkmate",
  fools_mate: "checkmate",
  back_rank_mate: "backRankMate",
  rook_takes_queen: "rook",
  answer_check: "check",
  knight_fork: "knightFork",
  castle_safe: "castling",
  promotion_queen: "promotion",
  rook_file_mate: "openFile",
  black_back_rank: "backRankMate",
  bishop_takes_queen: "bishop",
  black_promotion: "promotion",
  queen_takes_rook: "queen",
  knight_takes_rook: "knight",
  rook_defense: "rook",
  black_queen_capture: "queen",
  en_passant: "enPassant",
  smothered_mate: "smotheredMate",
  pin_knight: "pin",
  bishop_skewer: "skewer",
  queen_double_attack: "doubleAttack",
  discovered_check: "discoveredCheck",
  knight_underpromotion: "underpromotion",
  black_castle_long: "castling",
};

const GLOSSARY = {
  ko: {
    checkmate: ["체크메이트", "킹이 공격받는 체크 상태에서 피하거나, 막거나, 공격 기물을 잡는 모든 방법이 사라진 상태입니다. 체크메이트가 되면 즉시 게임이 끝납니다."],
    backRankMate: ["백랭크 메이트", "킹이 자기 폰에 가로막혀 마지막 줄에서 빠져나오지 못할 때 룩이나 퀸으로 만드는 체크메이트입니다. 킹 앞의 탈출 칸이 막혀 있는지 살펴보세요."],
    rook: ["룩", "룩은 가로와 세로로 원하는 만큼 움직입니다. 길이 열려 있을수록 강하며, 킹과 함께 캐슬링에 참여하는 기물입니다."],
    check: ["체크", "상대 기물이 현재 킹을 공격하고 있는 상태입니다. 다음 수에는 반드시 킹을 피하거나, 공격을 막거나, 공격 기물을 잡아 체크를 해제해야 합니다."],
    knightFork: ["나이트 포크", "나이트 한 기물이 동시에 둘 이상의 중요한 기물을 공격하는 전술입니다. 체크와 함께 퀸이나 룩을 공격하면 특히 강력합니다."],
    castling: ["캐슬링", "킹과 룩을 한 번에 움직여 킹을 안전하게 만드는 특별한 수입니다. 두 기물이 아직 움직이지 않았고, 사이가 비어 있으며, 킹이 체크 칸을 지나지 않을 때 가능합니다."],
    promotion: ["승급", "폰이 상대편의 마지막 줄에 도착하면 퀸, 룩, 비숍, 나이트 중 하나로 바뀝니다. 보통 가장 강한 퀸을 선택하지만 상황에 따라 다른 기물이 유리할 수 있습니다."],
    openFile: ["열린 파일", "폰이 하나도 없는 세로줄을 열린 파일이라고 합니다. 룩과 퀸이 방해 없이 멀리 움직일 수 있어 공격 통로로 활용됩니다."],
    bishop: ["비숍", "비숍은 대각선으로 원하는 만큼 움직입니다. 시작한 칸과 같은 색의 칸만 다니므로 열린 대각선을 찾는 것이 중요합니다."],
    queen: ["퀸", "퀸은 가로, 세로, 대각선으로 원하는 만큼 움직이는 가장 강한 기물입니다. 강한 만큼 상대의 공격에 노출되지 않도록 주의해야 합니다."],
    knight: ["나이트", "나이트는 두 칸 직선으로 간 뒤 옆으로 한 칸 움직이는 L자 형태로 이동합니다. 다른 기물을 뛰어넘을 수 있는 유일한 기물입니다."],
    enPassant: ["앙파상", "상대 폰이 시작 위치에서 두 칸 전진해 내 폰 옆에 도착했을 때, 그 폰이 한 칸만 움직인 것처럼 대각선으로 잡는 특별 규칙입니다. 바로 다음 수에만 가능합니다."],
    smotheredMate: ["스머더드 메이트", "킹의 주변 칸이 자기 기물로 막혀 도망갈 수 없을 때 나이트로 만드는 체크메이트입니다. 나이트는 다른 기물을 뛰어넘어 공격할 수 있습니다."],
    pin: ["핀", "앞의 기물이 움직이면 뒤의 더 중요한 기물이 공격받게 되어 움직이기 어려운 상태입니다. 뒤에 킹이 있으면 앞의 기물은 공격선을 열 수 없습니다."],
    skewer: ["스큐어", "더 가치가 높은 기물을 먼저 공격해 피하게 한 뒤, 같은 공격선 뒤에 있던 기물을 잡는 전술입니다. 핀과 반대 순서로 중요한 기물이 앞에 있습니다."],
    doubleAttack: ["더블 어택", "한 번의 수로 둘 이상의 기물을 동시에 공격하는 전술입니다. 상대는 보통 한쪽만 지킬 수 있어 다른 쪽에서 이득을 얻을 수 있습니다."],
    discoveredCheck: ["디스커버드 체크", "앞을 막고 있던 내 기물을 움직여 뒤쪽 룩, 비숍, 퀸의 공격선을 열면서 체크하는 전술입니다. 움직인 기물도 동시에 다른 곳을 공격할 수 있습니다."],
    underpromotion: ["언더프로모션", "폰을 가장 강한 퀸이 아닌 룩, 비숍, 나이트로 승급하는 선택입니다. 특정 체크나 체크메이트, 스테일메이트 방지를 위해 더 좋은 수가 될 수 있습니다."],
  },
  en: {
    checkmate: ["Checkmate", "The king is in check and has no legal way to escape, block the attack, or capture the attacker. Checkmate ends the game immediately."],
    backRankMate: ["Back-Rank Mate", "A rook or queen checkmates a king trapped on its last rank by its own pawns. Look for blocked escape squares in front of the king."],
    rook: ["Rook", "A rook moves any number of squares horizontally or vertically. It becomes strongest on open lines and also joins the king during castling."],
    check: ["Check", "The king is currently under attack. The next move must move the king, block the attack, or capture the attacking piece."],
    knightFork: ["Knight Fork", "A knight attacks two or more valuable pieces at the same time. A fork that checks the king while attacking the queen or rook is especially powerful."],
    castling: ["Castling", "A special move that moves the king and rook together to protect the king. Neither piece may have moved, the path must be clear, and the king cannot pass through check."],
    promotion: ["Promotion", "A pawn reaching the farthest rank becomes a queen, rook, bishop, or knight. A queen is usual, but another piece can sometimes be better."],
    openFile: ["Open File", "A vertical file with no pawns is called an open file. Rooks and queens use it as a clear route into the opponent's position."],
    bishop: ["Bishop", "A bishop moves any number of squares diagonally. It always stays on the same color of square, so open diagonals are important."],
    queen: ["Queen", "The queen moves any number of squares horizontally, vertically, or diagonally. It is the strongest piece, so keep it safe from attacks."],
    knight: ["Knight", "A knight moves in an L shape: two squares in one direction and one to the side. It is the only piece that can jump over other pieces."],
    enPassant: ["En Passant", "When an enemy pawn advances two squares from its starting square and lands beside your pawn, you may capture it diagonally as if it moved only one square. This is available only immediately."],
    smotheredMate: ["Smothered Mate", "A knight checkmates a king whose escape squares are blocked by its own pieces. The knight can attack over the surrounding pieces."],
    pin: ["Pin", "A piece is pinned when moving it would expose a more valuable piece behind it. If the king is behind it, the pinned piece cannot open that line of attack."],
    skewer: ["Skewer", "A valuable piece is attacked and forced to move, exposing another piece behind it on the same line. It resembles a pin with the more valuable piece in front."],
    doubleAttack: ["Double Attack", "One move attacks two or more targets at the same time. The opponent often cannot save every target, allowing you to win material."],
    discoveredCheck: ["Discovered Check", "Moving one piece opens a rook, bishop, or queen's line to the enemy king. The moved piece may create another threat at the same time."],
    underpromotion: ["Underpromotion", "A pawn promotes to a rook, bishop, or knight instead of the usual queen. It can create a special check, checkmate, or avoid stalemate."],
  },
  ja: {
    checkmate: ["チェックメイト", "キングがチェックされ、逃げる・攻撃を防ぐ・攻撃駒を取る方法がすべてない状態です。チェックメイトになると対局は終了します。"],
    backRankMate: ["バックランクメイト", "自分のポーンに逃げ道をふさがれたキングを、最終列でルークやクイーンが詰ませる形です。キング前方の空きマスを確認しましょう。"],
    rook: ["ルーク", "ルークは縦と横に何マスでも動けます。開いたラインで強くなり、キャスリングではキングと一緒に動きます。"],
    check: ["チェック", "キングが相手の駒に攻撃されている状態です。次の手でキングを逃がす、攻撃を防ぐ、攻撃駒を取る必要があります。"],
    knightFork: ["ナイトフォーク", "ナイトが同時に二つ以上の重要な駒を攻撃する戦術です。キングへのチェックと同時にクイーンやルークを狙うと特に強力です。"],
    castling: ["キャスリング", "キングとルークを同時に動かしてキングを安全にする特別な手です。両方が未移動で、間に駒がなく、キングがチェックのマスを通らない場合にできます。"],
    promotion: ["昇格", "ポーンが相手側の最終列に到達すると、クイーン、ルーク、ビショップ、ナイトのどれかに変わります。通常はクイーンを選びます。"],
    openFile: ["オープンファイル", "ポーンが一つもない縦列をオープンファイルと呼びます。ルークやクイーンが相手陣へ入る通路になります。"],
    bishop: ["ビショップ", "ビショップは斜めに何マスでも動けます。最初と同じ色のマスだけを進むため、開いた対角線を見つけることが重要です。"],
    queen: ["クイーン", "クイーンは縦、横、斜めに何マスでも動ける最も強い駒です。相手の攻撃にさらされないよう注意しましょう。"],
    knight: ["ナイト", "ナイトは縦横に2マス進んで横へ1マス曲がるL字型に動きます。他の駒を飛び越えられる唯一の駒です。"],
    enPassant: ["アンパッサン", "相手のポーンが初期位置から2マス進んで自分のポーンの横に来たとき、1マスだけ進んだものとして斜めに取る特別ルールです。直後の手だけ可能です。"],
    smotheredMate: ["スマザードメイト", "キングの逃げ道が自分の駒でふさがれているとき、ナイトで行うチェックメイトです。ナイトは周囲の駒を飛び越えて攻撃できます。"],
    pin: ["ピン", "前の駒が動くと後ろのより重要な駒が攻撃されるため、動きにくくなる状態です。後ろがキングなら攻撃線を開くことはできません。"],
    skewer: ["スキュアー", "価値の高い駒を先に攻撃して移動させ、その後ろにある駒を取る戦術です。重要な駒が前にある、ピンと逆の形です。"],
    doubleAttack: ["両取り", "一手で二つ以上の駒を同時に攻撃する戦術です。相手はすべてを守れないことが多く、どこかで駒を得られます。"],
    discoveredCheck: ["ディスカバードチェック", "前をふさいでいた自分の駒を動かし、後ろのルーク、ビショップ、クイーンの攻撃線を開いてチェックする戦術です。"],
    underpromotion: ["アンダープロモーション", "ポーンを通常のクイーンではなく、ルーク、ビショップ、ナイトへ昇格させる選択です。特別なチェックやステイルメイト回避に役立ちます。"],
  },
};

export function getLanguage() {
  return readPlayerState().language;
}

export function t(key, vars = {}, language = getLanguage()) {
  const value = TEXT[language]?.[key] ?? TEXT.ko[key] ?? key;
  return Object.entries(vars).reduce((result, [name, replacement]) => (
    result.replaceAll(`{${name}}`, String(replacement))
  ), value);
}

export function skinName(skin, language = getLanguage()) {
  if (language === "en") return skin.nameEn;
  if (language === "ja") return SKIN_JA[skin.id] || skin.nameEn;
  return skin.nameKo;
}

export function puzzleText(puzzle, field, language = getLanguage()) {
  if (language === "ko") return puzzle[field];
  const index = field === "title" ? 0 : field === "prompt" ? 1 : 2;
  return puzzle.localized?.[language]?.[field]
    ?? PUZZLES[puzzle.id]?.[language]?.[index]
    ?? puzzle[field];
}

export function puzzleTags(tags, language = getLanguage()) {
  if (language === "ko") return tags;
  return tags.map((tag) => TAGS[language]?.[tag] || tag);
}

export function puzzleGlossary(puzzle, language = getLanguage()) {
  const termId = PUZZLE_GLOSSARY[puzzle?.id]
    ?? puzzle?.tags?.map((tag) => TAG_GLOSSARY[tag]).find(Boolean);
  const localized = GLOSSARY[language]?.[termId] ?? GLOSSARY.ko[termId];
  if (!localized) return null;
  return { id: termId, title: localized[0], description: localized[1] };
}
