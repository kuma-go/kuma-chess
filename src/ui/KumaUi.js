import { readPlayerState, writePlayerState } from "../playerState.js?v=20260716-mobile26";
import { t } from "../i18n.js?v=20260716-mobile26";
import { SpriteButton } from "./SpriteButton.js?v=20260716-mobile26";
import { setMenuBgmVolume } from "../menuBgm.js?v=20260716-mobile26";
import {
  isVibrationSupported,
  playFeedback,
  primeAudioFromGesture,
  vibrateFeedback,
} from "../feedback.js?v=20260716-mobile26";

export const KUMA_FONT_SANS = '"Pretendard", "Apple SD Gothic Neo", sans-serif';
export const KUMA_FONT_SERIF = '"Noto Serif KR", "Noto Serif", Georgia, serif';

export const KUMA_COLORS = {
  ink: "#352719",
  muted: "#8e765f",
  pale: "#fff8ea",
  cream: "#fbf3e3",
  gold: "#d8a344",
  teal: "#0099b8",
  orange: "#dd8832",
  line: 0xc8a57f,
  darkPanel: 0x2f251a,
};

const BOARD_SOURCE = Object.freeze({
  width: 1072,
  height: 1068,
  sideWidth: 56,
  gridTop: 54,
  squareSize: 120,
});

export function getChessBoardLayout(scene, options = {}) {
  const outerWidth = options.outerWidth ?? Math.min(712, scene.scale.width - 8);
  const scale = outerWidth / BOARD_SOURCE.width;
  const squareSize = BOARD_SOURCE.squareSize * scale;
  const outerHeight = BOARD_SOURCE.height * scale;
  const outerLeft = options.outerLeft ?? (scene.scale.width - outerWidth) / 2;
  const outerTop = options.outerTop ?? 284;

  return {
    outerLeft,
    outerTop,
    outerWidth,
    outerHeight,
    scale,
    squareSize,
    boardX: outerLeft + BOARD_SOURCE.sideWidth * scale,
    boardY: outerTop + BOARD_SOURCE.gridTop * scale,
  };
}

export function addChessBoard(scene, layout, depth = 0) {
  const group = scene.add.container(0, 0).setDepth(depth);
  const sideWidth = BOARD_SOURCE.sideWidth * layout.scale;
  const centerWidth = (BOARD_SOURCE.width - BOARD_SOURCE.sideWidth * 2) * layout.scale;
  const centerX = layout.outerLeft + sideWidth;

  const center = scene.add.image(centerX, layout.outerTop, "kuma_ui_chess_board_center")
    .setOrigin(0)
    .setDisplaySize(centerWidth, layout.outerHeight);
  group.add(center);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const key = (row + col) % 2 === 0
        ? "kuma_ui_chess_board_cube_white"
        : "kuma_ui_chess_board_cube_black";
      const tile = scene.add.image(
        layout.boardX + col * layout.squareSize,
        layout.boardY + row * layout.squareSize,
        key
      ).setOrigin(0).setDisplaySize(layout.squareSize, layout.squareSize);
      group.add(tile);
    }
  }

  const left = scene.add.image(layout.outerLeft, layout.outerTop, "kuma_ui_chess_board_left")
    .setOrigin(0)
    .setDisplaySize(sideWidth, layout.outerHeight);
  const right = scene.add.image(layout.outerLeft + sideWidth + centerWidth, layout.outerTop, "kuma_ui_chess_board_right")
    .setOrigin(0)
    .setDisplaySize(sideWidth, layout.outerHeight);
  group.add([left, right]);

  return group;
}

export function addScreenBg(scene, key = "bg_select") {
  const { width, height } = scene.scale;
  if (key === "bg_select") {
    return scene.add.rectangle(0, 0, width, height, 0xfff8ea).setOrigin(0).setDepth(-100);
  }
  const bg = scene.add.image(width / 2, height / 2, key).setOrigin(0.5);
  bg.setDisplaySize(width, height);
  bg.setDepth(-100);
  return bg;
}

export function addContentWash(scene, alpha = 0.78) {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, 0xfff8ea, alpha)
    .setOrigin(0)
    .setDepth(-90);
}

