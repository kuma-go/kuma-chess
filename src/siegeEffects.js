const EFFECT_DEPTH = 190;
const GOLD = 0xffc857;
const PALE_GOLD = 0xffefb0;
const WHITE_ACCENT = 0x28c4dc;
const BLACK_ACCENT = 0xe05a52;

function point(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeOptions(options = {}) {
  const attacker = options.attacker || {};
  const target = options.target || {};
  return {
    ...options,
    attacker: { x: point(attacker.x), y: point(attacker.y) },
    target: { x: point(target.x), y: point(target.y) },
    squareSize: Math.max(36, point(options.squareSize, 80)),
    depth: point(options.depth, EFFECT_DEPTH),
    accent: options.color === "b" ? BLACK_ACCENT : WHITE_ACCENT,
  };
}

function vector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return {
    dx,
    dy,
    distance,
    nx: dx / distance,
    ny: dy / distance,
    angle: Math.atan2(dy, dx),
    degrees: Phaser.Math.RadToDeg(Math.atan2(dy, dx)),
  };
}

function makeLayer(scene, x, y, depth) {
  return scene.add.container(x, y).setDepth(depth);
}

function addCircle(scene, layer, x, y, radius, color, alpha, stroke = null) {
  const circle = scene.add.circle(x, y, radius, color, alpha);
  if (stroke) circle.setStrokeStyle(stroke.width, stroke.color, stroke.alpha ?? 1);
  layer.add(circle);
  return circle;
}

function scheduleDestroy(scene, layer, duration, fadeRatio = 0.35) {
  scene.tweens.add({
    targets: layer,
    alpha: 0,
    duration: Math.max(80, duration * fadeRatio),
    delay: duration * (1 - fadeRatio),
    ease: "Sine.In",
    onComplete: () => {
      if (layer?.active) layer.destroy(true);
    },
  });
  return layer;
}

function setRelativeImageScale(image, relativeScale) {
  image.setScale(image.scaleX * relativeScale, image.scaleY * relativeScale);
  return image;
}

function addSparkDots(scene, layer, radius, accent, count = 4) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count + 0.35;
    const dot = addCircle(scene, layer, 0, 0, Math.max(1.5, radius * 0.07), index % 2 ? PALE_GOLD : accent, 0.88);
    scene.tweens.add({
      targets: dot,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      alpha: 0,
      duration: 240,
      ease: "Quad.Out",
    });
  }
}

function playSecondaryImpact(scene, options) {
  const { target, squareSize, depth, accent, special } = options;
  const layer = makeLayer(scene, target.x, target.y, depth + 1);
  const color = special === "pierce" ? 0x76dcff : 0xe98cff;
  const ring = addCircle(scene, layer, 0, 0, squareSize * 0.1, color, 0.08, {
    width: Math.max(2, squareSize * 0.025), color, alpha: 0.78,
  });
  addSparkDots(scene, layer, squareSize * 0.2, accent, 3);
  scene.tweens.add({ targets: ring, scale: 1.65, alpha: 0, duration: 230, ease: "Quad.Out" });
  return scheduleDestroy(scene, layer, 250, 0.45);
}

function playPawnEffect(scene, options) {
  const { attacker, target, squareSize, depth, accent } = options;
  const direction = vector(attacker, target);
  const layer = makeLayer(scene, target.x, target.y, depth);
  const image = scene.add.image(0, 0, "kuma_ui_siege_fx_pawn")
    .setOrigin(0.53, 0.52)
    .setDisplaySize(squareSize * 0.58, squareSize * 0.58)
    .setAngle(direction.degrees)
    .setAlpha(0);
  const imageScale = image.scaleX;
  setRelativeImageScale(image, 0.55);
  const ring = addCircle(scene, layer, 0, 0, squareSize * 0.1, GOLD, 0.07, {
    width: Math.max(2, squareSize * 0.025), color: accent, alpha: 0.75,
  });
  layer.addAt(image, 0);
  addSparkDots(scene, layer, squareSize * 0.25, accent, 4);
  scene.tweens.add({ targets: image, alpha: 0.94, scaleX: imageScale, scaleY: imageScale, duration: 90, ease: "Back.Out" });
  scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 250, ease: "Quad.Out" });
  return scheduleDestroy(scene, layer, 300, 0.42);
}

