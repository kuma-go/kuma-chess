import {
  ensureProfileAssets,
  getProfileFrame,
  getProfilePortrait,
  profileTextureKey,
} from "../profileCatalog.js?v=20260903-online93";

export function addProfileAvatar(scene, parent, x, y, profile, options = {}) {
  const size = options.size ?? 130;
  const depth = options.depth ?? 10004;
  const container = scene.add.container(x, y).setDepth(depth);
  const fallback = scene.add.circle(0, 0, size * 0.46, 0xe9d5b4, 1);
  const fallbackRing = scene.add.circle(0, 0, size * 0.51, 0xffffff, 0)
    .setStrokeStyle(Math.max(2, size * 0.025), 0xc69245, 0.8);
  container.add([fallback, fallbackRing]);
  parent?.add(container);

  let renderToken = 0;
  let portraitImage = null;
  let frameImage = null;

  const setProfile = (nextProfile) => {
    const token = ++renderToken;
    const avatar = nextProfile?.avatar || nextProfile || {};
    const portrait = getProfilePortrait(avatar.portraitId);
    const frame = getProfileFrame(avatar.frameId);
    portraitImage?.destroy();
    frameImage?.destroy();
    portraitImage = null;
    frameImage = null;
    fallback.setVisible(true);
    fallbackRing.setVisible(true);

    ensureProfileAssets(scene, [portrait, frame]).then(() => {
      if (token !== renderToken || !container.scene) return;
      if (scene.textures.exists(profileTextureKey(portrait))) {
        portraitImage = scene.add.image(0, 0, profileTextureKey(portrait))
          .setDisplaySize(size, size);
        container.addAt(portraitImage, 0);
        fallback.setVisible(false);
      }
      if (scene.textures.exists(profileTextureKey(frame))) {
        const frameScale = Math.min(frame.displayScale, options.maxFrameScale ?? Number.POSITIVE_INFINITY);
        frameImage = scene.add.image(0, 0, profileTextureKey(frame))
          .setDisplaySize(size * frameScale, size * frameScale);
        container.add(frameImage);
        fallbackRing.setVisible(false);
      }
    });
  };

  setProfile(profile);
  return { container, setProfile };
}