export function addCoinPill(scene, x = 34, y = 34, depth = 900) {
  const state = readPlayerState();
  const group = scene.add.container(0, 0).setDepth(depth);
  const pill = scene.add.image(x + 77, y + 23, "kuma_ui_coin_bg").setDisplaySize(153, 47);
  const coin = scene.add.image(x + 25, y + 23, "kuma_ui_coin_nomal").setDisplaySize(40, 40);
  const amount = scene.add.text(x + 58, y + 23, String(state.coins), {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "30px",
    color: "#ffffff",
    fontStyle: "500",
  }).setOrigin(0, 0.5);

  group.add([pill, coin, amount]);
  return group;
}

export function addRoundIconButton(scene, x, y, glyph, onClick, size = 72) {
  const group = scene.add.container(x, y).setDepth(930);
  const r = size / 2;
  const bg = scene.add.graphics();
  bg.fillStyle(0xfff6e5, 0.98);
  bg.fillCircle(0, 0, r);
  bg.lineStyle(Math.max(4, size * 0.06), 0xbd852b, 1);
  bg.strokeCircle(0, 0, r - 2);
  bg.lineStyle(2, 0xf7df9e, 1);
  bg.strokeCircle(0, 0, r - 8);

  const icon = scene.add.text(0, -1, glyph, {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: `${Math.floor(size * 0.52)}px`,
    color: "#4a321d",
    fontStyle: "900",
  }).setOrigin(0.5);

  const hit = scene.add.circle(0, 0, r + 8, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => {
    playFeedback("ui");
    onClick?.();
  });

  group.add([bg, icon, hit]);
  return group;
}

export function addSettingsButton(scene, onClick) {
  const btn = scene.add.image(scene.scale.width - 67, 61, "kuma_ui_btn_seting")
    .setDisplaySize(67, 67)
    .setDepth(930)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerdown", () => {
    playFeedback("ui");
    onClick?.();
  });
  return btn;
}

export function addBackButton(scene, onClick, x = 70, y = null) {
  const yy = y ?? scene.scale.height - 70;
  const btn = scene.add.image(x, yy, "kuma_ui_btn_back").setDisplaySize(70, 70).setDepth(930)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerdown", () => {
    playFeedback("ui");
    onClick?.();
  });
  return btn;
}

export function addPageTitle(scene, title, subtitle = "", y = 86) {
  const { width } = scene.scale;
  const t = scene.add.text(width / 2, y, title, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "38px",
    color: KUMA_COLORS.ink,
    fontStyle: "900",
  }).setOrigin(0.5).setDepth(40);
  if (!subtitle) return { title: t, subtitle: null };
  const sub = scene.add.text(width / 2, y + 56, subtitle, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "22px",
    color: KUMA_COLORS.ink,
    fontStyle: "500",
  }).setOrigin(0.5).setDepth(40);
  return { title: t, subtitle: sub };
}

export function addFooter(scene, withContact = false) {
  const { width, height } = scene.scale;
  if (withContact) {
    scene.add.text(width / 2, height - 58, t("footer.contact"), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "17px",
      color: "#c3aa8f",
      fontStyle: "500",
    }).setOrigin(0.5).setDepth(20);
  }
  scene.add.text(width / 2, height - 26, "© 2026 koseulki. All Rights Reserved.", {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: "17px",
    color: "#c3aa8f",
    fontStyle: "500",
  }).setOrigin(0.5).setDepth(20);
}

export function addLargeTextButton(scene, x, y, label, subLabel, onClick, opts = {}) {
  const w = opts.width ?? 520;
  const h = opts.height ?? 96;
  const dark = !!opts.dark;
  const compact = w <= 320;
  const normalKey = dark
    ? "kuma_ui_btn_pop_b_normal"
    : compact ? "kuma_ui_btn_pop_w_normal" : "kuma_ui_btn_start_normal";
  const hoverKey = dark || compact ? normalKey : "kuma_ui_btn_start_hover";
  const pressedKey = dark || compact ? normalKey : "kuma_ui_btn_start_click";
  const btn = new SpriteButton(scene, x, y, {
    normal: normalKey,
    hover: hoverKey,
    pressed: pressedKey,
  }, onClick);
  btn.setScaleTo(w, h);
  btn.setDepth(opts.depth ?? 50);

  const color = opts.titleColor ?? (dark ? "#fff8dc" : KUMA_COLORS.ink);
  const titleY = y + (opts.titleOffsetY ?? (subLabel ? -12 : 0));
  const title = scene.add.text(x, titleY, label, {
    fontFamily: opts.titleFontFamily ?? KUMA_FONT_SANS,
    fontSize: `${opts.fontSize ?? 40}px`,
    color,
    fontStyle: opts.titleFontStyle ?? "700",
  }).setOrigin(0.5).setDepth((opts.depth ?? 50) + 1);
  let sub = null;
  if (subLabel) {
    const subY = y + (opts.subOffsetY ?? 28);
    sub = scene.add.text(x, subY, subLabel, {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: `${opts.subFontSize ?? 18}px`,
      color,
      fontStyle: opts.subFontStyle ?? "500",
    }).setOrigin(0.5).setAlpha(0.9).setDepth((opts.depth ?? 50) + 1);
  }
  return { button: btn, title, sub };
}

