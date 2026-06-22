/**
 * 垃圾處理設施 — 5 個量級小但戲劇感強的 Three.js scene。
 *
 * 對應 LayerSidebar sub-toggle：
 *   wfIncinerator (30)   → 高圓柱 + 火苗 + 煙
 *   wfLandfill (117)     → 棕半球 dome + 低層霧
 *   wfTransfer (28)      → Pin（倒錐 + 球）+ radar 掃描
 *   wfMedical (40)       → 紅警告 highlight + 偶發閃電
 *   wfMonitoring (574)   → 細藍光柱 + 漣漪
 *
 * 各 scene 共用：
 *   - 接收 WasteFacilityRow[]
 *   - 套 size / opacity / altitude params
 *   - 提供 pick(screenX, screenY, w, h) 給 customLayer click 用
 *   - render(matrix) Mapbox CustomLayer 標準介面
 *
 * 量級檢視（rebuild 成本）：
 *   - incinerator/landfill/transfer/medical 都 < 200，rebuild Group 即可
 *   - monitoring (574) 多一些 → 用 InstancedMesh 較省
 */

import * as THREE from "three";
import { toMercator, metersPerUnit } from "../utils/coordinates";
import type { WasteFacilityRow } from "../data/wasteLoader";

// ═══════════════════════════════════════════════════════════════
// 共用基底 — 處理 init / pick / render boilerplate
// ═══════════════════════════════════════════════════════════════

abstract class WasteFacilitySceneBase {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  renderer!: THREE.WebGLRenderer;
  protected rows: WasteFacilityRow[] = [];
  protected sizeMul = 1;
  protected opacityMul = 1;
  protected altitudeMeters = 0;
  protected visible = false;
  protected lastMatrix: THREE.Matrix4 | null = null;
  protected pickPoints: { row: WasteFacilityRow; world: THREE.Vector3 }[] = [];

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setRows(rows: WasteFacilityRow[]) {
    this.rows = rows;
    this.rebuild();
  }

  setVisible(v: boolean) { this.visible = v; }
  setSize(s: number) { this.sizeMul = Math.max(0.1, s); this.applyTransform(); }
  setOpacity(o: number) { this.opacityMul = Math.max(0, Math.min(1, o)); this.applyOpacity(); }
  setAltitude(m: number) { this.altitudeMeters = m; this.rebuild(); }

  /** 子類覆蓋：建立 Mesh / Group */
  protected abstract rebuild(): void;
  /** 子類覆蓋：每幀動畫（time = 秒） */
  protected abstract animate(timeSec: number): void;
  /** 子類覆蓋：opacity 變更時套到 material */
  protected abstract applyOpacity(): void;
  /** 子類覆蓋：size 變更時套（多數情況下 rebuild 即可，預設 noop） */
  protected applyTransform(): void { this.rebuild(); }

  render(matrix: number[]) {
    if (!this.visible || this.rows.length === 0) return;
    if (!this.lastMatrix) this.lastMatrix = new THREE.Matrix4();
    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);

    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.animate(performance.now() / 1000);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  pick(screenX: number, screenY: number, viewWidth: number, viewHeight: number, threshold = 28): WasteFacilityRow | null {
    if (!this.lastMatrix || !this.visible) return null;
    let closest: { row: WasteFacilityRow; dist: number } | null = null;
    for (const { row, world } of this.pickPoints) {
      const v = new THREE.Vector4(world.x, world.y, world.z, 1.0).applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;
      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const d = Math.hypot(sx - screenX, sy - screenY);
      if (d < threshold && (!closest || d < closest.dist)) closest = { row, dist: d };
    }
    return closest?.row ?? null;
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    this.scene.clear();
    this.renderer?.dispose();
    this.pickPoints = [];
  }

