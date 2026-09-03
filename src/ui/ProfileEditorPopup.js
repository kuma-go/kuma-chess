import {
  getProfileCosmeticCollection,
  purchaseProfileLoadout,
} from "../playerState.js?v=20260904-mobilefix102";
import {
  ensureProfileAssets,
  profileTextureKey,
} from "../profileCatalog.js?v=20260904-mobilefix102";
import {
  normalizeDisplayName,
  readProfileState,
  writeProfileState,
} from "../profileState.js?v=20260904-mobilefix102";
import {
  addLargeTextButton,
  addOutlinedTextButton,
  addPanel,
  createModalBackdrop,
  KUMA_COLORS,
  KUMA_FONT_SANS,
  showRewardLine,
} from "./KumaUi.js?v=20260904-mobilefix102";
import { showConfirm } from "./ConfirmPopup.js?v=20260904-mobilefix102";
import { addProfileAvatar } from "./ProfileAvatar.js?v=20260904-mobilefix102";

const GRID_COLUMNS = 4;
const GRID_ROW_HEIGHT = 148;
const LIST_HEIGHT = 510;

const COPY = {
  ko: {
    title: "프로필 변경", nickname: "닉네임", editName: "닉네임 변경",
    nameUnique: "닉네임은 다른 플레이어와 중복해서 사용할 수 없습니다.", portrait: "프로필 이미지", frame: "테두리",
    apply: "적용", noPurchase: "추가 구매 없음",
    purchaseSummary: "선택 {count}개 · 총 {cost}코인 · 구매 후 {remaining}코인",
    notEnough: "선택 {count}개 · 총 {cost}코인 · {shortage}코인 부족", cancel: "취소",
    purchaseTitle: "구매 확인", purchaseMessage: "선택한 프로필 항목 {count}개를 {cost}코인에 구매한 뒤 적용할까요?",
    purchaseBalance: "보유 {coins}코인 · 구매 후 {remaining}코인", purchase: "구매",
    nameTitle: "닉네임 변경", nameHint: "2~16자로 입력하세요.",
    nameInvalid: "닉네임은 2자 이상이어야 합니다.", nameChecking: "사용 가능한 닉네임인지 확인하고 있습니다.",
    nameTaken: "이미 사용 중인 닉네임입니다.", nameUnavailable: "서버 연결 후 닉네임을 변경할 수 있습니다.",
    nameChanged: "닉네임이 변경되었습니다.", profileChanged: "프로필이 변경되었습니다.",
    profilePurchased: "프로필 항목 {count}개를 구매하고 적용했습니다.", save: "저장",
  },
  en: {
    title: "Edit Profile", nickname: "Nickname", editName: "Change nickname",
    nameUnique: "Each nickname must be unique.", portrait: "Profile image", frame: "Frame",
    apply: "Apply", noPurchase: "No additional purchase",
    purchaseSummary: "{count} selected · {cost} coins · {remaining} left",
    notEnough: "{count} selected · {cost} coins · {shortage} short", cancel: "Cancel",
    purchaseTitle: "Confirm purchase", purchaseMessage: "Buy {count} selected profile item(s) for {cost} coins and apply them?",
    purchaseBalance: "You have {coins} coins · {remaining} left", purchase: "Buy",
    nameTitle: "Change nickname", nameHint: "Enter 2 to 16 characters.",
    nameInvalid: "Use at least 2 characters.", nameChecking: "Checking nickname availability...",
    nameTaken: "That nickname is already in use.", nameUnavailable: "Connect to the server to change your nickname.",
    nameChanged: "Nickname changed.", profileChanged: "Profile updated.",
    profilePurchased: "Purchased and applied {count} profile item(s).", save: "Save",
  },
  ja: {
    title: "プロフィール変更", nickname: "ニックネーム", editName: "名前を変更",
    nameUnique: "同じニックネームは使用できません。", portrait: "プロフィール画像", frame: "フレーム",
    apply: "適用", noPurchase: "追加購入なし",
    purchaseSummary: "{count}個選択 · 合計{cost}コイン · 残り{remaining}コイン",
    notEnough: "{count}個選択 · 合計{cost}コイン · {shortage}コイン不足", cancel: "キャンセル",
    purchaseTitle: "購入確認", purchaseMessage: "選択したプロフィールアイテム{count}個を{cost}コインで購入して適用しますか？",
    purchaseBalance: "所持{coins}コイン · 購入後{remaining}コイン", purchase: "購入",
    nameTitle: "ニックネーム変更", nameHint: "2～16文字で入力してください。",
    nameInvalid: "2文字以上入力してください。", nameChecking: "ニックネームを確認しています。",
    nameTaken: "そのニックネームは使用されています。", nameUnavailable: "サーバー接続後に変更できます。",
    nameChanged: "ニックネームを変更しました。", profileChanged: "プロフィールを変更しました。",
    profilePurchased: "プロフィール項目{count}個を購入して適用しました。", save: "保存",
  },
};

