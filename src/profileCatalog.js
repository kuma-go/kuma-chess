const PROFILE_ASSET_ROOT = "assets/kuma/ui/profile/";
const PROFILE_ASSET_VERSION = "20260903-onlinefix100";

export const DEFAULT_PROFILE_PORTRAIT_ID = "portrait-basic-01";
export const DEFAULT_PROFILE_FRAME_ID = "frame-basic-01";
export const PROFILE_PORTRAIT_PRICE = 60;

function numberedItems(count, create) {
  return Array.from({ length: count }, (_, index) => create(index + 1));
}

function portrait(id, fileName, cost = PROFILE_PORTRAIT_PRICE) {
  return Object.freeze({ id, fileName, cost, type: "portrait" });
}

function frame(id, fileName, cost, displayScale = 136 / 130) {
  return Object.freeze({ id, fileName, cost, displayScale, type: "frame" });
}

const defaultPortraits = numberedItems(8, (number) => portrait(
  `portrait-basic-${String(number).padStart(2, "0")}`,
  `프로필_기본_${String(number).padStart(2, "0")}.png`,
  0,
));

const numberedPortraits = Array.from({ length: 186 }, (_, index) => 79 + index)
  .filter((number) => ![113, 263].includes(number))
  .map((number) => portrait(`portrait-${number}`, `Frame ${number}.png`));

const alternatePortraits = Array.from({ length: 7 }, (_, index) => 82 + index)
  .map((number) => portrait(`portrait-${number}-alt`, `Frame ${number}-1.png`));

export const PROFILE_PORTRAITS = Object.freeze([
  ...defaultPortraits,
  ...numberedPortraits,
  ...alternatePortraits,
]);

export const PROFILE_FRAMES = Object.freeze([
  ...numberedItems(4, (number) => frame(
    `frame-basic-${String(number).padStart(2, "0")}`,
    `프로필_테두리_기본_${String(number).padStart(2, "0")}.png`,
    0,
  )),
  ...[174, 166, 174, 200, 176, 174].map((pixels, index) => frame(
    `frame-a-${String(index + 1).padStart(2, "0")}`,
    `프로필_테두리_A_${String(index + 1).padStart(2, "0")}.png`,
    150,
    pixels / 130,
  )),
  ...[168, 190, 174, 214].map((pixels, index) => frame(
    `frame-b-${String(index + 1).padStart(2, "0")}`,
    `프로필_테두리_B_${String(index + 1).padStart(2, "0")}.png`,
    300,
    pixels / 130,
  )),
  frame("frame-c", "프로필_테두리_C.png", 500, 224 / 130),
]);

const PORTRAIT_BY_ID = new Map(PROFILE_PORTRAITS.map((item) => [item.id, item]));
const FRAME_BY_ID = new Map(PROFILE_FRAMES.map((item) => [item.id, item]));

export const FREE_PROFILE_PORTRAIT_IDS = Object.freeze(
  PROFILE_PORTRAITS.filter((item) => item.cost === 0).map((item) => item.id),
);
export const FREE_PROFILE_FRAME_IDS = Object.freeze(
  PROFILE_FRAMES.filter((item) => item.cost === 0).map((item) => item.id),
);

export function getProfilePortrait(id) {
  const migratedId = id === "portrait-hourglass" ? "portrait-180" : id;
  return PORTRAIT_BY_ID.get(migratedId) || PORTRAIT_BY_ID.get(DEFAULT_PROFILE_PORTRAIT_ID);
}

export function getProfileFrame(id) {
  return FRAME_BY_ID.get(id) || FRAME_BY_ID.get(DEFAULT_PROFILE_FRAME_ID);
}

export function getProfileCosmetic(type, id) {
  return type === "frame" ? FRAME_BY_ID.get(id) : PORTRAIT_BY_ID.get(id);
}

export function profileAssetUrl(item) {
  return `${PROFILE_ASSET_ROOT}${encodeURIComponent(item.fileName)}?v=${PROFILE_ASSET_VERSION}`;
}

export function profileTextureKey(item) {
  return `kuma_profile_${item.id.replace(/[^a-z0-9_-]/gi, "_")}`;
}

export function ensureProfileAssets(scene, items) {
  const pending = Array.from(new Map(
    (Array.isArray(items) ? items : [items])
      .filter(Boolean)
      .map((item) => [item.id, item]),
  ).values()).filter((item) => !scene.textures.exists(profileTextureKey(item)));
  if (!pending.length) return Promise.resolve();

  return new Promise((resolve) => {
    for (const item of pending) {
      const key = profileTextureKey(item);
      scene.load.image(key, profileAssetUrl(item));
    }
    scene.load.once("complete", resolve);
    if (!scene.load.isLoading()) scene.load.start();
  });
}
