import * as THREE from "three";
import type { Ship } from "../types";
import { toMercator } from "../utils/coordinates";
import { interpolatePosition, getTrailUpToTime } from "../utils/interpolation";
// 色票與分桶規則的單一出處（three-free，故 LegendPanel 也能吃 —— 見 shipTrails.ts 檔頭）
import {
  shipTypeBucket, SHIP_TYPE_COLORS_DARK, SHIP_TYPE_COLORS_LIGHT,
  type ShipTypeBucket,
} from "../data/shipTrails";

const SHIP_COLOR_DARK = new THREE.Color(0.1, 0.85, 0.9); // fallback 青藍
const SHIP_COLOR_LIGHT = new THREE.Color(0.0, 0.3, 0.45); // fallback 深青

export function shipTypeLabel(vesselType: number): string {
  if (vesselType >= 60 && vesselType <= 69) return "客船 Passenger";
  if (vesselType >= 70 && vesselType <= 79) return "貨船 Cargo";
  if (vesselType >= 80 && vesselType <= 89) return "油輪 Tanker";
  if (vesselType >= 30 && vesselType <= 39) return "漁船 Fishing";
  if (vesselType >= 50 && vesselType <= 59) return "作業/拖船 Tug/Special";
  if (vesselType >= 90 && vesselType <= 99) return "其他 Other";
  return "未知 Unknown";
}

/** hex 色票 → THREE.Color，建一次快取（每幀每船都會查）。 */
function toThreeColors(hex: Record<ShipTypeBucket, string>): Record<ShipTypeBucket, THREE.Color> {
  const out = {} as Record<ShipTypeBucket, THREE.Color>;
  for (const k of Object.keys(hex) as ShipTypeBucket[]) out[k] = new THREE.Color(hex[k]);
  return out;
}

const SHIP_COLORS_DARK = toThreeColors(SHIP_TYPE_COLORS_DARK);
const SHIP_COLORS_LIGHT = toThreeColors(SHIP_TYPE_COLORS_LIGHT);

function shipTypeColor(vesselType: number, isDark: boolean): THREE.Color {
  const bucket = shipTypeBucket(vesselType);
  return (isDark ? SHIP_COLORS_DARK : SHIP_COLORS_LIGHT)[bucket];
}

const TRAIL_DURATION = 1800; // 0.5 小時 = 1800 秒
const MAX_TRAIL_VERTICES = 200000; // LineSegments 頂點上限

/**
 * 船舶場景 — InstancedMesh 光球 + LineSegments 拖尾線
 */
