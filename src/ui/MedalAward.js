import { getMedalEntries, medalTextureKey } from "../medals.js?v=20260720-puzzles100hint37";
import { readPlayerState } from "../playerState.js?v=20260720-puzzles100hint37";
import { playFeedback } from "../feedback.js?v=20260720-puzzles100hint37";
import { KUMA_FONT_SANS } from "./KumaUi.js?v=20260720-puzzles100hint37";

const UI_ROOT = "assets/kuma/ui/";
const NORMAL_TIMING = Object.freeze({ gather: 1040, settle: 430, exit: 240 });
const REDUCED_TIMING = Object.freeze({ gather: 160, settle: 120, exit: 100 });

function resolvedEntries(items) {
  const all = getMedalEntries(readPlayerState().language || "ko");
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  return (Array.isArray(items) ? items : [])
    .map((item) => (typeof item === "string" ? byId.get(item) : byId.get(item?.id) || item))
    .filter(Boolean);
}

function medalCopy() {
  const language = readPlayerState().language;
  if (language === "en") return "MEDAL ACQUIRED";
  if (language === "ja") return "メダル獲得";
  return "메달 획득";
}

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureTexture(scene, entry) {
  const key = medalTextureKey(entry.id);
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise((resolve) => {
    const onComplete = () => {
      cleanup();
      resolve(key);
    };
    const onError = (file) => {
      if (file?.key !== key) return;
      cleanup();
      resolve(null);
    };
    const cleanup = () => {
      scene.load.off(`filecomplete-image-${key}`, onComplete);
      scene.load.off("loaderror", onError);
    };
    scene.load.once(`filecomplete-image-${key}`, onComplete);
    scene.load.on("loaderror", onError);
    scene.load.image(key, `${UI_ROOT}${entry.asset}`);
    scene.load.start();
  });
}