function playKnightEffect(scene, options) {
  const { attacker, target, squareSize, depth, special } = options;
  const direction = vector(attacker, target);
  const layer = makeLayer(scene, target.x, target.y, depth + 1);
  const image = scene.add.image(0, 0, "kuma_ui_siege_fx_knight")
    .setOrigin(0.76, 0.35)
    .setDisplaySize(squareSize * (special === "charge" ? 1.45 : 1.22), squareSize * (special === "charge" ? 1.45 : 1.22))
    .setAngle(direction.degrees + 31)
    .setAlpha(0);
  const imageScale = image.scaleX;
  setRelativeImageScale(image, 0.55);
  layer.add(image);
  scene.tweens.add({ targets: image, alpha: 0.98, scaleX: imageScale, scaleY: imageScale, duration: 125, ease: "Back.Out" });
  scene.tweens.add({
    targets: image,
    x: direction.nx * squareSize * 0.08,
    y: direction.ny * squareSize * 0.08,
    duration: 250,
    ease: "Cubic.Out",
  });
  return scheduleDestroy(scene, layer, special === "charge" ? 430 : 360, 0.44);
}

function playBishopEffect(scene, options) {
  const { attacker, target, squareSize, depth } = options;
  const direction = vector(attacker, target);
  const layer = makeLayer(scene, target.x, target.y, depth + 2);
  const displaySize = Phaser.Math.Clamp(direction.distance * 1.1, squareSize * 1.1, squareSize * 3.5);
  const guide = scene.add.graphics();
  guide.lineStyle(Math.max(3, squareSize * 0.038), 0x4ddbe6, 0.36);
  guide.lineBetween(-direction.dx, -direction.dy, 0, 0);
  guide.lineStyle(Math.max(1, squareSize * 0.014), 0xffffff, 0.78);
  guide.lineBetween(-direction.dx, -direction.dy, 0, 0);
  const glow = scene.add.image(0, 0, "kuma_ui_siege_fx_bishop")
    .setOrigin(0.766, 0.284)
    .setDisplaySize(displaySize, displaySize)
    .setAngle(direction.degrees + 42)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.16);
  const glowScale = glow.scaleX;
  setRelativeImageScale(glow, 0.94);
  const beam = scene.add.image(0, 0, "kuma_ui_siege_fx_bishop")
    .setOrigin(0.766, 0.284)
    .setDisplaySize(displaySize, displaySize)
    .setAngle(direction.degrees + 42)
    .setAlpha(0);
  const beamScale = beam.scaleX;
  setRelativeImageScale(beam, 0.76);
  layer.add([guide, glow, beam]);
  scene.tweens.add({ targets: beam, alpha: 0.96, scaleX: beamScale, scaleY: beamScale, duration: 130, ease: "Cubic.Out" });
  scene.tweens.add({ targets: glow, alpha: 0.45, scaleX: glowScale * 1.05, scaleY: glowScale * 1.05, duration: 190, yoyo: true, ease: "Sine.Out" });
  return scheduleDestroy(scene, layer, 470, 0.5);
}

function playRookEffect(scene, options) {
  const { target, squareSize, depth, special } = options;
  const siege = special === "siege";
  const size = squareSize * (siege ? 1.38 : 0.88);
  const layer = makeLayer(scene, target.x, target.y, depth + 2);
  const dust = addCircle(scene, layer, 0, squareSize * 0.18, squareSize * 0.18, 0x9d7448, 0.12, {
    width: Math.max(2, squareSize * 0.03), color: GOLD, alpha: 0.45,
  });
  const image = scene.add.image(0, 0, "kuma_ui_siege_fx_rook")
    .setOrigin(0.5, 0.705)
    .setDisplaySize(size, size)
    .setY(-squareSize * 0.22)
    .setAlpha(0);
  const imageScale = image.scaleX;
  setRelativeImageScale(image, 0.58);
  layer.add(image);
  addSparkDots(scene, layer, squareSize * (siege ? 0.52 : 0.34), 0xc58a46, siege ? 7 : 4);
  scene.tweens.add({ targets: image, alpha: 0.98, scaleX: imageScale, scaleY: imageScale, y: 0, duration: 115, ease: "Cubic.In" });
  scene.tweens.add({ targets: dust, scale: siege ? 2.2 : 1.55, alpha: 0, duration: 360, ease: "Quad.Out" });
  return scheduleDestroy(scene, layer, siege ? 500 : 390, 0.44);
}