export function addDarkTopBar(scene, title = "Kuma Chess", opts = {}) {
  const { width } = scene.scale;
  const group = scene.add.container(0, 0).setDepth(900);
  const bg = scene.add.image(width / 2, 56, "kuma_ui_ingame_top").setDisplaySize(width - 22, 96);
  const home = scene.add.image(width - 188, 57, "kuma_ui_btn_home").setDisplaySize(67, 67)
    .setInteractive({ useHandCursor: true });
  home.on("pointerdown", () => {
    playFeedback("ui");
    if (opts.onHome) opts.onHome();
    else scene.scene.start("Start");
  });
  const settings = scene.add.image(width - 90, 57, "kuma_ui_btn_seting").setDisplaySize(67, 67)
    .setInteractive({ useHandCursor: true });
  settings.on("pointerdown", () => {
    playFeedback("ui");
    showSettingsPanel(scene);
  });
  group.add([bg, home, settings]);
  return group;
}

export function addPanel(scene, x, y, width, height, depth = 1000) {
  return scene.add.image(x, y, height > width * 1.05 ? "kuma_ui_popup_long" : "kuma_ui_popup")
    .setDisplaySize(width, height)
    .setDepth(depth);
}

export function addLock(scene, x, y, size = 42, depth = 80) {
  const group = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.image(0, 0, "kuma_ui_lock_bg").setDisplaySize(size * 1.55, size * 1.55);
  const lock = scene.add.image(0, 0, "kuma_ui_lock").setDisplaySize(size * 0.72, size);
  group.add([bg, lock]);
  return group;
}

export function createModalBackdrop(scene, depth = 9990) {
  const { width, height } = scene.scale;
  const visibleObjects = scene.children.list.filter((obj) => obj.visible && obj.active !== false);
  const hiddenObjects = [];
  let snapshot = null;

  if (scene.sys.game.renderer.type === Phaser.WEBGL) {
    try {
      snapshot = scene.add.renderTexture(0, 0, width, height)
        .setOrigin(0)
        .setDepth(depth);
      snapshot.draw(visibleObjects);
      for (const obj of visibleObjects) {
        hiddenObjects.push(obj);
        obj.setVisible(false);
      }
      snapshot.postFX?.addBlur(0, 1.2, 1.2, 0.9, 0xffffff, 2);
    } catch (error) {
      for (const obj of hiddenObjects) obj.setVisible(true);
      hiddenObjects.length = 0;
      snapshot?.destroy();
      snapshot = null;
    }
  }

  const dim = scene.add.rectangle(0, 0, width, height, 0x2b2118, 0.32)
    .setOrigin(0)
    .setDepth(depth + 1)
    .setInteractive();

  return {
    dim,
    cleanup() {
      dim.destroy();
      snapshot?.destroy();
      for (const obj of hiddenObjects) {
        if (obj.scene) obj.setVisible(true);
      }
    },
  };
}

export function addMiniCoin(scene, x, y, amount, depth = 80) {
  const group = scene.add.container(x, y).setDepth(depth);
  const coin = scene.add.image(0, 0, "kuma_ui_coin_small").setDisplaySize(18, 18);
  const txt = scene.add.text(14, 0, String(amount), {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: "17px",
    color: KUMA_COLORS.ink,
    fontStyle: "500",
  }).setOrigin(0, 0.5);
  group.add([coin, txt]);
  return group;
}

