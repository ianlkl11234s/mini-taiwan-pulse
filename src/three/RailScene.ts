import * as THREE from "three";
import type { RailTrain } from "../types";
import { toMercator } from "../utils/coordinates";

/**
 * 軌道列車場景 — InstancedMesh + per-instance color
 */
export class RailScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 2500;
  private isDarkTheme = true;
  private orbScale = 0.000005;

  // 快取顏色物件
  private colorCache = new Map<string, THREE.Color>();

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
  }

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    // 啟用 per-instance color
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances * 3),
      3,
    );
    this.scene.add(this.instancedMesh);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.9 : 0.75;
    }
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  private getColor(hex: string): THREE.Color {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      // 暗色主題下需要提亮顏色以配合 AdditiveBlending
      if (this.isDarkTheme) {
        c.multiplyScalar(1.5);
      }
      this.colorCache.set(hex, c);
    }
    return c;
  }

  update(trains: RailTrain[]) {
    if (!this.instancedMesh) return;

    const dummy = new THREE.Matrix4();
    const baseScale = this.orbScale * 0.5;
    let count = 0;

    for (const train of trains) {
      if (count >= this.maxInstances) break;

      const [lng, lat] = train.position;
      // 跳過無效位置
      if (lng === 0 && lat === 0) continue;

      const mc = toMercator(lat, lng, 0);
      const s = baseScale;

      dummy.makeScale(s, s, s);
      dummy.setPosition(mc.x, mc.y, mc.z);
      this.instancedMesh.setMatrixAt(count, dummy);

      // Per-instance color
      const color = this.getColor(train.color);
      this.instancedMesh.instanceColor!.setXYZ(count, color.r, color.g, color.b);

      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  getVisibleCount(): number {
    return this.instancedMesh?.count ?? 0;
  }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.renderer?.dispose();
    this.colorCache.clear();
  }
}