function playQueenEffect(scene, options) {
  const { attacker, target, squareSize, depth, special, accent } = options;
  const direction = vector(attacker, target);
  const size = squareSize * (special === "splash" ? 0.62 : 0.82);
  const travel = makeLayer(scene, attacker.x, attacker.y, depth + 3);
  const trail = addCircle(scene, travel, 0, 0, squareSize * 0.15, accent, 0.14, {
    width: Math.max(2, squareSize * 0.026), color: PALE_GOLD, alpha: 0.8,
  });
  const projectile = scene.add.image(0, 0, "kuma_ui_siege_fx_queen")
    .setDisplaySize(squareSize * 0.5, squareSize * 0.5)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAngle(direction.degrees)
    .setAlpha(0.96);
  const projectileScaleX = projectile.scaleX;
  const projectileScaleY = projectile.scaleY;
  travel.add(projectile);
  const duration = Phaser.Math.Clamp(direction.distance * 2.4, 170, 330);
  scene.tweens.add({
    targets: projectile,
    angle: direction.degrees + 210,
    scaleX: projectileScaleX * 1.12,
    scaleY: projectileScaleY * 1.12,
    duration,
    ease: "Sine.InOut",
  });
  scene.tweens.add({ targets: trail, scale: 1.45, alpha: 0, duration: Math.min(190, duration), repeat: 1, ease: "Quad.Out" });
  scene.tweens.add({
    targets: travel,
    x: target.x,
    y: target.y,
    duration,
    ease: "Cubic.In",
    onComplete: () => {
      if (travel.active) travel.destroy(true);
      const impact = makeLayer(scene, target.x, target.y, depth + 4);
      const glow = scene.add.image(0, 0, "kuma_ui_siege_fx_queen")
        .setDisplaySize(size * 1.06, size * 1.06)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.22);
      const glowScaleX = glow.scaleX;
      const glowScaleY = glow.scaleY;
      const image = scene.add.image(0, 0, "kuma_ui_siege_fx_queen")
        .setDisplaySize(size, size)
        .setAlpha(0.98)
        .setAngle(-16);
      const imageScaleX = image.scaleX;
      const imageScaleY = image.scaleY;
      setRelativeImageScale(image, 0.38);
      impact.add([glow, image]);
      addSparkDots(scene, impact, squareSize * 0.31, accent, 6);
      scene.tweens.add({ targets: image, scaleX: imageScaleX, scaleY: imageScaleY, angle: 18, duration: 250, ease: "Back.Out" });
      scene.tweens.add({
        targets: glow,
        scaleX: glowScaleX * 1.15,
        scaleY: glowScaleY * 1.15,
        alpha: 0,
        angle: -24,
        duration: 380,
        ease: "Cubic.Out",
      });
      scheduleDestroy(scene, impact, 500, 0.42);
    },
  });
  return travel;
}

function playKingAttackEffect(scene, options) {
  const { attacker, target, squareSize, depth, accent } = options;
  const direction = vector(attacker, target);
  const layer = makeLayer(scene, target.x, target.y, depth + 1);
  const core = addCircle(scene, layer, 0, 0, squareSize * 0.12, PALE_GOLD, 0.68, {
    width: Math.max(3, squareSize * 0.04), color: GOLD, alpha: 0.9,
  });
  const wave = scene.add.graphics();
  wave.lineStyle(Math.max(4, squareSize * 0.055), GOLD, 0.86);
  wave.beginPath();
  wave.arc(0, 0, squareSize * 0.27, direction.angle - 0.9, direction.angle + 0.9, false);
  wave.strokePath();
  wave.lineStyle(Math.max(2, squareSize * 0.025), accent, 0.72);
  wave.beginPath();
  wave.arc(0, 0, squareSize * 0.2, direction.angle - 0.72, direction.angle + 0.72, false);
  wave.strokePath();
  wave.setScale(0.55);
  layer.add(wave);
  scene.tweens.add({ targets: core, scale: 1.85, alpha: 0, duration: 280, ease: "Quad.Out" });
  scene.tweens.add({ targets: wave, scale: 1.15, alpha: 0, duration: 320, ease: "Cubic.Out" });
  return scheduleDestroy(scene, layer, 340, 0.42);
}

export function playSiegeAttackEffect(scene, options = {}) {
  const normalized = normalizeOptions(options);
  if (normalized.effectRole === "secondary") return playSecondaryImpact(scene, normalized);
  switch (normalized.unitType) {
    case "knight": return playKnightEffect(scene, normalized);
    case "bishop": return playBishopEffect(scene, normalized);
    case "rook": return playRookEffect(scene, normalized);
    case "queen": return playQueenEffect(scene, normalized);
    case "king": return playKingAttackEffect(scene, normalized);
    case "pawn":
    default: return playPawnEffect(scene, normalized);
  }
}

