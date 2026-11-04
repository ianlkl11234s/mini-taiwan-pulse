/**
 * 驗證雙北國道逐車模擬資料包的切檔正確性：把相鄰時段檔合併後，與原始單檔版逐點比對車輛位置。
 * 抽樣每個時段邊界 ±0–5 秒與隨機時間，比對所有在路上車輛的位置（位置、車速、隧道、換道）；
 * 跨邊界的拖尾分塊（拖尾 60／300 秒）逐位元比對。
 *
 * 用法：npx vite-node scripts/preprocess/verify-freeway-tdcs-sim-bundle.ts [bundle_version]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FREEWAY_TDCS_CHUNK_S, SEGPOS_LEN, buildChunk, decodeFreewayTdcs, decodeFreewayTdcsBase, decodeFreewayTdcsPart, mergeFreewayTdcsParts, tripPosition,
  type FreewayTdcsData, type FreewayTdcsMeta, type FreewayTdcsNetwork, type FreewayTdcsPartInfo,
} from "../../src/data/freewayTdcsSimModel";

const SRC = join(process.cwd(), "public/freeway_tdcs");
const ver = process.argv[2] ?? JSON.parse(readFileSync(join(SRC, "sim/freeway_tdcs/current.json"), "utf8")).bundle_version;
const DIR = join(SRC, "sim/freeway_tdcs", ver);
const buf = (p: string) => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const json = <T>(p: string) => JSON.parse(readFileSync(p, "utf8")) as T;

const net = json<FreewayTdcsNetwork>(join(SRC, "network.json"));
const full = decodeFreewayTdcs(json<FreewayTdcsMeta>(join(SRC, "trips_meta.json")), net, buf(join(SRC, "trips.bin")));
const bundle = json<{ parts: FreewayTdcsPartInfo[]; segs_layout: never; trips_layout: never }>(join(DIR, "bundle.json"));
const base = decodeFreewayTdcsBase(json(join(DIR, "meta.json")), json(join(DIR, "network.json")), buf(join(DIR, "segs.bin")), bundle.segs_layout, buf(join(DIR, "trips.bin")), bundle.trips_layout);
const parts = bundle.parts.map((p) => decodeFreewayTdcsPart(p, buf(join(DIR, p.file))));

// 每個 global seg → 單檔版段序號相同（單檔版的段序號就是 global id）
let checked = 0, bad = 0, maxErr = 0;
const a = new Float64Array(SEGPOS_LEN), b = new Float64Array(SEGPOS_LEN);
function compare(D: FreewayTdcsData, t: number) {
  for (let si = 0; si < D.nSeg; si++) {
    if (D.segStart[si]! > t || D.segEnd[si]! < t) continue;
    const trip = D.segs[3 * si + 2]!;
    if (!tripPosition(D, trip, t, a)) { bad++; continue; }
    if (!tripPosition(full, trip, t, b)) { bad++; continue; }
    const err = Math.hypot((a[0]! - b[0]!) * 1e5, (a[1]! - b[1]!) * 1e5);   // 約公尺
    const same = err < 1e-6 && a[6] === b[6] && (Number.isNaN(a[4]!) ? Number.isNaN(b[4]!) : Math.abs(a[4]! - b[4]!) < 1e-9) && Math.abs(a[7]! - b[7]!) < 1e-9;
    maxErr = Math.max(maxErr, err);
    if (!same) bad++;
    checked++;
  }
}
// 1) 單一時段檔、2) 相鄰兩檔合併：在邊界附近與檔內隨機時間比對
const times: number[] = [];
for (const p of bundle.parts) for (const d of [0, 0.5, 1, 3, 5, 150]) { times.push(p.t0 + d); if (p.t0 - d > bundle.parts[0]!.t0) times.push(p.t0 - d); }
let rnd = 7;
for (let i = 0; i < 40; i++) { rnd = (rnd * 1103515245 + 12345) % 2 ** 31; times.push(full.winStart + (rnd / 2 ** 31) * (full.winEnd - full.winStart)); }
for (const t of times) {
  const i = bundle.parts.findIndex((p) => p.t0 <= t && t < p.t1);
  if (i < 0) continue;
  compare(mergeFreewayTdcsParts(base, [parts[i]!], 1), t);
  if (i > 0) compare(mergeFreewayTdcsParts(base, [parts[i - 1]!, parts[i]!], 2), t);
  if (i + 1 < parts.length) compare(mergeFreewayTdcsParts(base, [parts[i]!, parts[i + 1]!], 3), t);
}
// 3) 跟隨用的每趟首末時間
let spanBad = 0;
for (let tr = 0; tr < full.meta.n_trips; tr++) if (full.tripFirst[tr] !== base.tripFirst[tr] || full.tripLast[tr] !== base.tripLast[tr]) spanBad++;
// 4) 拖尾分塊：跨時段邊界的塊（拖尾 60／300 秒），合併後與單檔版逐位元相同
let chunkBad = 0, chunks = 0;
for (const p of bundle.parts.slice(1)) {
  const k = Math.round((p.t0 - full.winStart) / FREEWAY_TDCS_CHUNK_S);
  for (const kk of [k - 1, k, k + 1]) for (const trail of [60, 300]) {
    if (kk < 0 || full.winStart + kk * FREEWAY_TDCS_CHUNK_S >= full.winEnd) continue;
    const c0 = full.winStart + kk * FREEWAY_TDCS_CHUNK_S;
    const need = bundle.parts.map((q, i) => (q.t1 > c0 - trail && q.t0 < c0 + FREEWAY_TDCS_CHUNK_S ? i : -1)).filter((i) => i >= 0);
    const D = mergeFreewayTdcsParts(base, need.map((i) => parts[i]!), 9);
    const o = { trail, vtMask: 31 };
    const x = buildChunk(D, kk, o), y = buildChunk(full, kk, o);
    const eq = (u: ArrayLike<number>, v: ArrayLike<number>) => u.length === v.length && Array.prototype.every.call(u, (val: number, i: number) => val === v[i]);
    chunks++;
    if (!x.complete || !eq(x.a, y.a) || !eq(x.b, y.b) || !eq(x.c, y.c)) chunkBad++;
  }
}
console.log(`拖尾分塊比對 ${chunks} 塊：不一致 ${chunkBad}`);
if (chunkBad) process.exitCode = 1;
console.log(`比對 ${times.length} 個時間點、${checked} 筆車輛位置：不一致 ${bad}，最大位置差 ${maxErr.toExponential(2)} m；每趟首末時間不一致 ${spanBad}`);
if (bad || spanBad) process.exit(1);
