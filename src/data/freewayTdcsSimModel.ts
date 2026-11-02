/**
 * 雙北國道逐車模擬：trips.bin 解碼與依時間內插（純函式，不碰 three／mapbox，供 scene、點選、跟隨共用）。
 *
 * 逐行移植自原型 taipei-gis-analytics pipelines/analysis/freeway_tdcs/viewer/index.html
 * 的 load()／laneOffset()／segPos()／buildChunk()：
 * - 關鍵影格只存起點、門架、換線處；門架之間沿折線等速展開（門架通過時間是真實的，其餘推算）。
 * - 車道：折線視為該方向車道中心線，每車道 3.6 m，行車方向右側為正；換道 smoothstep 橫移。
 * 時間單位：自資料日 00:00（台北）起的秒數（kf_time + t_base）。
 */
import {
  FREEWAY_TDCS_VT_RGB, freewayTdcsSpeedRgb, type FreewayTdcsColorMode,
} from "./freewayTdcsSimTypes";

const KX = 111320 * Math.cos((25 * Math.PI) / 180);
const KY = 110540;

export interface FreewayTdcsMeta {
  date: string;
  window: [number, number];
  t_base: number;
  n_trips: number;
  layout: Record<string, { offset: number; length: number; dtype: "uint8" | "uint16" | "uint32" }>;
  names: string[];
  peak_concurrent?: number;
  lane_change_s?: number;
}

export interface FreewayTdcsNetwork {
  nodes: number[];
  line_of: number[];
  lines: { road: string; dir: string; lanes: number; start: number; end: number }[];
  lane_w: number;
  range_bbox: [number, number, number, number];
}

export interface FreewayTdcsData {
  meta: FreewayTdcsMeta;
  net: FreewayTdcsNetwork;
  /** 資料日 00:00（Asia/Taipei）的 unix 秒 */
  dayStartUnix: number;
  winStart: number;
  winEnd: number;
  kn: Uint16Array; kt: Uint16Array; segs: Uint32Array;
  vt: Uint8Array; spd: Uint8Array; flags: Uint8Array; on: Uint16Array; off: Uint16Array;
  evS: Uint32Array | null; evT: Uint16Array | null; evL: Uint8Array | null;
  lcT: number;
  nSeg: number;
  segStart: Float64Array; segEnd: Float64Array;
  nodeLng: Float64Array; nodeLat: Float64Array;
  cum: Float64Array; nx: Float64Array; ny: Float64Array; lineOf: Int32Array;
  /** 每趟的段：tripSegs[tripSegStart[i] .. tripSegStart[i+1]) */
  tripSegStart: Uint32Array; tripSegs: Uint32Array;
  /** 投影原點（Web Mercator 0–1 座標），頂點以相對值存，避免 float32 精度不足（車道寬 3.6 m） */
  originX: number; originY: number;
}


export function mercX(lng: number): number { return (180 + lng) / 360; }
export function mercY(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
}