export function createSiegeKingAura(scene, options = {}) {
  const target = options.target || {};
  const x = point(options.x, point(target.x));
  const y = point(options.y, point(target.y));
  const squareSize = Math.max(36, point(options.squareSize, 80));
  const color = options.color === "b" ? BLACK_ACCENT : WHITE_ACCENT;
  const container = makeLayer(scene, x, y, point(options.depth, EFFECT_DEPTH - 45));
  const crest = scene.add.image(0, squareSize * 0.03, "kuma_ui_siege_fx_king")
    .setOrigin(0.5, 0.59)
    .setDisplaySize(squareSize * 1.38, squareSize * 1.38)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0);
  const crestScale = crest.scaleX;
  setRelativeImageScale(crest, 0.58);
  const glow = addCircle(scene, container, 0, squareSize * 0.16, squareSize * 0.46, GOLD, 0.04, {
    width: Math.max(3, squareSize * 0.04), color: GOLD, alpha: 0.82,
  });
  const sideRing = addCircle(scene, container, 0, squareSize * 0.16, squareSize * 0.35, color, 0.025, {
    width: Math.max(2, squareSize * 0.026), color, alpha: 0.7,
  });
  const commandPulse = addCircle(scene, container, 0, squareSize * 0.16, squareSize * 0.22, PALE_GOLD, 0.02, {
    width: Math.max(2, squareSize * 0.025), color: PALE_GOLD, alpha: 0.86,
  });
  container.addAt(crest, 0);
  const tweens = [];
  const intro = scene.tweens.add({
    targets: crest,
    alpha: 0.72,
    scaleX: crestScale,
    scaleY: crestScale,
    duration: 250,
    ease: "Back.Out",
    onComplete: () => {
      if (!crest.active) return;
      tweens.push(scene.tweens.add({
        targets: crest,
        alpha: 0.24,
        scaleX: crestScale * 0.9,
        scaleY: crestScale * 0.9,
        duration: 380,
        ease: "Sine.In",
      }));
    },
  });
  tweens.push(
    intro,
    scene.tweens.add({ targets: glow, scale: { from: 0.88, to: 1.12 }, alpha: { from: 0.3, to: 0.62 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" }),
    scene.tweens.add({ targets: sideRing, scale: { from: 1.08, to: 0.94 }, alpha: { from: 0.58, to: 0.26 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" }),
    scene.tweens.add({ targets: commandPulse, scale: { from: 0.72, to: 2.05 }, alpha: { from: 0.86, to: 0 }, duration: 1250, repeat: -1, ease: "Quad.Out" }),
  );
  return {
    container,
    tweens,
    setPosition(nextX, nextY) {
      if (container.active) container.setPosition(nextX, nextY);
    },
  };
}

export function createSiegeAllyAura(scene, options = {}) {
  const x = point(options.x);
  const y = point(options.y);
  const squareSize = Math.max(36, point(options.squareSize, 80));
  const container = makeLayer(scene, x, y, point(options.depth, EFFECT_DEPTH - 46));
  const ring = addCircle(scene, container, 0, squareSize * 0.18, squareSize * 0.29, GOLD, 0.035, {
    width: Math.max(2, squareSize * 0.03), color: PALE_GOLD, alpha: 0.82,
  });
  const innerRing = addCircle(scene, container, 0, squareSize * 0.18, squareSize * 0.21, GOLD, 0.01, {
    width: Math.max(1.5, squareSize * 0.018), color: GOLD, alpha: 0.62,
  });
  const glint = addCircle(scene, container, squareSize * 0.22, squareSize * 0.05, squareSize * 0.045, PALE_GOLD, 0.92);
  const tweens = [
    scene.tweens.add({ targets: ring, scale: { from: 0.92, to: 1.1 }, alpha: { from: 0.86, to: 0.46 }, duration: 720, yoyo: true, repeat: -1, ease: "Sine.InOut" }),
    scene.tweens.add({ targets: innerRing, scale: { from: 1.08, to: 0.9 }, alpha: { from: 0.66, to: 0.28 }, duration: 720, yoyo: true, repeat: -1, ease: "Sine.InOut" }),
    scene.tweens.add({ targets: glint, alpha: { from: 1, to: 0.25 }, scale: { from: 0.75, to: 1.4 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" }),
  ];
  container.setVisible(false);
  return {
    container,
    tweens,
    setPosition(nextX, nextY) {
      if (container.active) container.setPosition(nextX, nextY);
    },
    setVisible(visible) {
      if (container.active) container.setVisible(visible);
    },
  };
}

export function destroySiegeKingAura(aura) {
  if (!aura) return;
  for (const tween of aura.tweens || []) tween?.stop?.();
  const container = aura.container || aura;
  if (container?.active) container.destroy(true);
}

export function playSiegeCastleHitEffect(scene, options = {}) {
  const target = options.target || options.castle || {};
  const x = point(options.x, point(target.x));
  const y = point(options.y, point(target.y));
  const squareSize = Math.max(36, point(options.squareSize, 80));
  const depth = point(options.depth, EFFECT_DEPTH + 4);
  const layer = makeLayer(scene, x, y, depth);
  const ring = addCircle(scene, layer, 0, squareSize * 0.08, squareSize * 0.15, GOLD, 0.025, {
    width: Math.max(2, squareSize * 0.025), color: PALE_GOLD, alpha: 0.62,
  });
  scene.tweens.add({ targets: ring, scale: 1.55, alpha: 0, duration: 260, ease: "Quad.Out" });
  return scheduleDestroy(scene, layer, 280, 0.45);
}
