/**
 * 鐵道網格（W6-3）：一個 10 分區間內每格的列車潛勢碼（potentialCode）。前端每幀即時算，不做每日包：
 * 瀏覽器的班表來自 Supabase（_daily → _fixed），預處理拿不到同一份，預算會讓網格和接收點各用各的班表。
 *
 * 和 queryRailInterval **同一套規則**，只是把「每格掃每班車」改成「每班車只掃它走過的軌道子段 1.5 km 內的格」：
 * - 區間 [ta, tb] 的 progress、結構切段用 adapter 的 railProgressAt、railPieces；
 * - 每格到子段的距離用 segmentNearest（nearestOnTrack 的逐段公式），依段序取最小（同 nearestOnTrack 的先到先贏）；
 * - 地下段整段不計（排除地下段的既有規則）；結構不明、位置未知、班表缺 → 1.5 km 內為無法判斷候選；
 * - 每格：有潛勢 > 0 → 量化潛勢；否則有候選 → 255；否則 0。
 * 「整條軌道最近點」（位置未知、班表缺時用）每條軌道只算一次並快取。
 */
import { interpolateOnLineString } from "../../engines/railUtils";
import { gateFamilyRecords } from "../engines/receiverQuery";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { structureAtProgress } from "../model/railSegments";
import { RAIL } from "../model/soundProfiles";
import { nearestOnTrack, railPieces, railProgressAt, segmentNearest, type PreparedTrack, type RailRecord } from "../sourceAdapters/railAdapter";
import type { SoundSourceSet } from "../types";
import { scopeMask } from "./aviationGrid";
import { cellCenter, GRID_CELLS, GRID_COLS, GRID_ROWS, GRID_SPEC, GRID_UNKNOWN } from "./gridSpec";
import { quantizePotential } from "./potentialCode";

const M_PER_DEG = 111_195;

let centers: { lon: Float64Array; lat: Float64Array; rx: Float64Array; ry: Float64Array; kx: Float64Array } | null = null;
/** 每格格心與 nearestOnTrack 的投影量（kx 依格心緯度） */
function cellGeo() {
  if (centers) return centers;
  const lon = new Float64Array(GRID_CELLS), lat = new Float64Array(GRID_CELLS);
  const rx = new Float64Array(GRID_CELLS), ry = new Float64Array(GRID_CELLS), kx = new Float64Array(GRID_CELLS);
  for (let c = 0; c < GRID_CELLS; c++) {
    const [x, y] = cellCenter(c);
    lon[c] = x; lat[c] = y;
    kx[c] = M_PER_DEG * Math.cos((y * Math.PI) / 180);
    rx[c] = x * kx[c]!;
    ry[c] = y * M_PER_DEG;
  }
  centers = { lon, lat, rx, ry, kx };
  return centers;
}

/** 外框 [w,s,e,n] 外擴 radius 後涵蓋的格列／欄範圍 */
function cellRange(w: number, s: number, e: number, n: number, radiusM: number): [number, number, number, number] | null {
  const dLat = (radiusM / M_PER_DEG) * 1.02 + GRID_SPEC.dLat;
  const latAbs = Math.max(Math.abs(s), Math.abs(n)) + dLat;
  const dLon = (radiusM / (M_PER_DEG * Math.cos((latAbs * Math.PI) / 180))) * 1.02 + GRID_SPEC.dLon;
  const r0 = Math.max(0, Math.floor((GRID_SPEC.north - (n + dLat)) / GRID_SPEC.dLat));
  const r1 = Math.min(GRID_ROWS - 1, Math.floor((GRID_SPEC.north - (s - dLat)) / GRID_SPEC.dLat));
  const c0 = Math.max(0, Math.floor((w - dLon - GRID_SPEC.west) / GRID_SPEC.dLon));
  const c1 = Math.min(GRID_COLS - 1, Math.floor((e + dLon - GRID_SPEC.west) / GRID_SPEC.dLon));
  return r0 > r1 || c0 > c1 ? null : [r0, r1, c0, c1];
}