  /** 取每筆 row 在 mercator 座標下對應的 1m 縮放（緯度依賴） */
  protected getMeterUnit(): number {
    const lat = this.rows[0]?.lat ?? 23.7;
    return metersPerUnit(lat);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. WasteIncineratorScene — 焚化爐 (30 筆)
//    高圓柱 + 頂端火苗 + 煙
// ═══════════════════════════════════════════════════════════════

export class WasteIncineratorScene extends WasteFacilitySceneBase {
  private group: THREE.Group | null = null;
  private flameMaterials: THREE.MeshBasicMaterial[] = [];
  private smokeMeshes: THREE.Mesh[] = [];
  private ringMaterials: THREE.MeshBasicMaterial[] = [];
  /** 底圈大小倍率（拉遠也看得到的地面標示）*/
  private groundRingScale = 1.0;

  setGroundRingScale(s: number) {
    this.groundRingScale = Math.max(0, s);
    this.rebuild();
  }

  protected rebuild() {
    if (this.group) {
      this.scene.remove(this.group);
      this.dispose_inner();
    }
    this.group = new THREE.Group();
    this.flameMaterials = [];
    this.smokeMeshes = [];
    this.ringMaterials = [];
    this.pickPoints = [];

    const meterUnit = this.getMeterUnit();
    // 圓柱 600m × 半徑 80m（用 size mul）
    const stackHeight = 600 * this.sizeMul * meterUnit;
    const stackRadius = 80 * this.sizeMul * meterUnit;
    // 底圈：基準半徑 800m，獨立 groundRingScale slider 控制（拉遠也看得到）
    const ringOuterR = 800 * this.groundRingScale * meterUnit;
    const ringInnerR = ringOuterR * 0.78;

    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);

      // 底圈（地面平鋪，遠距離也可見）
      if (this.groundRingScale > 0) {
        const ringGeo = new THREE.RingGeometry(ringInnerR, ringOuterR, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff6b1a,
          transparent: true,
          opacity: 0.55 * this.opacityMul,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        // RingGeometry 預設躺在 XY 平面（z 法向），剛好就是地面，無需旋轉
        ringMesh.position.set(m.x, m.y, m.z + 2 * meterUnit);
        this.group.add(ringMesh);
        this.ringMaterials.push(ringMat);
      }

      // 圓柱（暗紅）
      const stackGeo = new THREE.CylinderGeometry(stackRadius * 0.7, stackRadius, stackHeight, 12, 1, true);
      stackGeo.translate(0, stackHeight / 2, 0);
      stackGeo.rotateX(Math.PI / 2);
      const stackMat = new THREE.MeshBasicMaterial({
        color: 0x4a1a1a,
        transparent: true,
        opacity: 0.7 * this.opacityMul,
        side: THREE.DoubleSide,
      });
      const stackMesh = new THREE.Mesh(stackGeo, stackMat);
      stackMesh.position.set(m.x, m.y, m.z);
      this.group.add(stackMesh);

      // 火苗（頂端球，加性混合）
      const flameGeo = new THREE.SphereGeometry(stackRadius * 1.6, 8, 8);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff6b1a,
        transparent: true,
        opacity: 0.85 * this.opacityMul,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.userData = { baseY: stackHeight, basePos: { x: m.x, y: m.y, z: m.z } };
      flameMesh.position.set(m.x, m.y, m.z + stackHeight);
      this.group.add(flameMesh);
      this.flameMaterials.push(flameMat);

      // 煙（更高處的半透明球）
      const smokeGeo = new THREE.SphereGeometry(stackRadius * 2.5, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.18 * this.opacityMul,
        depthWrite: false,
      });
      const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
      smokeMesh.userData = { basePos: { x: m.x, y: m.y, z: m.z + stackHeight } };
      smokeMesh.position.set(m.x, m.y, m.z + stackHeight + stackRadius * 3);
      this.group.add(smokeMesh);
      this.smokeMeshes.push(smokeMesh);

      this.pickPoints.push({ row, world: new THREE.Vector3(m.x, m.y, m.z + stackHeight / 2) });
    }
    this.scene.add(this.group);
  }

  protected animate(t: number) {
    // 火苗呼吸 + 煙緩升 + 底圈呼吸
    for (const mat of this.flameMaterials) {
      mat.opacity = (0.7 + 0.3 * Math.sin(t * 4)) * this.opacityMul;
    }
    for (const sm of this.smokeMeshes) {
      const base = sm.userData.basePos;
      const drift = ((t * 30) % 200);
      sm.position.set(base.x, base.y, base.z + drift * this.getMeterUnit());
      const fade = 1 - drift / 200;
      (sm.material as THREE.MeshBasicMaterial).opacity = 0.18 * fade * this.opacityMul;
    }
    for (const mat of this.ringMaterials) {
      mat.opacity = (0.45 + 0.15 * Math.sin(t * 1.5)) * this.opacityMul;
    }
  }