export function showRewardLine(scene, message, options = {}) {
  const { width, height } = scene.scale;
  const y = options.y ?? height / 2;
  const hold = options.hold ?? 1700;
  const depth = options.depth ?? 7000;
  const showCoin = options.showCoin !== false;
  const particleScale = options.particleScale ?? 1;
  const tone = options.tone ?? "success";
  const isFailure = tone === "failure";
  playFeedback(options.feedbackType || (isFailure ? "error" : showCoin ? "reward" : "success"));
  const palette = isFailure
    ? {
        band: 0x321b1b,
        edge: 0xc94b43,
        text: "#ffb5ad",
        stroke: "#541711",
        particles: [0xc94b43, 0xe8776d, 0x8f302b],
      }
    : {
        band: 0x2f251a,
        edge: 0xe0b353,
        text: "#fff4cf",
        stroke: "#4b2e12",
        particles: [0xf4c65d, 0xfff4cf, 0x22a7be, 0xd94c42, 0x66a85f],
      };
  const particleCount = options.particleCount ?? (isFailure ? 8 : 22);
  const group = scene.add.container(width / 2, y).setDepth(depth);

  const band = scene.add.rectangle(0, 0, width, 84, palette.band, 0.94).setScale(0.04, 1);
  const edgeTop = scene.add.rectangle(0, -42, width, 3, palette.edge, 1).setScale(0.04, 1);
  const edgeBottom = scene.add.rectangle(0, 42, width, 3, palette.edge, 1).setScale(0.04, 1);
  const coin = scene.add.image(-170, 0, "kuma_ui_coin_nomal")
    .setDisplaySize(46, 46)
    .setAlpha(0)
    .setVisible(showCoin);
  const label = scene.add.text(showCoin ? 18 : 0, 0, message, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "29px",
    color: palette.text,
    fontStyle: "900",
    stroke: palette.stroke,
    strokeThickness: 3,
  }).setOrigin(0.5).setAlpha(0).setScale(0.82);
  group.add([band, edgeTop, edgeBottom, coin, label]);

  scene.tweens.add({
    targets: [band, edgeTop, edgeBottom],
    scaleX: 1,
    duration: 260,
    ease: "Cubic.Out",
  });
  scene.tweens.add({
    targets: [coin, label],
    alpha: 1,
    duration: 300,
    delay: 150,
    ease: "Quad.Out",
  });
  scene.tweens.add({
    targets: label,
    scaleX: 1,
    scaleY: 1,
    duration: 300,
    delay: 150,
    ease: "Back.Out",
  });
  scene.tweens.add({
    targets: coin,
    angle: 360,
    duration: 700,
    delay: 180,
    ease: "Cubic.Out",
  });

  for (let i = 0; i < particleCount; i += 1) {
    const spark = scene.add.rectangle(
      Phaser.Math.Between(-250, 250),
      Phaser.Math.Between(-18, 18),
      Phaser.Math.Between(Math.round(4 * particleScale), Math.round(9 * particleScale)),
      Phaser.Math.Between(Math.round(3 * particleScale), Math.round(6 * particleScale)),
      palette.particles[i % palette.particles.length],
      1
    ).setAlpha(0).setAngle(Phaser.Math.Between(0, 180));
    group.add(spark);
    scene.tweens.add({
      targets: spark,
      alpha: { from: 0, to: 1 },
      x: spark.x + Phaser.Math.Between(-36, 36),
      y: spark.y + Phaser.Math.Between(-48, 48),
      angle: spark.angle + Phaser.Math.Between(120, 360),
      duration: Phaser.Math.Between(520, 900),
      delay: Phaser.Math.Between(180, 520),
      yoyo: true,
      ease: "Quad.Out",
    });
  }

  scene.time.delayedCall(hold, () => {
    if (!group.scene) return;
    scene.tweens.add({
      targets: group,
      alpha: 0,
      scaleY: 0.92,
      duration: 320,
      ease: "Quad.In",
      onComplete: () => group.destroy(),
    });
  });

  return group;
}

