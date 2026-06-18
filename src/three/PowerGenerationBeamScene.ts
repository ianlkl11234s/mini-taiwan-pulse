import * as THREE from "three";
import { toMercator } from "../utils/coordinates";
import { fuelColorOf, type PowerPlantRow } from "../data/energyLoader";

/**
 * 機組即時出力 3D beam (layer 4)
 *
 * - 對每個 output_mw 不為 NULL 的 plant 放一根光柱（InstancedMesh 單 draw call）
 * - 高度 ∝ output_load_rate（0~1.5 clamp 後縮放）
 * - 色按 fuel_type（FUEL_COLORS 對應，跟 layer 1 POI 同色系）
 * - frame lerp 平滑：5 min poll 寫入後柱高漸變，不瞬切
 *
 * 三 3D skill §2.1 beam / §四 E 性能 InstancedMesh
 */

const MAX_BEAM_COUNT = 256;       // 預留：14 台電廠 + 預留 IPP / 未來
const BEAM_RADIUS = 0.00002;      // mercator 單位，約 0.75km
const BEAM_BASE_HEIGHT = 0.0004;  // 滿載柱高 mercator 單位，約 14km
const LERP_FACTOR = 0.06;

interface BeamState {
  mc: { x: number; y: number; z: number };
  color: THREE.Color;
  currentHeight: number; // 0~1.5
  targetHeight: number;
  active: boolean;
}

export class PowerGenerationBeamScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private mesh: THREE.InstancedMesh | null = null;
  private beams: BeamState[] = [];
  private opacity = 0.55;
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
    this.buildMesh();
  }

  private buildMesh() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    // 單位圓柱：高度 1，向 Z 軸（旋轉 X 90°）
    const geo = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS * 0.4, 1, 6);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: this.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_BEAM_COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // 初始化 instanceColor
    const colors = new Float32Array(MAX_BEAM_COUNT * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    (this.mesh.material as THREE.MeshBasicMaterial).color.set(0xffffff);
    this.scene.add(this.mesh);
  }

  /** 餵入最新一輪 plants（只取 output_mw 非 NULL 者） */
  setData(rows: PowerPlantRow[]) {
    const candidates = rows.filter(
      (r) =>
        r.output_mw != null &&
        r.output_load_rate != null &&
        Number.isFinite(r.lon) &&
        Number.isFinite(r.lat),
    );

    // Build new beam state list - preserve currentHeight for matching plants
    const prevByKey = new Map(this.beams.map((b, i) => [`${i}`, b]));
    void prevByKey;

    const newBeams: BeamState[] = [];
    for (const r of candidates.slice(0, MAX_BEAM_COUNT)) {
      const mc = toMercator(r.lat, r.lon, 0);
      const color = new THREE.Color(fuelColorOf(r.fuel_type));
      const target = Math.max(0.05, Math.min(1.2, r.output_load_rate ?? 0));
      // 嘗試保留前次 currentHeight（按位置匹配）
      const prev = this.beams.find(
        (b) =>
          Math.abs(b.mc.x - mc.x) < 1e-7 && Math.abs(b.mc.y - mc.y) < 1e-7,
      );
      newBeams.push({
        mc,
        color,
        currentHeight: prev?.currentHeight ?? 0,
        targetHeight: target,
        active: true,
      });
    }
    this.beams = newBeams;
    this.applyInstanceColors();
    this.updateMatrices();
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

  private applyInstanceColors() {
    if (!this.mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < MAX_BEAM_COUNT; i++) {
      if (i < this.beams.length) {
        color.copy(this.beams[i]!.color);
      } else {
        color.setHex(0x000000);
      }
      this.mesh.setColorAt(i, color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private updateMatrices() {
    if (!this.mesh) return;
    const m = new THREE.Matrix4();
    const t = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_BEAM_COUNT; i++) {
      if (i < this.beams.length) {
        const b = this.beams[i]!;
        const h = BEAM_BASE_HEIGHT * b.currentHeight;
        t.makeTranslation(b.mc.x, b.mc.y, b.mc.z + h / 2);
        s.makeScale(1, 1, h);
        m.copy(t).multiply(s);
        this.mesh.setMatrixAt(i, m);
      } else {
        this.mesh.setMatrixAt(i, ZERO);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = this.beams.length;
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    // Lerp heights
    let anyMoving = false;
    for (const b of this.beams) {
      const diff = b.targetHeight - b.currentHeight;
      if (Math.abs(diff) > 1e-4) {
        b.currentHeight += diff * LERP_FACTOR;
        anyMoving = true;
      }
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