/**
 * 子段 [pa, pb] 到每格的最短距離（同 nearestOnTrack(track, 格心, pa, pb)）；只寫 radius 附近的格，其他保持 Infinity。
 * touched 收集被寫過的格（呼叫端用來重設）。
 */
function rasterPiece(track: PreparedTrack, pa: number, pb: number, radiusM: number, scope: Uint8Array, dist: Float64Array, prog: Float64Array, touched: number[]): void {
  const g = cellGeo();
  const lo = Math.max(0, Math.min(pa, pb));
  const hi = Math.min(1, Math.max(pa, pb));
  const visitBox = (w: number, s: number, e: number, n: number, fn: (c: number) => void) => {
    const rg = cellRange(w, s, e, n, radiusM);
    if (!rg) return;
    for (let r = rg[0]; r <= rg[1]; r++) for (let col = rg[2]; col <= rg[3]; col++) {
      const c = r * GRID_COLS + col;
      if (scope[c]) fn(c);
    }
  };
  const setPoint = (x: number, y: number, p: number) => {
    visitBox(x, y, x, y, (c) => {
      const d = Math.hypot(x * g.kx[c]! - g.rx[c]!, y * M_PER_DEG - g.ry[c]!);
      if (dist[c] === Infinity) touched.push(c);
      dist[c] = d;
      prog[c] = p;
    });
  };
  if (track.total === 0 || track.coords.length < 2) {
    const [x, y] = track.coords[0] ?? [NaN, NaN];
    setPoint(x, y, lo);
    return;
  }
  if (hi - lo < 1e-12) {
    const [x, y] = interpolateOnLineString(track.coords, lo);
    setPoint(x, y, lo);
    return;
  }
  const dLo = lo * track.total;
  const dHi = hi * track.total;
  // 第一個可能的段：cum[i+1] >= dLo（二分）；之後掃到 cum[i] > dHi 為止
  let a = 0, b = track.coords.length - 1;
  while (a < b) {
    const m = (a + b) >> 1;
    if (track.cum[m + 1]! < dLo) a = m + 1;
    else b = m;
  }
  for (let i = a; i + 1 < track.coords.length; i++) {
    if (track.cum[i]! > dHi) break;
    const [x1, y1] = track.coords[i]!;
    const [x2, y2] = track.coords[i + 1]!;
    visitBox(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), (c) => {
      const hit = segmentNearest(track, i, dLo, dHi, g.rx[c]!, g.ry[c]!, g.kx[c]!);
      if (!hit) return;
      if (dist[c] === Infinity) touched.push(c);
      if (hit.distanceM < dist[c]!) {
        dist[c] = hit.distanceM;
        prog[c] = hit.progress;
      }
    });
  }
}

interface WholeTrackNear { cells: Int32Array; dist: Float64Array; prog: Float64Array }
const wholeTrackCache = new WeakMap<PreparedTrack, WholeTrackNear>();

/** nearestOnTrack(track, 格心, 0, 1) 在 1.5 km 內的格（每條軌道快取一次） */
function wholeTrackNear(track: PreparedTrack, scope: Uint8Array, work: Work): WholeTrackNear {
  const hit = wholeTrackCache.get(track);
  if (hit) return hit;
  const radius = RAIL.candidateRadiusM.value;
  const touched: number[] = [];
  rasterPiece(track, 0, 1, radius, scope, work.dist, work.prog, touched);
  const cells: number[] = [], dist: number[] = [], prog: number[] = [];
  for (const c of touched) {
    if (work.dist[c]! <= radius) { cells.push(c); dist.push(work.dist[c]!); prog.push(work.prog[c]!); }
    work.dist[c] = Infinity;
  }
  const v = { cells: Int32Array.from(cells), dist: Float64Array.from(dist), prog: Float64Array.from(prog) };
  wholeTrackCache.set(track, v);
  return v;
}

interface Work { dist: Float64Array; prog: Float64Array }
let workBuf: Work | null = null;
function work(): Work {
  workBuf ??= { dist: new Float64Array(GRID_CELLS).fill(Infinity), prog: new Float64Array(GRID_CELLS) };
  return workBuf;
}