export class ShipScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 12000;
  private isDarkTheme = true;
  private orbScale = 0.000005;
  private breathPhase = 0;
  private lastMatrix: THREE.Matrix4 | null = null;
  private shipPositions = new Map<number, { ship: Ship; lat: number; lng: number; timestamp: number }>();
  private lastUpdateTime = Number.NaN;
  private lastShipsRef: Ship[] | null = null;
  private lastBoundsKey = "";
  private lastOrbScale = Number.NaN;
  private lastThemeDark = true;
  private forceRebuild = true;

  // 拖尾線
  private trailGeo: THREE.BufferGeometry | null = null;
  private trailLine: THREE.LineSegments | null = null;
  private trailPositions!: Float32Array;
  private trailColors!: Float32Array;

  // 視口剔除用
  private viewBounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null = null;
  private _dummy = new THREE.Matrix4();

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

    const geo = new THREE.CircleGeometry(1, 24);

    // 主船舶點：2D 圓點（比球體在俯視/球面視角更清楚）
    const mat = new THREE.MeshBasicMaterial({
      color: SHIP_COLOR_DARK,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances * 3),
      3,
    );
    this.scene.add(this.instancedMesh);

    // 拖尾 LineSegments（per-vertex color）
    this.trailGeo = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(MAX_TRAIL_VERTICES * 3);
    this.trailColors = new Float32Array(MAX_TRAIL_VERTICES * 3);

    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeo.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 3));
    this.trailGeo.setDrawRange(0, 0);

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailLine = new THREE.LineSegments(this.trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    this.forceRebuild = true;
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(isDark ? SHIP_COLOR_DARK : SHIP_COLOR_LIGHT);
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.85 : 0.7;
    }
    if (this.trailLine) {
      const mat = this.trailLine.material as THREE.LineBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.8 : 0.5;
    }
  }

  setOrbScale(scale: number) {
    if (this.orbScale !== scale) {
      this.orbScale = scale;
      this.forceRebuild = true;
    }
  }

  setTrailOpacity(opacity: number) {
    if (!this.trailLine) return;
    const mat = this.trailLine.material as THREE.LineBasicMaterial;
    mat.opacity = opacity;
  }

  private boundsKey(bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null) {
    if (!bounds) return "none";
    // 避免滑鼠微動/浮點雜訊造成每幀重建；約 10m 級精度已足夠做視口剔除。
    return `${bounds.minLng.toFixed(4)},${bounds.maxLng.toFixed(4)},${bounds.minLat.toFixed(4)},${bounds.maxLat.toFixed(4)}`;
  }

  setViewBounds(bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null) {
    this.viewBounds = bounds;
  }

  update(ships: Ship[], currentTime: number) {
    if (!this.instancedMesh || !this.trailGeo) return;

    const boundsKey = this.boundsKey(this.viewBounds);
    if (
      !this.forceRebuild &&
      this.lastShipsRef === ships &&
      this.lastUpdateTime === currentTime &&
      this.lastBoundsKey === boundsKey &&
      this.lastOrbScale === this.orbScale &&
      this.lastThemeDark === this.isDarkTheme
    ) {
      return;
    }

    this.forceRebuild = false;
    this.lastShipsRef = ships;
    this.lastUpdateTime = currentTime;
    this.lastBoundsKey = boundsKey;
    this.lastOrbScale = this.orbScale;
    this.lastThemeDark = this.isDarkTheme;

    // B: 時間/資料未變時不再為了呼吸動畫重建全部 buffer；只有需要 rebuild 時才更新相位。
    this.breathPhase += 0.02;
    const breathFactor = 1.0 + 0.15 * Math.sin(this.breathPhase);

    const dummy = this._dummy;
    let headCount = 0;
    let vi = 0; // trail vertex index
    const bounds = this.viewBounds;
    const baseScale = this.orbScale * 1.15;

    const fallbackColor = this.isDarkTheme ? SHIP_COLOR_DARK : SHIP_COLOR_LIGHT;
    this.shipPositions.clear();
    const positions = this.trailPositions;
    const colors = this.trailColors;

    for (const ship of ships) {
      if (headCount >= this.maxInstances) break;

      const path = ship.path;
      if (path.length === 0) continue;
      // trail 已含 ±1h 跨日緩衝，直接用首末點判斷
      const firstTime = path[0]![3];
      const lastTime = path[path.length - 1]![3];
      if (currentTime < firstTime || currentTime > lastTime) continue;

      const pos = interpolatePosition(path, currentTime);
      if (!pos) continue;

      const [lat, lng] = pos;

      // 視口剔除
      if (bounds) {
        const pad = 0.5;
        if (lng < bounds.minLng - pad || lng > bounds.maxLng + pad ||
            lat < bounds.minLat - pad || lat > bounds.maxLat + pad) {
          continue;
        }
      }

      // 主光球
      const mc = toMercator(lat, lng, 0);
      const s = baseScale * breathFactor;
      dummy.makeScale(s, s, s);
      dummy.setPosition(mc.x, mc.y, mc.z);
      const shipColor = shipTypeColor(ship.vessel_type, this.isDarkTheme);
      this.instancedMesh.setMatrixAt(headCount, dummy);
      this.instancedMesh.setColorAt(headCount, shipColor);
      this.shipPositions.set(headCount, { ship, lat, lng, timestamp: currentTime });
      headCount++;

      // 拖尾線段
      const trail = getTrailUpToTime(ship.path, currentTime, TRAIL_DURATION);
      if (trail.length >= 2 && vi < MAX_TRAIL_VERTICES - trail.length * 2) {
        for (let i = 0; i < trail.length - 1; i++) {
          const ptA = trail[i]!;
          const ptB = trail[i + 1]!;
          const progressA = i / (trail.length - 1); // 0=oldest → 1=newest
          const progressB = (i + 1) / (trail.length - 1);

          const mcA = toMercator(ptA[0], ptA[1], 0);
          const mcB = toMercator(ptB[0], ptB[1], 0);

          // 頂點 A
          positions[vi * 3] = mcA.x;
          positions[vi * 3 + 1] = mcA.y;
          positions[vi * 3 + 2] = mcA.z;
          const bA = 0.1 + 0.9 * progressA;
          const trailColor = shipColor ?? fallbackColor;
          colors[vi * 3] = trailColor.r * bA;
          colors[vi * 3 + 1] = trailColor.g * bA;
          colors[vi * 3 + 2] = trailColor.b * bA;
          vi++;

          // 頂點 B
          positions[vi * 3] = mcB.x;
          positions[vi * 3 + 1] = mcB.y;
          positions[vi * 3 + 2] = mcB.z;
          const bB = 0.1 + 0.9 * progressB;
          colors[vi * 3] = trailColor.r * bB;
          colors[vi * 3 + 1] = trailColor.g * bB;
          colors[vi * 3 + 2] = trailColor.b * bB;
          vi++;
        }
      }
    }

    this.instancedMesh.count = headCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

    this.trailGeo.setDrawRange(0, vi);
    (this.trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
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

  pickShip(screenX: number, screenY: number, viewWidth: number, viewHeight: number): { ship: Ship; lat: number; lng: number; timestamp: number } | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;

    const threshold = 24;
    let closest: { hit: { ship: Ship; lat: number; lng: number; timestamp: number }; dist: number } | null = null;
    const mat = new THREE.Matrix4();

    for (const [idx, hit] of this.shipPositions) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(mat.elements[12], mat.elements[13], mat.elements[14], 1.0);
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;
      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);
      if (dist < threshold && (!closest || dist < closest.dist)) closest = { hit, dist };
    }

    return closest?.hit ?? null;
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
      this.shipPositions.clear();
    }
    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailGeo?.dispose();
      (this.trailLine.material as THREE.Material).dispose();
      this.trailLine = null;
      this.trailGeo = null;
    }
    this.lastShipsRef = null;
    this.forceRebuild = true;
    this.renderer?.dispose();
  }
}
