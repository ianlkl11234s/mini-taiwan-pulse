import * as THREE from "three";

// 共用幾何
const sharedGeo = new THREE.IcosahedronGeometry(1, 1);

/**
 * 紅色閃爍警示燈
 * 模擬飛機的防碰撞閃爍燈
 * 使用 Mesh 而非 Sprite，確保在 Mapbox 自訂投影矩陣下正確渲染。
 */
export class BlinkingLight {
  mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private time = 0;
  private blinkFrequency: number;

  constructor(scale: number = 0.000015, blinkFrequency: number = 1.2) {
    this.blinkFrequency = blinkFrequency;

    this.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.1, 0.1),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(sharedGeo, this.material);
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.frustumCulled = false;
    // 稍微偏移，不要完全重疊在光球中心
    this.mesh.position.set(0, 0, 0.0000015);
  }

  /** 更新閃爍動畫 */
  update(dt: number) {
    this.time += dt;
    const cycle = (this.time * this.blinkFrequency) % 1.0;
    const blink1 = cycle < 0.1 ? 1.0 : 0.0;
    const blink2 = cycle > 0.15 && cycle < 0.25 ? 0.7 : 0.0;
    this.material.opacity = Math.max(blink1, blink2);
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.material.dispose();
  }
}