export function decodeFreewayTdcs(meta: FreewayTdcsMeta, net: FreewayTdcsNetwork, bin: ArrayBuffer): FreewayTdcsData {
  const get = <K extends string>(k: K) => {
    const L = meta.layout[k];
    if (!L) throw new Error(`trips.bin 缺欄位 ${k}`);
    if (L.dtype === "uint8") return new Uint8Array(bin, L.offset, L.length);
    if (L.dtype === "uint16") return new Uint16Array(bin, L.offset, L.length);
    return new Uint32Array(bin, L.offset, L.length);
  };
  const kn = get("kf_node") as Uint16Array, kt = get("kf_time") as Uint16Array, segs = get("segs") as Uint32Array;
  const hasEv = !!meta.layout.ev_start;
  const d = `${meta.date.slice(0, 4)}-${meta.date.slice(4, 6)}-${meta.date.slice(6, 8)}`;
  const dayStartUnix = Date.parse(`${d}T00:00:00+08:00`) / 1000;
  const nSeg = segs.length / 3;
  const segStart = new Float64Array(nSeg), segEnd = new Float64Array(nSeg);
  for (let i = 0; i < nSeg; i++) {
    segStart[i] = kt[segs[3 * i]!]! + meta.t_base;
    segEnd[i] = kt[segs[3 * i + 1]! - 1]! + meta.t_base;
  }
  const N = net.nodes.length / 2;
  const nodeLng = new Float64Array(N), nodeLat = new Float64Array(N);
  for (let i = 0; i < N; i++) { nodeLng[i] = net.nodes[2 * i]!; nodeLat[i] = net.nodes[2 * i + 1]!; }
  const cum = new Float64Array(N), nx = new Float64Array(N), ny = new Float64Array(N);
  const lineOf = Int32Array.from(net.line_of);
  for (const L of net.lines) {
    for (let i = L.start; i <= L.end; i++) {
      if (i > L.start) cum[i] = cum[i - 1]! + Math.hypot((nodeLng[i]! - nodeLng[i - 1]!) * KX, (nodeLat[i]! - nodeLat[i - 1]!) * KY);
      const a = Math.max(L.start, i - 1), b = Math.min(L.end, i + 1);
      const tx = (nodeLng[b]! - nodeLng[a]!) * KX, ty = (nodeLat[b]! - nodeLat[a]!) * KY, l = Math.hypot(tx, ty) || 1;
      nx[i] = ty / l; ny[i] = -tx / l;
    }
  }
  const nTrips = meta.n_trips;
  const tripSegStart = new Uint32Array(nTrips + 1);
  for (let i = 0; i < nSeg; i++) tripSegStart[segs[3 * i + 2]! + 1]!++;
  for (let i = 0; i < nTrips; i++) tripSegStart[i + 1]! += tripSegStart[i]!;
  const fill = tripSegStart.slice(0, nTrips);
  const tripSegs = new Uint32Array(nSeg);
  for (let i = 0; i < nSeg; i++) { const tr = segs[3 * i + 2]!; tripSegs[fill[tr]!++] = i; }
  const [x0, y0, x1, y1] = net.range_bbox;
  return {
    meta, net, dayStartUnix, winStart: meta.window[0], winEnd: meta.window[1],
    kn, kt, segs,
    vt: get("vt") as Uint8Array, spd: get("spd") as Uint8Array, flags: get("flags") as Uint8Array,
    on: get("on") as Uint16Array, off: get("off") as Uint16Array,
    evS: hasEv ? (get("ev_start") as Uint32Array) : null,
    evT: hasEv ? (get("ev_time") as Uint16Array) : null,
    evL: hasEv ? (get("ev_lane") as Uint8Array) : null,
    lcT: meta.lane_change_s ?? 2.5,
    nSeg, segStart, segEnd, nodeLng, nodeLat, cum, nx, ny, lineOf, tripSegStart, tripSegs,
    originX: mercX((x0 + x1) / 2), originY: mercY((y0 + y1) / 2),
  };
}

/** 車道偏移：[偏移 m（右正）, 橫向速度 m/s] */
function laneOffset(D: FreewayTdcsData, si: number, line: number, t: number): [number, number] {
  const lanes = D.net.lines[line]!.lanes, c = (lanes - 1) / 2, W = D.net.lane_w;
  const { evS, evT, evL } = D;
  if (!evS || !evT || !evL) return [0, 0];
  const a = evS[si]!, b = evS[si + 1]!, base = D.meta.t_base;
  let k = a; while (k + 1 < b && evT[k + 1]! + base <= t) k++;
  const L1 = Math.min(evL[k]!, lanes), te = evT[k]! + base;
  if (k > a && t < te + D.lcT && t >= te) {
    const L0 = Math.min(evL[k - 1]!, lanes), u = (t - te) / D.lcT, f = u * u * (3 - 2 * u), df = (6 * u * (1 - u)) / D.lcT;
    return [(L0 + (L1 - L0) * f - c) * W, (L1 - L0) * df * W];
  }
  return [(L1 - c) * W, 0];
}

