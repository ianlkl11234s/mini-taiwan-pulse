/**
 * RealEstatePointsScene — 房地產交易「點」的 WebGL 渲染（取代 3 個 PMTiles circle 圖層）。
 *
 * 為何存在：原本播放歷史（月/週）時，每幀對 365k 點重設資料驅動 circle-opacity 運算式，
 * Mapbox 必須逐 feature 重算 + 重灌 GPU buffer（O(feature) / 幀）→ 卡頓。
 * 改用一次性 GPU buffer + 一個 uCursorTs uniform，fade 全在 shader 算，每幀成本固定。
 *
 * 對標：WasteMusicNoteScene（uTime uniform GPU fade）+ OsmPowerLinesGlowScene（GL state 存還 / 關 frustum cull）。
 *
 * ⚠️ float32 精度：trade_ts ~1.7e9 超出 float32 尾數，buffer 內存「相對 RANGE_START 的差值」；
 *    uCursorTs / 季窗也同樣相對化。
 */
import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import { RANGE_START } from "../lib/realEstateTime";
import { RE_PALETTES } from "../map/overlayRegistry";
import type { RePointsState } from "../state/realEstatePointsStore";

const PALETTE_KEYS = ["rental", "sale", "presale"] as const;
const MODE_CODE: Record<RePointsState["mode"], number> = { realtime: 0, quarter: 1, fadewindow: 2 };

const VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aTradeTs;   // 相對 RANGE_START 的交易秒
attribute float aType;      // 0 rental / 1 sale / 2 presale
attribute float aIsTaipei;  // 0 / 1
attribute vec3  aColor;     // 已在 JS 端依 domain 算好

uniform float uCursorTs;    // 相對 RANGE_START
uniform float uMode;        // 0 realtime / 1 quarter / 2 fadewindow
uniform float uFull;
uniform float uFade;
uniform float uQStart;
uniform float uQEnd;
uniform float uShowRental;
uniform float uShowSale;
uniform float uShowPresale;
uniform float uExcludeTaipei;
uniform float uBaseOpacity;
uniform float uPointSize;

varying float vOpacity;
varying vec3  vColor;

