import * as THREE from "three";

/**
 * 發光球體：多層 Sprite 疊加模擬 bloom 效果
 * 內層小且亮，外層大且淡
 */
export class LightOrb {
  group: THREE.Group;
  private layers: THREE.Sprite[] = [];
  private time = 0;

  constructor(
    color: THREE.Color = new THREE.Color(0.6, 0.85, 1.0),
    scale: number = 0.00008,
  ) {
    this.group = new THREE.Group();

    // 建立發光紋理
    const glowTexture = this.createGlowTexture();

    // 三層疊加：內亮外淡
    const layerConfigs = [
      { scale: scale * 0.5, opacity: 1.0, color: new THREE.Color(1, 1, 1) },
      { scale: scale * 1.0, opacity: 0.5, color },
      { scale: scale * 2.0, opacity: 0.15, color },
    ];

    for (const cfg of layerConfigs) {
      const material = new THREE.SpriteMaterial({
        map: glowTexture,
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      material.userData["baseOpacity"] = cfg.opacity;
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(cfg.scale, cfg.scale, 1);
      this.group.add(sprite);
      this.layers.push(sprite);
    }
  }

  /** 設定位置 */
  setPosition(x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
  }

  /** 設定可見度 */
  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /** 更新動畫（呼吸效果） */
  update(dt: number) {
    this.time += dt;
    const pulse = 1.0 + Math.sin(this.time * 2.0) * 0.1;
    for (const sprite of this.layers) {
      const mat = sprite.material as THREE.SpriteMaterial;
      const base = mat.userData["baseOpacity"] as number;
      mat.opacity = base * pulse;
    }
  }

  /** 建立高斯發光紋理 */
  private createGlowTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.6)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    for (const sprite of this.layers) {
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.SpriteMaterial).dispose();
    }
  }
}