function format(text, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text,
  );
}

function addText(scene, layer, x, y, text, options = {}) {
  const label = scene.add.text(x, y, text, {
    fontFamily: KUMA_FONT_SANS,
    fontSize: `${options.size ?? 20}px`,
    color: options.color ?? KUMA_COLORS.ink,
    fontStyle: options.weight ?? "500",
    align: options.align ?? "left",
  }).setOrigin(options.originX ?? 0, options.originY ?? 0.5).setDepth(options.depth ?? 11004);
  layer.add(label);
  return label;
}

function cloudApi() {
  try {
    return window.parent?.KumaCloud || window.KumaCloud || null;
  } catch (_error) {
    return window.KumaCloud || null;
  }
}

function showNicknameDialog(initialValue, copy, onSave) {
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483000", "display:grid", "place-items:center",
    "padding:14px", "box-sizing:border-box", "background:rgba(43,33,24,.56)",
    "font-family:Pretendard,Apple SD Gothic Neo,sans-serif",
  ].join(";");
  const form = document.createElement("form");
  form.style.cssText = [
    "position:relative", "isolation:isolate", "width:min(620px,100%)", "min-height:380px",
    "box-sizing:border-box", "padding:82px clamp(24px,8vw,64px) 64px", "border:0", "background:transparent",
    "filter:drop-shadow(0 14px 22px rgba(42,28,15,.35))",
  ].join(";");
  const panelArt = document.createElement("div");
  panelArt.setAttribute("aria-hidden", "true");
  panelArt.style.cssText = "position:absolute;inset:0;z-index:0;pointer-events:none";
  const centerArt = document.createElement("img");
  centerArt.src = "./assets/kuma/ui/pop_3p_center.png";
  centerArt.alt = "";
  centerArt.style.cssText = "position:absolute;inset:76px 0 60px;width:100%;height:calc(100% - 136px);object-fit:fill";
  const topArt = document.createElement("img");
  topArt.src = "./assets/kuma/ui/pop_3p_top.png";
  topArt.alt = "";
  topArt.style.cssText = "position:absolute;top:0;left:0;width:100%;height:auto";
  const bottomArt = document.createElement("img");
  bottomArt.src = "./assets/kuma/ui/pop_3p_bottom.png";
  bottomArt.alt = "";
  bottomArt.style.cssText = "position:absolute;right:0;bottom:0;left:0;width:100%;height:auto";
  panelArt.append(centerArt, topArt, bottomArt);
  const title = document.createElement("h2");
  title.textContent = copy.nameTitle;
  title.style.cssText = "margin:0 0 28px;color:#352719;font-size:clamp(24px,7vw,30px);text-align:center;line-height:1.2";
  const input = document.createElement("input");
  input.type = "text";
  input.value = initialValue;
  input.maxLength = 16;
  input.autocomplete = "nickname";
  input.enterKeyHint = "done";
  input.setAttribute("aria-label", copy.nickname);
  input.style.cssText = [
    "width:100%", "height:62px", "box-sizing:border-box", "padding:0 18px", "border:3px solid #0a9db9",
    "border-radius:7px", "outline:none", "background:rgba(255,253,247,.88)", "color:#352719", "font:700 22px Pretendard,sans-serif",
  ].join(";");
  const hint = document.createElement("p");
  hint.textContent = copy.nameHint;
  hint.style.cssText = "min-height:24px;margin:12px 0 28px;color:#8e765f;font-size:17px";
  const actions = document.createElement("div");
  actions.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:10px";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = copy.cancel;
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = copy.save;
  for (const button of [cancel, save]) {
    button.style.cssText = "height:68px;border:0;border-radius:0;background-color:transparent;background-position:center;background-repeat:no-repeat;background-size:100% 100%;font:800 21px Pretendard,sans-serif;cursor:pointer";
  }
  cancel.style.backgroundImage = "url('./assets/kuma/ui/btn_pop_w_normal.png')";
  cancel.style.color = "#352719";
  save.style.backgroundImage = "url('./assets/kuma/ui/btn_pop_b_normal.png')";
  save.style.color = "#fff8dc";
  actions.append(cancel, save);
  for (const element of [title, input, hint, actions]) {
    element.style.position = "relative";
    element.style.zIndex = "1";
  }
  form.append(panelArt, title, input, hint, actions);
  overlay.append(form);
  document.body.append(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  cancel.addEventListener("click", close);
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) close();
  });
  let submitting = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    const value = normalizeDisplayName(input.value);
    if (value.length < 2) {
      hint.textContent = copy.nameInvalid;
      hint.style.color = "#b94d45";
      input.focus();
      return;
    }
    submitting = true;
    save.disabled = true;
    cancel.disabled = true;
    hint.textContent = copy.nameChecking;
    hint.style.color = "#8e765f";
    try {
      const result = await onSave(value);
      if (result?.ok !== false) {
        close();
        return;
      }
      hint.textContent = result?.reason === "duplicate" ? copy.nameTaken : copy.nameUnavailable;
      hint.style.color = "#b94d45";
      input.focus();
    } catch (_error) {
      hint.textContent = copy.nameUnavailable;
      hint.style.color = "#b94d45";
      input.focus();
    } finally {
      submitting = false;
      save.disabled = false;
      cancel.disabled = false;
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [input, cancel, save];
    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex].focus();
  });
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  return close;
}

