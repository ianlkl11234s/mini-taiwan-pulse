import * as THREE from "three";
import { toMercator, metersPerUnit } from "../utils/coordinates";

/**
 * 消防分隊 Three.js 視覺 — 依階級分大小/高度的光柱 + 向外擴張漣漪。
 *
 * 解決「四個階級只靠顏色看不出來」：
 *   - 光柱高度 + 半徑依 cat（大隊 > 分隊 > 分駐所 > 其他）
 *   - 頂端發光球 + 地面同步擴張漣漪環（sonar ping 感的「向外波動」）
 *
 * 疊在既有 Mapbox circle 之上（circle 負責俯視可見 + click popup）。
 * 677 點用 InstancedMesh（3 個：柱/帽/漣漪），per-instance 顏色 + scale。
 * 動畫走 performance.now()（純視覺，不綁時間軸）。
 */

export interface FireStationRow {
  lng: number;
  lat: number;
  cat: string;
}

interface RankCfg {
  color: number;
  pillarH: number;   // 公尺
  pillarR: number;
  cap: number;
  ripple: number;
}

// 加性混合需偏亮色才會發光；hue 順序對齊圖例（紅→橙→琥珀→灰）
const RANK_CFG: Record<string, RankCfg> = {
  "大隊":   { color: 0xff3030, pillarH: 340, pillarR: 30, cap: 48, ripple: 300 },
  "分隊":   { color: 0xff6b3d, pillarH: 210, pillarR: 22, cap: 36, ripple: 200 },
  "分駐所": { color: 0xffab40, pillarH: 135, pillarR: 17, cap: 27, ripple: 135 },
  "其他":   { color: 0xb0bec5, pillarH:  90, pillarR: 13, cap: 20, ripple:  95 },
};
const DEFAULT_CFG = RANK_CFG["其他"]!;

export class FireStationScene {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  renderer!: THREE.WebGLRenderer;

  private pillar: THREE.InstancedMesh | null = null;
  private cap: THREE.InstancedMesh | null = null;
  private ripple: THREE.InstancedMesh | null = null;
  private rippleMat: THREE.MeshBasicMaterial | null = null;

  /** 每個漣漪 instance 的地面位置 + 基準半徑（mercator unit），animate 用 */
  private rippleBase: { x: number; y: number; z: number; r: number }[] = [];

  private rows: FireStationRow[] = [];
  private sizeMul = 1;
  private opacityMul = 0.85;
  private visible = false;
  private meterUnit = metersPerUnit(23.7);
  private lastMatrix: THREE.Matrix4 | null = null;

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setVisible(v: boolean) { this.visible = v; }

  setOpacity(o: number) {
    this.opacityMul = Math.max(0, Math.min(1, o));
    this.applyOpacity();
  }

  setScale(s: number) {
    const ns = Math.max(0.3, s);
    if (ns === this.sizeMul) return;
    this.sizeMul = ns;
    this.rebuild();
  }

  setRows(rows: FireStationRow[]) {
    this.rows = rows;
    if (rows.length > 0) {
      this.meterUnit = metersPerUnit(rows.reduce((s, r) => s + r.lat, 0) / rows.length);
    }
    this.rebuild();
  }

  private disposeMeshes() {
    for (const m of [this.pillar, this.cap, this.ripple]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.pillar = this.cap = this.ripple = null;
    this.rippleMat = null;
    this.rippleBase = [];
  }

  private rebuild() {
    this.disposeMeshes();
    const n = this.rows.length;
    if (n === 0) return;
    const mu = this.meterUnit;
    const sm = this.sizeMul;

    // 單位幾何（柱沿 +z、base 在 z=0；帽為單位球；漣漪為躺平的環）
    const pillarGeo = new THREE.CylinderGeometry(0.35, 1, 1, 10, 1, true);
    pillarGeo.translate(0, 0.5, 0);
    pillarGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.SphereGeometry(1, 10, 10);
    const rippleGeo = new THREE.RingGeometry(0.82, 1.0, 28);

    const pillarMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.55 * this.opacityMul,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const capMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.9 * this.opacityMul,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.rippleMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.4 * this.opacityMul,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });

