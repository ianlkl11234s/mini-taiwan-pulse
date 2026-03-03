import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import type { TemperatureGridData } from "../data/temperatureLoader";

// ── 溫度發散色盤（藍→白→紅，RdBu diverging） ──
// 中心點 ~15°C（台灣冬季均溫），冷色往藍、暖色往紅
const DIVERGING_STOPS: { t: number; r: number; g: number; b: number }[] = [
  { t: 0.000, r: 0x21 / 255, g: 0x66 / 255, b: 0xac / 255 }, // #2166ac  -10°C  深藍
  { t: 0.222, r: 0x67 / 255, g: 0xa9 / 255, b: 0xcf / 255 }, // #67a9cf    0°C  中藍
  { t: 0.389, r: 0xd1 / 255, g: 0xe5 / 255, b: 0xf0 / 255 }, // #d1e5f0  7.5°C  淺藍
  { t: 0.556, r: 0xf7 / 255, g: 0xf7 / 255, b: 0xf7 / 255 }, // #f7f7f7   15°C  近白（中心）
  { t: 0.667, r: 0xfd / 255, g: 0xdb / 255, b: 0xc7 / 255 }, // #fddbc7   20°C  淺橙
  { t: 0.778, r: 0xef / 255, g: 0x8a / 255, b: 0x62 / 255 }, // #ef8a62   25°C  橙紅
  { t: 1.000, r: 0xb2 / 255, g: 0x18 / 255, b: 0x2b / 255 }, // #b2182b   35°C  深紅
];

function temperatureToColor(temp: number, tMin: number, tRange: number, out: Float32Array, offset: number) {
  // 用實際資料範圍正規化 → 0~1
  const t = Math.max(0, Math.min(1, (temp - tMin) / tRange));

  let i = 0;
  while (i < DIVERGING_STOPS.length - 2 && DIVERGING_STOPS[i + 1]!.t < t) i++;
  const s0 = DIVERGING_STOPS[i]!;
  const s1 = DIVERGING_STOPS[i + 1]!;
  const f = s1.t > s0.t ? (t - s0.t) / (s1.t - s0.t) : 0;

  out[offset] = s0.r + (s1.r - s0.r) * f;
  out[offset + 1] = s0.g + (s1.g - s0.g) * f;
  out[offset + 2] = s0.b + (s1.b - s0.b) * f;
}

const BASE_HEIGHT = 0.000005; // 每單位 heightScale 的 Mercator Z 高度

/**
 * TemperatureWaveScene — 溫度 3D 波浪曲面
 *
 * 使用 BufferGeometry 建立 grid mesh，海洋 cell 的三角形剔除。
 * vertex position.z = 正規化溫度 × heightScale
 * vertex color = Magma 色盤
 * 每幀 lerp 兩相鄰 frame 的 vertex 高度，實現平滑動畫
 */