  protected applyOpacity() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if ((m as THREE.MeshBasicMaterial).transparent) {
            // rebuild handles opacity baseline; just leave for animate
          }
        }
      }
    });
    // 直接 rebuild 簡單處理
    this.rebuild();
  }

  private dispose_inner() {
    if (!this.group) return;
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.group = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. WasteLandfillScene — 衛生掩埋場 (117 筆)
//    棕色半球 dome + 低層霧
// ═══════════════════════════════════════════════════════════════

export class WasteLandfillScene extends WasteFacilitySceneBase {
  private group: THREE.Group | null = null;
  private domeMats: THREE.MeshBasicMaterial[] = [];

  protected rebuild() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    this.group = new THREE.Group();
    this.domeMats = [];
    this.pickPoints = [];

    const mu = this.getMeterUnit();
    const radius = 600 * this.sizeMul * mu;

    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);

      // ① 底部填色圓盤（拉遠也看得到的地面標示）
      const baseDiscGeo = new THREE.CircleGeometry(radius * 1.15, 48);
      const baseDiscMat = new THREE.MeshBasicMaterial({
        color: 0x92400e,
        transparent: true,
        opacity: 0.5 * this.opacityMul,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
      baseDisc.position.set(m.x, m.y, m.z + 1 * mu);
      this.group.add(baseDisc);

      // ② 外圍亮環（黃色，AdditiveBlending 拉遠也亮）
      const ringGeo = new THREE.RingGeometry(radius * 1.15, radius * 1.28, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85 * this.opacityMul,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(m.x, m.y, m.z + 2 * mu);
      this.group.add(ringMesh);

      // ③ 棕色半球（提高 opacity 0.35 → 0.65）
      const domeGeo = new THREE.SphereGeometry(radius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      domeGeo.rotateX(Math.PI / 2);
      const domeMat = new THREE.MeshBasicMaterial({
        color: 0x92400e,
        transparent: true,
        opacity: 0.65 * this.opacityMul,
        side: THREE.DoubleSide,
      });
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.position.set(m.x, m.y, m.z);
      this.group.add(domeMesh);
      this.domeMats.push(domeMat);

      // ④ wireframe（黃色，提亮 0.18 → 0.45）
      const wireGeo = new THREE.SphereGeometry(radius * 1.005, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      wireGeo.rotateX(Math.PI / 2);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        wireframe: true,
        transparent: true,
        opacity: 0.45 * this.opacityMul,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      wireMesh.position.set(m.x, m.y, m.z);
      this.group.add(wireMesh);

      // ⑤ 頂端標記（黃色光球，dome 中心點）
      const topGeo = new THREE.SphereGeometry(radius * 0.12, 10, 10);
      const topMat = new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.95 * this.opacityMul,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(m.x, m.y, m.z + radius);
      this.group.add(topMesh);

      // ⑥ 低層霧（扁圓盤，更淺）
      const fogGeo = new THREE.SphereGeometry(radius * 1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 5);
      fogGeo.rotateX(Math.PI / 2);
      const fogMat = new THREE.MeshBasicMaterial({
        color: 0x8b7355,
        transparent: true,
        opacity: 0.15 * this.opacityMul,
        depthWrite: false,
      });
      const fogMesh = new THREE.Mesh(fogGeo, fogMat);
      fogMesh.position.set(m.x, m.y, m.z + radius * 0.25);
      this.group.add(fogMesh);

      this.pickPoints.push({ row, world: new THREE.Vector3(m.x, m.y, m.z + radius * 0.5) });
    }
    this.scene.add(this.group);
  }

  protected animate(t: number) {
    // dome 呼吸（很慢）
    for (const m of this.domeMats) {
      m.opacity = (0.30 + 0.05 * Math.sin(t * 0.8)) * this.opacityMul;
    }
  }

  protected applyOpacity() { this.rebuild(); }
}

// ═══════════════════════════════════════════════════════════════
// 2b. WasteLandfillCoastalScene — 濱海掩埋場 (23 筆)
//    同 Landfill 結構，換深青配色（區隔內陸 / 沿海）
// ═══════════════════════════════════════════════════════════════

export class WasteLandfillCoastalScene extends WasteFacilitySceneBase {
  private group: THREE.Group | null = null;
  private domeMats: THREE.MeshBasicMaterial[] = [];

  protected rebuild() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    this.group = new THREE.Group();
    this.domeMats = [];
    this.pickPoints = [];

    const mu = this.getMeterUnit();
    const radius = 600 * this.sizeMul * mu;

    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);

      const baseDiscGeo = new THREE.CircleGeometry(radius * 1.15, 48);
      const baseDiscMat = new THREE.MeshBasicMaterial({
        color: 0x0891b2,
        transparent: true,
        opacity: 0.5 * this.opacityMul,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
      baseDisc.position.set(m.x, m.y, m.z + 1 * mu);
      this.group.add(baseDisc);

      const ringGeo = new THREE.RingGeometry(radius * 1.15, radius * 1.28, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.85 * this.opacityMul,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(m.x, m.y, m.z + 2 * mu);
      this.group.add(ringMesh);

      const domeGeo = new THREE.SphereGeometry(radius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      domeGeo.rotateX(Math.PI / 2);
      const domeMat = new THREE.MeshBasicMaterial({
        color: 0x0891b2,
        transparent: true,
        opacity: 0.65 * this.opacityMul,
        side: THREE.DoubleSide,
      });
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.position.set(m.x, m.y, m.z);
      this.group.add(domeMesh);
      this.domeMats.push(domeMat);

      const wireGeo = new THREE.SphereGeometry(radius * 1.005, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      wireGeo.rotateX(Math.PI / 2);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        wireframe: true,
        transparent: true,
        opacity: 0.45 * this.opacityMul,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      wireMesh.position.set(m.x, m.y, m.z);
      this.group.add(wireMesh);

      const topGeo = new THREE.SphereGeometry(radius * 0.12, 10, 10);
      const topMat = new THREE.MeshBasicMaterial({
        color: 0xcffafe,
        transparent: true,
        opacity: 0.95 * this.opacityMul,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(m.x, m.y, m.z + radius);
      this.group.add(topMesh);

      const fogGeo = new THREE.SphereGeometry(radius * 1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 5);
      fogGeo.rotateX(Math.PI / 2);
      const fogMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.15 * this.opacityMul,
        depthWrite: false,
      });
      const fogMesh = new THREE.Mesh(fogGeo, fogMat);
      fogMesh.position.set(m.x, m.y, m.z + radius * 0.25);
      this.group.add(fogMesh);

      this.pickPoints.push({ row, world: new THREE.Vector3(m.x, m.y, m.z + radius * 0.5) });
    }
    this.scene.add(this.group);
  }

  protected animate(t: number) {
    for (const m of this.domeMats) {
      m.opacity = (0.30 + 0.05 * Math.sin(t * 0.8)) * this.opacityMul;
    }
  }

  protected applyOpacity() { this.rebuild(); }
}

// ═══════════════════════════════════════════════════════════════
// 3. WasteTransferScene — 轉運站 (28 筆)
//    Pin (倒錐 + 球) + radar 扇形掃描
// ═══════════════════════════════════════════════════════════════

export class WasteTransferScene extends WasteFacilitySceneBase {
  private group: THREE.Group | null = null;
  private radarMeshes: THREE.Mesh[] = [];

  protected rebuild() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    this.group = new THREE.Group();
    this.radarMeshes = [];
    this.pickPoints = [];

    const mu = this.getMeterUnit();
    const pinHeight = 380 * this.sizeMul * mu;
    const pinRadius = 80 * this.sizeMul * mu;
    const radarRadius = 600 * this.sizeMul * mu;

    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);

      // 倒錐 pin
      const coneGeo = new THREE.ConeGeometry(pinRadius, pinHeight, 12);
      coneGeo.rotateX(-Math.PI / 2);
      coneGeo.translate(0, 0, pinHeight / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.85 * this.opacityMul,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(m.x, m.y, m.z);
      this.group.add(cone);

      // 頂端球
      const ballGeo = new THREE.SphereGeometry(pinRadius * 1.1, 12, 12);
      const ballMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.9 * this.opacityMul,
      });
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.set(m.x, m.y, m.z + pinHeight + pinRadius * 0.6);
      this.group.add(ball);

      // 雷達扇形（扁平環）
      const radarGeo = new THREE.RingGeometry(radarRadius * 0.4, radarRadius, 32, 1, 0, Math.PI / 4);
      const radarMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.35 * this.opacityMul,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const radar = new THREE.Mesh(radarGeo, radarMat);
      radar.position.set(m.x, m.y, m.z + 5 * mu);
      radar.userData = { baseAngle: 0 };
      this.group.add(radar);
      this.radarMeshes.push(radar);

      this.pickPoints.push({ row, world: new THREE.Vector3(m.x, m.y, m.z + pinHeight) });
    }
    this.scene.add(this.group);
  }

  protected animate(t: number) {
    // radar 旋轉
    for (const r of this.radarMeshes) {
      r.rotation.z = (t * 0.6) % (Math.PI * 2);
    }
  }

  protected applyOpacity() { this.rebuild(); }
}

// ═══════════════════════════════════════════════════════════════
// 4. WasteMedicalScene — 醫療廢棄物 (40 筆)
//    紅警告（脈動球 + 缺口環）+ 偶發閃電
// ═══════════════════════════════════════════════════════════════

export class WasteMedicalScene extends WasteFacilitySceneBase {
  private group: THREE.Group | null = null;
  private pulseMats: THREE.MeshBasicMaterial[] = [];
  private rings: THREE.Mesh[] = [];
  private boltMeshes: { mesh: THREE.Line; nextStrikeAt: number; basePos: THREE.Vector3 }[] = [];

  protected rebuild() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          // @ts-ignore
          o.geometry?.dispose?.();
          const mats = Array.isArray((o as any).material) ? (o as any).material : [(o as any).material];
          for (const m of mats) m?.dispose?.();
        }
      });
    }
    this.group = new THREE.Group();
    this.pulseMats = [];
    this.rings = [];
    this.boltMeshes = [];
    this.pickPoints = [];

    const mu = this.getMeterUnit();
    const radius = 280 * this.sizeMul * mu;
    const ringR = 320 * this.sizeMul * mu;

    for (const row of this.rows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);
      const basePos = new THREE.Vector3(m.x, m.y, m.z + radius);

      // 中心脈動球
      const ballGeo = new THREE.SphereGeometry(radius, 16, 16);
      const ballMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.9 * this.opacityMul,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.copy(basePos);
      this.group.add(ball);
      this.pulseMats.push(ballMat);

      // 缺口環 × 2
      for (let i = 0; i < 2; i++) {
        const ringGeo = new THREE.RingGeometry(ringR * (1 + i * 0.3), ringR * (1.05 + i * 0.3), 32, 1, 0, Math.PI * 1.5);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xec4899,
          transparent: true,
          opacity: 0.5 * this.opacityMul,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(m.x, m.y, m.z + 8 * mu);
        ring.userData = { dir: i % 2 === 0 ? 1 : -1, speed: 0.8 + i * 0.4 };
        this.group.add(ring);
        this.rings.push(ring);
      }

      // 閃電線（先建空 zigzag，animate 時更新）
      const boltGeo = new THREE.BufferGeometry();
      boltGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
      const boltMat = new THREE.LineBasicMaterial({
        color: 0xfff,
        transparent: true,
        opacity: 0,
      });
      const bolt = new THREE.Line(boltGeo, boltMat);
      this.group.add(bolt);
      this.boltMeshes.push({ mesh: bolt, nextStrikeAt: performance.now() / 1000 + Math.random() * 5, basePos });

      this.pickPoints.push({ row, world: basePos.clone() });
    }
    this.scene.add(this.group);
  }

  protected animate(t: number) {
    // 脈動
    for (const mat of this.pulseMats) {
      mat.opacity = (0.6 + 0.4 * Math.sin(t * 3)) * this.opacityMul;
    }
    for (const r of this.rings) {
      r.rotation.z += r.userData.dir * r.userData.speed * 0.016;
    }
    // 閃電：每 ~5s 觸發一次，持續 0.2s
    const mu = this.getMeterUnit();
    const altScale = 1500 * mu;
    for (const b of this.boltMeshes) {
      const elapsed = t - b.nextStrikeAt;
      const mat = b.mesh.material as THREE.LineBasicMaterial;
      if (elapsed > 0 && elapsed < 0.2) {
        // 顯示閃電
        const positions = (b.mesh.geometry.attributes["position"] as THREE.BufferAttribute).array as Float32Array;
        const baseX = b.basePos.x, baseY = b.basePos.y, baseZ = b.basePos.z;
        for (let i = 0; i < 8; i++) {
          const f = i / 7;
          const jitter = (Math.random() - 0.5) * 100 * mu;
          positions[i * 3] = baseX + jitter;
          positions[i * 3 + 1] = baseY + (Math.random() - 0.5) * 80 * mu;
          positions[i * 3 + 2] = baseZ + altScale * (1 - f);
        }
        b.mesh.geometry.attributes["position"]!.needsUpdate = true;
        mat.opacity = (1 - elapsed / 0.2) * this.opacityMul;
      } else if (elapsed >= 0.2) {
        mat.opacity = 0;
        b.nextStrikeAt = t + 4 + Math.random() * 4;
      }
    }
  }

  protected applyOpacity() { this.rebuild(); }
}

