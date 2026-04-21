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
 *     - 顏色依 alert_level（正常=青 / 輕度=黃 / 中度=橘 / 重度=紅 / 嚴重=深紅）
 *
 * 兩組 InstancedMesh 共享水庫陣列，單次 draw call × 2。
 */

// Mercator 單位（參考 station pillar 的尺寸校準值）
const H_SHELL_METERS = 8000;    // 外殼高度（公尺，台灣中緯度投影後約 10km 視覺）
const R_MIN_METERS = 500;       // 最小容量對應半徑（公尺）
const R_MAX_METERS = 8000;      // 最大容量對應半徑
const SHELL_THICKNESS = 0.85;   // 內水圓柱半徑 = 外殼 × SHELL_THICKNESS

const CYLINDER_SEGMENTS = 20;

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

export class ReservoirScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private shellMesh: THREE.InstancedMesh | null = null;
  private waterMesh: THREE.InstancedMesh | null = null;
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
    console.log(`[ReservoirScene] setStatuses input=${statuses.length}`);
    // 暫時關閉全域 alt 調整，確保柱體底部貼地
    const savedOffset = getAltOffset();
    const savedExag = getAltExaggeration();
    setAltOffset(0);
    setAltExaggeration(1);

    // 僅保留有經緯度與容量的紀錄
    const valid = statuses.filter(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        (s.effective_capacity_wan ?? 0) > 0,
    );

    // 容量 → 半徑（cube root，體積-半徑自然關係）
    const cbrts = valid.map((s) => Math.cbrt(s.effective_capacity_wan ?? 1));
    const minC = Math.min(...cbrts);
    const maxC = Math.max(...cbrts);
    const spread = Math.max(maxC - minC, 1e-6);

    this.data = valid.map((s, i) => {
      const mercator = toMercator(s.lat, s.lng, 0);
      // 以該水庫緯度下的 meters-per-unit 轉換半徑 / 高度至 Mercator
      const m = metersPerUnit(s.lat);
      const radiusM = R_MIN_METERS + ((cbrts[i]! - minC) / spread) * (R_MAX_METERS - R_MIN_METERS);
      const shellHeightM = H_SHELL_METERS;
      const ratio = Math.max(0, Math.min(1, (s.storage_ratio_pct ?? 0) / 100));
      const waterHeightM = shellHeightM * ratio;
      const alertKey = s.alert_level ?? "正常";
      return {
        status: s,
        mercator,
        radiusMercator: radiusM * m,
        shellHeightMercator: shellHeightM * m,
        waterHeightMercator: waterHeightM * m,
        waterColorHex: ALERT_COLOR_HEX[alertKey] ?? ALERT_COLOR_HEX["正常"]!,
      };
    });

    setAltOffset(savedOffset);
    setAltExaggeration(savedExag);

    this.rebuild();
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

  setVisible(v: boolean) {
    if (this.shellMesh) this.shellMesh.visible = v;
    if (this.waterMesh) this.waterMesh.visible = v;
  }

  setHeightScale(scale: number) {
    if (scale === this.heightScale) return;
    this.heightScale = scale;
    this.updateMatrices();
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
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