/** 段在時間 t 的位置：寫入 out = [lng, lat, hx, hy, 車速 km/h（NaN＝推算不出）] */
export function segPos(D: FreewayTdcsData, si: number, t: number, out: Float64Array): void {
  const { segs, kn, kt, cum, nodeLng: LG, nodeLat: LT, lineOf } = D;
  const s0 = segs[3 * si]!, s1 = segs[3 * si + 1]!, base = D.meta.t_base;
  let lo = s0, hi = s1 - 1;
  if (t <= kt[s0]! + base) hi = s0 + 1;
  else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (kt[mid]! + base <= t) lo = mid; else hi = mid; }
  if (hi >= s1) hi = s1 - 1;
  const nA = kn[lo]!, nB = kn[hi]!, tA = kt[lo]! + base, tB = kt[hi]! + base;
  const f = tB > tA ? Math.min(1, Math.max(0, (t - tA) / (tB - tA))) : 0;
  let x: number, y: number, hx: number, hy: number, d: number;
  if (lineOf[nA] === lineOf[nB] && nB >= nA) {
    const m = cum[nA]! + (cum[nB]! - cum[nA]!) * f; d = cum[nB]! - cum[nA]!;
    let a = nA, b = Math.max(nA, nB - 1);
    while (b - a > 0) { const mid = (a + b + 1) >> 1; if (cum[mid]! <= m) a = mid; else b = mid - 1; }
    const j = Math.min(a, Math.max(nA, nB - 1)), k = Math.min(j + 1, nB);
    const sl = cum[k]! - cum[j]!, g = sl > 0 ? (m - cum[j]!) / sl : 0;
    x = LG[j]! + (LG[k]! - LG[j]!) * g; y = LT[j]! + (LT[k]! - LT[j]!) * g;
    hx = (LG[k]! - LG[j]!) * KX; hy = (LT[k]! - LT[j]!) * KY;
  } else {
    x = LG[nA]! + (LG[nB]! - LG[nA]!) * f; y = LT[nA]! + (LT[nB]! - LT[nA]!) * f;
    hx = (LG[nB]! - LG[nA]!) * KX; hy = (LT[nB]! - LT[nA]!) * KY; d = Math.hypot(hx, hy);
  }
  const l = Math.hypot(hx, hy) || 1; hx /= l; hy /= l;
  const [off] = laneOffset(D, si, lineOf[nA]!, t);
  x += (hy * off) / KX; y += (-hx * off) / KY;
  out[0] = x; out[1] = y; out[2] = hx; out[3] = hy;
  out[4] = tB > tA ? (d / (tB - tA)) * 3.6 : NaN;
}

export function carRgb(D: FreewayTdcsData, trip: number, v: number, mode: FreewayTdcsColorMode): [number, number, number] {
  return mode === "type" ? FREEWAY_TDCS_VT_RGB[D.vt[trip]!]! : freewayTdcsSpeedRgb(Number.isFinite(v) ? v : null);
}

/** 拖尾分塊：每塊 CHUNK 秒（另含前「拖尾秒數」的軌跡），GPU 依時間淡出，每幀只改時間 uniform */
export const FREEWAY_TDCS_CHUNK_S = 60;

export interface FreewayTdcsChunk {
  k: number;
  c0: number;
  key: string;
  /** 本塊有畫的段（車頭從這裡找） */
  segIdx: Uint32Array;
  /** LineSegments 頂點：相對投影原點的 Mercator xyz、時間（相對 c0 秒）、RGB */
  positions: Float32Array;
  times: Float32Array;
  colors: Uint8Array;
  vertexCount: number;
  buildMs: number;
}

export interface ChunkOpts { trail: number; mode: FreewayTdcsColorMode; vtMask: number }

export function chunkKeyOf(k: number, o: ChunkOpts): string { return `${k}|${o.trail}|${o.mode}|${o.vtMask}`; }

/** 公尺 → Mercator 單位（以北緯 25° 近似；只用在 ≤ 15 m 的車道偏移，誤差可忽略） */
const MERC_PER_M = 1 / (40075016.686 * Math.cos((25 * Math.PI) / 180));

/** 節點的 Mercator 座標（相對原點）快取 */
const nodeMercCache = new WeakMap<FreewayTdcsData, { mx: Float64Array; my: Float64Array }>();
function nodeMerc(D: FreewayTdcsData) {
  let c = nodeMercCache.get(D);
  if (!c) {
    const n = D.nodeLng.length, mx = new Float64Array(n), my = new Float64Array(n);
    for (let i = 0; i < n; i++) { mx[i] = mercX(D.nodeLng[i]!) - D.originX; my[i] = mercY(D.nodeLat[i]!) - D.originY; }
    c = { mx, my }; nodeMercCache.set(D, c);
  }
  return c;
}

