import * as THREE from "three";
import { toMercator } from "../utils/coordinates";

/**
 * 地震漣漪（擴散圈）—— 取代舊的「Mapbox circle 層每幀 setPaintProperty」做法。
 *
 * 舊做法每幀改 data-driven `circle-radius`，Mapbox 會把整份 GeoJSON source 標成 reload，
 * 漣漪播放期間 `map.loaded()` 恆為 false、idle 不觸發。這裡改由 Three.js 自繪，完全不經
 * Mapbox 資料管線。
 *
 * 視覺參數與舊版逐一對應（螢幕像素、與 Mapbox circle 預設 pitch-alignment=viewport /
 * pitch-scale=map 相同）：
 * - 每個震央 2 道圈，相位差半個週期；週期 2400ms（掛鐘時間，所有震央同步）
 * - eased = 1 - (1 - phase)^2
 * - 半徑 = mag*2 + 6 + 60*eased（px），描邊畫在半徑「外側」寬 2.5*(1 - eased*0.5)
 * - 描邊不透明度 = 0.7*(1 - eased) × 圖層 opacity
 *
 * 一個 InstancedBufferGeometry（四邊形）+ ShaderMaterial = 1 draw call；不用 gl_PointSize
 * （最大圈直徑在 DPR 2 下約 330 device px，部分 GPU 的 point size 上限不夠）。
 *
 * 座標精度：instance 位置存「相對參考原點」的 Mercator 偏移，原點平移在 JS（float64）先乘進
 * 矩陣，避免高 zoom 下 float32 抖動。世界副本：vertex shader 依地圖中心挑最近的一份，
 * 全球視角下跨換日線的震央才會畫在 Mapbox 圓點那一份上。
 *
 * 地球投影（本站底圖 zoom < 6 為 globe）：Mapbox 給 custom layer 的 matrix 一律是 mercator
 * matrix，另附 globe→mercator 矩陣與過渡係數（zoom 5→6 由 0 漸變到 1）。照 Mapbox 官方
 * globe custom layer 的做法：ECEF 位置經 globeToMerc 轉進同一空間後與 mercator 位置 mix，
 * 再乘 mercator matrix；位於地球背面的震央（相機看不到）整圈收掉，與 Mapbox 圓點一致。
 */

export const RIPPLE_CYCLE_MS = 2400;
export const RIPPLE_RINGS = 2;
const BASE_RADIUS_PX = 6;
const MAX_ADD_PX = 60;
const MAX_STROKE_PX = 2.5;
const MAX_STROKE_OPACITY = 0.7;
/** Mapbox globe 的 ECEF 半徑（EXTENT 8192 / 2π），與 mapbox-gl latLngToECEF 一致 */
const GLOBE_RADIUS = 8192 / Math.PI / 2;

/** 經緯度 → Mapbox globe ECEF（與 mapbox-gl 內部 csLatLngToECEF 同公式） */
export function latLngToGlobeEcef(lat: number, lng: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lng * Math.PI) / 180;
  const c = Math.cos(la);
  return [c * Math.sin(lo) * GLOBE_RADIUS, -Math.sin(la) * GLOBE_RADIUS, c * Math.cos(lo) * GLOBE_RADIUS];
}

export interface QuakeRippleItem {
  lng: number;
  lat: number;
  mag: number;
  /** 0~1 sRGB（與 Mapbox interpolate 預設的 rgb 插值相同空間） */
  rgb: [number, number, number];
}

/** 第 ring 道圈在掛鐘時間 nowMs 的相位（0~1）——與舊 rippleTick 的公式相同。 */
export function ripplePhase(nowMs: number, ring: number): number {
  const shifted = nowMs + ring * (RIPPLE_CYCLE_MS / RIPPLE_RINGS);
  return (((shifted % RIPPLE_CYCLE_MS) + RIPPLE_CYCLE_MS) % RIPPLE_CYCLE_MS) / RIPPLE_CYCLE_MS;
}

/** 相位 → 該圈的半徑／描邊寬／描邊不透明度（opacity 尚未乘圖層 opacity）。 */
export function rippleRing(phase: number, mag: number) {
  const eased = 1 - Math.pow(1 - phase, 2);
  return {
    radiusPx: mag * 2 + BASE_RADIUS_PX + MAX_ADD_PX * eased,
    strokePx: MAX_STROKE_PX * (1 - eased * 0.5),
    strokeOpacity: MAX_STROKE_OPACITY * (1 - eased),
  };
}

