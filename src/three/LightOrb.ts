import * as THREE from "three";

// 共用球體幾何（所有 LightOrb 實例共用，節省記憶體）
const sharedGeo = new THREE.IcosahedronGeometry(1, 2);

/**
 * 發光球體：多層 Mesh 球體疊加模擬 bloom 效果
 * 使用 Mesh 而非 Sprite，確保在 Mapbox 自訂投影矩陣下正確渲染。
 */
export class LightOrb {
  group: THREE.Group;
  private layers: THREE.Mesh[] = [];
  private time = 0;
  private layerRatios = [0.5, 1.0, 2.0];

  constructor(
    color: THREE.Color = new THREE.Color(0.6, 0.85, 1.0),
    scale: number = 0.000005,
  ) {
    this.group = new THREE.Group();

    const layerConfigs = [
      { ratio: 0.5, opacity: 1.0, color: new THREE.Color(1, 1, 1) },
      { ratio: 1.0, opacity: 0.5, color },
      { ratio: 2.0, opacity: 0.15, color },
    ];

    for (const cfg of layerConfigs) {
      const s = scale * cfg.ratio;
      const material = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      material.userData["baseOpacity"] = cfg.opacity;
      const mesh = new THREE.Mesh(sharedGeo, material);
      mesh.scale.set(s, s, s);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.layers.push(mesh);
    }
  }

  /** 動態更新光球大小 */
  setScale(scale: number) {
    for (let i = 0; i < this.layers.length; i++) {
      const s = scale * this.layerRatios[i]!;
      this.layers[i]!.scale.set(s, s, s);
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
    const pulse = 1.0 + Math.sin(this.time * 2.0) * 0.15;
    for (const mesh of this.layers) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const base = mat.userData["baseOpacity"] as number;
      mat.opacity = base * pulse;
    }
  }

  dispose() {
    for (const mesh of this.layers) {
      (mesh.material as THREE.MeshBasicMaterial).dispose();
    }
  }
}
