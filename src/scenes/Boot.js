import { queueInitialPieceAssets } from "../pieceAssets.js?v=20260720-puzzles100hint37";

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
      "btn_start_normal", "btn_start_hover", "btn_start_click",
      "btn_seting", "btn_rank", "btn_medal", "btn_install", "btn_home", "btn_back", "btn_hint",
      "btn_radio_on", "btn_radio_off", "btn_sound_on", "btn_sound_off",
      "btn_vibration_on", "btn_vibration_off", "btn_c_normal",
      "btn_pop_w_normal", "btn_pop_b_normal",
      "ingame_top", "chess_board_center",
      "chess_board_cube_black", "chess_board_cube_white",
      "chess_board_left", "chess_board_right", "popup", "popup_long",
      "icon_Pawn_w", "icon_Pawn_b", "icon_Knight_w", "icon_Knight_b",
      "icon_Bishop_w", "icon_Bishop_b", "icon_Rook_w", "icon_Rook_b",
      "icon_Queen_w", "icon_Queen_b", "icon_King_w", "icon_King_b",
    ];
    for (const name of uiFiles) {
      const version = name === "btn_install" ? "?v=20260720-puzzles100hint37" : "";
      this.load.image(`kuma_ui_${name}`, `${uiRoot}${name}.png${version}`);
    }
    this.load.image("kuma_ui_book_bg", `${uiRoot}book_bg.webp`);
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
      this.scene.start("Start");
    };
    if (document.fonts?.load) {
      Promise.all([
        document.fonts.load('700 16px "Pretendard"'),
        document.fonts.load('700 16px "Noto Serif KR"'),
      ]).then(start).catch(start);
    } else {
      start();
    }
  }
}