export function showProfileEditorPopup(scene, options = {}) {
  if (scene.profileEditorLayer) return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "kuma-profile-editor-state", open: true }, window.location.origin);
  }
  const profile = readProfileState();
  const copy = COPY[profile.language] || COPY.ko;
  const draft = { ...profile, avatar: { ...profile.avatar } };
  let collection = getProfileCosmeticCollection();
  let activeType = "portrait";
  let scrollY = 0;
  let renderToken = 0;
  let renderedWindow = "";
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let closeNicknameDialog = null;
  let disposed = false;

  const backdrop = createModalBackdrop(scene, 10990, options.externalBackdrop
    ? { capture: false, dimAlpha: 0.001 }
    : undefined);
  const layer = scene.add.container(0, 0).setDepth(11000);
  scene.profileEditorLayer = layer;
  const px = scene.scale.width / 2;
  const py = scene.scale.height / 2;
  const panelW = Math.min(676, scene.scale.width - 24);
  const panelH = Math.min(1130, scene.scale.height - 34);
  const panelTop = py - panelH / 2;
  layer.add(addPanel(scene, px, py, panelW, panelH, 11001));

  addText(scene, layer, px, panelTop + 100, copy.title, { size: 34, weight: "900", originX: 0.5 });
  layer.add(scene.add.rectangle(px, panelTop + 145, panelW * 0.72, 2, 0xc69d72).setDepth(11003));

  const avatar = addProfileAvatar(scene, layer, px - 180, panelTop + 235, draft, {
    size: 148, maxFrameScale: 1.32, depth: 11004,
  });
  addText(scene, layer, px - 72, panelTop + 181, copy.nickname, { size: 18, color: "#8e765f", weight: "700" });
  const nickname = addText(scene, layer, px - 72, panelTop + 216, draft.displayName, {
    size: draft.displayName.length > 12 ? 22 : 28, color: KUMA_COLORS.teal, weight: "800",
  });
  const nameButton = addOutlinedTextButton(scene, px + 101, panelTop + 277, copy.editName, () => {
    closeNicknameDialog?.();
    closeNicknameDialog = showNicknameDialog(draft.displayName, copy, async (value) => {
      const previousName = draft.displayName;
      if (value === previousName) return { ok: true };
      const api = cloudApi();
      if (!api?.reserveNickname) return { ok: false, reason: "offline" };
      const result = await api.reserveNickname(value, previousName);
      if (!result?.ok) return result || { ok: false, reason: "offline" };
      if (disposed || !layer.scene) return { ok: false, reason: "closed" };
      draft.displayName = value;
      const savedProfile = readProfileState();
      writeProfileState({ ...savedProfile, displayName: value });
      nickname.setText(value).setFontSize(value.length > 12 ? 23 : 27);
      showRewardLine(scene, copy.nameChanged, {
        y: scene.scale.height * 0.52, hold: 1800, depth: 13000, showCoin: false,
      });
      return { ok: true };
    });
  }, { width: 342, height: 62, fontSize: 21, depth: 11004 });
  layer.add([nameButton.button, nameButton.title]);
  addText(scene, layer, px - 70, panelTop + 322, copy.nameUnique, {
    size: profile.language === "en" ? 12 : 13, color: "#a48769", weight: "600",
  });

  const tabY = panelTop + 378;
  const tabContainer = scene.add.container(0, 0).setDepth(11004);
  layer.add(tabContainer);
  const listTop = panelTop + 434;
  const listWidth = Math.min(568, panelW - 76);
  const listHit = scene.add.rectangle(px, listTop + LIST_HEIGHT / 2, listWidth, LIST_HEIGHT, 0xffffff, 0.001)
    .setDepth(11003).setInteractive({ useHandCursor: true });
  layer.add(listHit);
  const listLayer = scene.add.container(0, listTop).setDepth(11004);
  const grid = scene.add.container(0, 0);
  let tileHits = [];
  listLayer.add(grid);
  layer.add(listLayer);

  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(px - listWidth / 2, listTop, listWidth, LIST_HEIGHT);
  const listMask = maskShape.createGeometryMask();
  listLayer.setMask(listMask);
  const scrollTrack = scene.add.rectangle(px + listWidth / 2 + 6, listTop + LIST_HEIGHT / 2, 4, LIST_HEIGHT, 0xc9af91, 0.34)
    .setDepth(11005);
  const scrollThumb = scene.add.rectangle(px + listWidth / 2 + 6, listTop + 35, 5, 70, 0xa98764, 0.78)
    .setDepth(11006);
  layer.add([scrollTrack, scrollThumb]);

  const loading = addText(scene, layer, px, listTop + LIST_HEIGHT / 2, "...", {
    size: 24, color: "#a48665", weight: "800", originX: 0.5,
  }).setVisible(false);
  const purchaseSummary = addText(scene, layer, px, panelTop + 975, "", {
    size: 16, color: "#80684f", weight: "700", originX: 0.5,
  });

  function currentItems() {
    const source = activeType === "frame" ? collection.frames : collection.portraits;
    return source.map((item, index) => ({ ...item, catalogIndex: index }))
      .sort((a, b) => Number(b.owned) - Number(a.owned) || a.catalogIndex - b.catalogIndex);
  }

  function selectedId(type = activeType) {
    return draft.avatar[type === "frame" ? "frameId" : "portraitId"];
  }

  function selectedItem(type) {
    const items = type === "frame" ? collection.frames : collection.portraits;
    return items.find((item) => item.id === selectedId(type));
  }

  function pendingItems() {
    return [selectedItem("portrait"), selectedItem("frame")]
      .filter((item) => item && !item.owned);
  }

  let applyButton = null;
  function updatePurchaseSummary() {
    const items = pendingItems();
    const cost = items.reduce((total, item) => total + item.cost, 0);
    const coins = collection.coins;
    const shortage = Math.max(0, cost - coins);
    if (!cost) {
      purchaseSummary.setText(copy.noPurchase).setColor("#80684f");
    } else if (shortage) {
      purchaseSummary.setText(format(copy.notEnough, {
        count: items.length, cost, shortage,
      })).setColor("#b94d45");
    } else {
      purchaseSummary.setText(format(copy.purchaseSummary, {
        count: items.length, cost, remaining: coins - cost,
      })).setColor("#80684f");
    }
    if (applyButton) {
      applyButton.title.setText(copy.apply).setAlpha(shortage ? 0.58 : 1);
      applyButton.button.setEnabled(!shortage);
    }
  }

  function chooseItem(item) {
    draft.avatar[activeType === "frame" ? "frameId" : "portraitId"] = item.id;
    avatar.setProfile(draft);
    renderedWindow = "";
    updatePurchaseSummary();
    renderVisible();
  }

  function maxScroll() {
    const rows = Math.ceil(currentItems().length / GRID_COLUMNS);
    return Math.max(0, rows * GRID_ROW_HEIGHT - LIST_HEIGHT);
  }

  function updateScrollThumb() {
    const maximum = maxScroll();
    const totalHeight = LIST_HEIGHT + maximum;
    const thumbHeight = Math.max(56, LIST_HEIGHT * (LIST_HEIGHT / totalHeight));
    const travel = LIST_HEIGHT - thumbHeight;
    const ratio = maximum ? scrollY / maximum : 0;
    scrollThumb.setSize(5, thumbHeight).setDisplaySize(5, thumbHeight);
    scrollThumb.y = listTop + thumbHeight / 2 + travel * ratio;
    scrollTrack.setVisible(maximum > 0);
    scrollThumb.setVisible(maximum > 0);
  }

  function setScroll(next, force = false) {
    scrollY = Phaser.Math.Clamp(next, 0, maxScroll());
    grid.y = -scrollY;
    updateTileInputs();
    updateScrollThumb();
    const firstRow = Math.max(0, Math.floor(scrollY / GRID_ROW_HEIGHT) - 1);
    const lastRow = Math.ceil((scrollY + LIST_HEIGHT) / GRID_ROW_HEIGHT) + 1;
    const key = `${activeType}:${firstRow}:${lastRow}`;
    if (force || key !== renderedWindow) {
      renderedWindow = key;
      renderVisible(firstRow, lastRow);
    }
  }

  function updateTileInputs() {
    tileHits.forEach((hit) => {
      const screenY = listTop + grid.y + hit.y;
      const visible = screenY >= listTop && screenY <= listTop + LIST_HEIGHT;
      if (visible && !hit.input?.enabled) hit.setInteractive({ useHandCursor: true });
      if (!visible && hit.input?.enabled) hit.disableInteractive();
    });
  }

  async function renderVisible(startRow, endRow) {
    const token = ++renderToken;
    const items = currentItems();
    const firstRow = startRow ?? Math.max(0, Math.floor(scrollY / GRID_ROW_HEIGHT) - 1);
    const lastRow = endRow ?? Math.ceil((scrollY + LIST_HEIGHT) / GRID_ROW_HEIGHT) + 1;
    const firstIndex = firstRow * GRID_COLUMNS;
    const visible = items.slice(firstIndex, Math.min(items.length, lastRow * GRID_COLUMNS));
    grid.removeAll(true);
    tileHits = [];
    loading.setVisible(true);
    await ensureProfileAssets(scene, visible);
    if (token !== renderToken || !layer.scene) return;
    loading.setVisible(false);

    visible.forEach((item, visibleIndex) => {
      const absoluteIndex = firstIndex + visibleIndex;
      const col = absoluteIndex % GRID_COLUMNS;
      const row = Math.floor(absoluteIndex / GRID_COLUMNS);
      const x = px - 195 + col * 130;
      const y = row * GRID_ROW_HEIGHT + 68;
      const isSelected = item.id === selectedId();
      grid.add(scene.add.circle(x, y, 55, 0xfffaf0, activeType === "portrait" ? 0.96 : 0.3)
        .setStrokeStyle(2, 0xd2b58d, 1));
      if (isSelected && activeType === "frame") {
        grid.add(scene.add.circle(x, y, 63, 0xffffff, 0)
          .setStrokeStyle(4, 0x08a0bd, 1));
      }
      if (activeType === "frame") {
        if (scene.textures.exists(profileTextureKey(item))) {
          const key = profileTextureKey(item);
          const source = scene.textures.get(key).getSourceImage();
          const fitScale = Math.min(116 / source.width, 116 / source.height);
          grid.add(scene.add.image(x, y, key).setScale(fitScale));
        }
      } else if (scene.textures.exists(profileTextureKey(item))) {
        grid.add(scene.add.image(x, y, profileTextureKey(item)).setDisplaySize(104, 104));
      }
      if (!item.owned) {
        grid.add(scene.add.circle(x, y, 52, 0x2c2118, isSelected ? 0.28 : 0.42));
        grid.add(scene.add.image(x - 13, y + 61, "kuma_ui_coin_small").setDisplaySize(19, 19));
        grid.add(scene.add.text(x + 1, y + 61, String(item.cost), {
          fontFamily: KUMA_FONT_SANS, fontSize: "15px", color: KUMA_COLORS.ink, fontStyle: "800",
        }).setOrigin(0, 0.5));
      }
      if (isSelected && activeType !== "frame") {
        grid.add(scene.add.circle(x, y, 55, 0xffffff, 0)
          .setStrokeStyle(5, 0x08a0bd, 1));
      }
      const tileHit = scene.add.circle(x, y, 62, 0xffffff, 0.001);
      let downY = 0;
      tileHit.on("pointerdown", (pointer) => { downY = pointer.y; });
      tileHit.on("pointerup", (pointer) => {
        if (Math.abs(pointer.y - downY) <= 8) chooseItem(item);
      });
      tileHits.push(tileHit);
      grid.add(tileHit);
    });
    updateTileInputs();
  }

  function jumpToSelected() {
    const items = currentItems();
    const index = Math.max(0, items.findIndex((item) => item.id === selectedId()));
    const row = Math.floor(index / GRID_COLUMNS);
    setScroll(Math.max(0, row * GRID_ROW_HEIGHT - GRID_ROW_HEIGHT), true);
  }

  function renderTabs() {
    tabContainer.removeAll(true);
    [{ type: "portrait", label: copy.portrait }, { type: "frame", label: copy.frame }]
      .forEach((tab, index) => {
        const x = px + (index ? 153 : -153);
        const selected = activeType === tab.type;
        const bg = scene.add.nineslice(
          x,
          tabY,
          selected ? "kuma_ui_btn_tab_on" : "kuma_ui_btn_tab_off",
          null,
          286,
          64,
          24,
          24,
          0,
          0,
        )
          .setInteractive({ useHandCursor: true });
        const label = scene.add.text(x, tabY, tab.label, {
          fontFamily: KUMA_FONT_SANS, fontSize: "22px",
          color: selected ? "#0099b8" : "#715a43", fontStyle: "800",
        }).setOrigin(0.5);
        bg.on("pointerdown", () => {
          if (activeType === tab.type) return;
          activeType = tab.type;
          renderedWindow = "";
          renderTabs();
          jumpToSelected();
        });
        tabContainer.add([bg, label]);
      });
  }

  const onWheel = (pointer, gameObjects, deltaX, deltaY) => {
    if (pointer.x >= px - listWidth / 2 && pointer.x <= px + listWidth / 2
      && pointer.y >= listTop && pointer.y <= listTop + LIST_HEIGHT) {
      setScroll(scrollY + deltaY * 0.45);
    }
  };
  const onPointerDown = (pointer) => {
    if (pointer.x < px - listWidth / 2 || pointer.x > px + listWidth / 2
      || pointer.y < listTop || pointer.y > listTop + LIST_HEIGHT) return;
    dragging = true;
    dragStartY = pointer.y;
    dragStartScroll = scrollY;
  };
  const onPointerMove = (pointer) => {
    if (dragging && pointer.isDown) setScroll(dragStartScroll - (pointer.y - dragStartY));
  };
  const onPointerUp = () => { dragging = false; };
  scene.input.on("wheel", onWheel);
  scene.input.on("pointerdown", onPointerDown);
  scene.input.on("pointermove", onPointerMove);
  scene.input.on("pointerup", onPointerUp);

  const dispose = (invokeCallback = true) => {
    if (disposed) return;
    disposed = true;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "kuma-profile-editor-state", open: false }, window.location.origin);
    }
    renderToken += 1;
    closeNicknameDialog?.();
    closeNicknameDialog = null;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.input.off("wheel", onWheel);
    scene.input.off("pointerdown", onPointerDown);
    scene.input.off("pointermove", onPointerMove);
    scene.input.off("pointerup", onPointerUp);
    if (listLayer.scene) listLayer.clearMask(false);
    listMask?.destroy();
    maskShape?.destroy();
    backdrop.cleanup();
    if (layer.scene) layer.destroy();
    scene.profileEditorLayer = null;
    if (invokeCallback) options.onClose?.();
  };
  const onShutdown = () => dispose(false);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  const close = () => dispose(true);
  const closeWithMessage = (message, lineOptions = {}) => {
    dispose(false);
    showRewardLine(scene, message, {
      y: scene.scale.height * 0.52,
      hold: 1800,
      depth: 13000,
      ...lineOptions,
    });
    scene.time.delayedCall((lineOptions.hold || 1800) + 180, () => options.onClose?.());
  };
  const cancel = addLargeTextButton(scene, px - 158, panelTop + 1045, copy.cancel, "", close, {
    width: 286, height: 80, fontSize: 26, depth: 11004,
  });
  applyButton = addLargeTextButton(scene, px + 158, panelTop + 1045, copy.apply, "", () => {
    const items = pendingItems();
    const cost = items.reduce((total, item) => total + item.cost, 0);
    if (!cost) {
      const avatarChanged = draft.avatar.portraitId !== profile.avatar.portraitId
        || draft.avatar.frameId !== profile.avatar.frameId;
      writeProfileState(draft);
      if (avatarChanged) {
        closeWithMessage(copy.profileChanged, { showCoin: false });
      } else {
        close();
      }
      return;
    }
    if (collection.coins < cost) {
      updatePurchaseSummary();
      return;
    }
    showConfirm(scene, {
      title: copy.purchaseTitle,
      message: `${format(copy.purchaseMessage, { count: items.length, cost })}\n${format(copy.purchaseBalance, {
        coins: collection.coins,
        remaining: collection.coins - cost,
      })}`,
      confirmText: copy.purchase,
      cancelText: copy.cancel,
      depth: 12000,
      onConfirm: () => {
        const result = purchaseProfileLoadout(draft.avatar.portraitId, draft.avatar.frameId);
        collection = getProfileCosmeticCollection();
        if (!result.ok) {
          updatePurchaseSummary();
          return;
        }
        writeProfileState(draft);
        closeWithMessage(format(copy.profilePurchased, { count: result.items.length }), { hold: 2100 });
      },
    });
  }, {
    width: 286, height: 80, fontSize: profile.language === "en" ? 19 : 23, dark: true, depth: 11004,
  });
  layer.add([cancel.button, cancel.title, applyButton.button, applyButton.title]);

  renderTabs();
  jumpToSelected();
  updatePurchaseSummary();
}