    this.pillar = new THREE.InstancedMesh(pillarGeo, pillarMat, n);
    this.cap = new THREE.InstancedMesh(capGeo, capMat, n);
    this.ripple = new THREE.InstancedMesh(rippleGeo, this.rippleMat, n);
    for (const m of [this.pillar, this.cap, this.ripple]) m.frustumCulled = false;

    const mat = new THREE.Matrix4();
    let i = 0;
    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const cfg = RANK_CFG[row.cat] ?? DEFAULT_CFG;
      const m = toMercator(row.lat, row.lng, 0);
      const col = new THREE.Color(cfg.color);

      const pr = cfg.pillarR * sm * mu;
      const ph = cfg.pillarH * sm * mu;
      mat.makeScale(pr, pr, ph).setPosition(m.x, m.y, m.z);
      this.pillar.setMatrixAt(i, mat);
      this.pillar.setColorAt(i, col);

      const cr = cfg.cap * sm * mu;
      mat.makeScale(cr, cr, cr).setPosition(m.x, m.y, m.z + ph);
      this.cap.setMatrixAt(i, mat);
      this.cap.setColorAt(i, col);

      const rr = cfg.ripple * sm * mu;
      mat.makeScale(rr, rr, 1).setPosition(m.x, m.y, m.z + 2 * mu);
      this.ripple.setMatrixAt(i, mat);
      this.ripple.setColorAt(i, col);
      this.rippleBase.push({ x: m.x, y: m.y, z: m.z + 2 * mu, r: rr });
      i++;
    }
    this.pillar.count = this.cap.count = this.ripple.count = i;
    for (const m of [this.pillar, this.cap, this.ripple]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.pillar, this.cap, this.ripple);
  }

  private applyOpacity() {
    if (this.pillar) (this.pillar.material as THREE.MeshBasicMaterial).opacity = 0.55 * this.opacityMul;
    if (this.cap) (this.cap.material as THREE.MeshBasicMaterial).opacity = 0.9 * this.opacityMul;
    // ripple opacity 由 animate 依 phase 控制
  }

  private animate(tSec: number) {
    if (!this.ripple || !this.rippleMat) return;
    // 同步擴張環：scale 0.3→2.5、opacity 1→0，週期 ~1.6s（sonar ping）
    const phase = (tSec / 1.6) % 1;
    const expand = 0.3 + phase * 2.2;
    this.rippleMat.opacity = (1 - phase) * 0.45 * this.opacityMul;
    const mat = new THREE.Matrix4();
    for (let i = 0; i < this.rippleBase.length; i++) {
      const b = this.rippleBase[i]!;
      const s = b.r * expand;
      mat.makeScale(s, s, 1).setPosition(b.x, b.y, b.z);
      this.ripple.setMatrixAt(i, mat);
    }
    this.ripple.instanceMatrix.needsUpdate = true;
  }

  render(matrix: number[]) {
    if (!this.visible || this.rows.length === 0 || !this.pillar) return;

    this.animate(performance.now() / 1000);

    const gl = this.renderer.getContext();
    const be = gl.isEnabled(gl.BLEND);
    const bs = gl.getParameter(gl.BLEND_SRC_RGB);
    const bd = gl.getParameter(gl.BLEND_DST_RGB);
    const bsa = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const bda = gl.getParameter(gl.BLEND_DST_ALPHA);

    if (!this.lastMatrix) this.lastMatrix = new THREE.Matrix4();
    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (be) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(bs, bd, bsa, bda);
  }

  dispose() {
    this.disposeMeshes();
    this.renderer?.dispose();
    this.rows = [];
  }
}
