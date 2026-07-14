import { SpriteButton } from "./SpriteButton.js";
import { t as translate } from "../i18n.js?v=20260714-layout22";
import { createModalBackdrop, KUMA_FONT_SANS } from "./KumaUi.js?v=20260714-layout22";

/**
 * 공용 Confirm Popup
 * - 9-slice 패널 + dim 배경 + 확인/취소
 * - onConfirm/onCancel 콜백
 * - 항상 최상단(depth 10000)으로 떠서 입력을 가로챔
 */
export function showConfirm(scene, opts) {
  const {
    themeId,
    title = translate("common.confirm"),
    message = "",
    confirmText = translate("common.confirm"),
    cancelText = translate("common.cancel"),
    onConfirm,
    onCancel,
  } = opts;

  const { width, height } = scene.scale;

  const backdrop = createModalBackdrop(scene, 9990);
  const layer = scene.add.container(0, 0).setDepth(10000);

  const panelW = Math.min(514, width * 0.86);
  const panelH = 447;
  const px = width / 2;
  const py = height / 2;

  const panel = scene.add.image(px, py, "kuma_ui_popup").setDisplaySize(panelW, panelH);
  layer.add(panel);

  const t = scene.add.text(px, py - 110, title, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "28px",
    color: "#352719",
    fontStyle: "900",
  }).setOrigin(0.5);
  layer.add(t);

  const msg = scene.add.text(px, py - 20, message, {
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
    fontSize: "18px",
    color: "#352719",
    fontStyle: "500",
    align: "center",
    lineSpacing: 6,
    wordWrap: { width: panelW * 0.82 },
  }).setOrigin(0.5);
  layer.add(msg);

  const btnY = py + 143;

  const leftX = px - 105;
  const rightX = px + 105;

  const cancelBtn = new SpriteButton(scene, leftX, btnY, {
    normal: "kuma_ui_btn_pop_w_normal",
    hover: "kuma_ui_btn_pop_w_normal",
    pressed: "kuma_ui_btn_pop_w_normal",
  }, () => {
    backdrop.cleanup();
    layer.destroy();
    if (onCancel) onCancel();
  }).setScaleTo(187, 81);
  layer.add(cancelBtn);

  const cancelLabel = scene.add.text(leftX, btnY, cancelText, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "22px",
    color: "#0b1020",
    fontStyle: "700",
  }).setOrigin(0.5);
  layer.add(cancelLabel);

  const okBtn = new SpriteButton(scene, rightX, btnY, {
    normal: "kuma_ui_btn_pop_b_normal",
    hover: "kuma_ui_btn_pop_b_normal",
    pressed: "kuma_ui_btn_pop_b_normal",
  }, () => {
    backdrop.cleanup();
    layer.destroy();
    if (onConfirm) onConfirm();
  }).setScaleTo(195, 81);
  layer.add(okBtn);

  const okLabel = scene.add.text(rightX, btnY, confirmText, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: "22px",
    color: "#fff8dc",
    fontStyle: "700",
  }).setOrigin(0.5);
  layer.add(okLabel);

  // esc로 닫기(데스크탑)
  const esc = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  if (esc) {
    esc.once("down", () => {
      if (!layer.scene) return;
      backdrop.cleanup();
      layer.destroy();
      if (onCancel) onCancel();
    });
  }

  return layer;
}
