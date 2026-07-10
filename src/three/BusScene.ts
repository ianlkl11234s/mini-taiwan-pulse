import * as THREE from "three";
import type { BusVehicle, BusColorMode } from "../types";
import { toMercator } from "../utils/coordinates";

// ── 速度漸層：紅(停)→橙(慢)→黃(正常)→綠(快) ──
const SPEED_STOPS = [
  { speed: 0,  color: new THREE.Color("#b71c1c") },  // 暗紅 — 停靠
  { speed: 3,  color: new THREE.Color("#e53935") },  // 紅
  { speed: 15, color: new THREE.Color("#ff9800") },  // 橙
  { speed: 30, color: new THREE.Color("#fdd835") },  // 黃
  { speed: 50, color: new THREE.Color("#66bb6a") },  // 綠
];

// ── 密度漸層：暗藍(冷門)→青→黃→紅(幹線) ──
const DENSITY_STOPS = [
  { count: 1,  color: new THREE.Color("#1a237e") },  // 暗藍
  { count: 3,  color: new THREE.Color("#0097a7") },  // 青
  { count: 8,  color: new THREE.Color("#fdd835") },  // 黃
  { count: 15, color: new THREE.Color("#ff5722") },  // 紅橙
];

function lerpStops(stops: { speed?: number; count?: number; color: THREE.Color }[], value: number, key: "speed" | "count"): THREE.Color {
  const result = new THREE.Color();
  if (value <= (stops[0] as any)[key]) return result.copy(stops[0]!.color);
  for (let i = 1; i < stops.length; i++) {
    const lo = (stops[i - 1] as any)[key] as number;
    const hi = (stops[i] as any)[key] as number;
    if (value <= hi) {
      const t = (value - lo) / (hi - lo);
      return result.copy(stops[i - 1]!.color).lerp(stops[i]!.color, t);
    }
  }
  return result.copy(stops[stops.length - 1]!.color);
}

/**
 * 公車場景 — InstancedMesh 光球（無 trail、無靜態路線）
 * 精簡版 RailScene，專為 GPS-based 公車設計
 */
export class BusScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private alphaAttribute: THREE.InstancedBufferAttribute | null = null;
  private maxInstances: number;
  private isDarkTheme = true;
  private orbScale = 0.000004;
  private altOffset = 0;

  private colorCache = new Map<string, THREE.Color>();
  private busPositions = new Map<number, BusVehicle>(); // instanceIndex → bus
  /** 視覺平滑：記住每輛車的上一幀 Mercator 座標 */
  private prevMercator = new Map<string, { x: number; y: number; z: number }>();
  private smoothFactor = 0.15; // 0=不動, 1=無平滑

  private lastMatrix: THREE.Matrix4 | null = null;
  private _dummy = new THREE.Matrix4();

  constructor(maxInstances = 5000) {
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

    // 比 rail 低一級 detail (1 vs 2)，因公車數量更多
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,  // 不被地形遮擋
    });

    // Per-instance alpha attribute (for fade in/out) — 注入 shader
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
      mat.opacity = isDark ? 0.85 : 0.7;
    }
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  setAltitudeOffset(offset: number) {
    this.altOffset = offset;
  }

  /**
   * 覆寫材質透明度（可選；未呼叫時 opacity 由 setTheme 依明暗主題決定）。
   * 每輛車共用同一個 InstancedMesh 材質，故此值套用到整個 scene 實例。
   * 僅台灣好行圖層有接（透過 busCustomLayer 的 getOpacity），
   * 市區公車 / 公路客運未接 → 行為不變。
   */
  setOpacity(opacity: number) {
    if (this.instancedMesh) {
      (this.instancedMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
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

  update(buses: BusVehicle[], colorMode: BusColorMode = "route") {
    if (!this.instancedMesh) return;
    // density 模式：直接讀 bus.density（preprocess 算好的班次/小時，固定值）
    // 不再每 frame 統計，負擔更低；顏色對同一班車永遠相同

    const dummy = this._dummy;
    const baseScale = this.orbScale * 0.5;
    const darkBoost = this.isDarkTheme ? 1.4 : 1.0;
    let count = 0;

    this.busPositions.clear();

    for (const bus of buses) {
      if (count >= this.maxInstances) break;

      const [lng, lat] = bus.position;
      if (lng === 0 && lat === 0) continue;

      const target = toMercator(lat, lng, this.altOffset);

      // 視覺平滑：route-snapped 的車不 lerp（位置已沿路線，lerp 會切角）
      // 無路線配對的車用 lerp 避免 GPS 跳躍
      let fx: number, fy: number, fz: number;
      if (bus.progress > 0) {
        // route-snapped：直接到位
        fx = target.x; fy = target.y; fz = target.z;
      } else {
        // 無路線：lerp 平滑
        const prev = this.prevMercator.get(bus.plateNumb);
        if (prev) {
          const s = this.smoothFactor;
          fx = prev.x + (target.x - prev.x) * s;
          fy = prev.y + (target.y - prev.y) * s;
          fz = prev.z + (target.z - prev.z) * s;
        } else {
          fx = target.x; fy = target.y; fz = target.z;
        }
      }
      this.prevMercator.set(bus.plateNumb, { x: fx, y: fy, z: fz });

      dummy.makeScale(baseScale, baseScale, baseScale);
      dummy.setPosition(fx, fy, fz);
      this.instancedMesh.setMatrixAt(count, dummy);

      let color: THREE.Color;
      if (colorMode === "speed") {
        color = lerpStops(SPEED_STOPS, bus.speed, "speed");
        if (this.isDarkTheme) color.multiplyScalar(darkBoost);
      } else if (colorMode === "density") {
        // frequency（班次/小時）直接上色：高頻 → 暖色、低頻 → 冷色
        const freq = bus.density ?? 0.5;
        color = lerpStops(DENSITY_STOPS, freq, "count");
        if (this.isDarkTheme) color.multiplyScalar(darkBoost);
      } else {
        color = this.getColor(bus.color);
      }
      this.instancedMesh.instanceColor!.setXYZ(count, color.r, color.g, color.b);

      // Per-instance alpha（淡入淡出）
      if (this.alphaAttribute) {
        const a = bus.fadeAlpha ?? 1;
        this.alphaAttribute.setX(count, a);
      }

      this.busPositions.set(count, bus);
      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    if (this.alphaAttribute) {
      this.alphaAttribute.needsUpdate = true;
    }

    // 清理不再活躍的平滑快取（每 60 幀一次）
    if (this.prevMercator.size > count * 2) {
      const activeKeys = new Set(buses.map((b) => b.plateNumb));
      for (const key of this.prevMercator.keys()) {
        if (!activeKeys.has(key)) this.prevMercator.delete(key);
      }
    }
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