// ═══════════════════════════════════════════════════════════════
// 5. WasteMonitoringWellScene — 地下水監測井 (574 筆)
//    細藍光柱 + 漣漪（量大 → InstancedMesh）
// ═══════════════════════════════════════════════════════════════

export class WasteMonitoringWellScene extends WasteFacilitySceneBase {
  private beamMesh: THREE.InstancedMesh | null = null;
  private rippleMesh: THREE.InstancedMesh | null = null;
  private maxInstances: number;

  constructor(maxInstances = 800) {
    super();
    this.maxInstances = maxInstances;
  }

  protected rebuild() {
    if (this.beamMesh) {
      this.scene.remove(this.beamMesh);
      this.beamMesh.geometry.dispose();
      (this.beamMesh.material as THREE.Material).dispose();
      this.beamMesh = null;
    }
    if (this.rippleMesh) {
      this.scene.remove(this.rippleMesh);
      this.rippleMesh.geometry.dispose();
      (this.rippleMesh.material as THREE.Material).dispose();
      this.rippleMesh = null;
    }
    this.pickPoints = [];

    const mu = this.getMeterUnit();
    const beamH = 220 * this.sizeMul * mu;
    const beamR = 18 * this.sizeMul * mu;

    // beam: cylinder
    const beamGeo = new THREE.CylinderGeometry(beamR * 0.3, beamR, beamH, 6, 1, true);
    beamGeo.translate(0, beamH / 2, 0);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.7 * this.opacityMul,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, this.maxInstances);
    this.beamMesh.frustumCulled = false;
    this.beamMesh.count = 0;
    this.scene.add(this.beamMesh);