export function showSettingsPanel(scene) {
  if (scene.settingsLayer) return;
  const { width, height } = scene.scale;
  const current = readPlayerState();
  const pending = { ...current };
  const vibrationAvailable = isVibrationSupported();
  const backdrop = createModalBackdrop(scene, 9990);
  const layer = scene.add.container(0, 0).setDepth(10000);
  scene.settingsLayer = layer;

  const panelW = Math.min(514, width * 0.86);
  const panelH = 760;
  const px = width / 2;
  const py = height / 2;
  const panel = addPanel(scene, px, py, panelW, panelH, 10001);
  const title = scene.add.text(px, py - 250, t("settings.title", {}, current.language), {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: "28px",
    color: KUMA_COLORS.ink,
    fontStyle: "900",
  }).setOrigin(0.5).setDepth(10002);
  const divider = scene.add.rectangle(px, py - 210, panelW * 0.72, 2, 0xc69d72).setDepth(10002);
  layer.add([panel, title, divider]);

  const redraw = () => {
    controls?.destroy();
    title.setText(t("settings.title", {}, pending.language));
    controls = scene.add.container(0, 0).setDepth(10003);
    const langTitle = scene.add.text(px, py - 165, t("settings.language", {}, pending.language), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "28px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0.5);
    controls.add(langTitle);
    const langs = [
      { key: "ko", label: "한" },
      { key: "en", label: "En" },
      { key: "ja", label: "あ" },
    ];
    langs.forEach((lang, i) => {
      const x = px - 100 + i * 100;
      const selected = pending.language === lang.key;
      const box = scene.add.graphics();
      box.fillStyle(selected ? 0xfff1c8 : 0xfff8eb, 0.95);
      box.fillRoundedRect(x - 42, py - 123, 84, 58, 6);
      box.lineStyle(2, selected ? 0xd8a344 : 0xc69d72, 1);
      box.strokeRoundedRect(x - 42, py - 123, 84, 58, 6);
      box.setInteractive(new Phaser.Geom.Rectangle(x - 42, py - 123, 84, 58), Phaser.Geom.Rectangle.Contains);
      box.on("pointerdown", () => {
        playFeedback("ui");
        pending.language = lang.key;
        redraw();
      });
      const txt = scene.add.text(x, py - 94, lang.label, {
        fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
        fontSize: "24px",
        color: selected ? KUMA_COLORS.teal : "#876f58",
        fontStyle: "900",
      }).setOrigin(0.5);
      controls.add([box, txt]);
    });

    const makeToggle = (x, y, label, asset, value, onClick, enabled = true) => {
      const labelObj = scene.add.text(x, y - 48, label, {
        fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
        fontSize: "25px",
        color: KUMA_COLORS.ink,
        fontStyle: "800",
      }).setOrigin(0.5);
      const button = scene.add.image(x, y, `kuma_ui_${asset}_${value ? "on" : "off"}`)
        .setDisplaySize(64, 64).setDepth(10004);
      if (enabled) button.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
      else button.setAlpha(0.46);
      if (!enabled) {
        labelObj.setAlpha(0.52);
      }
      controls.add([labelObj, button]);
    };

    makeToggle(px - 110, py + 12, t("settings.sound", {}, pending.language), "btn_sound", pending.soundEnabled, () => {
      pending.soundEnabled = !pending.soundEnabled;
      if (pending.soundEnabled) {
        primeAudioFromGesture(true);
        playFeedback("ui", { forceSound: true, vibrate: false });
      }
      redraw();
    });
    makeToggle(px + 110, py + 12, t("settings.vibration", {}, pending.language), "btn_vibration", pending.vibrationEnabled !== false, () => {
      pending.vibrationEnabled = pending.vibrationEnabled === false;
      if (pending.vibrationEnabled) vibrateFeedback("success", true);
      redraw();
    }, vibrationAvailable);

    const sliderY = py + 137;
    const sliderLeft = px - 145;
    const sliderRight = px + 145;
    const volumeLabel = scene.add.text(sliderLeft, py + 90, t("settings.bgmVolume", {}, pending.language), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "23px",
      color: KUMA_COLORS.ink,
      fontStyle: "800",
    }).setOrigin(0, 0.5);
    const volumeValue = scene.add.text(sliderRight, py + 90, "", {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "22px",
      color: KUMA_COLORS.teal,
      fontStyle: "800",
    }).setOrigin(1, 0.5);
    const slider = scene.add.graphics();
    const sliderHit = scene.add.rectangle(px, sliderY, 330, 52, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const drawSlider = () => {
      const value = Math.min(1, Math.max(0, Number(pending.bgmVolume) || 0));
      const thumbX = Phaser.Math.Linear(sliderLeft, sliderRight, value);
      slider.clear();
      slider.lineStyle(10, 0xd8c6aa, 0.8);
      slider.beginPath();
      slider.moveTo(sliderLeft, sliderY);
      slider.lineTo(sliderRight, sliderY);
      slider.strokePath();
      if (value > 0) {
        slider.lineStyle(10, 0xd8a344, 1);
        slider.beginPath();
        slider.moveTo(sliderLeft, sliderY);
        slider.lineTo(thumbX, sliderY);
        slider.strokePath();
      }
      slider.fillStyle(0xfff6e5, 1);
      slider.fillCircle(thumbX, sliderY, 17);
      slider.lineStyle(4, 0xbd852b, 1);
      slider.strokeCircle(thumbX, sliderY, 17);
      volumeValue.setText(`${Math.round(value * 100)}%`);
    };
    const updateVolume = (pointerX) => {
      pending.bgmVolume = Phaser.Math.Clamp((pointerX - sliderLeft) / (sliderRight - sliderLeft), 0, 1);
      setMenuBgmVolume(pending.bgmVolume);
      drawSlider();
    };
    sliderHit.on("pointerdown", (pointer) => updateVolume(pointer.x));
    sliderHit.on("pointermove", (pointer) => {
      if (pointer.isDown) updateVolume(pointer.x);
    });
    drawSlider();
    controls.add([volumeLabel, volumeValue, slider, sliderHit]);

    const contact = scene.add.text(px, py + 195, t("settings.contact", {}, pending.language), {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: "22px",
      color: "#c49a74",
      fontStyle: "800",
    }).setOrigin(0.5);
    controls.add(contact);

    const cancel = addLargeTextButton(scene, px - 100, py + 260, t("common.cancel", {}, pending.language), "", () => close(false), {
      width: 180,
      height: 70,
      fontSize: 24,
      depth: 10004,
    });
    const apply = addLargeTextButton(scene, px + 100, py + 260, t("common.apply", {}, pending.language), "", () => close(true), {
      width: 180,
      height: 70,
      fontSize: 24,
      dark: true,
      depth: 10004,
    });
    controls.add([cancel.button, cancel.title, apply.button, apply.title]);
    layer.add(controls);
  };

  let finalized = false;
  let handleShutdown = null;
  const close = (apply) => {
    if (finalized) return;
    finalized = true;
    if (handleShutdown) scene.events.off(Phaser.Scenes.Events.SHUTDOWN, handleShutdown);
    const languageChanged = apply && current.language !== pending.language;
    if (apply) {
      writePlayerState(pending);
      scene.sound.mute = !pending.soundEnabled;
    }
    setMenuBgmVolume(apply ? pending.bgmVolume : current.bgmVolume);
    backdrop.cleanup();
    layer.destroy();
    scene.settingsLayer = null;
    if (languageChanged) {
      if (typeof scene.refreshLanguage === "function") scene.refreshLanguage();
      else scene.scene.restart();
    }
  };

  handleShutdown = () => close(false);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, handleShutdown);

  let controls = null;
  redraw();
}

