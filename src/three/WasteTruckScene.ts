import * as THREE from "three";
import { toMercator } from "../utils/coordinates";
import { WASTE_STATUS_COLORS, type WasteTrailRow } from "../data/wasteLoader";
import { computeWasteTruckFrames, wasteVisualTimeSec } from "../data/wasteTruckFrames";

// 時間來源由 custom layer 傳入：
//   - replay：用 timeStore 時間，讓播放/倍速能驅動近 60 分鐘 trail
//   - live：timeStore 會貼近 Date.now()，再套 5 分鐘 visual lag（VIEW_LAG_SECONDS，見 wasteTruckFrames）
// Historical replay：useWasteLayer 會載入當天 day trail；matched 存在時沿 OSRM 路網 progress 移動。
//
// R6 段 3：時間插值（GPS 三種模式／matched progress／live lag）抽到 three-free 的
// `data/wasteTruckFrames.ts`，Mapbox 平面模式共用同一份算式；本 Scene 只負責擺 InstancedMesh。

/**
 * 垃圾車光球場景（方案 A 軌跡插值）
 *
 * 顏色：依 status 區分（collecting=琥珀，會噴音符）
 * 多城市可復用：跟 city 無關，只看 trail 資料本身
 */

// ── Scene ────────────────────────────────────────────────

export class WasteTruckScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private alphaAttribute: THREE.InstancedBufferAttribute | null = null;
  private maxInstances: number;
  private isDarkTheme = true;
  private orbScale = 0.000020;
  private altOffset = 0;
  /** 圖層透明度倍率，乘進既有明暗主題的材質 opacity。 */
  private opacityMultiplier = 1;

  private colorCache = new Map<string, THREE.Color>();
  /** instanceIndex → trail row (給 picking 用) */
  private trailIndex = new Map<number, WasteTrailRow>();
  /** 對外快照：collecting 中的 truck 已平滑後 Mercator 位置（給音符 scene 用） */
  private collectingPositions: Array<{ vehicle_no: string; x: number; y: number; z: number }> = [];

  private lastMatrix: THREE.Matrix4 | null = null;
  private _dummy = new THREE.Matrix4();

  constructor(maxInstances = 500) {
    this.maxInstances = maxInstances;
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

    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.alphaAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances).fill(1),
      1,
    );
    this.alphaAttribute.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aAlpha", this.alphaAttribute);

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float aAlpha;\nvarying float vAlpha;\n" +
        shader.vertexShader.replace(
          /void\s+main\s*\(\s*\)\s*\{/,
          "void main() {\n  vAlpha = aAlpha;",
        );
      shader.fragmentShader =
        "varying float vAlpha;\n" +
        shader.fragmentShader.replace(
          /\}\s*$/,
          "  gl_FragColor.a *= vAlpha;\n}",
        );
    };

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
      this.applyMaterialOpacity();
    }
  }

  setOrbScale(scale: number) { this.orbScale = scale; }
  setAltitudeOffset(offset: number) { this.altOffset = offset; }

  setOpacity(opacity: number) {
    this.opacityMultiplier = Math.max(0, Math.min(1, opacity));
    this.applyMaterialOpacity();
  }

  private applyMaterialOpacity() {
    if (!this.instancedMesh) return;
    const baseOpacity = this.isDarkTheme ? 0.85 : 0.7;
    (this.instancedMesh.material as THREE.MeshBasicMaterial).opacity =
      baseOpacity * this.opacityMultiplier;
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

  /**
   * 每幀呼叫：用指定時間對每車軌跡做時間插值。
   *
   * currentTimeSec 若貼近真實現在，視為 live，套 5 分鐘 visual lag；
   * 若是 timeline replay 的歷史時間，直接使用該時間，讓播放/倍速可見。
   */
  update(trails: WasteTrailRow[], currentTimeSec?: number) {
    if (!this.instancedMesh) return;

    const nowSec = wasteVisualTimeSec(currentTimeSec, Date.now());

    const dummy = this._dummy;
    const baseScale = this.orbScale * 0.5;
    let count = 0;
    this.trailIndex.clear();
    this.collectingPositions = [];

    for (const { row, frame } of computeWasteTruckFrames(trails, nowSec, { maxCount: this.maxInstances })) {
      const target = toMercator(frame.lat, frame.lng, this.altOffset);

      // 停車/離線縮小
      const sizeMul = frame.status === "parked" || frame.status === "offline" ? 0.6 : 1.0;
      const s = baseScale * sizeMul;
      dummy.makeScale(s, s, s);
      dummy.setPosition(target.x, target.y, target.z);
      this.instancedMesh.setMatrixAt(count, dummy);

      const colorHex = WASTE_STATUS_COLORS[frame.status] ?? "#9ca3af";
      const color = this.getColor(colorHex);
      this.instancedMesh.instanceColor!.setXYZ(count, color.r, color.g, color.b);

      // collecting → 暴露給音符 scene
      if (frame.status === "collecting" && frame.alpha > 0.5) {
        this.collectingPositions.push({
          vehicle_no: row.vehicle_no,
          x: target.x, y: target.y, z: target.z,
        });
      }

      // alpha：teleport 中 / stale 數據 自然降低
      if (this.alphaAttribute) {
        this.alphaAttribute.setX(count, frame.alpha);
      }

      this.trailIndex.set(count, row);
      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    if (this.alphaAttribute) this.alphaAttribute.needsUpdate = true;
  }

  /** 給 WasteMusicNoteScene 讀目前正在收運的車（已是 Mercator） */
  getCollectingPositions() {
    return this.collectingPositions;
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    if (!this.lastMatrix) this.lastMatrix = new THREE.Matrix4();
    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  pickTruck(screenX: number, screenY: number, viewWidth: number, viewHeight: number): WasteTrailRow | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;
    const threshold = 25;
    let closest: { row: WasteTrailRow; dist: number } | null = null;
    const mat = new THREE.Matrix4();
    for (const [idx, row] of this.trailIndex) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(mat.elements[12], mat.elements[13], mat.elements[14], 1.0);
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;
      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);
      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { row, dist };
      }
    }
    return closest?.row ?? null;
  }

  getVisibleCount(): number { return this.instancedMesh?.count ?? 0; }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.renderer?.dispose();
    this.colorCache.clear();
    this.trailIndex.clear();
  }
}