    // ripple: ring (扁平)
    const rippleGeo = new THREE.RingGeometry(beamR * 4, beamR * 5, 16);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.45 * this.opacityMul,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rippleMesh = new THREE.InstancedMesh(rippleGeo, rippleMat, this.maxInstances);
    this.rippleMesh.frustumCulled = false;
    this.rippleMesh.count = 0;
    this.scene.add(this.rippleMesh);

    const dummy = new THREE.Matrix4();
    let i = 0;
    for (const row of this.rows) {
      if (i >= this.maxInstances) break;
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const m = toMercator(row.lat, row.lng, this.altitudeMeters);
      dummy.makeTranslation(m.x, m.y, m.z);
      this.beamMesh.setMatrixAt(i, dummy);
      this.rippleMesh.setMatrixAt(i, dummy);
      this.pickPoints.push({ row, world: new THREE.Vector3(m.x, m.y, m.z + beamH * 0.5) });
      i++;
    }
    this.beamMesh.count = i;
    this.rippleMesh.count = i;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
  }

  protected animate(t: number) {
    // ripple 隨時間擴張（透過 scale）
    if (!this.rippleMesh) return;
    const mu = this.getMeterUnit();
    const phase = (t * 0.6) % 1; // 0..1
    const scale = 0.3 + phase * 2.5; // 擴散
    const fade = 1 - phase;
    const dummy = new THREE.Matrix4();
    const tmp = new THREE.Matrix4();
    for (let i = 0; i < this.rippleMesh.count; i++) {
      this.rippleMesh.getMatrixAt(i, tmp);
      const x = tmp.elements[12]!, y = tmp.elements[13]!, z = tmp.elements[14]!;
      dummy.makeScale(scale, scale, 1);
      dummy.setPosition(x, y, z + 5 * mu);
      this.rippleMesh.setMatrixAt(i, dummy);
    }
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    (this.rippleMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * fade * this.opacityMul;
  }

  protected applyOpacity() { this.rebuild(); }
}
