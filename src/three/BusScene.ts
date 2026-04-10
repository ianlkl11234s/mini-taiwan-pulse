import * as THREE from "three";
import type { BusVehicle } from "../types";
import { toMercator } from "../utils/coordinates";

/**
 * 公車場景 — InstancedMesh 光球（無 trail、無靜態路線）
 * 精簡版 RailScene，專為 GPS-based 公車設計
 */
export class BusScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 3000;
  private isDarkTheme = true;
  private orbScale = 0.000004;

  private colorCache = new Map<string, THREE.Color>();
  private busPositions = new Map<number, BusVehicle>(); // instanceIndex → bus

  private lastMatrix: THREE.Matrix4 | null = null;

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

    // 比 rail 低一級 detail (1 vs 2)，因公車數量更多
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances * 3),
      3,
    );
    this.scene.add(this.instancedMesh);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    this.colorCache.clear();
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.85 : 0.7;
    }
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  private getColor(hex: string): THREE.Color {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      if (this.isDarkTheme) c.multiplyScalar(1.4);
      this.colorCache.set(hex, c);
    }
    return c;
  }

  update(buses: BusVehicle[]) {
    if (!this.instancedMesh) return;

    const dummy = new THREE.Matrix4();
    const baseScale = this.orbScale * 0.5;
    let count = 0;

    this.busPositions.clear();

    for (const bus of buses) {
      if (count >= this.maxInstances) break;

      const [lng, lat] = bus.position;
      if (lng === 0 && lat === 0) continue;

      const mc = toMercator(lat, lng, 0);
      dummy.makeScale(baseScale, baseScale, baseScale);
      dummy.setPosition(mc.x, mc.y, mc.z);
      this.instancedMesh.setMatrixAt(count, dummy);

      const color = this.getColor(bus.color);
      this.instancedMesh.instanceColor!.setXYZ(count, color.r, color.g, color.b);

      this.busPositions.set(count, bus);
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

    this.lastMatrix = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = this.lastMatrix.clone();
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  pickBus(screenX: number, screenY: number, viewWidth: number, viewHeight: number): BusVehicle | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;

    const threshold = 25;
    let closest: { bus: BusVehicle; dist: number } | null = null;
    const mat = new THREE.Matrix4();

    for (const [idx, bus] of this.busPositions) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(
        mat.elements[12], mat.elements[13], mat.elements[14], 1.0,
      );
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;

      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);

      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { bus, dist };
      }
    }

    return closest?.bus ?? null;
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
    this.busPositions.clear();
  }
}
