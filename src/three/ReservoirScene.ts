import * as THREE from "three";
import { toMercator, getAltOffset, setAltOffset, getAltExaggeration, setAltExaggeration, metersPerUnit } from "../utils/coordinates";
import type { ReservoirStatus } from "../data/reservoirStatusLoader";
import { ALERT_COLOR_HEX } from "../data/reservoirStatusLoader";

/**
 * 水庫水位計 3D 場景
 *
 * 視覺語言（使用者決策 2026-04-22）：
 *   - 外殼 cylinder（固定高度 = 滿水容量規模，半透明邊框）
 *     - 基座半徑 ∝ cube_root(effective_capacity_wan)（容量大 → 杯子大）
 *     - 高度固定（視覺校準）
 *   - 內部 water cylinder（可變高度 = 當下蓄水率 %）
 *     - 半徑略小於外殼（留殼厚度）
 *     - 高度 = H_SHELL × storage_ratio_pct / 100
 *     - 顏色依 alert_level（critical=紅 / warning=橘 / normal=青 / high=綠）
 *
 * 兩組 InstancedMesh 共享水庫陣列，單次 draw call × 2。
 */

// Mercator 單位（參考 station pillar 的尺寸校準值）
const H_SHELL_METERS = 8000;    // 外殼高度（公尺，台灣中緯度投影後約 10km 視覺）
const R_MIN_METERS = 500;       // 最小容量對應半徑（公尺）
const R_MAX_METERS = 8000;      // 最大容量對應半徑
const SHELL_THICKNESS = 0.85;   // 內水圓柱半徑 = 外殼 × SHELL_THICKNESS

const CYLINDER_SEGMENTS = 20;

// 進/出流 雙排日柱視覺化（active reservoir 專屬，BL-5 方案 D）
// 注意：柱體總高應 ≤ H_SHELL × 1.5，否則高 zoom + pitch 時會被 viewport 截頂
const OPS_BAR_SIDE_FACTOR = 0.22;        // 柱體邊長相對外殼半徑
const OPS_BAR_SPACING_FACTOR = 2.6;      // 同排柱心距相對邊長
const OPS_ROW_OFFSET_FACTOR = 1.35;      // N-S 兩排間距相對外殼半徑（> 1 = 外殼外側，避免與殼重疊）
const OPS_FLOAT_Z_FACTOR = 0.1;          // 底部浮在地面上方 × H_SHELL_METERS（低空浮空，不搶殼頂空間）
const OPS_MAX_HEIGHT_FACTOR = 0.45;      // 柱最大高度相對 H_SHELL_METERS（柱頂 ≤ 0.55 × shell）
const OPS_CMS_LOG_BASE = 100;            // log(cms) 正規化基準：100 cms → 全高
const OPS_CMS_COLOR_REF = 30;            // 超過此 cms 顏色達最深

interface InstanceDatum {
  /** 原 RPC 資料（for pick callback 回查）*/
  status: ReservoirStatus;
  /** Mercator 基座座標（lat/lng → mercator）*/
  mercator: { x: number; y: number; z: number };
  /** 容量決定的基座半徑（Mercator 單位）*/
  radiusMercator: number;
  /** 水柱填充高度（Mercator 單位）*/
  waterHeightMercator: number;
  /** 外殼高度（Mercator 單位）*/
  shellHeightMercator: number;
  /** 警示燈號顏色 */
  waterColorHex: number;
}

/** 單日進/出流量（cms） */
export interface OpsDayValue {
  date: string;
  inflow_cms: number;
  outflow_cms: number;
}

/** Active reservoir 的進/出流視覺化輸入（每日陣列）*/
export interface ActiveOpsInput {
  reservoir_id: string;
  days: OpsDayValue[]; // 最舊在前
}

/** 內部結構：含座標與縮放後的 mercator 值 */
interface ActiveOpsState extends ActiveOpsInput {
  mercator: { x: number; y: number; z: number };
  radiusMercator: number;
  shellHeightMercator: number;
}