void main() {
  // type 顯示開關
  float shown = aType < 0.5 ? uShowRental : (aType < 1.5 ? uShowSale : uShowPresale);

  // 模式 opacity
  float op = 0.0;
  if (uMode < 0.5) {
    op = 1.0;                                   // realtime：全顯示
  } else if (uMode < 1.5) {
    op = (aTradeTs >= uQStart && aTradeTs < uQEnd) ? 1.0 : 0.0;  // quarter snapshot
  } else {
    float diff = uCursorTs - aTradeTs;          // fadewindow：單側拖尾梯形
    if (diff < 0.0) op = 0.0;
    else if (diff < uFull) op = 1.0;
    else if (diff < uFull + uFade) op = 1.0 - (diff - uFull) / uFade;
    else op = 0.0;
  }

  op *= shown;
  if (uExcludeTaipei > 0.5 && aIsTaipei > 0.5) op = 0.0;
  op *= uBaseOpacity;

  vOpacity = op;
  vColor = aColor;

  if (op <= 0.001) {
    // 不顯示 → 推到 clip 外避免 fragment 工作
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPointSize;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying float vOpacity;
varying vec3  vColor;

void main() {
  // 圓點：裁掉方形角落
  vec2 c = gl_PointCoord - vec2(0.5);
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  // 邊緣柔化 1px 感
  float edge = smoothstep(0.25, 0.18, d2);
  float a = vOpacity * edge;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** 對齊 overlayRegistry reColorExpr：在 domain 上均分色票、線性插值（excludeTaipei 換 domainExcl） */
function colorForValue(typeIdx: number, value: number, excludeTaipei: boolean): [number, number, number] {
  const p = RE_PALETTES[PALETTE_KEYS[typeIdx]!];
  const rgbs = p.colors.map(hexToRgb);
  const [lo, hi] = excludeTaipei ? p.domainExcl : p.domain;
  const n = rgbs.length;
  if (value <= lo || hi <= lo) return rgbs[0]!;
  if (value >= hi) return rgbs[n - 1]!;
  const t = ((value - lo) / (hi - lo)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(t));
  const f = t - i;
  const a = rgbs[i]!;
  const b = rgbs[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export class RealEstatePointsScene {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  renderer!: THREE.WebGLRenderer;

  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;

  // 供 excludeTaipei 切換時重算顏色
  private typeArr: Float32Array | null = null;
  private priceArr: Float32Array | null = null;
  private count = 0;
  private lastExcludeTaipei: boolean | null = null;
  private lastMatrix = new THREE.Matrix4();

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uCursorTs: { value: 0 },
        uMode: { value: 0 },
        uFull: { value: 0 },
        uFade: { value: 0 },
        uQStart: { value: 0 },
        uQEnd: { value: 0 },
        uShowRental: { value: 0 },
        uShowSale: { value: 0 },
        uShowPresale: { value: 0 },
        uExcludeTaipei: { value: 0 },
        uBaseOpacity: { value: 0.85 },
        uPointSize: { value: 4 },
      },
    });
  }

  /** 一次性灌入全部點（interleaved Float32：[lng, lat, tradeTsRel, price, packed] × N） */
  setBuffer(data: Float32Array) {
    const n = Math.floor(data.length / 5);
    this.count = n;
    const positions = new Float32Array(n * 3);
    const tradeTs = new Float32Array(n);
    const type = new Float32Array(n);
    const isTaipei = new Float32Array(n);
    const price = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const o = i * 5;
      const lng = data[o]!;
      const lat = data[o + 1]!;
      const mc = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
      positions[i * 3] = mc.x;
      positions[i * 3 + 1] = mc.y;
      positions[i * 3 + 2] = 0;
      tradeTs[i] = data[o + 2]!;
      price[i] = data[o + 3]!;
      const packed = data[o + 4]!;
      const isTp = packed >= 4 ? 1 : 0;
      type[i] = packed - isTp * 4;
      isTaipei[i] = isTp;
    }

    this.typeArr = type;
    this.priceArr = price;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aTradeTs", new THREE.BufferAttribute(tradeTs, 1));
    geo.setAttribute("aType", new THREE.BufferAttribute(type, 1));
    geo.setAttribute("aIsTaipei", new THREE.BufferAttribute(isTaipei, 1));
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute("aColor", this.colorAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 0.5, 0), 2);

    this.geometry?.dispose();
    this.geometry = geo;
    if (this.points) this.scene.remove(this.points);
    this.points = new THREE.Points(geo, this.material!);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // 首次上色（lastExcludeTaipei null → 強制算）
    this.recomputeColors(false);
  }

  /** excludeTaipei 切換時重算 aColor（不進每幀路徑） */
  recomputeColors(excludeTaipei: boolean) {
    if (!this.colorAttr || !this.typeArr || !this.priceArr) return;
    if (this.lastExcludeTaipei === excludeTaipei) return;
    const col = this.colorAttr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const [r, g, b] = colorForValue(this.typeArr[i]!, this.priceArr[i]!, excludeTaipei);
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
    this.colorAttr.needsUpdate = true;
    this.lastExcludeTaipei = excludeTaipei;
  }

  /** 每幀套用 store 狀態到 uniforms */
  applyState(s: RePointsState, pointSizePx: number) {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uCursorTs!.value = s.cursorTs - RANGE_START;
    u.uMode!.value = MODE_CODE[s.mode];
    u.uFull!.value = s.full;
    u.uFade!.value = s.fade;
    u.uQStart!.value = s.qStart - RANGE_START;
    u.uQEnd!.value = s.qEnd - RANGE_START;
    u.uShowRental!.value = s.show[0] ? 1 : 0;
    u.uShowSale!.value = s.show[1] ? 1 : 0;
    u.uShowPresale!.value = s.show[2] ? 1 : 0;
    u.uExcludeTaipei!.value = s.excludeTaipei ? 1 : 0;
    u.uBaseOpacity!.value = s.baseOpacity;
    u.uPointSize!.value = pointSizePx;
    this.recomputeColors(s.excludeTaipei);
  }

  hasData(): boolean {
    return this.count > 0;
  }

  render(matrix: number[]) {
    if (!this.material || !this.points) return;

    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points = null;
    }
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
  }
}
