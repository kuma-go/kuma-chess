const CONTENT_TARGETS = Object.freeze([
  {
    selector: "#story .story-copy-1 h2",
    en: "The KUMA CHESS Story",
    ja: "KUMA CHESSの物語",
  },
  {
    selector: "#story .story-copy-1 p",
    en: "Play puzzles, AI matches, and local face-to-face games with crowned animal pieces.<br />KUMA CHESS began as a game for the creator's elementary-school son, who loves chess. At a time when people often stay inside separate screens, it was designed to bring two people around one device to think, talk, and enjoy a warm game together.<br />Solo puzzles and AI matches matter, but so does seeing the other player's expression. We hope KUMA CHESS creates small moments when family and friends look at one another instead of only at a screen.",
    ja: "王冠をかぶった動物の駒と一緒に、パズル、AI対戦、1台で向かい合う2人対戦を楽しめます。<br />KUMA CHESSは、チェスが好きな小学生の息子のために作り始めたゲームです。別々の画面に向かう時間が増えた今、1台の端末を囲んで考え、話しながら遊べる温かな時間をゲームに込めました。<br />ひとりで遊ぶパズルやAI対戦だけでなく、相手の表情を見ながら遊ぶ時間も大切にしています。家族や友だちが画面越しではなく、互いに向き合う小さなきっかけになれば幸いです。",
  },
  {
    selector: "#story .story-copy-2 h3",
    en: "Music of KUMA CHESS",
    ja: "KUMA CHESSの音楽",
  },
  {
    selector: "#story .story-copy-2 p:nth-of-type(1)",
    en: "Every background track was planned and composed for KUMA CHESS. The music reflects a warm place to stay while thinking and the small world where the animal pieces live.",
    ja: "ゲーム内のBGMはすべてKUMA CHESSのために企画・制作したオリジナル曲です。考える時間を心地よく過ごせる温かさと、動物の駒が暮らす小さな世界を音楽で表現しました。",
  },
  {
    selector: "#story .story-copy-2 .track-list",
    en: "Track 01. Little Forest by the Window<br />Track 02. Kuma's Chess<br />Track 03. Kuma Chess",
    ja: "Track 01. 窓辺の小さな森<br />Track 02. クマのチェス<br />Track 03. クマチェス",
  },
  {
    selector: "#story .story-copy-3 h3",
    en: "Created Together with AI",
    ja: "AIと共に作った制作過程",
  },
  {
    selector: "#story .story-copy-3 p",
    en: "KUMA CHESS was built from the creator's ideas and designs, with generative AI assisting concept development, images, music, code, and review. The creator chose the direction and personally selected, revised, and completed every result.",
    ja: "KUMA CHESSは制作者のアイデアとデザインを基に、生成AIを企画の具体化、画像・音楽制作、コード実装、検証の補助として活用しました。方向を決め、成果物を選び、修正して完成させる工程は制作者自身が行っています。",
  },
  {
    selector: "#guide .guide-intro h2",
    en: "How to Play",
    ja: "遊び方",
  },
  {
    selector: "#guide .guide-intro h3:nth-of-type(1)",
    en: "Goal of Chess",
    ja: "チェスの目的",
  },
  {
    selector: "#guide .guide-intro p:nth-of-type(1)",
    en: "Chess is a strategy game where White and Black move one piece at a time.<br />The goal is checkmate: attack the enemy king so it has no legal escape.<br />You do not need to capture every piece. The game ends when checkmate is complete.",
    ja: "チェスは白と黒が交互に1つずつ駒を動かす戦略ゲームです。<br />相手のキングが逃げられない状態、チェックメイトを作ることが目的です。<br />すべての駒を取る必要はなく、チェックメイトが完成した時点でゲーム終了です。",
  },
  {
    selector: "#guide .guide-intro h3:nth-of-type(2)",
    en: "Basic Controls",
    ja: "基本操作",
  },
  {
    selector: "#guide .guide-intro p:nth-of-type(2)",
    en: "Tap your piece to show legal squares.<br />Tap a destination or drag the piece directly.<br />Choose a promotion when a pawn reaches the last rank.<br />The lower-left button undoes the previous move.",
    ja: "自分の駒を押すと移動可能なマスが表示されます。<br />目的のマスを押すか、駒を直接ドラッグします。<br />ポーンが最終列に着いたら昇格する駒を選びます。<br />左下のボタンで直前の手を戻せます。",
  },
  {
    selector: "#guide .board-copy h3:nth-of-type(1)",
    en: "Board and Starting Position",
    ja: "盤とゲーム開始",
  },
  {
    selector: "#guide .board-copy p:nth-of-type(1)",
    en: "The board has 64 squares in an 8×8 grid. White and Black each begin with 16 pieces.",
    ja: "盤は8×8、合計64マスです。白と黒はそれぞれ16個の駒で始めます。",
  },
  {
    selector: "#guide .board-copy ul",
    en: "<li>1 King</li><li>1 Queen</li><li>2 Rooks</li><li>2 Bishops</li><li>2 Knights</li><li>8 Pawns</li>",
    ja: "<li>キング 1個</li><li>クイーン 1個</li><li>ルーク 2個</li><li>ビショップ 2個</li><li>ナイト 2個</li><li>ポーン 8個</li>",
  },
  {
    selector: "#guide .board-copy p:nth-of-type(2)",
    en: "White always moves first, then the two sides alternate turns.",
    ja: "ゲームは必ず白が先に動き、その後は交互に1手ずつ進めます。",
  },
  {
    selector: "#guide .board-copy h3:nth-of-type(2)",
    en: "How Pieces Move",
    ja: "駒の動き方",
  },
  {
    selector: "#guide .king-rule h3",
    en: "King",
    ja: "キング",
  },
  {
    selector: "#guide .king-rule p",
    en: "Moves one square in any direction.<br />It cannot move onto a square attacked by an enemy piece.",
    ja: "上下左右と斜めに1マス動きます。<br />相手の駒に攻撃されているマスには移動できません。",
  },
  {
    selector: "#guide .queen-rule h3",
    en: "Queen",
    ja: "クイーン",
  },
  {
    selector: "#guide .queen-rule p",
    en: "Moves any number of squares horizontally, vertically, or diagonally.<br />It has the widest movement range in chess.",
    ja: "縦・横・斜めに好きなだけ進めます。<br />チェスで最も広い範囲を動ける駒です。",
  },
  {
    selector: "#guide .rook-rule h3",
    en: "Rook",
    ja: "ルーク",
  },
  {
    selector: "#guide .rook-rule p",
    en: "Moves any number of squares horizontally or vertically.",
    ja: "縦と横に好きなだけ進めます。",
  },
  {
    selector: "#guide .bishop-rule h3",
    en: "Bishop",
    ja: "ビショップ",
  },
  {
    selector: "#guide .bishop-rule p",
    en: "Moves any number of squares diagonally.<br />It always remains on the same color of square.",
    ja: "斜めに好きなだけ進めます。<br />最初にいたマスと同じ色のマスだけを移動します。",
  },
  {
    selector: "#guide .knight-rule h3",
    en: "Knight",
    ja: "ナイト",
  },
  {
    selector: "#guide .knight-rule p",
    en: "Moves two squares in one direction, then one square sideways in an L shape.<br />It is the only piece that can jump over others.",
    ja: "2マス進んで横に1マス動くL字型の移動をします。<br />ほかの駒を飛び越えられる唯一の駒です。",
  },
  {
    selector: "#guide .pawn-rule h3",
    en: "Pawn",
    ja: "ポーン",
  },
  {
    selector: "#guide .pawn-rule p",
    en: "Normally moves one square forward and may move two on its first move.<br />It captures one square diagonally forward and can never move backward.",
    ja: "通常は前へ1マス、最初の移動だけ2マス進めます。<br />相手の駒は斜め前1マスで取り、後ろには戻れません。",
  },
  {
    selector: "#guide .capture-copy h3",
    en: "Capturing Pieces",
    ja: "相手の駒を取る方法",
  },
  {
    selector: "#guide .capture-copy p",
    en: "If an enemy occupies a legal destination, move there to capture it.<br />The captured piece leaves the board. You cannot move onto your own piece.",
    ja: "移動できるマスに相手の駒があれば、そのマスへ進んで取れます。<br />取られた駒は盤から消えます。自分の駒があるマスには移動できません。",
  },
  {
    selector: "#guide .check-copy h3",
    en: "Check and Checkmate",
    ja: "チェックとチェックメイト",
  },
  {
    selector: "#guide .check-copy p:nth-of-type(1)",
    en: "Check means the king could be captured on the next move.<br />A player in check must remove the threat immediately.<br />There are three ways to respond:",
    ja: "次の手でキングを取られる状態をチェックと呼びます。<br />チェックされた側は次の手で必ず危険を解消します。<br />方法は3つあります。",
  },
  {
    selector: "#guide .check-copy ul",
    en: "<li>Move the king to safety</li><li>Capture the attacking piece</li><li>Block the attack</li>",
    ja: "<li>キングを安全なマスへ移動</li><li>攻撃している駒を取る</li><li>別の駒で攻撃経路をふさぐ</li>",
  },
  {
    selector: "#guide .check-copy p:nth-of-type(2)",
    en: "If none is possible, it is checkmate and the game is lost.",
    ja: "どの方法も使えなければチェックメイトとなり、負けです。",
  },
  {
    selector: "#guide .castling-rule h3",
    en: "Castling",
    ja: "キャスリング",
  },
  {
    selector: "#guide .castling-rule p:nth-of-type(1)",
    en: "Castling moves the king and rook together.<br />It protects the king and develops the rook.<br />All of these conditions are required:",
    ja: "キャスリングはキングとルークを同時に動かす特別な手です。<br />キングを守りながらルークを中央へ出せます。<br />次の条件をすべて満たす必要があります。",
  },
  {
    selector: "#guide .castling-rule ul",
    en: "<li>The king has not moved</li><li>The rook has not moved</li><li>No pieces stand between them</li><li>The king is not currently in check</li><li>The king does not cross or land on an attacked square</li>",
    ja: "<li>キングが一度も動いていない</li><li>対象のルークも動いていない</li><li>キングとルークの間に駒がない</li><li>現在チェックされていない</li><li>通過・到着マスが攻撃されていない</li>",
  },
  {
    selector: "#guide .castling-rule p:nth-of-type(2)",
    en: "The king moves two squares toward the rook, and the rook moves beside the king.",
    ja: "キングがルーク側へ2マス動き、ルークはキングの隣へ移動します。",
  },
  {
    selector: "#guide .enpassant-rule h3",
    en: "En Passant",
    ja: "アンパッサン",
  },
  {
    selector: "#guide .enpassant-rule p",
    en: "En passant is a special pawn capture.<br />When an enemy pawn advances two squares from its start and lands beside your pawn, capture it diagonally as if it moved only one square.<br />This is allowed only on the immediately following turn.",
    ja: "アンパッサンはポーン同士の特別な取り方です。<br />相手のポーンが最初の手で2マス進み、自分のポーンの隣に来たとき、1マスだけ進んだように斜めへ取れます。<br />使えるのはその直後の1手だけです。",
  },
  {
    selector: "#guide .promotion-rule h3",
    en: "Pawn Promotion",
    ja: "ポーンの昇格",
  },
  {
    selector: "#guide .promotion-rule p:nth-of-type(1)",
    en: "A pawn promotes when it reaches the last rank.<br />Choose one of these pieces:",
    ja: "ポーンが相手側の最終列に着くと昇格できます。<br />次の駒から1つ選びます。",
  },
  {
    selector: "#guide .promotion-rule ul",
    en: "<li>Queen</li><li>Rook</li><li>Bishop</li><li>Knight</li>",
    ja: "<li>クイーン</li><li>ルーク</li><li>ビショップ</li><li>ナイト</li>",
  },
  {
    selector: "#guide .promotion-rule p:nth-of-type(2)",
    en: "Promotion is allowed even if that piece remains on the board, so a player may have multiple queens.",
    ja: "同じ駒が盤に残っていても昇格できます。複数のクイーンを持つことも可能です。",
  },
  {
    selector: "#guide .draw-rule h3",
    en: "Draw Conditions",
    ja: "引き分けになる場合",
  },
  {
    selector: "#guide .draw-rule p",
    en: "A game can end in a draw without checkmate.<br /><strong>Stalemate</strong><br />The player has no legal move but the king is not in check.<br /><strong>Threefold repetition</strong><br />The same position occurs three times.<br /><strong>Fifty-move rule</strong><br />Fifty moves pass without a pawn move or capture.<br /><strong>Insufficient material</strong><br />Neither side has enough pieces to checkmate.<br />Players may also agree to a draw.",
    ja: "チェックメイト以外でも引き分けになります。<br /><strong>ステイルメイト</strong><br />合法手がないのにキングがチェックされていない状態です。<br /><strong>同じ局面が3回</strong><br />同一の局面が3回現れます。<br /><strong>50手ルール</strong><br />ポーン移動も駒取りもなく50手が経過します。<br /><strong>チェックメイト不可能</strong><br />残った駒ではどちらも詰ませられません。<br />両者の合意でも引き分けにできます。",
  },
  {
    selector: "#guide .tip-copy h3",
    en: "Small Tips for Winning",
    ja: "勝つための小さなヒント",
  },
  {
    selector: "#guide .tip-copy p",
    en: "Protecting your king and coordinating pieces matters more than taking many pieces.<br />Develop pawns, knights, and bishops early, then castle for safety.<br />Before every move ask:<br />“Is my king safe?”<br />“What is my opponent attacking?”<br />These two questions will make your play much steadier.",
    ja: "多く取ることより、キングを守り複数の駒を連携させることが大切です。<br />序盤はポーン、ナイト、ビショップを展開し、キャスリングでキングを守りましょう。<br />指す前に考えてください。<br />「自分のキングは安全か？」<br />「相手は何を攻撃しているか？」<br />この2点だけでも対局が安定します。",
  },
  {
    selector: "#minigame-guide .minigame-guide-header h2",
    en: "Mini-Game Guides",
    ja: "ミニゲームの遊び方",
  },
  {
    selector: "#minigame-guide .minigame-guide-header p",
    en: "See the goal and controls for each mini-game.",
    ja: "各ミニゲームの目的と操作方法を確認できます。",
  },
  {
    selector: "#modes > h2",
    en: "Game Modes",
    ja: "ゲームモード",
  },
  {
    selector: "#modes .mode-puzzle h3",
    en: "Puzzles",
    ja: "パズル",
  },
  {
    selector: "#modes .mode-puzzle p",
    en: "Learn practical tactics such as checkmate, forks, pins, castling, and promotion. Tap or drag pieces, and use hints and term guides when needed.",
    ja: "チェックメイト、フォーク、ピン、キャスリング、昇格など実戦的な戦術を順番に学びます。駒を押すかドラッグし、ヒントや用語説明も確認できます。",
  },
  {
    selector: "#modes .mode-ai h3",
    en: "AI Match",
    ja: "AI対戦",
  },
  {
    selector: "#modes .mode-ai p",
    en: "Choose Easy, Normal, Hard, or the top-tier Challenge level. Wins reward 5, 15, 35, or 100 coins, and Challenge searches more deeply.",
    ja: "かんたん・ふつう・むずかしい・最上級の挑戦から選びます。勝利報酬は5・15・35・100コインで、挑戦AIはより深く探索します。",
  },
  {
    selector: "#modes .mode-pvp h3",
    en: "Face-to-Face PvP",
    ja: "対面対戦",
  },
  {
    selector: "#modes .mode-pvp p",
    en: "Two players share one device. Pieces and guidance rotate toward the active player when the turn changes.",
    ja: "1台の端末を向かい合って使うローカル2人モードです。手番が変わると駒と案内が相手側へ回転します。",
  },
  {
    selector: "#modes .mode-data h3",
    en: "Data Storage and Sync",
    ja: "データ保存と同期",
  },
  {
    selector: "#modes .mode-data p",
    en: "The game is stored locally first, while profile preferences and an unverified progress summary are backed up to an anonymous Firebase account. Data is not yet transferred automatically to another device or restored after local deletion, and coins, rewards, owned pieces, and official rankings are not yet server-verified or provided.",
    ja: "ゲームはブラウザに優先保存され、プロフィール設定と未検証の進行概要はFirebase匿名アカウントへバックアップされます。現在は別の端末への自動移行や削除したローカル記録の復元には対応せず、コイン・報酬・保有駒・公式ランキングもまだサーバー検証または提供の対象ではありません。",
  },
  {
    selector: "#collection .collection-intro h3",
    en: "Coins and Pieces",
    ja: "コインと駒",
  },
  {
    selector: "#collection .collection-intro p",
    en: "Earn coins from login rewards, first puzzle clears, and AI wins. White and Black sets are purchased separately, and some unlock through quests. The same reward may be granted only once.",
    ja: "ログイン報酬、パズル初クリア、AI勝利でコインを獲得します。白と黒の駒は別々に購入し、一部はクエストで解放します。同じ報酬は1回だけの場合があります。",
  },
  {
    selector: "#collection .collection-intro h2",
    en: "Piece Collection",
    ja: "駒コレクション",
  },
  {
    selector: "#collection .collection-1 h3",
    en: "1. Which King Will You Choose?",
    ja: "1. どの王と進みますか？",
  },
  {
    selector: "#collection .collection-1 p",
    en: "Choose bears, rabbits, cats, foxes, wolves, squirrels, and more. Build your favorite set and play matches between kingdoms with distinct styles.",
    ja: "クマ、ウサギ、ネコ、キツネ、オオカミ、リスなど多彩な動物の駒があります。好きな動物を選び、自分だけのセットで対局しましょう。",
  },
  {
    selector: "#collection .collection-2 h3",
    en: "2. One Animal, Two Kingdoms",
    ja: "2. 同じ動物、2つの王国",
  },
  {
    selector: "#collection .collection-2 p",
    en: "Every animal has White and Black pieces. Match the same animal or combine different kingdoms to create your own battle.",
    ja: "各動物には白と黒の両陣営があります。同じ動物同士でも、別の王国を組み合わせても遊べます。",
  },
  {
    selector: "#collection .collection-3 h3",
    en: "3. Build Your Collection",
    ja: "3. 駒を集めよう",
  },
  {
    selector: "#collection .collection-3 p",
    en: "Use coins earned through play to unlock new animal pieces. Collect your favorites and complete your personal collection.",
    ja: "ゲームで得たコインで新しい動物の駒を手に入れ、好きな駒を集めて自分だけのコレクションを完成させましょう。",
  },
  {
    selector: "#collection .collection-4 h3",
    en: "4. Same Chess, Any Piece",
    ja: "4. どの駒でも同じチェス",
  },
  {
    selector: "#collection .collection-4 p",
    en: "Animal pieces are cosmetic collectibles. Movement and strength never change, so play with whichever design you like.",
    ja: "動物の駒は見た目を変えるコレクション要素です。移動ルールや性能は変わらないので、好きな姿で遊べます。",
  },
  {
    selector: "#rewards > h2",
    en: "Achievements and Rewards",
    ja: "実績と報酬",
  },
  {
    selector: "#rewards .reward-1 h3",
    en: "1. Small Challenges Become Your Record",
    ja: "1. 小さな挑戦が記録になる",
  },
  {
    selector: "#rewards .reward-1 p",
    en: "From your first match to puzzles, AI battles, and games with family or friends, every KUMA CHESS experience becomes part of your record.",
    ja: "最初の対局からパズル、AI対戦、家族や友だちとの時間まで、KUMA CHESSでの体験が一つずつ記録になります。",
  },
  {
    selector: "#rewards .reward-2 h3",
    en: "2. Complete Achievements Your Way",
    ja: "2. さまざまな方法で実績を達成",
  },
  {
    selector: "#rewards .reward-2 p",
    en: "Winning is not the only goal. First matches, checkmates, puzzles, promotion, castling, and AI play all unlock achievements naturally.",
    ja: "勝利だけが目標ではありません。初対局、チェックメイト、パズル、昇格、キャスリング、AI対戦などで自然に実績を達成できます。",
  },
  {
    selector: "#rewards .reward-3 h3",
    en: "3. Time Together Is Recorded",
    ja: "3. 一緒に遊んだ時間も記録",
  },
  {
    selector: "#rewards .reward-3 p",
    en: "Face-to-face mode lets two people share one board on one device. A match enjoyed across the table becomes a special record too.",
    ja: "対面モードは1台の端末で同じ盤を見ながら遊ぶ2人対戦です。家族や友だちと向き合った一局も特別な記録になります。",
  },
  {
    selector: "#rewards .reward-4 h3",
    en: "4. A Small Daily Challenge",
    ja: "4. 今日の小さな挑戦",
  },
  {
    selector: "#rewards .reward-4 p",
    en: "Complete new missions each day. Finish all three to receive today's completion reward.",
    ja: "毎日の新しいミッションに挑戦しましょう。3つすべて達成すると今日の完了報酬を受け取れます。",
  },
  {
    selector: "#rewards .reward-5 h3",
    en: "5. Collect Medals and Rewards",
    ja: "5. メダルと報酬を集めよう",
  },
  {
    selector: "#rewards .reward-5 p",
    en: "Meet special conditions to earn medals and rewards. Each medal celebrates how you played and how steadily your kingdom grew.",
    ja: "特別な条件を達成するとメダルと報酬を獲得できます。遊び方や積み重ねを記念する記録を一つずつ集めましょう。",
  },
  {
    selector: "#rewards .reward-6 h3",
    en: "6. Records That Last Beyond Victory",
    ja: "6. 勝利より長く残る記録",
  },
  {
    selector: "#rewards .reward-6 p",
    en: "Wins, chosen pieces, solved puzzles, and shared games all become your KUMA CHESS story. Complete challenges and build a kingdom of your own.",
    ja: "勝利数だけでなく、選んだ駒、解いたパズル、誰かと遊んだ時間も物語になります。挑戦を重ね、自分だけの王国を作りましょう。",
  },
  {
    selector: ".site-footer .footer-copy strong",
    en: "Contact",
    ja: "お問い合わせ",
  },
  {
    selector: ".site-footer .footer-copy p:nth-of-type(1)",
    en: "For game questions and suggestions,<br />email carksk@naver.com or<br />contact KakaoTalk ID carksk2.",
    ja: "ゲームに関するお問い合わせ・ご提案は<br />carksk@naver.com または<br />KakaoTalk ID carksk2までお送りください。",
  },
]);

