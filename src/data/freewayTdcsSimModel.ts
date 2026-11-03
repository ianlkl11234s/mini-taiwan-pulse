/**
 * 雙北國道逐車模擬：trips.bin 解碼與依時間內插（純函式，不碰 three／mapbox，供 scene、點選、跟隨共用）。
 *
 * 逐行移植自原型 taipei-gis-analytics pipelines/analysis/freeway_tdcs/viewer/index.html
 * 的 load()／laneOffset()／segPos()／buildChunk()：
 * - 關鍵影格只存起點、門架、換線處；門架之間沿折線等速展開（門架通過時間是真實的，其餘推算）。
 * - 車道：折線視為該方向車道中心線，每車道 3.6 m，行車方向右側為正；換道 smoothstep 橫移。
 * 時間單位：自資料日 00:00（台北）起的秒數（kf_time + t_base）。
 * 路網（OSM 主線＋匝道版）：節點帶路面高程 z（m）與隧道旗標（tunnel：節點 i→i+1 這一小段在隧道內）。
 */
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
  lines: { road: string; dir?: string; cls?: string; lanes: number; start: number; end: number }[];
  /** 每節點路面高程（m，內政部 20 m DTM；隧道與橋梁在洞口／橋台間內插） */
  z?: number[];
  /** 隧道起點節點：節點 i→i+1 在隧道內 */
  tunnel?: number[];
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
  /** 節點路面高程（m）；舊版路網沒有就全 0 */
  nodeZ: Float32Array;
  /** 節點 i→i+1 在隧道內 */
  tun: Uint8Array;
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
  const nodeZ = new Float32Array(N);
  if (net.z && net.z.length === N) nodeZ.set(net.z);
  const tun = new Uint8Array(N);
  for (const i of net.tunnel ?? []) if (i >= 0 && i < N) tun[i] = 1;
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
    nSeg, segStart, segEnd, nodeLng, nodeLat, cum, nx, ny, lineOf, nodeZ, tun, tripSegStart, tripSegs,
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

/** segPos 輸出長度 */
export const SEGPOS_LEN = 8;

/**
 * 段在時間 t 的位置，寫入 out：
 * [0] lng [1] lat [2] hx [3] hy（行進方向單位向量，東／北）[4] 車速 km/h（NaN＝推算不出）
 * [5] 節點參照 j+g（高度用：介於節點 j 與 j+1 之間的比例）[6] 在隧道內（1＝不畫）[7] 橫向速度 m/s（換道車頭偏轉）
 */
export function segPos(D: FreewayTdcsData, si: number, t: number, out: Float64Array): void {
  const { segs, kn, kt, cum, nodeLng: LG, nodeLat: LT, lineOf, tun } = D;
  const s0 = segs[3 * si]!, s1 = segs[3 * si + 1]!, base = D.meta.t_base;
  let lo = s0, hi = s1 - 1;
  if (t <= kt[s0]! + base) hi = s0 + 1;
  else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (kt[mid]! + base <= t) lo = mid; else hi = mid; }
  if (hi >= s1) hi = s1 - 1;
  const nA = kn[lo]!, nB = kn[hi]!, tA = kt[lo]! + base, tB = kt[hi]! + base;
  const f = tB > tA ? Math.min(1, Math.max(0, (t - tA) / (tB - tA))) : 0;
  let x: number, y: number, hx: number, hy: number, d: number, ref: number, tn: number;
  if (lineOf[nA] === lineOf[nB] && nB >= nA) {
    const m = cum[nA]! + (cum[nB]! - cum[nA]!) * f; d = cum[nB]! - cum[nA]!;
    let a = nA, b = Math.max(nA, nB - 1);
    while (b - a > 0) { const mid = (a + b + 1) >> 1; if (cum[mid]! <= m) a = mid; else b = mid - 1; }
    const j = Math.min(a, Math.max(nA, nB - 1)), k = Math.min(j + 1, nB);
    const sl = cum[k]! - cum[j]!, g = sl > 0 ? Math.min(1, Math.max(0, (m - cum[j]!) / sl)) : 0;
    x = LG[j]! + (LG[k]! - LG[j]!) * g; y = LT[j]! + (LT[k]! - LT[j]!) * g;
    hx = (LG[k]! - LG[j]!) * KX; hy = (LT[k]! - LT[j]!) * KY;
    ref = k > j ? j + g : j;
    tn = k > j && tun[j] ? 1 : 0;
  } else {
    // 跨線（匝道接主線等）：兩節點直線內插，高度取較近的節點
    x = LG[nA]! + (LG[nB]! - LG[nA]!) * f; y = LT[nA]! + (LT[nB]! - LT[nA]!) * f;
    hx = (LG[nB]! - LG[nA]!) * KX; hy = (LT[nB]! - LT[nA]!) * KY; d = Math.hypot(hx, hy);
    ref = f < 0.5 ? nA : nB;
    tn = 0;
  }
  const l = Math.hypot(hx, hy) || 1; hx /= l; hy /= l;
  const [off, dOff] = laneOffset(D, si, lineOf[nA]!, t);
  x += (hy * off) / KX; y += (-hx * off) / KY;
  out[0] = x; out[1] = y; out[2] = hx; out[3] = hy;
  out[4] = tB > tA ? (d / (tB - tA)) * 3.6 : NaN;
  out[5] = ref; out[6] = tn; out[7] = dOff;
}

