/**
 * 交通可及性「單一起點播放」自訂 WebGL 圖層（移植 taipei-gis-analytics transit_reach/viewer/reach.html）。
 *
 * - 靜態幾何（H3 res 8 約 5.6 萬格，每格中心＋邊界頂點的扇形）只在第一次建一次；
 *   切起點／模式時只重寫每頂點 (t, a) 兩個浮點；**播放每幀只改時間 uniform**
 *   （原型實測：feature-state／setData 做動畫只有 0.9 fps，這條路 shader 內判斷 t ≤ T）。
 * - 分階色：前 2 小時每 15 分一階、之後每 30 分（viridis）；前緣（30 分內剛到）較亮、剛到 6 分鐘淡入。
 * - 比較模式：橘＝主檔比基準提早 ≥10 分；藍＝其餘。
 * - 離島且未被接上＝斜線（未涵蓋）；無路網格＝淡灰。
 * - 地球投影（本站 zoom < 6）：照 `QuakeRippleScene` 的作法，ECEF 經 globeToMerc 轉換後與 mercator 依過渡係數混合，
 *   背面頂點丟出裁切範圍。ECEF 在 vertex shader 由 mercator 反算經緯度，不另存屬性。
 * - 雙向比較（`setTimes(main, base, "diverge")`，雙北大眾運輸可及性 GPS−表定用）：以兩檔較早者揭露，差值依 PuOr 分 7 色、
 *   |差| ≤ 容許值畫中性灰（spec §5.40 S-4）；`id` 選項讓兩個播放層可同時掛在地圖上。
 * - 原型 fragment 用 mediump 且以 1e9 當「未到」哨兵；改 highp＋哨兵 1e4（分鐘最大 720）避免行動 GPU 溢位。
 */
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { TRANSIT_REACH_COMPARE_COLORS, TRANSIT_REACH_FRONT_MIN, TRANSIT_REACH_GAIN_MIN, TRANSIT_REACH_NA, TRANSIT_REACH_VIRIDIS } from "../data/transitReachTypes";

export const TRANSIT_REACH_CUSTOM_LAYER_ID = "transit-reach-playback-cells";
/** 未到哨兵（分） */
const UNREACHED = 1.0e4;

const VS = `
precision highp float;
attribute vec2 a_pos;   // mercator 0–1
attribute float a_u;    // 0 本島路網／1 無路網／2 離島路網
attribute vec2 a_ta;    // (主檔到達分, 基準到達分)；未到＝1e4
uniform mat4 u_matrix;
uniform float u_globe;
uniform mat4 u_globeToMerc;
uniform float u_transition;
uniform vec3 u_camEcef;
varying float v_u;
varying vec2 v_ta;
const float PI = 3.141592653589793;
const float R = ${(8192 / Math.PI / 2).toFixed(6)};
void main() {
  vec3 p = vec3(a_pos, 0.0);
  if (u_globe > 0.5) {
    float lng = a_pos.x * 2.0 * PI - PI;
    float lat = 2.0 * atan(exp(PI - a_pos.y * 2.0 * PI)) - 0.5 * PI;
    float c = cos(lat);
    vec3 ecef = vec3(c * sin(lng) * R, -sin(lat) * R, c * cos(lng) * R);
    if (dot(ecef, u_camEcef - ecef) < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec4 g = u_globeToMerc * vec4(ecef, 1.0);
    p = mix(g.xyz / g.w, p, u_transition);
  }
  gl_Position = u_matrix * vec4(p, 1.0);
  v_u = a_u;
  v_ta = a_ta;
}`;

