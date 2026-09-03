import { queueInitialPieceAssets } from "../pieceAssets.js?v=20260904-pwarefresh103";

export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0xfff8ea);
    const title = this.add.text(width / 2, height / 2 - 42, "KUMA CHESS", {
      fontFamily: '"Noto Serif KR", "Noto Serif", Georgia, serif',
      fontSize: "34px",
      color: "#5a3c1d",
      fontStyle: "700",
    }).setOrigin(0.5);
    const track = this.add.rectangle(width / 2, height / 2 + 18, 310, 8, 0xd8c6aa, 0.55);
    const fill = this.add.rectangle(width / 2 - 155, height / 2 + 18, 1, 8, 0xb8862b, 1).setOrigin(0, 0.5);
    this.load.on("progress", (value) => {
      fill.width = Math.max(1, 310 * value);
    });
    this.load.once("complete", () => {
      fill.width = 310;
    });
    this.loadingUi = [title, track, fill];

    const uiRoot = "assets/kuma/ui/";
    const uiFiles = [
      "main_logo_B", "main_img", "main_bottom_bg",
      "coin_bg", "coin_nomal", "coin_small", "lock", "lock_bg",
      "icon_lock", "img_key", "img_flag", "result_crown", "result_crown_slot",
      "btn_start_normal", "btn_start_hover", "btn_start_click",
      "btn_seting", "btn_rank", "btn_medal", "btn_daily", "btn_install", "btn_home", "btn_back", "btn_hint",
      "btn_rankborad", "btn_leaderboard", "btn_my", "btn_rank_tab_on", "btn_rank_tab_off",
      "pop_3p_top", "pop_3p_center", "pop_3p_bottom",
      "popup_3Patch_top", "popup_3Patch_center", "popup_3Patch_bottom",
      "icon_rank_num_01", "icon_rank_num_02", "icon_rank_num_03", "icon_cup",
      "btn_radio_on", "btn_radio_off", "btn_sound_on", "btn_sound_off",
      "btn_vibration_on", "btn_vibration_off", "btn_c_normal",
      "btn_pop_w_normal", "btn_pop_b_normal",
      "btn_arrow_up", "btn_arrow_left", "btn_arrow_right", "img_castle", "img_item_box", "icon_king_crown", "img_potal",
      "siege_fx_pawn", "siege_fx_knight", "siege_fx_bishop", "siege_fx_rook", "siege_fx_queen", "siege_fx_king",
      "tile_cross", "tile_crossroad", "tile_down_up", "tile_down_up_speed",
      "tile_down_left", "tile_down_right", "tile_left_up", "tile_right_up",
      "tile_t_up", "tile_t_down", "tile_t_left", "tile_t_right", "tile_left_end", "tile_right_end",
      "tile_bomb", "tile_spike", "tile_trap",
      "ingame_top", "chess_board_center", "chess_board_center_top_shot", "chess_board_center_bottom_shot",
      "chess_board_cube_black", "chess_board_cube_white",
      "chess_board_left", "chess_board_right", "popup", "popup_long",
      "icon_Pawn_w", "icon_Pawn_b", "icon_Knight_w", "icon_Knight_b",
      "icon_Bishop_w", "icon_Bishop_b", "icon_Rook_w", "icon_Rook_b",
      "icon_Queen_w", "icon_Queen_b", "icon_King_w", "icon_King_b",
    ];
    for (const name of uiFiles) {
      const version = name === "btn_install" ? "?v=20260904-pwarefresh103" : "";
      this.load.image(`kuma_ui_${name}`, `${uiRoot}${name}.png${version}`);
    }
    this.load.image("kuma_ui_btn_tab_on", `${uiRoot}btn_rank_tab_on.png`);
    this.load.image("kuma_ui_btn_tab_off", `${uiRoot}btn_rank_tab_off.png`);
    this.load.spritesheet("kuma_ui_ani_dice", `${uiRoot}ani_dice.png`, {
      frameWidth: 384,
      frameHeight: 512,
    });
    this.load.spritesheet("kuma_ui_ani_dice_black", `${uiRoot}ani_dice_black.png`, {
      frameWidth: 384,
      frameHeight: 512,
    });
    this.load.image("kuma_ui_book_bg", `${uiRoot}book_bg.webp`);
    this.load.image("kuma_ui_daily_popup", `${uiRoot}daily_popup.png`);
    this.load.image("kuma_ui_icon_new", `${uiRoot}icon_new.svg`);

    queueInitialPieceAssets(this);
  }

  create() {
    this.registry.set("boardThemeId", "kuma");
    if (!this.registry.get("pieceSkin")) {
      this.registry.set("pieceSkin", { w: "classic", b: "classic" });
    }
    const start = () => {
      if (!this.scene.isActive()) return;
      this.loadingUi?.forEach((item) => item.destroy());
      const params = new URLSearchParams(window.location.search);
      const demoMode = params.get("demo");
      const launch = params.get("launch");
      const launchMode = ["ai", "pvp"].includes(params.get("mode")) ? params.get("mode") : "";
      const miniGameScenes = {
        tug: "KingdomTug",
        road: "RoyalRoad",
        crown: "CrownClash",
        siege: "KingdomSiege",
      };
      const localPuzzleStage = ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? Number(params.get("roadPuzzleStage"))
        : 0;
      const localOnlineDemo = ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? params.get("onlineDemo")
        : "";
      if (["white", "black"].includes(localOnlineDemo)) {
        const demoColor = localOnlineDemo === "black" ? "b" : "w";
        this.scene.start("OnlineGame", {
          demo: true,
          code: "DEMO23",
          playerColor: demoColor,
          room: {
            code: "DEMO23",
            hostUid: "demo-white",
            guestUid: "demo-black",
            hostName: "White Player",
            guestName: "Black Player",
            whiteUid: "demo-white",
            blackUid: "demo-black",
            status: "active",
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: [],
            turnUid: "demo-white",
            result: "",
            reason: "",
            revision: 0,
          },
        });
      } else if (localPuzzleStage > 0) {
        this.scene.start("RoyalRoadPuzzle", { stageIndex: localPuzzleStage - 1 });
      } else if (launch === "ai" || launch === "pvp") {
        this.registry.set("pieceSelectTargetScene", "Game");
        this.registry.set("gameMode", launch);
        this.scene.start(launch === "ai" ? "PieceSelectAI" : "PieceSelect");
      } else if (launch === "puzzle") {
        this.scene.start("PuzzleSelect");
      } else if (launch === "road-puzzle") {
        this.scene.start("RoyalRoadPuzzleSelect");
      } else if (launch === "medals") {
        this.scene.start("MedalCatalog");
      } else if (miniGameScenes[launch] && launchMode) {
        this.registry.set("pieceSelectTargetScene", miniGameScenes[launch]);
        this.registry.set("gameMode", launchMode);
        this.scene.start(launchMode === "ai" ? "PieceSelectAI" : "PieceSelect");
      } else {
        const embeddedLaunch = window.parent !== window ? (launch || "preload") : "";
        this.scene.start(demoMode === "ad" ? "Demo" : "Start", embeddedLaunch
          ? { embeddedLaunch, embeddedIdle: embeddedLaunch === "preload" }
          : undefined);
      }
    };
    if (document.fonts?.load) {
      const fontReady = Promise.allSettled([
        document.fonts.load('700 16px "Pretendard"'),
        document.fonts.load('700 16px "Noto Serif KR"'),
      ]);
      const fontTimeout = new Promise((resolve) => window.setTimeout(resolve, 1800));
      Promise.race([fontReady, fontTimeout]).then(start).catch(start);
    } else {
      start();
    }
  }
}