/** 車速 → 色表索引（0–254 km/h；255＝推算不出） */
export function speedIdx(v: number): number { return Number.isFinite(v) ? Math.max(0, Math.min(254, Math.round(v))) : 255; }

/** 拖尾分塊：每塊 CHUNK 秒（另含前「拖尾秒數」的軌跡），GPU 依時間淡出，每幀只改時間 uniform */
export const FREEWAY_TDCS_CHUNK_S = 60;

/**
 * 一塊拖尾：每一小段（piece）一筆 instance，GPU 用螢幕空間四邊形畫成可調寬度的線。
 * - a／b：兩端 [x, y（相對投影原點的 Mercator）, 節點參照（高度查表）, 時間（相對 c0 秒）]
 * - c：[車速索引（0–255）, 車種, 隧道內（1＝不畫）, 0]；顏色在 shader 依模式查表，換色不必重建
 */
export interface FreewayTdcsChunk {
  k: number;
  c0: number;
  key: string;
  /** 本塊有畫的段（車頭從這裡找） */
  segIdx: Uint32Array;
  a: Float32Array;
  b: Float32Array;
  c: Uint8Array;
  pieceCount: number;
  buildMs: number;
}

export interface ChunkOpts { trail: number; vtMask: number }

export function chunkKeyOf(k: number, o: ChunkOpts): string { return `${k}|${o.trail}|${o.vtMask}`; }

/** 公尺 → Mercator 單位（以北緯 25° 近似；範圍南北不到 0.5°，誤差 < 0.3%） */
export const MERC_PER_M = 1 / (40075016.686 * Math.cos((25 * Math.PI) / 180));

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
  const { segs, kn, kt, cum, nodeLng: LG, nodeLat: LT, lineOf, nx, ny, evS, evT, evL, tun } = D;
  const { mx, my } = nodeMerc(D);
  const lines = D.net.lines, W = D.net.lane_w;
  const segIdx: number[] = [];
  const A = new Grow(1 << 20), B = new Grow(1 << 20), C = new GrowU8(1 << 20);
  const pos = new Float64Array(SEGPOS_LEN);
  // 每段的頂點暫存：時間、x、y、車速、節點參照、抵達此點的這一小段是否在隧道內
  let cap = 4096;
  let vT = new Float64Array(cap), vX = new Float64Array(cap), vY = new Float64Array(cap), vV = new Float64Array(cap);
  let vR = new Float64Array(cap), vH = new Uint8Array(cap);
  let nv = 0, unsorted = false;
  const push = (t: number, x: number, y: number, v: number, r: number, h: number) => {
    if (nv === cap) {
      cap *= 2;
      const g = (a: Float64Array) => { const b = new Float64Array(cap); b.set(a); return b; };
      vT = g(vT); vX = g(vX); vY = g(vY); vV = g(vV); vR = g(vR);
      const hh = new Uint8Array(cap); hh.set(vH); vH = hh;
    }
    if (nv > 0 && t < vT[nv - 1]!) unsorted = true;
    vT[nv] = t; vX[nv] = x; vY[nv] = y; vV[nv] = v; vR[nv] = r; vH[nv] = h; nv++;
  };
  const pushPos = (t: number) => { push(t, mercX(pos[0]!) - D.originX, mercY(pos[1]!) - D.originY, pos[4]!, pos[5]!, pos[6]!); };
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
        // 抵達節點 j 的這一小段：同線時是 j-1→j（隧道旗標記在起點節點）；跨線直連不算隧道
        const hid = same && j > lines[lineOf[j]!]!.start && tun[j - 1] ? 1 : 0;
        push(tj, mx[j]! + nx[j]! * off * MERC_PER_M, my[j]! - ny[j]! * off * MERC_PER_M, v, j, hid);
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
    const np = nv - 1;
    A.ensure(np * 4); B.ensure(np * 4); C.ensure(np * 4);
    for (let q = 1; q < nv; q++) {
      const a = order ? order[q - 1]! : q - 1, b = order ? order[q]! : q;
      A.f[A.n++] = vX[a]!; A.f[A.n++] = vY[a]!; A.f[A.n++] = vR[a]!; A.f[A.n++] = vT[a]! - c0;
      B.f[B.n++] = vX[b]!; B.f[B.n++] = vY[b]!; B.f[B.n++] = vR[b]!; B.f[B.n++] = vT[b]! - c0;
      // 顏色取這一小段的區間車速；隧道旗標取抵達端
      C.f[C.n++] = speedIdx(vV[b]!); C.f[C.n++] = vtype; C.f[C.n++] = vH[b]!; C.f[C.n++] = 0;
    }
  }
  return {
    k, c0, key: chunkKeyOf(k, o), segIdx: Uint32Array.from(segIdx),
    a: A.f.slice(0, A.n), b: B.f.slice(0, B.n), c: C.f.slice(0, C.n),
    pieceCount: A.n / 4, buildMs: performance.now() - t0,
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
