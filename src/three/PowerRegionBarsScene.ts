import * as THREE from "three";
import { toMercator } from "../utils/coordinates";
import {
  REGION_CENTROIDS,
  RESERVE_INDICATOR_COLORS,
  FUEL_FALLBACK_COLOR,
  type PowerRegion,
  type PowerStatus,
} from "../data/energyLoader";

/**
 * 區域用電 3D 長條柱 (layer 3)
 *
 * - 4 區質心固定座標：北 / 中 / 南 / 東
 * - 柱高 ∝ consumption_mw（內部對 maxConsumption 正規化到 0~1）
 * - 柱色 = reserve_indicator（全國共用一個燈號，4 柱同色）
 * - 每 frame lerp 平滑（target → current，factor 0.05）→ 5 min cron 寫入時不瞬切
 *
 * 三 3D skill §5.3.2 數據量化 / §7.1 bars 樣式
 */

const BAR_WIDTH_M = 0.0007;     // mercator 單位寬度，約 25km 邊長
const BAR_BASE_HEIGHT = 0.0006; // 滿載柱高 mercator 單位，約 22km
const LERP_FACTOR = 0.05;

const REGION_ORDER = ["北部", "中部", "南部", "東部"] as const;
type RegionKey = typeof REGION_ORDER[number];

interface BarState {
  region: RegionKey;
  mc: { x: number; y: number; z: number };
  currentHeight: number;  // 0~1
  targetHeight: number;   // 0~1
}

export class PowerRegionBarsScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private mesh: THREE.InstancedMesh | null = null;
  private bars: BarState[] = [];
  private targetColor = new THREE.Color(FUEL_FALLBACK_COLOR);
  private currentColor = new THREE.Color(FUEL_FALLBACK_COLOR);
  private opacity = 0.5;
  private ownsRenderer = false;

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

    this.bars = REGION_ORDER.map((region) => {
      const centroid = REGION_CENTROIDS[region]!;
      const mc = toMercator(centroid[1], centroid[0], 0);
      return { region, mc, currentHeight: 0, targetHeight: 0 };
    });

    this.buildMesh();
  }

  private buildMesh() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    const geo = new THREE.BoxGeometry(BAR_WIDTH_M, BAR_WIDTH_M, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: this.currentColor.getHex(),
      transparent: true,
      opacity: this.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.bars.length);
    this.scene.add(this.mesh);
    this.updateMatrices();
  }

  /** 由 hook 餵入最新 dashboard：更新目標高度 + 目標色（4 區共用全國燈號） */
  setData(status: PowerStatus | null, regions: PowerRegion[]) {
    const byRegion = new Map<string, PowerRegion>();
    for (const r of regions) byRegion.set(r.region, r);

    // 用 consumption_mw 正規化，分母取 4 區 max（避免全部 < 1）
    let maxC = 0;
    for (const r of regions) {
      const c = r.consumption_mw ?? 0;
      if (c > maxC) maxC = c;
    }
    if (maxC <= 0) maxC = 1;

    for (const b of this.bars) {
      const r = byRegion.get(b.region);
      const c = r?.consumption_mw ?? 0;
      b.targetHeight = Math.max(0.02, Math.min(1, c / maxC));
    }

    const ind = status?.reserve_indicator?.toUpperCase() ?? "";
    const colorHex = RESERVE_INDICATOR_COLORS[ind] ?? FUEL_FALLBACK_COLOR;
    this.targetColor.set(colorHex);
  }

  setOpacity(o: number) {
    this.opacity = Math.max(0, Math.min(1, o));
    if (this.mesh) {
      (this.mesh.material as THREE.MeshBasicMaterial).opacity = this.opacity;
    }
  }

  setVisible(v: boolean) {
    if (this.mesh) this.mesh.visible = v;
  }

  private updateMatrices() {
    if (!this.mesh) return;
    const m = new THREE.Matrix4();
    const t = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    for (let i = 0; i < this.bars.length; i++) {
      const b = this.bars[i]!;
      const h = BAR_BASE_HEIGHT * b.currentHeight;
      t.makeTranslation(b.mc.x, b.mc.y, b.mc.z + h / 2);
      s.makeScale(1, 1, h);
      m.copy(t).multiply(s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    // Lerp heights toward target
    let anyMoving = false;
    for (const b of this.bars) {
      const diff = b.targetHeight - b.currentHeight;
      if (Math.abs(diff) > 1e-4) {
        b.currentHeight += diff * LERP_FACTOR;
        anyMoving = true;
      }
    }
    // Lerp color
    const colorDiff =
      Math.abs(this.currentColor.r - this.targetColor.r) +
      Math.abs(this.currentColor.g - this.targetColor.g) +
      Math.abs(this.currentColor.b - this.targetColor.b);
    if (colorDiff > 1e-3) {
      this.currentColor.lerp(this.targetColor, LERP_FACTOR);
      if (this.mesh) (this.mesh.material as THREE.MeshBasicMaterial).color.copy(this.currentColor);
      anyMoving = true;
    }
    if (anyMoving) this.updateMatrices();

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);

    return anyMoving;
  }

  /** 對應的區域中心，給 click hit-test 用 */
  getRegionCenters(): { region: string; lon: number; lat: number; targetHeight: number }[] {
    return this.bars.map((b) => ({
      region: b.region,
      lon: REGION_CENTROIDS[b.region]![0],
      lat: REGION_CENTROIDS[b.region]![1],
      targetHeight: b.targetHeight,
    }));
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
