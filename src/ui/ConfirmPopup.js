import { t as translate } from "../i18n.js?v=20260902-frame86";
import {
  addLargeTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_FONT_SANS,
} from "./KumaUi.js?v=20260902-frame86";

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
    depth = 10000,
  } = opts;

  const { width, height } = scene.scale;

  const backdrop = createModalBackdrop(scene, depth - 10);
  const layer = scene.add.container(0, 0).setDepth(depth);

  const panelW = Math.min(514, width * 0.86);
  const panelH = 447;
  const px = width / 2;
  const py = height / 2;

  const panel = addPanel(scene, px, py, panelW, panelH, depth + 1);
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

  let closed = false;
  const close = (confirmed) => {
    if (closed) return;
    closed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    backdrop.cleanup();
    if (layer.scene) layer.destroy();
    if (confirmed) onConfirm?.();
    else onCancel?.();
  };
  const onShutdown = () => close(false);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

  const cancel = addLargeTextButton(scene, leftX, btnY, cancelText, "", () => close(false), {
    width: 187, height: 81, fontSize: 22, depth: depth + 2,
  });
  const confirm = addLargeTextButton(scene, rightX, btnY, confirmText, "", () => close(true), {
    width: 195, height: 81, fontSize: 22, dark: true, depth: depth + 2,
  });
  layer.add([cancel.button, cancel.title, confirm.button, confirm.title]);

  // esc로 닫기(데스크탑)
  const esc = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  if (esc) {
    esc.once("down", () => {
      if (!layer.scene) return;
      close(false);
    });
  }

  return layer;
}