/** 車速 → RGB 查表（0–255 km/h；255＝推算不出） */
const SPEED_LUT = (() => {
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) { const c = freewayTdcsSpeedRgb(v === 255 ? null : v); lut.set(c, 3 * v); }
  return lut;
})();
function speedIdx(v: number): number { return Number.isFinite(v) ? Math.max(0, Math.min(254, Math.round(v))) : 255; }

class Grow {
  f: Float32Array; n = 0;
  constructor(cap: number) { this.f = new Float32Array(cap); }
  ensure(extra: number) { if (this.n + extra > this.f.length) { const g = new Float32Array(Math.max(this.f.length * 2, this.n + extra)); g.set(this.f); this.f = g; } }
}
class GrowU8 {
  f: Uint8Array; n = 0;
  constructor(cap: number) { this.f = new Uint8Array(cap); }
  ensure(extra: number) { if (this.n + extra > this.f.length) { const g = new Uint8Array(Math.max(this.f.length * 2, this.n + extra)); g.set(this.f); this.f = g; } }
}

export function buildChunk(D: FreewayTdcsData, k: number, o: ChunkOpts): FreewayTdcsChunk {
  const t0 = performance.now();
  const c0 = D.winStart + k * FREEWAY_TDCS_CHUNK_S;
  const w0 = c0 - Math.max(o.trail, 1), w1 = c0 + FREEWAY_TDCS_CHUNK_S, base = D.meta.t_base;
  const { segs, kn, kt, cum, nodeLng: LG, nodeLat: LT, lineOf, nx, ny, evS, evT, evL } = D;
  const { mx, my } = nodeMerc(D);
  const lines = D.net.lines, W = D.net.lane_w;
  const segIdx: number[] = [];
  const P = new Grow(1 << 20), T = new Grow(1 << 19), C = new GrowU8(1 << 19);
  const pos = new Float64Array(5);
  // 每段的頂點暫存：時間、x、y、車速
  let cap = 4096;
  let vT = new Float64Array(cap), vX = new Float64Array(cap), vY = new Float64Array(cap), vV = new Float64Array(cap);
  let nv = 0, unsorted = false;
  const push = (t: number, x: number, y: number, v: number) => {
    if (nv === cap) {
      cap *= 2;
      const g = (a: Float64Array) => { const b = new Float64Array(cap); b.set(a); return b; };
      vT = g(vT); vX = g(vX); vY = g(vY); vV = g(vV);
    }
    if (nv > 0 && t < vT[nv - 1]!) unsorted = true;
    vT[nv] = t; vX[nv] = x; vY[nv] = y; vV[nv] = v; nv++;
  };
  const pushPos = (t: number) => { push(t, mercX(pos[0]!) - D.originX, mercY(pos[1]!) - D.originY, pos[4]!); };
  const typeRgb = FREEWAY_TDCS_VT_RGB;
  for (let si = 0; si < D.nSeg; si++) {
    if (D.segEnd[si]! < w0 || D.segStart[si]! > w1) continue;
    const trip = segs[3 * si + 2]!;
    const vtype = D.vt[trip]!;
    if (!(o.vtMask & (1 << vtype))) continue;
    segIdx.push(si);
    if (o.trail <= 0) continue;
    const tS = Math.max(D.segStart[si]!, w0), tE = Math.min(D.segEnd[si]!, w1);
    if (tE <= tS) continue;
    nv = 0; unsorted = false;
    segPos(D, si, tS, pos); pushPos(tS);
    const s0 = segs[3 * si]!, s1 = segs[3 * si + 1]!;
    const eA = evS ? evS[si]! : 0, eB = evS ? evS[si + 1]! : 0;
    let ek = eA;
    for (let i = s0; i < s1 - 1; i++) {
      const nA = kn[i]!, nB = kn[i + 1]!, tA = kt[i]! + base, tB = kt[i + 1]! + base;
      if (tB <= tS || tA >= tE) continue;
      const same = lineOf[nA] === lineOf[nB] && nB >= nA, Dd = same ? cum[nB]! - cum[nA]! : 0;
      const v = tB > tA ? (same ? Dd : Math.hypot((LG[nB]! - LG[nA]!) * KX, (LT[nB]! - LT[nA]!) * KY)) / (tB - tA) * 3.6 : NaN;
      const jStart = same ? nA + 1 : nB;
      for (let j = jStart; j <= nB; j++) {
        const tj = same ? (Dd > 0 ? tA + ((cum[j]! - cum[nA]!) / Dd) * (tB - tA) : tB) : tB;
        if (tj <= tS) continue;
        if (tj >= tE) break;
        // 車道偏移（時間單調遞增，事件指標只往前走）
        let off = 0;
        if (evT && evL) {
          while (ek + 1 < eB && evT[ek + 1]! + base <= tj) ek++;
          const lanes = lines[lineOf[j]!]!.lanes, c = (lanes - 1) / 2;
          const L1 = Math.min(evL[ek]!, lanes), te = evT[ek]! + base;
          if (ek > eA && tj < te + D.lcT && tj >= te) {
            const L0 = Math.min(evL[ek - 1]!, lanes), u = (tj - te) / D.lcT;
            off = (L0 + (L1 - L0) * u * u * (3 - 2 * u) - c) * W;
          } else off = (L1 - c) * W;
        }
        push(tj, mx[j]! + nx[j]! * off * MERC_PER_M, my[j]! - ny[j]! * off * MERC_PER_M, v);
      }
    }
    if (evS && evT) for (let e = eA + 1; e < eB; e++) {   // 換道橫移處補頂點，尾巴才看得到橫移
      const te0 = evT[e]! + base;
      if (te0 + D.lcT <= tS || te0 >= tE) continue;
      for (const u of [0, 0.35, 0.65, 1]) {
        const te = te0 + u * D.lcT;
        if (te > tS && te < tE) { segPos(D, si, te, pos); pushPos(te); }
      }
    }
    segPos(D, si, tE, pos); pushPos(tE);
    let order: number[] | null = null;
    if (unsorted) { order = Array.from({ length: nv }, (_, q) => q); order.sort((a, b) => vT[a]! - vT[b]!); }
    // 線段：每段兩頂點，顏色取前一點起算的區間車速
    const nSegV = nv - 1;
    P.ensure(nSegV * 6); T.ensure(nSegV * 2); C.ensure(nSegV * 6);
    for (let q = 1; q < nv; q++) {
      const a = order ? order[q - 1]! : q - 1, b = order ? order[q]! : q;
      P.f[P.n++] = vX[a]!; P.f[P.n++] = vY[a]!; P.f[P.n++] = 0;
      P.f[P.n++] = vX[b]!; P.f[P.n++] = vY[b]!; P.f[P.n++] = 0;
      T.f[T.n++] = vT[a]! - c0; T.f[T.n++] = vT[b]! - c0;
      let r: number, g: number, bl: number;
      if (o.mode === "type") { const c = typeRgb[vtype]!; r = c[0]; g = c[1]; bl = c[2]; }
      else { const li = 3 * speedIdx(vV[b]!); r = SPEED_LUT[li]!; g = SPEED_LUT[li + 1]!; bl = SPEED_LUT[li + 2]!; }
      C.f[C.n++] = r; C.f[C.n++] = g; C.f[C.n++] = bl; C.f[C.n++] = r; C.f[C.n++] = g; C.f[C.n++] = bl;
    }
  }
  return {
    k, c0, key: chunkKeyOf(k, o), segIdx: Uint32Array.from(segIdx),
    positions: P.f.slice(0, P.n), times: T.f.slice(0, T.n), colors: C.f.slice(0, C.n),
    vertexCount: T.n, buildMs: performance.now() - t0,
  };
}

/** 某趟在時間 t 的位置（跟隨用）；車不在路上回 null */
export function tripPosition(D: FreewayTdcsData, trip: number, t: number, out: Float64Array): boolean {
  for (let i = D.tripSegStart[trip]!; i < D.tripSegStart[trip + 1]!; i++) {
    const si = D.tripSegs[i]!;
    if (D.segStart[si]! <= t && D.segEnd[si]! >= t) { segPos(D, si, t, out); return true; }
  }
  return false;
}

/** 某趟是否還會出現（目前或之後） */
export function tripEnded(D: FreewayTdcsData, trip: number, t: number): boolean {
  let last = -Infinity;
  for (let i = D.tripSegStart[trip]!; i < D.tripSegStart[trip + 1]!; i++) last = Math.max(last, D.segEnd[D.tripSegs[i]!]!);
  return t > last;
}
