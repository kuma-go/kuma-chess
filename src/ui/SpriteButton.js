import { playFeedback } from "../feedback.js?v=20260716-mobile25";

/**
 * SpriteButton
 * - 이미지 3장(normal/hover/pressed)로 동작하는 버튼
 * - setScaleTo()로 크기 변경해도 hitArea가 정확히 따라오도록 refreshHitArea() 수행
 */
export class SpriteButton extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{normal:string, hover?:string, pressed?:string}} keys
   * @param {() => void} onClick
   */
  constructor(scene, x, y, keys, onClick) {
    super(scene, x, y);

    this.scene = scene;
    this.keys = {
      normal: keys.normal,
      hover: keys.hover || keys.normal,
      pressed: keys.pressed || keys.hover || keys.normal,
      // 선택 상태 전용 텍스처 (없으면 hover로 대체)
      selected: keys.selected || keys.hover || keys.normal,
    };
    this.onClick = onClick;

    // 선택(토글) 상태 지원
    // - selected=true 이면 normal 대신 hover 텍스처를 "기본"으로 고정해서
    //   별도의 외곽선 오브젝트 없이도 자연스러운 선택 표시가 가능하게 한다.
    this._selected = false;

    this.sprite = scene.add.image(0, 0, this.keys.normal).setOrigin(0.5);

    // 컨테이너에 스프라이트를 넣고, 스프라이트에만 인터랙티브를 건다.
    this.add(this.sprite);
    scene.add.existing(this);

    this._isDown = false;
    this._enabled = true;

    this.refreshHitArea(); // 초기 hitArea

    // Hover / Press 상태 스왑
    this.sprite.on("pointerover", () => {
      if (!this._enabled || this._isDown) return;
      // selected 상태면 이미 hover가 기본이므로 그대로 유지
      this.sprite.setTexture(this.keys.hover);
    });

    this.sprite.on("pointerout", () => {
      if (!this._enabled) return;
      this._isDown = false;
      const selectedKey = this.keys.selected || this.keys.hover || this.keys.normal;
      this.sprite.setTexture(this._selected ? selectedKey : this.keys.normal);
    });

    this.sprite.on("pointerdown", () => {
      if (!this._enabled) return;
      this._isDown = true;
      this.sprite.setTexture(this.keys.pressed);
    });

    // pointerup은 버튼 위에서 뗐을 때만 클릭 처리
    this.sprite.on("pointerup", () => {
      if (!this._enabled) return;
      const wasDown = this._isDown;
      this._isDown = false;
      // selected면 hover를 유지, 아니면 hover(마우스가 위에 있으니까)
      this.sprite.setTexture(this.keys.hover);
      if (wasDown && this.onClick) {
        playFeedback("ui");
        this.onClick();
      }
    });

    // 밖에서 떼면 눌림 해제만
    this.sprite.on("pointerupoutside", () => {
      if (!this._enabled) return;
      this._isDown = false;
      const selectedKey = this.keys.selected || this.keys.hover || this.keys.normal;
      this.sprite.setTexture(this._selected ? selectedKey : this.keys.normal);
    });
  }

  /**
   * 선택 상태를 토글한다.
   * - selected=true: hover 텍스처를 기본으로 고정
   * - selected=false: normal 텍스처로 복귀
   */
  setSelected(v) {
    this._selected = !!v;
    if (!this._enabled) return this;
    if (this._isDown) return this; // 누르는 중이면 이벤트 흐름에 맡김
    const selectedKey = this.keys.selected || this.keys.hover || this.keys.normal;
    this.sprite.setTexture(this._selected ? selectedKey : this.keys.normal);
    return this;
  }

  isSelected() {
    return !!this._selected;
  }

  setEnabled(v) {
    this._enabled = !!v;
    if (!this._enabled) {
      this.sprite.disableInteractive();
      this.sprite.setAlpha(0.55);
    } else {
      this.sprite.setAlpha(1);
      this.refreshHitArea();
    }
    return this;
  }

  /**
   * 버튼이 원하는 픽셀 사이즈가 되도록 리사이즈 + hitArea 갱신
   */
  setScaleTo(width, height) {
    this.sprite.setDisplaySize(width, height);
    this.refreshHitArea();
    return this;
  }

  /**
   * **핵심 수정**
   * Phaser는 setDisplaySize/setScale 이후에도 hitArea가 자동 갱신되지 않는 경우가 있어
   * 여기서 항상 "현재 displayWidth/displayHeight" 기준으로 직사각형 hitArea를 재설정한다.
   */
  refreshHitArea() {
    // texture가 아직 준비 안 된 경우를 대비
    if (!this.sprite || !this.sprite.texture || !this.sprite.texture.key) return;

    const w = Math.max(1, this.sprite.displayWidth);
    const h = Math.max(1, this.sprite.displayHeight);

    // ✅ Phaser의 localX/localY는 "오브젝트 좌상단" 기준으로 들어오기 때문에
    // hitArea는 (0,0)~(w,h)로 잡아야 한다.
    this.sprite.disableInteractive();
    this.sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains
    );
    this.sprite.input.cursor = "pointer";

    // Debug: 화면에 hitArea를 그려 확인
    if (this.debug) {
      // local 좌표(0,0)는 스프라이트의 top-left. 컨테이너 기준 좌표로 변환해 그린다.
      const x0 = -w * this.sprite.originX;
      const y0 = -h * this.sprite.originY;

      this.debugGfx.clear();
      this.debugGfx.lineStyle(2, 0x00ff00, 1);
      this.debugGfx.strokeRect(x0, y0, w, h);

      this.debugGfx.lineStyle(2, 0xff0000, 1);
      this.debugGfx.beginPath();
      this.debugGfx.moveTo(x0, y0);
      this.debugGfx.lineTo(x0 + w, y0 + h);
      this.debugGfx.strokePath();

      this.debugGfx.lineStyle(2, 0x00ffff, 1);
      this.debugGfx.strokeCircle(0, 0, 6);
    }
  }
}