const VERT = /* glsl */ `
attribute vec2 corner;
attribute vec3 iOffset;
attribute float iMag;
attribute float iRing;
attribute vec3 iColor;
attribute vec3 iEcef;
uniform mat4 uMatrix;      // Mapbox matrix × translate(origin)，JS 端 float64 先乘好
uniform vec2 uViewport;    // CSS px
uniform float uRefW;       // 地圖中心點的 clip w（= camera-to-center distance）
uniform float uPhase0;     // 掛鐘相位（0~1），第 0 道圈
uniform float uWrapShift;  // 地圖中心的 mercator x - 原點 x（挑最近的世界副本）
uniform float uGlobe;      // 1 = 地球投影
uniform mat4 uGlobeToMerc; // ECEF → mercator 單位
uniform float uTransition; // globe→mercator 過渡（0 = 純 globe，1 = 純 mercator）
uniform vec3 uOrigin;      // mercator 參考原點
uniform vec3 uCamEcef;     // 相機在 ECEF 的位置（背面剔除）
varying vec2 vLocal;
varying float vRadius;
varying float vStroke;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float phase = fract(uPhase0 + iRing * ${(1 / RIPPLE_RINGS).toFixed(6)});
  float eased = 1.0 - (1.0 - phase) * (1.0 - phase);
  float radius = iMag * 2.0 + ${BASE_RADIUS_PX.toFixed(1)} + ${MAX_ADD_PX.toFixed(1)} * eased;
  float stroke = ${MAX_STROKE_PX.toFixed(2)} * (1.0 - eased * 0.5);
  float halfSize = radius + stroke + 1.5;
  vec3 p = iOffset;
  p.x += floor(uWrapShift - p.x + 0.5);
  if (uGlobe > 0.5) {
    // 地球背面（法線背向相機）→ 丟到裁切範圍外，不畫
    if (dot(iEcef, uCamEcef - iEcef) < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec4 g = uGlobeToMerc * vec4(iEcef, 1.0);
    p = mix(g.xyz / g.w - uOrigin, p, uTransition);
  }
  vec4 clip = uMatrix * vec4(p, 1.0);
  // 與 Mapbox circle（pitch-scale=map）相同：位移量乘 camera-to-center distance，再由 w 透視除法
  clip.xy += corner * halfSize * (2.0 / uViewport) * uRefW;
  gl_Position = clip;
  vLocal = corner * halfSize;
  vRadius = radius;
  vStroke = stroke;
  vAlpha = ${MAX_STROKE_OPACITY.toFixed(2)} * (1.0 - eased);
  vColor = iColor;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity;
varying vec2 vLocal;
varying float vRadius;
varying float vStroke;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(vLocal);
  float aa = max(fwidth(d), 0.5);
  float inner = smoothstep(vRadius - aa, vRadius, d);
  float outer = 1.0 - smoothstep(vRadius + vStroke, vRadius + vStroke + aa, d);
  float a = inner * outer * vAlpha * uOpacity;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export interface QuakeRippleView {
  /** 地圖中心的 mercator x（0~1，可為展開值） */
  centerMercX: number;
  /** 地圖中心點在 matrix 下的 clip w */
  refW: number;
  viewportW: number;
  viewportH: number;
  nowMs: number;
  /** 地球投影時由 custom layer 帶入（Mapbox render 的 projectionToMercatorMatrix / Transition） */
  globe?: { globeToMerc: number[]; transition: number };
}

export class QuakeRippleScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private geometry: THREE.InstancedBufferGeometry | null = null;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh | null = null;
  private origin = { x: 0, y: 0 };
  private matrix = new THREE.Matrix4();
  private translate = new THREE.Matrix4();
  private tmp = new THREE.Matrix4();
  private eventCount = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMatrix: { value: new THREE.Matrix4() },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uRefW: { value: 1 },
        uPhase0: { value: 0 },
        uWrapShift: { value: 0 },
        uOpacity: { value: 0.9 },
        uGlobe: { value: 0 },
        uGlobeToMerc: { value: new THREE.Matrix4() },
        uTransition: { value: 1 },
        uOrigin: { value: new THREE.Vector3() },
        uCamEcef: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  /** 目前有幾個震央在播漣漪 */
  get count(): number {
    return this.eventCount;
  }

  /** instance 數 = 震央數 × 圈數 */
  get instanceCount(): number {
    return this.geometry?.instanceCount ?? 0;
  }

  setRipples(items: QuakeRippleItem[]) {
    this.disposeMesh();
    const valid = items.filter((r) => Number.isFinite(r.lng) && Number.isFinite(r.lat) && Number.isFinite(r.mag));
    this.eventCount = valid.length;
    if (valid.length === 0) return;

    const mcs = valid.map((r) => toMercator(r.lat, r.lng, 0));
    this.origin = {
      x: mcs.reduce((s, m) => s + m.x, 0) / mcs.length,
      y: mcs.reduce((s, m) => s + m.y, 0) / mcs.length,
    };

    const n = valid.length * RIPPLE_RINGS;
    const offset = new Float32Array(n * 3);
    const mag = new Float32Array(n);
    const ring = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const ecef = new Float32Array(n * 3);
    let k = 0;
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i]!;
      const mc = mcs[i]!;
      const e = latLngToGlobeEcef(r.lat, r.lng);
      for (let j = 0; j < RIPPLE_RINGS; j++, k++) {
        offset[k * 3] = mc.x - this.origin.x;
        offset[k * 3 + 1] = mc.y - this.origin.y;
        offset[k * 3 + 2] = 0;
        mag[k] = r.mag;
        ring[k] = j;
        color[k * 3] = r.rgb[0];
        color[k * 3 + 1] = r.rgb[1];
        color[k * 3 + 2] = r.rgb[2];
        ecef[k * 3] = e[0];
        ecef[k * 3 + 1] = e[1];
        ecef[k * 3 + 2] = e[2];
      }
    }

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("corner", new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    // three 的 Mesh 需要 position 屬性才會繪製；vertex shader 不讀它
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offset, 3));
    g.setAttribute("iMag", new THREE.InstancedBufferAttribute(mag, 1));
    g.setAttribute("iRing", new THREE.InstancedBufferAttribute(ring, 1));
    g.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 3));
    g.setAttribute("iEcef", new THREE.InstancedBufferAttribute(ecef, 3));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    this.geometry = g;

    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setOpacity(o: number) {
    this.material.uniforms.uOpacity!.value = Math.max(0, Math.min(1, o));
  }

  render(mapMatrix: number[], view: QuakeRippleView) {
    if (!this.renderer || !this.mesh) return;
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    const u = this.material.uniforms;
    this.matrix.fromArray(mapMatrix).multiply(this.translate.makeTranslation(this.origin.x, this.origin.y, 0));
    (u.uMatrix!.value as THREE.Matrix4).copy(this.matrix);
    (u.uViewport!.value as THREE.Vector2).set(Math.max(1, view.viewportW), Math.max(1, view.viewportH));
    u.uRefW!.value = view.refW;
    u.uPhase0!.value = ripplePhase(view.nowMs, 0);
    u.uWrapShift!.value = view.centerMercX - this.origin.x;
    (u.uOrigin!.value as THREE.Vector3).set(this.origin.x, this.origin.y, 0);
    if (view.globe && view.globe.transition < 1) {
      u.uGlobe!.value = 1;
      u.uTransition!.value = view.globe.transition;
      const g2m = (u.uGlobeToMerc!.value as THREE.Matrix4).fromArray(view.globe.globeToMerc);
      // 相機位置：ECEF→clip 矩陣的逆矩陣作用在 (0,0,1,0)（透視投影的相機中心是齊次解）
      const ecefToClip = this.tmp.fromArray(mapMatrix).multiply(g2m);
      const cam = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(ecefToClip.invert());
      if (Math.abs(cam.w) > 1e-12) (u.uCamEcef!.value as THREE.Vector3).set(cam.x / cam.w, cam.y / cam.w, cam.z / cam.w);
    } else {
      u.uGlobe!.value = 0;
      u.uTransition!.value = 1;
    }

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  private disposeMesh() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    this.eventCount = 0;
  }

  dispose() {
    this.disposeMesh();
    this.material.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