const FS = `
precision highp float;
uniform float u_T;
uniform float u_cmax;
uniform float u_cmp;
uniform float u_opacity;
uniform vec3 u_ramp[10];
uniform vec3 u_base;
uniform vec3 u_gain;
uniform vec3 u_div[7];
uniform float u_tol;
varying float v_u;
varying vec2 v_ta;
void main() {
  float op = u_opacity;
  if (v_u > 1.5 && v_ta.x > ${(UNREACHED / 10).toFixed(1)}) { // 離島且沒被任何運具接上：斜線（未涵蓋）
    if (mod(gl_FragCoord.x + gl_FragCoord.y, 8.0) > 2.0) discard;
    float a0 = 0.55 * op;
    gl_FragColor = vec4(vec3(0.29, 0.33, 0.39) * a0, a0); return;
  }
  if (v_u > 0.5 && v_u < 1.5) { float a1 = 0.22 * op; gl_FragColor = vec4(vec3(0.61, 0.64, 0.69) * a1, a1); return; } // 無路網
  float t = u_cmp > 1.5 ? min(v_ta.x, v_ta.y) : v_ta.x;
  if (t > u_T) discard;
  float front = (t > u_T - ${TRANSIT_REACH_FRONT_MIN.toFixed(1)}) ? 0.92 : 0.62;
  float a = front * clamp((u_T - t) / 6.0, 0.0, 1.0) * op;
  vec3 c;
  if (u_cmp > 1.5) {
    float d = v_ta.x - v_ta.y;
    if (abs(d) <= u_tol) { c = u_div[3]; a *= 0.45; }
    else if (d < 0.0) c = d <= -20.0 ? u_div[0] : (d <= -10.0 ? u_div[1] : u_div[2]);
    else c = d >= 20.0 ? u_div[6] : (d >= 10.0 ? u_div[5] : u_div[4]);
  } else if (u_cmp > 0.5) {
    c = (v_ta.y - t >= ${TRANSIT_REACH_GAIN_MIN.toFixed(1)}) ? u_gain : u_base;
  } else {
    float stp = t < 120.0 ? floor(t / 15.0) : 8.0 + floor((t - 120.0) / 30.0);
    float x = clamp(stp / max(u_cmax - 1.0, 1.0), 0.0, 1.0) * 9.0;
    c = u_ramp[9];
    for (int i = 0; i < 9; i++) { if (x <= float(i + 1)) { c = mix(u_ramp[i], u_ramp[i + 1], x - float(i)); break; } }
  }
  gl_FragColor = vec4(c * a, a);
}`;

const hex2rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.substr(k, 2), 16) / 255);
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/** 4×4 column-major 反矩陣（相機 ECEF 位置用；奇異回 null） */
export function invertMat4(m: ArrayLike<number>): number[] | null {
  const a = Array.from(m);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

/** column-major a × b */
function mulMat4(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
    out[c * 4 + r] = s;
  }
  return out;
}

export interface TransitReachGeometry {
  /** 每格 [lat, lng] 邊界頂點（h3 cellToBoundary） */
  rings: ArrayLike<ArrayLike<number>>[] | number[][][];
  centers: number[][];
  u: readonly number[];
}

export interface TransitReachLayerOptions {
  /** 目前時間（分）；每幀讀 */
  getTimeMin: () => number;
  getOpacity: () => number;
  /** 每幀 render 的 CPU 時間（效能量測） */
  onRenderMs?: (ms: number) => void;
  /** 圖層 id（預設 transitReach 播放層） */
  id?: string;
  /** 雙向比較 7 色（由「主檔較早很多」到「主檔較晚很多」，中間＝差在容許值內）與容許值（分） */
  diverge?: { colors: readonly string[]; tolMin: number };
}

export interface TransitReachCustomLayer extends CustomLayerInterface {
  setGeometry(geo: TransitReachGeometry): void;
  /** 每格到達時間（Uint16，0.1 分；0xFFFF 未到）。main 為 null＝清空 */
  setTimes(main: Uint16Array | null, base: Uint16Array | null, compare: boolean | "diverge"): void;
  /** 色階範圍（小時） */
  setRangeHours(hours: number): void;
}