export function showInstallGuide(scene, platform = "browser") {
  if (scene.installGuideLayer) return;
  const { width, height } = scene.scale;
  const language = readPlayerState().language;
  const px = width / 2;
  const py = height / 2;
  const backdrop = createModalBackdrop(scene, 9990);
  const layer = scene.add.container(0, 0).setDepth(10000);
  scene.installGuideLayer = layer;
  layer.add(addPanel(scene, px, py, Math.min(450, width * 0.84), 390, 10001));
  layer.add(scene.add.text(px, py - 112, t("install.title", {}, language), {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "28px",
    color: KUMA_COLORS.ink,
    fontStyle: "800",
  }).setOrigin(0.5).setDepth(10002));
  layer.add(scene.add.rectangle(px, py - 74, 300, 2, 0xc69d72).setDepth(10002));
  layer.add(scene.add.text(px, py + 4, t(platform === "ios" ? "install.ios" : "install.browser", {}, language), {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "22px",
    color: KUMA_COLORS.ink,
    fontStyle: "500",
    align: "center",
    lineSpacing: 9,
  }).setOrigin(0.5).setDepth(10002));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, close);
    backdrop.cleanup();
    layer.destroy();
    scene.installGuideLayer = null;
  };
  const confirm = addLargeTextButton(scene, px, py + 118, t("common.confirm", {}, language), "", close, {
    width: 190,
    height: 70,
    fontSize: 24,
    dark: true,
    depth: 10003,
  });
  layer.add([confirm.button, confirm.title]);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, close);
}