export class ReservoirScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private shellMesh: THREE.InstancedMesh | null = null;
  private waterMesh: THREE.InstancedMesh | null = null;
  private inflowMesh: THREE.InstancedMesh | null = null;
  private outflowMesh: THREE.InstancedMesh | null = null;
  private activeOps: ActiveOpsState | null = null;
  private data: InstanceDatum[] = [];
  private isDark = true;
  private ownsRenderer = false;
  private heightScale = 1;
  private lastMatrix: number[] | null = null;

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

  setStatuses(statuses: ReservoirStatus[]) {
    // 僅保留有經緯度與容量的紀錄
    const valid = statuses.filter(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        (s.effective_capacity_wan ?? 0) > 0,
    );

    // Fast path：站點組與順序與現有 data 完全相同，只需更新水位高度 + 顏色
    // 避免 per-tick 拆除/重建 InstancedMesh GPU buffer（timeline 回放必備）
    const sameSet =
      this.shellMesh != null &&
      this.waterMesh != null &&
      valid.length === this.data.length &&
      valid.every((s, i) => s.reservoir_id === this.data[i]!.status.reservoir_id);

    if (sameSet) {
      const color = new THREE.Color();
      for (let i = 0; i < valid.length; i++) {
        const s = valid[i]!;
        const d = this.data[i]!;
        const m = metersPerUnit(s.lat);
        const ratio = Math.max(0, Math.min(1, (s.storage_ratio_pct ?? 0) / 100));
        d.status = s;
        d.waterHeightMercator = H_SHELL_METERS * m * ratio;
        d.waterColorHex =
          ALERT_COLOR_HEX[s.alert_level ?? "normal"] ?? ALERT_COLOR_HEX["normal"]!;
        color.setHex(d.waterColorHex);
        this.waterMesh!.instanceColor!.setXYZ(i, color.r, color.g, color.b);
      }
      this.waterMesh!.instanceColor!.needsUpdate = true;
      this.updateMatrices();
      // Active ops 位置是追隨水庫，setStatuses 不改 lat/lng，所以不需重算
      // 但 heightScale 若同步更新 ops 已在 setHeightScale 處理
      return;
    }

    console.log(`[ReservoirScene] setStatuses input=${statuses.length} (full rebuild)`);
    // Slow path：站點組變動，走完整 rebuild
    const savedOffset = getAltOffset();
    const savedExag = getAltExaggeration();
    setAltOffset(0);
    setAltExaggeration(1);

    const cbrts = valid.map((s) => Math.cbrt(s.effective_capacity_wan ?? 1));
    const minC = Math.min(...cbrts);
    const maxC = Math.max(...cbrts);
    const spread = Math.max(maxC - minC, 1e-6);

    this.data = valid.map((s, i) => {
      const mercator = toMercator(s.lat, s.lng, 0);
      const m = metersPerUnit(s.lat);
      const radiusM = R_MIN_METERS + ((cbrts[i]! - minC) / spread) * (R_MAX_METERS - R_MIN_METERS);
      const shellHeightM = H_SHELL_METERS;
      const ratio = Math.max(0, Math.min(1, (s.storage_ratio_pct ?? 0) / 100));
      const waterHeightM = shellHeightM * ratio;
      const alertKey = s.alert_level ?? "normal";
      return {
        status: s,
        mercator,
        radiusMercator: radiusM * m,
        shellHeightMercator: shellHeightM * m,
        waterHeightMercator: waterHeightM * m,
        waterColorHex: ALERT_COLOR_HEX[alertKey] ?? ALERT_COLOR_HEX["normal"]!,
      };
    });

    setAltOffset(savedOffset);
    setAltExaggeration(savedExag);

    this.rebuild();

    // 若 active ops 已設定，重算對應位置（水庫 mercator 可能變了）
    if (this.activeOps) {
      const target = this.data.find((d) => d.status.reservoir_id === this.activeOps!.reservoir_id);
      if (target) {
        this.activeOps.mercator = target.mercator;
        this.activeOps.radiusMercator = target.radiusMercator;
        this.activeOps.shellHeightMercator = target.shellHeightMercator;
        this.updateOpsMatrices();
      }
    }
  }

  private rebuild() {
    this.disposeMeshes();
    const count = this.data.length;
    console.log(`[ReservoirScene] rebuild count=${count}`,
      count > 0 ? {
        sample: {
          name: this.data[0]!.status.name,
          mc: this.data[0]!.mercator,
          r: this.data[0]!.radiusMercator,
          shellH: this.data[0]!.shellHeightMercator,
          waterH: this.data[0]!.waterHeightMercator,
        },
      } : null);
    if (count === 0) return;

    // 單位 cylinder（radius=1, height=1），旋轉至 Z 軸向上
    const shellGeo = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, true /* openEnded */);
    shellGeo.rotateX(Math.PI / 2);

    const waterGeo = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, false);
    waterGeo.rotateX(Math.PI / 2);

    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: this.isDark ? 0.18 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const waterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, // 會被 instanceColor 覆蓋
      transparent: true,
      opacity: this.isDark ? 0.85 : 0.9,
      depthWrite: false,
    });

    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, count);
    this.waterMesh = new THREE.InstancedMesh(waterGeo, waterMat, count);
    this.waterMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

    const colorTmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      colorTmp.setHex(this.data[i]!.waterColorHex);
      this.waterMesh.instanceColor!.setXYZ(i, colorTmp.r, colorTmp.g, colorTmp.b);
    }
    this.waterMesh.instanceColor!.needsUpdate = true;

    this.updateMatrices();
    this.scene.add(this.shellMesh);
    this.scene.add(this.waterMesh);
  }

  private updateMatrices() {
    if (!this.shellMesh || !this.waterMesh) return;

    const tmp = new THREE.Matrix4();
    const scale = new THREE.Matrix4();

    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i]!;
      const r = d.radiusMercator;
      const shellH = d.shellHeightMercator * this.heightScale;
      const waterH = d.waterHeightMercator * this.heightScale;

      // 外殼：位置中心在 z = shellH/2，scale(r, r, shellH)
      tmp.makeTranslation(d.mercator.x, d.mercator.y, d.mercator.z + shellH / 2);
      scale.makeScale(r, r, shellH);
      tmp.multiply(scale);
      this.shellMesh.setMatrixAt(i, tmp);

      // 水位：位置中心在 z = waterH/2，scale(r*thickness, r*thickness, waterH)
      tmp.makeTranslation(d.mercator.x, d.mercator.y, d.mercator.z + waterH / 2);
      scale.makeScale(r * SHELL_THICKNESS, r * SHELL_THICKNESS, waterH);
      tmp.multiply(scale);
      this.waterMesh.setMatrixAt(i, tmp);
    }
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.waterMesh.instanceMatrix.needsUpdate = true;
  }

  private disposeMeshes() {
    for (const m of [this.shellMesh, this.waterMesh]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.shellMesh = null;
    this.waterMesh = null;
  }

  private disposeOpsMeshes() {
    for (const m of [this.inflowMesh, this.outflowMesh]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.inflowMesh = null;
    this.outflowMesh = null;
  }

  setVisible(v: boolean) {
    if (this.shellMesh) this.shellMesh.visible = v;
    if (this.waterMesh) this.waterMesh.visible = v;
    if (this.inflowMesh) this.inflowMesh.visible = v && this.activeOps != null;
    if (this.outflowMesh) this.outflowMesh.visible = v && this.activeOps != null;
  }

  /**
   * 設定當前點選水庫的進/出流「雙排日柱陣」
   * @param input  { reservoir_id, days: [...] } 或 null 清除
   */
  setActiveOps(input: ActiveOpsInput | null) {
    if (!input || input.days.length === 0) {
      this.activeOps = null;
      if (this.inflowMesh) this.inflowMesh.visible = false;
      if (this.outflowMesh) this.outflowMesh.visible = false;
      return;
    }
    const target = this.data.find((d) => d.status.reservoir_id === input.reservoir_id);
    if (!target) {
      console.warn(`[ReservoirScene] setActiveOps: reservoir_id ${input.reservoir_id} not found in scene`);
      this.activeOps = null;
      return;
    }
    this.activeOps = {
      ...input,
      mercator: target.mercator,
      radiusMercator: target.radiusMercator,
      shellHeightMercator: target.shellHeightMercator,
    };
    this.ensureOpsMeshes(input.days.length);
    this.updateOpsMatrices();
  }

  /** 確保 InstancedMesh count 與 N 日匹配，否則重建 */
  private ensureOpsMeshes(n: number) {
    if (this.inflowMesh?.count === n && this.outflowMesh?.count === n) return;
    this.disposeOpsMeshes();
    if (n <= 0) return;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mkMat = () => new THREE.MeshBasicMaterial({
      color: 0xffffff, // 會被 instanceColor 覆蓋
      transparent: true,
      opacity: this.isDark ? 0.9 : 0.92,
      depthWrite: false,
    });

    this.inflowMesh = new THREE.InstancedMesh(geo, mkMat(), n);
    this.inflowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.outflowMesh = new THREE.InstancedMesh(geo.clone(), mkMat(), n);
    this.outflowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    this.scene.add(this.inflowMesh);
    this.scene.add(this.outflowMesh);
  }

  private updateOpsMatrices() {
    if (!this.inflowMesh || !this.outflowMesh || !this.activeOps) return;
    const ops = this.activeOps;
    const n = ops.days.length;
    if (n === 0) return;

    const mercPerMeter = ops.shellHeightMercator / H_SHELL_METERS;
    const barSide = ops.radiusMercator * OPS_BAR_SIDE_FACTOR;
    const spacingX = barSide * OPS_BAR_SPACING_FACTOR;
    const totalLen = (n - 1) * spacingX;
    const startX = ops.mercator.x - totalLen / 2;
    const rowOffsetY = ops.radiusMercator * OPS_ROW_OFFSET_FACTOR;
    const floatZ = ops.mercator.z + (H_SHELL_METERS * OPS_FLOAT_Z_FACTOR) * mercPerMeter * this.heightScale;
    const maxBarH = H_SHELL_METERS * OPS_MAX_HEIGHT_FACTOR * mercPerMeter * this.heightScale;

    const toHeight = (cms: number) => {
      if (cms <= 0) return barSide * 0.3; // 空值也給個小柱高當基準（避免完全消失）
      const norm = Math.log10(cms + 1) / Math.log10(OPS_CMS_LOG_BASE + 1);
      return Math.max(barSide * 0.3, Math.min(1, norm) * maxBarH);
    };

    const tmp = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const d = ops.days[i]!;
      const x = startX + i * spacingX;

      // ─── Inflow row（北側）─────────────────────────────
      const inH = toHeight(d.inflow_cms);
      tmp.makeTranslation(x, ops.mercator.y + rowOffsetY, floatZ + inH / 2);
      s.makeScale(barSide, barSide, inH);
      tmp.multiply(s);
      this.inflowMesh.setMatrixAt(i, tmp);
      // 顏色：低=淡青，高=飽和綠（HSL 漸層）
      const inT = Math.min(1, d.inflow_cms / OPS_CMS_COLOR_REF);
      color.setHSL(0.48 - inT * 0.15, 0.55 + inT * 0.3, 0.6 - inT * 0.1);
      this.inflowMesh.instanceColor!.setXYZ(i, color.r, color.g, color.b);

      // ─── Outflow row（南側）────────────────────────────
      const outH = toHeight(d.outflow_cms);
      tmp.makeTranslation(x, ops.mercator.y - rowOffsetY, floatZ + outH / 2);
      s.makeScale(barSide, barSide, outH);
      tmp.multiply(s);
      this.outflowMesh.setMatrixAt(i, tmp);
      // 顏色：正常橘 → 警示紅（出流 > 進流 × 1.5 且 > 0.5 cms 時偏紅）
      const alert = d.outflow_cms > d.inflow_cms * 1.5 && d.outflow_cms > 0.5;
      const outT = Math.min(1, d.outflow_cms / OPS_CMS_COLOR_REF);
      if (alert) {
        color.setHSL(0.02, 0.8, 0.58 - outT * 0.1); // 紅
      } else {
        color.setHSL(0.08 - outT * 0.02, 0.75, 0.6 - outT * 0.08); // 橘
      }
      this.outflowMesh.instanceColor!.setXYZ(i, color.r, color.g, color.b);
    }

    this.inflowMesh.instanceMatrix.needsUpdate = true;
    this.inflowMesh.instanceColor!.needsUpdate = true;
    this.outflowMesh.instanceMatrix.needsUpdate = true;
    this.outflowMesh.instanceColor!.needsUpdate = true;
    this.inflowMesh.visible = true;
    this.outflowMesh.visible = true;
  }

  setHeightScale(scale: number) {
    if (scale === this.heightScale) return;
    this.heightScale = scale;
    this.updateMatrices();
    this.updateOpsMatrices();
  }

  setTheme(isDark: boolean) {
    if (isDark === this.isDark) return;
    this.isDark = isDark;
    if (this.shellMesh) {
      (this.shellMesh.material as THREE.MeshBasicMaterial).opacity = isDark ? 0.18 : 0.22;
    }
    if (this.waterMesh) {
      (this.waterMesh.material as THREE.MeshBasicMaterial).opacity = isDark ? 0.85 : 0.9;
    }
  }

  /**
   * 螢幕座標 → 最近水庫的 reservoir_id（text）
   * InstancedMesh 的 raycaster 支援較複雜，採用投影 + 2D 距離方式，
   * 仿 FlightScene.pickFlight：點到畫面上哪座水庫的基座中心最近且 < threshold。
   */
  pickReservoir(
    screenX: number,
    screenY: number,
    viewWidth: number,
    viewHeight: number,
    thresholdPx = 30,
  ): ReservoirStatus | null {
    if (this.data.length === 0 || !this.lastMatrix) return null;
    const proj = new THREE.Matrix4().fromArray(this.lastMatrix);
    const v = new THREE.Vector3();
    let bestDist = Infinity;
    let bestStatus: ReservoirStatus | null = null;
    for (const d of this.data) {
      v.set(d.mercator.x, d.mercator.y, d.mercator.z + d.shellHeightMercator * 0.3 * this.heightScale);
      v.applyMatrix4(proj);
      // NDC → 螢幕像素
      const sx = (v.x * 0.5 + 0.5) * viewWidth;
      const sy = (1 - (v.y * 0.5 + 0.5)) * viewHeight;
      const dx = sx - screenX;
      const dy = sy - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist <= thresholdPx) {
        bestDist = dist;
        bestStatus = d.status;
      }
    }
    return bestStatus;
  }

  render(matrix: number[]) {
    this.lastMatrix = matrix;
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

  dispose() {
    this.disposeMeshes();
    this.disposeOpsMeshes();
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