export function createTransitReachLayer(opts: TransitReachLayerOptions): TransitReachCustomLayer {
  let map: MapboxMap | null = null;
  let gl: WebGLRenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  const loc: Record<string, WebGLUniformLocation | number | null> = {};
  let posBuf: WebGLBuffer | null = null, idxBuf: WebGLBuffer | null = null, taBuf: WebGLBuffer | null = null;
  let nVerts = 0, nIdx = 0;
  let cellOfVert: Uint32Array | null = null;
  // 換底圖時 Mapbox 會 onRemove／onAdd：幾何與到達時間留在這裡，重掛時再上傳
  let geoData: TransitReachGeometry | null = null;
  let timeData: { main: Uint16Array | null; base: Uint16Array | null } = { main: null, base: null };
  let hasData = false;
  let compare = 0;
  let nSteps = 20;
  const ramp = new Float32Array(TRANSIT_REACH_VIRIDIS.flatMap(hex2rgb));
  const baseColor = hex2rgb(TRANSIT_REACH_COMPARE_COLORS.base);
  const gainColor = hex2rgb(TRANSIT_REACH_COMPARE_COLORS.gain);
  const divColors = new Float32Array((opts.diverge?.colors ?? Array(7).fill("#9ca3af")).slice(0, 7).flatMap(hex2rgb));
  const divTol = opts.diverge?.tolMin ?? 5;

  const uploadGeometry = (geo: TransitReachGeometry) => {
    geoData = geo;
    if (!gl) return;
    let nv = 0, ni = 0;
    const rings = geo.rings as ArrayLike<ArrayLike<number>>[];
    for (const r of rings) { nv += r.length + 1; ni += r.length * 3; }
    const pos = new Float32Array(nv * 3), idx = new Uint32Array(ni), cov = new Uint32Array(nv);
    let v = 0, k = 0;
    rings.forEach((r, ci) => {
      const c = geo.centers[ci]!, base = v, u = geo.u[ci] ?? 0;
      pos[v * 3] = mercX(c[1]!); pos[v * 3 + 1] = mercY(c[0]!); pos[v * 3 + 2] = u; cov[v++] = ci;
      for (let q = 0; q < r.length; q++) {
        const p = r[q] as ArrayLike<number>;
        pos[v * 3] = mercX(p[1]!); pos[v * 3 + 1] = mercY(p[0]!); pos[v * 3 + 2] = u; cov[v++] = ci;
      }
      for (let q = 0; q < r.length; q++) { idx[k++] = base; idx[k++] = base + 1 + q; idx[k++] = base + 1 + ((q + 1) % r.length); }
    });
    nVerts = nv; nIdx = ni; cellOfVert = cov;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, taBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nv * 2).fill(UNREACHED), gl.DYNAMIC_DRAW);
    uploadTimes(timeData.main, timeData.base);
  };

  const uploadTimes = (main: Uint16Array | null, base: Uint16Array | null) => {
    timeData = { main, base };
    hasData = !!main;
    if (!gl || !cellOfVert) return;
    const d = new Float32Array(nVerts * 2), cv = cellOfVert;
    for (let v = 0; v < nVerts; v++) {
      const c = cv[v]!;
      const b = main ? main[c]! : TRANSIT_REACH_NA, a = base ? base[c]! : TRANSIT_REACH_NA;
      d[v * 2] = b === TRANSIT_REACH_NA ? UNREACHED : b / 10;
      d[v * 2 + 1] = a === TRANSIT_REACH_NA ? UNREACHED : a / 10;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, taBuf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
    map?.triggerRepaint();
  };

  return {
    id: opts.id ?? TRANSIT_REACH_CUSTOM_LAYER_ID,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(m: MapboxMap, context: WebGLRenderingContext) {
      map = m; gl = context;
      const mk = (type: number, src: string) => {
        const sh = context.createShader(type)!;
        context.shaderSource(sh, src); context.compileShader(sh);
        if (!context.getShaderParameter(sh, context.COMPILE_STATUS)) throw new Error(context.getShaderInfoLog(sh) ?? "shader compile failed");
        return sh;
      };
      prog = context.createProgram()!;
      context.attachShader(prog, mk(context.VERTEX_SHADER, VS)); context.attachShader(prog, mk(context.FRAGMENT_SHADER, FS));
      context.linkProgram(prog);
      if (!context.getProgramParameter(prog, context.LINK_STATUS)) throw new Error(context.getProgramInfoLog(prog) ?? "program link failed");
      for (const n of ["a_pos", "a_u", "a_ta"]) loc[n] = context.getAttribLocation(prog, n);
      for (const n of ["u_matrix", "u_globe", "u_globeToMerc", "u_transition", "u_camEcef", "u_T", "u_cmax", "u_cmp", "u_opacity", "u_ramp", "u_base", "u_gain", "u_div", "u_tol"]) loc[n] = context.getUniformLocation(prog, n);
      posBuf = context.createBuffer(); idxBuf = context.createBuffer(); taBuf = context.createBuffer();
      if (!(typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext)) context.getExtension("OES_element_index_uint");
      cellOfVert = null;
      if (geoData) uploadGeometry(geoData);
    },

    render(context: WebGLRenderingContext, matrix: number[], projection?: { name?: string }, globeToMerc?: number[], transition?: number) {
      if (!prog || !nIdx || !hasData) return;
      const t0 = performance.now();
      const g = context;
      g.useProgram(prog);
      g.uniformMatrix4fv(loc.u_matrix as WebGLUniformLocation, false, matrix);
      const globe = projection?.name === "globe" && globeToMerc && (transition ?? 0) < 1;
      g.uniform1f(loc.u_globe as WebGLUniformLocation, globe ? 1 : 0);
      if (globe) {
        g.uniformMatrix4fv(loc.u_globeToMerc as WebGLUniformLocation, false, globeToMerc!);
        g.uniform1f(loc.u_transition as WebGLUniformLocation, transition ?? 0);
        // 相機位置：ECEF→clip 的反矩陣作用在 (0,0,1,0)（同 QuakeRippleScene）
        const inv = invertMat4(mulMat4(matrix, globeToMerc!));
        if (inv && Math.abs(inv[11]!) > 1e-12) g.uniform3f(loc.u_camEcef as WebGLUniformLocation, inv[8]! / inv[11]!, inv[9]! / inv[11]!, inv[10]! / inv[11]!);
      } else {
        g.uniform1f(loc.u_transition as WebGLUniformLocation, 1);
      }
      g.uniform1f(loc.u_T as WebGLUniformLocation, opts.getTimeMin());
      g.uniform1f(loc.u_cmax as WebGLUniformLocation, nSteps);
      g.uniform1f(loc.u_cmp as WebGLUniformLocation, compare);
      g.uniform1f(loc.u_opacity as WebGLUniformLocation, Math.max(0, Math.min(1, opts.getOpacity())));
      g.uniform3fv(loc.u_ramp as WebGLUniformLocation, ramp);
      g.uniform3fv(loc.u_base as WebGLUniformLocation, baseColor);
      g.uniform3fv(loc.u_gain as WebGLUniformLocation, gainColor);
      g.uniform3fv(loc.u_div as WebGLUniformLocation, divColors);
      g.uniform1f(loc.u_tol as WebGLUniformLocation, divTol);
      const aPos = loc.a_pos as number, aU = loc.a_u as number, aTa = loc.a_ta as number;
      g.bindBuffer(g.ARRAY_BUFFER, posBuf);
      g.enableVertexAttribArray(aPos); g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 12, 0);
      g.enableVertexAttribArray(aU); g.vertexAttribPointer(aU, 1, g.FLOAT, false, 12, 8);
      g.bindBuffer(g.ARRAY_BUFFER, taBuf);
      g.enableVertexAttribArray(aTa); g.vertexAttribPointer(aTa, 2, g.FLOAT, false, 8, 0);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, idxBuf);
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA); g.disable(g.DEPTH_TEST);
      g.drawElements(g.TRIANGLES, nIdx, g.UNSIGNED_INT, 0);
      g.disableVertexAttribArray(aPos); g.disableVertexAttribArray(aU); g.disableVertexAttribArray(aTa);
      opts.onRenderMs?.(performance.now() - t0);
    },

    onRemove(_m: MapboxMap, context: WebGLRenderingContext) {
      for (const b of [posBuf, idxBuf, taBuf]) if (b) context.deleteBuffer(b);
      if (prog) context.deleteProgram(prog);
      posBuf = idxBuf = taBuf = null; prog = null; gl = null; map = null; nIdx = 0; cellOfVert = null;
    },

    setGeometry(geo) { uploadGeometry(geo); },
    setTimes(main, base, isCompare) { compare = isCompare === "diverge" ? 2 : isCompare ? 1 : 0; uploadTimes(main, base); },
    setRangeHours(hours) { nSteps = 8 + Math.ceil((hours * 60 - 120) / 30); map?.triggerRepaint(); },
  };
}
