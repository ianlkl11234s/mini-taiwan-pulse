import * as THREE from "three";
import type { Ship } from "../types";
import { toMercator } from "../utils/coordinates";
import { interpolatePosition } from "../utils/interpolation";

const SHIP_COLOR_DARK = new THREE.Color(0.1, 0.85, 0.9); // 青藍
const SHIP_COLOR_LIGHT = new THREE.Color(0.0, 0.3, 0.45); // 深青

/**
 * 船舶場景 — 使用 InstancedMesh 單一 draw call 渲染所有船
 */
export class ShipScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 2500;
  private isDarkTheme = true;
  private orbScale = 0.000005;
  private breathPhase = 0;

  // 視口剔除用
  private viewBounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null = null;

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

    // 建立 InstancedMesh
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: SHIP_COLOR_DARK,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.scene.add(this.instancedMesh);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(isDark ? SHIP_COLOR_DARK : SHIP_COLOR_LIGHT);
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.85 : 0.7;
    }
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  setViewBounds(bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null) {
    this.viewBounds = bounds;
  }

  update(ships: Ship[], currentTime: number) {
    if (!this.instancedMesh) return;

    this.breathPhase += 0.02;
    const breathFactor = 1.0 + 0.15 * Math.sin(this.breathPhase);

    const dummy = new THREE.Matrix4();
    let count = 0;
    const bounds = this.viewBounds;
    // 船用較大的光球（相對飛機）
    const baseScale = this.orbScale * 0.6;

    for (const ship of ships) {
      if (count >= this.maxInstances) break;

      const pos = interpolatePosition(ship.path, currentTime);
      if (!pos) continue;

      const [lat, lng] = pos;

      // 視口剔除（加 padding）
      if (bounds) {
        const pad = 0.5;
        if (lng < bounds.minLng - pad || lng > bounds.maxLng + pad ||
            lat < bounds.minLat - pad || lat > bounds.maxLat + pad) {
          continue;
        }
      }

      const mc = toMercator(lat, lng, 0);
      const s = baseScale * breathFactor;

      dummy.makeScale(s, s, s);
      dummy.setPosition(mc.x, mc.y, mc.z);
      this.instancedMesh.setMatrixAt(count, dummy);
      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
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
  }
}
