import * as THREE from "three";
import type { Ship } from "../types";
import { toMercator } from "../utils/coordinates";
import { interpolatePosition, getTrailUpToTime } from "../utils/interpolation";
// 色票與分桶規則的單一出處（three-free，故 LegendPanel 也能吃 —— 見 shipTrails.ts 檔頭）
import {
  shipTypeBucket, SHIP_TYPE_COLORS_DARK, SHIP_TYPE_COLORS_LIGHT, SHIP_FISHING_GLOW_LEGEND,
  type ShipTypeBucket,
} from "../data/shipTrails";
import { nightLightIntensity, solarElevationDeg, solarFrame } from "../utils/solarElevation";

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

// ── 漁火模擬（30 天地圖挑戰 Light & dark；design-system map-layers §3.1 例外）──
// 只對 AIS 船種碼 30（漁船）畫；疏浚 33、遊艇／帆船 36 雖同桶但不畫。
// 外圈大而淡、內核小而亮；強度＝船位的太陽高度（solarElevation.nightLightIntensity）。
const FISHING_VESSEL_TYPE = 30;
/**
 * 外圈半徑＝「光點 × 倍率」夾在「視口寬 × 下限比例」與「視口寬 × 上限比例」之間：
 * 拉遠時仍有固定螢幕大小的光暈，拉近時不會無限放大（1400px 寬約 7–35px）。
 */
const FISHING_GLOW_OUTER_ORB_MUL = 8;
const FISHING_GLOW_OUTER_VIEW_FRAC = 0.005;
const FISHING_GLOW_OUTER_VIEW_FRAC_MAX = 0.025;
const FISHING_GLOW_CORE_RATIO = 0.3;
/** 透明度（暗底 additive）；淡底改 normal blending 並乘 FISHING_GLOW_LIGHT_MUL，避免洗白 */
const FISHING_GLOW_OUTER_OPACITY = 0.35;
const FISHING_GLOW_CORE_OPACITY = 0.9;
const FISHING_GLOW_LIGHT_MUL = 0.5;
const FISHING_GLOW_COLOR_DARK = new THREE.Color(SHIP_FISHING_GLOW_LEGEND.dark); // 暖白
const FISHING_GLOW_COLOR_LIGHT = new THREE.Color(SHIP_FISHING_GLOW_LEGEND.light); // 淡底琥珀（暖白在淡底看不見）

const GLOW_VERTEX = /* glsl */ `
attribute float aIntensity;
varying vec2 vUv;
varying float vIntensity;
void main() {
  vUv = uv;
  vIntensity = aIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPower;
varying vec2 vUv;
varying float vIntensity;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  if (d > 1.0) discard;
  float f = pow(1.0 - d, uPower);
  gl_FragColor = vec4(uColor, f * vIntensity * uOpacity);
}`;

function createGlowMesh(maxInstances: number, power: number, opacity: number): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.setAttribute("aIntensity", new THREE.InstancedBufferAttribute(new Float32Array(maxInstances), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: {
      uColor: { value: FISHING_GLOW_COLOR_DARK.clone() },
      uOpacity: { value: opacity },
      uPower: { value: power },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, maxInstances);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
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

  // 漁火模擬（預設關；開啟才建 mesh）
  private fishingLights = false;
  private glowOuter: THREE.InstancedMesh | null = null;
  private glowCore: THREE.InstancedMesh | null = null;

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
    this.applyGlowTheme();
  }

  /** 漁火模擬開關：開啟時才建光暈 mesh；關閉時釋放 */
  setFishingLights(on: boolean) {
    if (this.fishingLights === on) return;
    this.fishingLights = on;
    this.forceRebuild = true;
    if (on && !this.glowOuter) {
      // 外圈先加、內核後加：同為 additive，內核疊在外圈上
      this.glowOuter = createGlowMesh(this.maxInstances, 2.0, FISHING_GLOW_OUTER_OPACITY);
      this.glowCore = createGlowMesh(this.maxInstances, 1.2, FISHING_GLOW_CORE_OPACITY);
      this.scene.add(this.glowOuter, this.glowCore);
      this.applyGlowTheme();
    } else if (!on) {
      this.disposeGlow();
    }
  }

  private applyGlowTheme() {
    const dark = this.isDarkTheme;
    for (const [mesh, opacity] of [[this.glowOuter, FISHING_GLOW_OUTER_OPACITY], [this.glowCore, FISHING_GLOW_CORE_OPACITY]] as const) {
      if (!mesh) continue;
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      (mat.uniforms.uColor!.value as THREE.Color).copy(dark ? FISHING_GLOW_COLOR_DARK : FISHING_GLOW_COLOR_LIGHT);
      mat.uniforms.uOpacity!.value = dark ? opacity : opacity * FISHING_GLOW_LIGHT_MUL;
      mat.needsUpdate = true;
    }
  }

  private disposeGlow() {
    for (const mesh of [this.glowOuter, this.glowCore]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.glowOuter = null;
    this.glowCore = null;
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

    // 漁火：同一時刻共用太陽赤緯／時角，每船只算一次高度角
    const glowOuter = this.fishingLights ? this.glowOuter : null;
    const glowCore = this.fishingLights ? this.glowCore : null;
    const sun = glowOuter ? solarFrame(currentTime) : null;
    let glowCount = 0;
    const viewSpan = bounds ? (bounds.maxLng - bounds.minLng) / 360 : 0;
    const orbR = baseScale * FISHING_GLOW_OUTER_ORB_MUL;
    const outerR = viewSpan > 0
      ? Math.min(Math.max(orbR, viewSpan * FISHING_GLOW_OUTER_VIEW_FRAC), viewSpan * FISHING_GLOW_OUTER_VIEW_FRAC_MAX)
      : orbR;
    const coreR = outerR * FISHING_GLOW_CORE_RATIO;
    const outerIntensity = glowOuter ? (glowOuter.geometry.getAttribute("aIntensity") as THREE.InstancedBufferAttribute) : null;
    const coreIntensity = glowCore ? (glowCore.geometry.getAttribute("aIntensity") as THREE.InstancedBufferAttribute) : null;

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

      // 漁火光暈（漁船仍留在主 mesh，pickShip 的 index 不變）
      if (sun && glowOuter && glowCore && outerIntensity && coreIntensity && ship.vessel_type === FISHING_VESSEL_TYPE) {
        const k = nightLightIntensity(solarElevationDeg(sun, lat, lng));
        if (k > 0.01) {
          dummy.makeScale(outerR, outerR, outerR);
          dummy.setPosition(mc.x, mc.y, mc.z);
          glowOuter.setMatrixAt(glowCount, dummy);
          dummy.makeScale(coreR, coreR, coreR);
          dummy.setPosition(mc.x, mc.y, mc.z);
          glowCore.setMatrixAt(glowCount, dummy);
          outerIntensity.setX(glowCount, k);
          coreIntensity.setX(glowCount, k);
          glowCount++;
        }
      }

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
    for (const [mesh, attr] of [[glowOuter, outerIntensity], [glowCore, coreIntensity]] as const) {
      if (!mesh || !attr) continue;
      mesh.count = glowCount;
      mesh.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
    }
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
    this.disposeGlow();
    this.fishingLights = false;
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