function showOne(scene, entry, key, options = {}) {
  return new Promise((resolve) => {
    if (!scene.scene?.isActive()) {
      resolve();
      return;
    }

    const { width, height } = scene.scale;
    const centerX = width / 2;
    const centerY = options.y ?? height * 0.46;
    const reducedMotion = prefersReducedMotion();
    const timing = reducedMotion ? REDUCED_TIMING : NORMAL_TIMING;
    const revealAt = timing.gather;
    const readyAt = revealAt + timing.settle;
    const layer = scene.add.container(0, 0).setDepth(24000);
    const timers = [];
    let ready = false;
    let finished = false;
    let settled = false;

    const backdrop = scene.add.rectangle(0, 0, width, height, 0x160f0a, 0.82)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const stageBand = scene.add.rectangle(centerX, centerY + 32, width, 510, 0x2a1d12, 0.76);
    const topEdge = scene.add.rectangle(centerX, centerY - 223, width, 2, 0xd9a746, 0.62);
    const bottomEdge = scene.add.rectangle(centerX, centerY + 287, width, 2, 0xd9a746, 0.38);
    const core = scene.add.rectangle(centerX, centerY - 44, 12, 12, 0xfff0ad, 1)
      .setAngle(45)
      .setAlpha(0);
    const art = key
      ? scene.add.image(centerX, centerY - 44, key).setDisplaySize(220, 258)
      : scene.add.rectangle(centerX, centerY - 44, 184, 225, 0xdba64d, 1)
        .setStrokeStyle(4, 0xffe8a7, 1);
    art.setAlpha(0);

    const label = scene.add.text(centerX, centerY + 106, medalCopy(), {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "19px",
      color: "#ffe19a",
      fontStyle: "700",
    }).setOrigin(0.5).setAlpha(0);
    const title = scene.add.text(centerX, centerY + 150, entry.name, {
      fontFamily: KUMA_FONT_SANS,
      fontSize: "32px",
      color: "#fff8df",
      fontStyle: "700",
      align: "center",
      wordWrap: { width: Math.min(width - 80, 560), useAdvancedWrap: true },
    }).setOrigin(0.5).setAlpha(0);
    const counter = options.total > 1
      ? scene.add.text(centerX, centerY + 202, `${options.index + 1} / ${options.total}`, {
          fontFamily: KUMA_FONT_SANS,
          fontSize: "17px",
          color: "#cdbb9d",
          fontStyle: "600",
        }).setOrigin(0.5).setAlpha(0)
      : null;

    const content = [art, label, title];
    if (counter) content.push(counter);
    layer.add([backdrop, stageBand, topEdge, bottomEdge, core, ...content]);

    const schedule = (delay, callback) => {
      const timer = scene.time.delayedCall(delay, callback);
      timers.push(timer);
      return timer;
    };

    const gatheringSparks = [];
    const burstSparks = [];
    const colors = [0xffd86b, 0xfff1b3, 0xd99432, 0xffffff, 0xe86f3c];
    const gatherCount = reducedMotion ? 10 : 34;
    const burstCount = reducedMotion ? 14 : 42;

    for (let index = 0; index < gatherCount; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(175, 330);
      const spark = scene.add.rectangle(
        centerX + Math.cos(angle) * distance,
        centerY - 44 + Math.sin(angle) * distance * 0.68,
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(2, 5),
        colors[index % colors.length],
        1
      ).setAngle(Phaser.Math.Between(0, 180)).setAlpha(reducedMotion ? 0.45 : 0);
      gatheringSparks.push(spark);
      layer.add(spark);

      if (!reducedMotion) {
        scene.tweens.add({
          targets: spark,
          x: centerX + Phaser.Math.Between(-8, 8),
          y: centerY - 44 + Phaser.Math.Between(-8, 8),
          alpha: { from: 0, to: 1 },
          angle: spark.angle + Phaser.Math.Between(180, 480),
          duration: Phaser.Math.Between(620, 900),
          delay: Phaser.Math.Between(40, 180),
          ease: "Cubic.In",
        });
      }
    }

    for (let index = 0; index < burstCount; index += 1) {
      const angle = (Math.PI * 2 * index) / burstCount + Phaser.Math.FloatBetween(-0.09, 0.09);
      const reducedDistance = reducedMotion ? Phaser.Math.Between(24, 76) : 0;
      const spark = scene.add.rectangle(
        centerX + Math.cos(angle) * reducedDistance,
        centerY - 44 + Math.sin(angle) * reducedDistance * 0.72,
        Phaser.Math.Between(6, 15),
        Phaser.Math.Between(2, 5),
        colors[index % colors.length],
        1
      ).setAngle(Phaser.Math.Between(0, 180)).setAlpha(0);
      burstSparks.push(spark);
      layer.add(spark);

      if (!reducedMotion) {
        const distance = Phaser.Math.Between(130, 300);
        scene.tweens.add({
          targets: spark,
          x: centerX + Math.cos(angle) * distance,
          y: centerY - 44 + Math.sin(angle) * distance * 0.72,
          alpha: { from: 1, to: 0 },
          angle: spark.angle + Phaser.Math.Between(180, 620),
          duration: Phaser.Math.Between(620, 980),
          delay: revealAt,
          ease: "Cubic.Out",
        });
      }
    }

    if (reducedMotion) {
      scene.tweens.add({
        targets: gatheringSparks,
        alpha: 0,
        duration: timing.gather,
        ease: "Linear",
      });
      scene.tweens.add({
        targets: burstSparks,
        alpha: { from: 0.7, to: 0 },
        duration: timing.settle,
        delay: revealAt,
        ease: "Linear",
      });
    }

    scene.tweens.add({
      targets: core,
      alpha: { from: 0, to: 1 },
      scaleX: reducedMotion ? 1 : 2.4,
      scaleY: reducedMotion ? 1 : 2.4,
      duration: timing.gather,
      ease: reducedMotion ? "Linear" : "Cubic.In",
    });

    schedule(revealAt, () => {
      if (finished || !scene.scene?.isActive()) return;
      playFeedback("reward");
      gatheringSparks.forEach((spark) => spark.setAlpha(0));
      core.setAlpha(0);
      art.setScale(reducedMotion ? 1 : 0.72);
      scene.tweens.add({
        targets: art,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: timing.settle,
        ease: reducedMotion ? "Linear" : "Back.Out",
      });
      if (!reducedMotion) {
        schedule(timing.settle + 40, () => {
          if (finished || !scene.scene?.isActive()) return;
          scene.tweens.add({
            targets: art,
            y: art.y - 8,
            duration: 1750,
            yoyo: true,
            repeat: -1,
            ease: "Sine.InOut",
          });
        });
      }
      scene.tweens.add({
        targets: [label, title, ...(counter ? [counter] : [])],
        alpha: 1,
        duration: reducedMotion ? timing.settle : 280,
        delay: reducedMotion ? 0 : 120,
        ease: "Quad.Out",
      });
    });

    schedule(readyAt, () => {
      if (finished || !scene.scene?.isActive()) return;
      ready = true;
    });

    const cleanup = () => {
      timers.forEach((timer) => timer.remove(false));
      scene.events.off("shutdown", onShutdown);
      if (!layer.scene) return;
      scene.tweens.killTweensOf(layer);
      layer.list.slice().forEach((child) => scene.tweens.killTweensOf(child));
      layer.destroy(true);
    };

    const finish = () => {
      if (!ready || finished) return;
      finished = true;
      backdrop.disableInteractive();
      art.disableInteractive();
      playFeedback("ui");
      scene.tweens.add({
        targets: layer,
        alpha: 0,
        duration: timing.exit,
        ease: "Sine.In",
        onComplete: () => {
          if (settled) return;
          cleanup();
          settled = true;
          resolve();
        },
      });
    };

    const onShutdown = () => {
      if (settled) return;
      finished = true;
      cleanup();
      settled = true;
      resolve();
    };

    backdrop.on("pointerup", finish);
    art.setInteractive({ useHandCursor: true }).on("pointerup", finish);
    scene.events.once("shutdown", onShutdown);
  });
}

export async function showMedalAwardSequence(scene, items, options = {}) {
  const entries = resolvedEntries(items);
  for (let index = 0; index < entries.length; index += 1) {
    if (!scene.scene?.isActive()) return;
    const entry = entries[index];
    const key = await ensureTexture(scene, entry);
    await showOne(scene, entry, key, {
      y: options.y,
      index,
      total: entries.length,
    });
    if (index < entries.length - 1 && scene.scene?.isActive()) {
      await new Promise((resolve) => scene.time.delayedCall(120, resolve));
    }
  }
}