/** 已過 coverage gate 的 records → 一個區間的整幀碼（範圍外 255） */
export function railIntervalCodes(records: readonly RailRecord[], t0: number, t1: number, out: Uint8Array = new Uint8Array(GRID_CELLS), scope: Uint8Array = scopeMask()): Uint8Array {
  const radius = RAIL.candidateRadiusM.value;
  const half = RAIL.halfPotentialDistanceM.value;
  const weight = RAIL.structureWeight.value;
  const pot = new Float64Array(GRID_CELLS);
  const unk = new Uint8Array(GRID_CELLS);
  const w = work();
  const touched: number[] = [];
  const [gw, gs, ge, gn] = [GRID_SPEC.west, GRID_SPEC.north - GRID_ROWS * GRID_SPEC.dLat, GRID_SPEC.west + GRID_COLS * GRID_SPEC.dLon, GRID_SPEC.north];
  const padLat = radius / M_PER_DEG * 1.05, padLon = radius / (M_PER_DEG * Math.cos((26 * Math.PI) / 180)) * 1.05;
  const markWhole = (track: PreparedTrack, skipUnderground: boolean) => {
    const near = wholeTrackNear(track, scope, w);
    for (let k = 0; k < near.cells.length; k++) {
      if (skipUnderground && structureAtProgress(track.intervals, near.prog[k]!) === "underground") continue;
      unk[near.cells[k]!] = 1;
    }
  };
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const track = r.payload.track;
    const [bw, bs, be, bn] = track.bbox;
    if (be < gw - padLon || bw > ge + padLon || bn < gs - padLat || bs > gn + padLat) continue; // 軌道離網格太遠
    if (r.payload.kind === "schedule_unavailable") { markWhole(track, true); continue; }
    const ta = Math.max(t0, r.validFrom);
    const tb = Math.min(t1, r.validUntil);
    const sa = railProgressAt(r, ta);
    const sb = railProgressAt(r, tb);
    if (sa.status === "unknown" || sb.status === "unknown") { markWhole(track, false); continue; }
    const pa = sa.status === "on_track" ? sa.progress : sb.status === "on_track" ? sb.progress : null;
    const pb = sb.status === "on_track" ? sb.progress : pa;
    if (pa == null || pb == null) continue;
    const lo = Math.min(pa, pb);
    const hi = Math.max(pa, pb);
    for (const piece of railPieces(track, lo, hi)) {
      if (piece.structure === "underground") continue; // 地下段不發聲（adapter 同樣跳過）
      touched.length = 0;
      rasterPiece(track, piece.a, piece.b, radius, scope, w.dist, w.prog, touched);
      for (const c of touched) {
        const d = w.dist[c]!;
        w.dist[c] = Infinity;
        if (d > radius) continue;
        if (piece.structure === "unknown") { unk[c] = 1; continue; }
        const p = proximityPotential(d, half) * weight[piece.structure];
        if (p > pot[c]!) pot[c] = p;
      }
    }
  }
  for (let c = 0; c < GRID_CELLS; c++) {
    out[c] = !scope[c] ? GRID_UNKNOWN : pot[c]! > 0 ? quantizePotential(pot[c]!) : unk[c] ? GRID_UNKNOWN : 0;
  }
  return out;
}

export interface RailGridFrame { values: Uint8Array; gateReason: string | null; ms: number }

/** 一幀：set 為 null 或 gate 不通過 → 整幀 255 */
export function railGridFrame(set: SoundSourceSet | null, t0: number, t1: number, out: Uint8Array = new Uint8Array(GRID_CELLS)): RailGridFrame {
  const s = performance.now();
  if (!set) { out.fill(GRID_UNKNOWN); return { values: out, gateReason: "source_not_loaded", ms: 0 }; }
  const gate = gateFamilyRecords("rail", [set], t0, t1);
  if (gate.kind !== "ok") { out.fill(GRID_UNKNOWN); return { values: out, gateReason: gate.reason, ms: 0 }; }
  railIntervalCodes(gate.records as RailRecord[], t0, t1, out);
  return { values: out, gateReason: null, ms: performance.now() - s };
}

/** 測試用：單格直算（nearestOnTrack 原版），對照 rasterPiece */
export const _nearestOnTrackForTest = nearestOnTrack;