const ATTRIBUTE_TARGETS = Object.freeze([
  { selector: '[data-minigame-guide-art="tug"]', attribute: "alt", en: "How to play Kingdom Push Battle", ja: "王国押し合いの遊び方" },
  { selector: '[data-minigame-guide-art="road"]', attribute: "alt", en: "How to play Royal Road", ja: "王国の道の遊び方" },
  { selector: '[data-minigame-guide-art="crown"]', attribute: "alt", en: "How to play Crown Clash", ja: "王冠争奪戦の遊び方" },
  { selector: '[data-minigame-guide-art="siege"]', attribute: "alt", en: "How to play Kingdom Siege", ja: "王国攻城戦の遊び方" },
  { selector: '[data-minigame-guide-art="road-puzzle"]', attribute: "alt", en: "How to play Royal Road Puzzle", ja: "王国の道パズルの遊び方" },
  { selector: "#modes .mode-puzzle .reference-hit-area", attribute: "aria-label", en: "Start Puzzle", ja: "パズル開始" },
  { selector: "#modes .mode-ai .reference-hit-area", attribute: "aria-label", en: "Start AI Match", ja: "AI対戦開始" },
  { selector: "#modes .mode-pvp .reference-hit-area", attribute: "aria-label", en: "Start Face-to-Face Match", ja: "対面対戦開始" },
  { selector: "#rewards .reward-4 .reference-hit-area", attribute: "aria-label", en: "View Daily Missions", ja: "デイリーミッションを見る" },
  { selector: "#rewards .reward-5 .reference-hit-area", attribute: "aria-label", en: "Open Medal Catalog", ja: "メダル図鑑を開く" },
]);

const originalContent = new Map();
const originalAttributes = new Map();

export function applyMainPageContentLanguage(language = "ko") {
  const lang = ["en", "ja"].includes(language) ? language : "ko";

  CONTENT_TARGETS.forEach((target) => {
    const element = document.querySelector(target.selector);
    if (!element) return;
    if (!originalContent.has(target.selector)) originalContent.set(target.selector, element.innerHTML);
    element.innerHTML = lang === "ko" ? originalContent.get(target.selector) : target[lang];
  });

  ATTRIBUTE_TARGETS.forEach((target) => {
    const element = document.querySelector(target.selector);
    if (!element) return;
    const key = `${target.selector}:${target.attribute}`;
    if (!originalAttributes.has(key)) originalAttributes.set(key, element.getAttribute(target.attribute) || "");
    element.setAttribute(target.attribute, lang === "ko" ? originalAttributes.get(key) : target[lang]);
  });
}