export class TemperatureWaveScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private mesh: THREE.Mesh | null = null;
  private wireframeMesh: THREE.LineSegments | null = null;
  private ownsRenderer = false;

  // Grid data
  private data: TemperatureGridData | null = null;
  private rows = 0;
  private cols = 0;
  private landSet = new Set<number>();
  private mercatorXY: Float64Array | null = null; // [x0, y0, x1, y1, ...] for ALL grid verts
  private baseZ = 0; // Z value at sea level

  // State
  private currentTime = 0; // unix timestamp（秒）
  private heightScale = 50;
  private zOffset = 300; // 整體 Z 軸抬升量（同 heightScale 單位）
  private opacity = 0.85;
  private extruded = true; // true=3D 波浪, false=平面色圖
  private showWireframe = false;

  // Geometry refs
  private posAttr: THREE.BufferAttribute | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;

  // Vertex ↔ grid mapping
  // We only create vertices for land cells, not the full grid.
  // But for triangle connectivity we need ALL grid vertices that participate in at least one land triangle.
  // Simpler approach: create vertices for ALL grid cells and just skip ocean triangles in the index buffer.
  // 8040 vertices is tiny, no perf concern.

  init(glOrRenderer: WebGLRenderingContext | THREE.WebGLRenderer) {
    if (glOrRenderer instanceof THREE.WebGLRenderer) {
      this.renderer = glOrRenderer;
      this.ownsRenderer = false;
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: glOrRenderer.canvas as HTMLCanvasElement,
        context: glOrRenderer as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.ownsRenderer = true;
    }
  }

  setData(data: TemperatureGridData) {
    this.data = data;
    this.rows = data.metadata.rows;
    this.cols = data.metadata.cols;
    this.landSet = new Set(data.landIndices);

    this.computeMercatorPositions();
    this.buildGeometry();
  }

  private computeMercatorPositions() {
    const { rows, cols } = this;
    const { bottomLeftLon, bottomLeftLat, resolutionDeg } = this.data!.metadata;
    const totalVerts = rows * cols;
    this.mercatorXY = new Float64Array(totalVerts * 2);

    // Compute base Z at sea level (mid-latitude of Taiwan)
    const midLat = bottomLeftLat + (rows * resolutionDeg) / 2;
    const mcBase = mapboxgl.MercatorCoordinate.fromLngLat([bottomLeftLon, midLat], 0);
    this.baseZ = mcBase.z;

    for (let r = 0; r < rows; r++) {
      const lat = bottomLeftLat + r * resolutionDeg;
      for (let c = 0; c < cols; c++) {
        const lng = bottomLeftLon + c * resolutionDeg;
        const idx = r * cols + c;
        // x = Mercator x
        this.mercatorXY[idx * 2] = (lng + 180) / 360;
        // y = Mercator y
        const mc = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
        this.mercatorXY[idx * 2 + 1] = mc.y;
      }
    }
  }

  private buildGeometry() {
    this.disposeGeometry();

    const { rows, cols, landSet, mercatorXY } = this;
    if (!mercatorXY || !this.data) return;

    const totalVerts = rows * cols;

    // Position buffer (x, y, z) — z 先設為 baseZ
    const positions = new Float32Array(totalVerts * 3);
    for (let i = 0; i < totalVerts; i++) {
      positions[i * 3] = mercatorXY[i * 2]!;
      positions[i * 3 + 1] = mercatorXY[i * 2 + 1]!;
      positions[i * 3 + 2] = this.baseZ;
    }

    // Color buffer (r, g, b) — 初始灰色
    const colors = new Float32Array(totalVerts * 3);
    colors.fill(0.3);

    // Index buffer — 只建立至少有 1 個 vertex 在陸地的 cell 的三角形
    // 更精確：只建立所有 4 個角都是陸地的 cell 三角形
    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const v00 = r * cols + c;
        const v01 = r * cols + (c + 1);
        const v10 = (r + 1) * cols + c;
        const v11 = (r + 1) * cols + (c + 1);

        // 只要任一頂點不是陸地就跳過
        if (!landSet.has(v00) || !landSet.has(v01) || !landSet.has(v10) || !landSet.has(v11)) continue;

        // 兩個三角形 (CCW winding)
        indices.push(v00, v10, v01);
        indices.push(v10, v11, v01);
      }
    }

    const geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute("position", this.posAttr);
    geometry.setAttribute("color", this.colorAttr);
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Wireframe overlay
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    this.wireframeMesh = new THREE.LineSegments(wireGeo, wireMat);
    this.wireframeMesh.visible = this.showWireframe;
    this.scene.add(this.wireframeMesh);

    // 立即用第一幀更新
    this.updateVertices(0, 0, 0);
  }

  private updateVertices(frameA: number, frameB: number, lerpFactor: number) {
    if (!this.data || !this.posAttr || !this.colorAttr) return;

    const { landIndices, frames } = this.data;
    const { tempMin, tempMax } = this.data.metadata;
    const tempRange = tempMax - tempMin || 1;

    const fA = frames[frameA]!;
    const fB = frames[frameB]!;
    const positions = this.posAttr.array as Float32Array;
    const colors = this.colorAttr.array as Float32Array;
    const h = BASE_HEIGHT * this.heightScale;
    const zBase = this.baseZ + BASE_HEIGHT * this.zOffset; // 整體抬升

    for (let li = 0; li < landIndices.length; li++) {
      const gridIdx = landIndices[li]!;
      const tempA = fA.values[li]! / 10; // 還原為實際溫度
      const tempB = fB.values[li]! / 10;
      const temp = tempA + (tempB - tempA) * lerpFactor;

      // Z: zBase（抬升後的基底）+ 3D 模式加溫度高度
      if (this.extruded) {
        const norm = (temp - tempMin) / tempRange;
        positions[gridIdx * 3 + 2] = zBase + norm * h;
      } else {
        positions[gridIdx * 3 + 2] = zBase;
      }

      // Color
      temperatureToColor(temp, tempMin, tempRange, colors, gridIdx * 3);
    }

    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  setHeightScale(v: number) { this.heightScale = v; }
  setZOffset(v: number) { this.zOffset = v; }
  setExtruded(v: boolean) { this.extruded = v; }
  setOpacity(v: number) {
    this.opacity = v;
    if (this.mesh) (this.mesh.material as THREE.MeshBasicMaterial).opacity = v;
  }
  /** 接收 timeline 的 unix timestamp（秒） */
  setCurrentTime(unixSec: number) {
    this.currentTime = unixSec;
  }
  setWireframe(v: boolean) {
    this.showWireframe = v;
    if (this.wireframeMesh) this.wireframeMesh.visible = v;
  }

  /** Binary search: 找到 currentTime 左側最近的 frame index */
  private findFrameIndex(t: number): number {
    const frames = this.data!.frames;
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid]!.time <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  render(matrix: number[]) {
    if (!this.data || !this.mesh) return;

    const { frames } = this.data;
    const t = this.currentTime;

    // 找到兩個 bracketing frames 做 lerp
    let frameA: number;
    let frameB: number;
    let lerpFactor: number;

    if (t <= frames[0]!.time) {
      // 在資料範圍之前 → 用第一幀
      frameA = 0;
      frameB = 0;
      lerpFactor = 0;
    } else if (t >= frames[frames.length - 1]!.time) {
      // 在資料範圍之後 → 用最後一幀
      frameA = frames.length - 1;
      frameB = frameA;
      lerpFactor = 0;
    } else {
      frameA = this.findFrameIndex(t);
      frameB = Math.min(frameA + 1, frames.length - 1);
      const tA = frames[frameA]!.time;
      const tB = frames[frameB]!.time;
      lerpFactor = tB > tA ? (t - tA) / (tB - tA) : 0;
    }

    this.updateVertices(frameA, frameB, lerpFactor);

    // Render
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

  private disposeGeometry() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.wireframeMesh) {
      this.scene.remove(this.wireframeMesh);
      this.wireframeMesh.geometry.dispose();
      (this.wireframeMesh.material as THREE.Material).dispose();
      this.wireframeMesh = null;
    }
    this.posAttr = null;
    this.colorAttr = null;
  }

  dispose() {
    this.disposeGeometry();
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
