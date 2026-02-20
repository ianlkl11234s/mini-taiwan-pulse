import * as THREE from "three";

/**
 * 紅色閃爍警示燈
 * 模擬飛機的防碰撞閃爍燈
 */
export class BlinkingLight {
  sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private time = 0;
  private blinkFrequency: number;

  constructor(scale: number = 0.000012, blinkFrequency: number = 1.2) {
    this.blinkFrequency = blinkFrequency;

    const texture = this.createRedDotTexture();
    this.material = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color(1.0, 0.1, 0.1),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(scale, scale, 1);
    // 稍微偏移，不要完全重疊在光球中心
    this.sprite.position.set(0, 0, 0.0000015);
  }

  /** 更新閃爍動畫 */
  update(dt: number) {
    this.time += dt;

    // 快速閃爍模式：短暫亮起，然後長時間暗
    const cycle = (this.time * this.blinkFrequency) % 1.0;
    // 雙閃效果
    const blink1 = cycle < 0.1 ? 1.0 : 0.0;
    const blink2 = cycle > 0.15 && cycle < 0.25 ? 0.7 : 0.0;
    this.material.opacity = Math.max(blink1, blink2);
  }

  setVisible(visible: boolean) {
    this.sprite.visible = visible;
  }

  private createRedDotTexture(): THREE.Texture {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, "rgba(255,50,50,1)");
    gradient.addColorStop(0.5, "rgba(255,0,0,0.4)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.material.map?.dispose();
    this.material.dispose();
  }
}
