// src/ui/NineSlice.js
//
// 9-slice panel that renders into a single CanvasTexture.
// This eliminates visible seams that can appear when composing 9 separate
// images with filtering / fractional positions.
//
// Compatible with Phaser 3.88.x.

export class NineSlice extends Phaser.GameObjects.Image {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {string} key - base texture key
   * @param {{left:number,right:number,top:number,bottom:number,frame?:string}} margins
   */
  constructor(scene, x, y, width, height, key, margins) {
    const canvasKey = `__9s_${key}_${Phaser.Utils.String.UUID()}`;
    super(scene, x, y, canvasKey);

    this._srcKey = key;
    this._frameKey = margins?.frame;
    this._margins = {
      left: Math.max(0, margins?.left ?? 16),
      right: Math.max(0, margins?.right ?? 16),
      top: Math.max(0, margins?.top ?? 16),
      bottom: Math.max(0, margins?.bottom ?? 16),
    };

    this._canvasKey = canvasKey;
    this._canvasTex = null;

    this.setOrigin(0.5);

    // Create canvas texture now
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this._ensureCanvas(w, h);

    scene.add.existing(this);

    this.resize(w, h);
  }

  /**
   * Ensure a CanvasTexture exists for this NineSlice.
   */
  _ensureCanvas(w, h) {
    const tm = this.scene.textures;

    // If already exists, just reuse
    if (tm.exists(this._canvasKey)) {
      this._canvasTex = tm.get(this._canvasKey);
      return;
    }

    const created = tm.createCanvas(this._canvasKey, w, h);
    if (!created) {
      throw new Error(`NineSlice: failed to create canvas texture '${this._canvasKey}'`);
    }
    this._canvasTex = created;
  }

  /**
   * Redraw and resize.
   */
  resize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    this._ensureCanvas(w, h);

    // Resize canvas backing store
    if (typeof this._canvasTex.setSize === "function") {
      this._canvasTex.setSize(w, h);
    } else {
      // Older Phaser fallback (shouldn't happen on 3.88.x)
      this._canvasTex.width = w;
      this._canvasTex.height = h;
    }

    this._draw(w, h);

    this.setTexture(this._canvasKey);
    this.displayWidth = w;
    this.displayHeight = h;

    return this;
  }

  _draw(w, h) {
    const srcTex = this.scene.textures.get(this._srcKey);
    if (!srcTex) throw new Error(`NineSlice: missing texture '${this._srcKey}'`);

    const frame = srcTex.get(this._frameKey);
    if (!frame) throw new Error(`NineSlice: missing frame '${this._srcKey}:${this._frameKey ?? "__BASE"}'`);

    const img = frame.source?.image;
    if (!img) throw new Error(`NineSlice: missing source image for '${this._srcKey}'`);

    const sx0 = frame.cutX;
    const sy0 = frame.cutY;
    const sw = frame.cutWidth;
    const sh = frame.cutHeight;

    const { left: L, right: R, top: T, bottom: B } = this._margins;

    // Clamp margins so we never sample outside the source
    const l = Math.min(L, sw);
    const r = Math.min(R, Math.max(0, sw - l));
    const t = Math.min(T, sh);
    const b = Math.min(B, Math.max(0, sh - t));

    const ctx = this._canvasTex.getContext();
    ctx.clearRect(0, 0, w, h);

    // NOTE: turning off smoothing helps remove tiny seams on some GPUs
    // when scaling. (Feel free to enable if you prefer softer scaling.)
    ctx.imageSmoothingEnabled = true;

    const dwMid = Math.max(0, w - l - r);
    const dhMid = Math.max(0, h - t - b);
    const swMid = Math.max(0, sw - l - r);
    const shMid = Math.max(0, sh - t - b);

    const draw = (sxx, syy, sww, shh, dxx, dyy, dww, dhh) => {
      if (sww <= 0 || shh <= 0 || dww <= 0 || dhh <= 0) return;
      ctx.drawImage(img, sxx, syy, sww, shh, dxx, dyy, dww, dhh);
    };

    // corners
    draw(sx0 + 0,      sy0 + 0,      l, t,  0,      0,      l, t);
    draw(sx0 + sw - r, sy0 + 0,      r, t,  w - r,  0,      r, t);
    draw(sx0 + 0,      sy0 + sh - b, l, b,  0,      h - b,  l, b);
    draw(sx0 + sw - r, sy0 + sh - b, r, b,  w - r,  h - b,  r, b);

    // edges
    draw(sx0 + l,      sy0 + 0,      swMid, t,  l,     0,      dwMid, t);
    draw(sx0 + l,      sy0 + sh - b, swMid, b,  l,     h - b,  dwMid, b);
    draw(sx0 + 0,      sy0 + t,      l, shMid,  0,     t,      l, dhMid);
    draw(sx0 + sw - r, sy0 + t,      r, shMid,  w - r, t,      r, dhMid);

    // center
    draw(sx0 + l, sy0 + t, swMid, shMid, l, t, dwMid, dhMid);

    this._canvasTex.refresh();
  }

  destroy(fromScene) {
    const scene = this.scene;
    const canvasKey = this._canvasKey;
    super.destroy(fromScene);

    // Clean up our temporary canvas texture
    if (scene && scene.textures && scene.textures.exists(canvasKey)) {
      scene.textures.remove(canvasKey);
    }
  }
}
