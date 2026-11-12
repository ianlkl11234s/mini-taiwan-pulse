/**
 * 道路車流（W6-2）：路網＋國道 VD 每日包 → 任意點的道路潛勢估計。**網格、接收點查詢、格 popup 共用這一支**。
 *
 * 三級證據（MODEL_DECISIONS §8）：
 * - freeway（國道，當日實測 observed）：TDX 國道路段依里程最近配主線 VD；值＝該 10 分槽的 1 分鐘流量×60。
 * - taipei（臺北市區，1 月平日典型 estimated）：VD 沿同一路名延伸到下一支 VD 或路口（**延伸是假設**）；
 *   週末／假日／異常日、行事曆範圍外 → 無法判斷（typicalDayVerdict，不放寬）。
 * - estimate（新北與範圍外，道路等級推估 inferred）：OSM 等級 × 固定典型流量，不隨時間變。
 * 另有「有路但沒資料」：臺北延伸不到的主要道路（taipeiUncovered）、小路經過的格（minorCells）、
 * 國道沒配到 VD／當日 VD 故障／缺槽／沒有每日包 → 無法判斷；離任何道路都遠 → 0（平靜）。
 *
 * 取值：每個來源潛勢＝proximityPotential(d, 尺度) × (1 − e^(−Q/600))；同一點多來源取最高（不相加），
 * 來源記貢獻最大者。家族狀態與 receiverQuery.queryFamilyInterval 相同：有任何潛勢 >0 → 取最大；
 * 否則有任何無法判斷 → 無法判斷；否則 0。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { distanceToFlatLineM } from "../engines/geometryShapes";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { ROAD_GRID } from "../model/soundProfiles";
import { typicalDayVerdict, typicalFlowAt, type VdBaselineEntry } from "../sourceAdapters/typicalTrafficAdapter";
import { cellIndexOf, GRID_CELLS, GRID_SPEC, GRID_UNKNOWN } from "./gridSpec";

export const ROAD_NETWORK_SCHEMA = "pulse-sound-road-network-v1";
export const FREEWAY_VD_SCHEMA = "pulse-sound-freeway-vd-v1";
export const FREEWAY_SLOT_S = 600;

// ── 檔案格式 ─────────────────────────────────────────────

type Coords = [number, number][];
export interface RoadNetworkFile {
  schema: string;
  grid: { id: string; sha256?: string };
  sources?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  freeway: { sec: string; road: string; dir: string; vd: string | null; km: [number, number]; c: Coords }[];
  taipei: { vd: string; c: Coords }[];
  taipeiUncovered: { name: string | null; c: Coords }[];
  estimate: { cls: string; name: string | null; c: Coords }[];
  minorCells: number[];
}

export interface FreewayVdPack {
  schema: string;
  date_taiwan: string;
  unit: "veh_per_min";
  frames: { count: number; step_s: number; first_slot_utc: string; slots_missing: number[]; slot_fetch_utc: (string | null)[] };
  vds: Record<string, { lanes: number | null; day: string; v: (number | null)[] }>;
}

// ── 編譯後的路網 ─────────────────────────────────────────

export type RoadSourceKind = "freeway" | "taipei" | "taipei_uncovered" | "estimate";
export type RoadEvidence = "observed" | "estimated" | "inferred";

export interface RoadSource {
  kind: RoadSourceKind;
  /** 扁平座標 [lon, lat, …] */
  flat: Float64Array;
  vdId: string | null;
  name: string | null;
  /** estimate：OSM 等級；freeway：方向 */
  cls: string | null;
  dir: string | null;
}

export interface RoadNetwork {
  sources: RoadSource[];
  /** 0.005° 桶 → 來源索引（依線段外框登記） */
  buckets: Map<number, number[]>;
  /** 長度 GRID_CELLS：1＝小路經過的格 */
  minor: Uint8Array;
}

const BUCKET_DEG = 0.005;
const bucketKey = (ix: number, iy: number) => ix * 100_000 + iy;

const flatten = (c: Coords): Float64Array => {
  const f = new Float64Array(c.length * 2);
  c.forEach(([x, y], i) => { f[2 * i] = x; f[2 * i + 1] = y; });
  return f;
};

export function compileRoadNetwork(file: RoadNetworkFile): RoadNetwork {
  const sources: RoadSource[] = [
    ...file.freeway.map((s) => ({ kind: "freeway" as const, flat: flatten(s.c), vdId: s.vd, name: s.road, cls: null, dir: s.dir })),
    ...file.taipei.map((s) => ({ kind: "taipei" as const, flat: flatten(s.c), vdId: s.vd, name: null, cls: null, dir: null })),
    ...file.taipeiUncovered.map((s) => ({ kind: "taipei_uncovered" as const, flat: flatten(s.c), vdId: null, name: s.name, cls: null, dir: null })),
    ...file.estimate.map((s) => ({ kind: "estimate" as const, flat: flatten(s.c), vdId: null, name: s.name, cls: s.cls, dir: null })),
  ];
  const buckets = new Map<number, number[]>();
  sources.forEach((s, si) => {
    const seen = new Set<number>();
    const n = s.flat.length >> 1;
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const j = Math.min(i + 1, n - 1);
      const x0 = Math.floor(Math.min(s.flat[2 * i]!, s.flat[2 * j]!) / BUCKET_DEG), x1 = Math.floor(Math.max(s.flat[2 * i]!, s.flat[2 * j]!) / BUCKET_DEG);
      const y0 = Math.floor(Math.min(s.flat[2 * i + 1]!, s.flat[2 * j + 1]!) / BUCKET_DEG), y1 = Math.floor(Math.max(s.flat[2 * i + 1]!, s.flat[2 * j + 1]!) / BUCKET_DEG);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = bucketKey(x, y);
        if (seen.has(k)) continue;
        seen.add(k);
        let list = buckets.get(k);
        if (!list) buckets.set(k, (list = []));
        list.push(si);
      }
    }
  });
  const minor = new Uint8Array(GRID_CELLS);
  for (const c of file.minorCells) if (c >= 0 && c < GRID_CELLS) minor[c] = 1;
  return { sources, buckets, minor };
}

const halfOf = (k: RoadSourceKind) => (k === "freeway" ? ROAD_GRID.freewayHalfPotentialDistanceM.value : ROAD_GRID.urbanHalfPotentialDistanceM.value);
const radiusOf = (k: RoadSourceKind) => (k === "freeway" ? ROAD_GRID.freewayCandidateRadiusM.value : ROAD_GRID.urbanCandidateRadiusM.value);

export interface NearRoads {
  /** 候選半徑內的來源（依來源索引遞增）與距離（m）、距離項 */
  idx: Int32Array;
  dist: Float64Array;
  prox: Float64Array;
  /** 所在格有小路經過 */
  minor: boolean;
}

/** 某點候選半徑內的道路來源（網格預算與單點查詢同一支） */
export function nearRoadSources(net: RoadNetwork, lon: number, lat: number): NearRoads {
  const r = ROAD_GRID.freewayCandidateRadiusM.value;
  const padY = r / 111_195, padX = r / (111_195 * Math.cos((lat * Math.PI) / 180));
  const cand = new Set<number>();
  for (let x = Math.floor((lon - padX) / BUCKET_DEG); x <= Math.floor((lon + padX) / BUCKET_DEG); x++)
    for (let y = Math.floor((lat - padY) / BUCKET_DEG); y <= Math.floor((lat + padY) / BUCKET_DEG); y++)
      for (const si of net.buckets.get(bucketKey(x, y)) ?? []) cand.add(si);
  const ids = [...cand].sort((a, b) => a - b);
  const idx: number[] = [], dist: number[] = [], prox: number[] = [];
  for (const si of ids) {
    const s = net.sources[si]!;
    const d = distanceToFlatLineM(s.flat, lon, lat);
    if (d > radiusOf(s.kind)) continue;
    idx.push(si);
    dist.push(d);
    prox.push(proximityPotential(d, halfOf(s.kind)));
  }
  const cell = cellIndexOf(lon, lat);
  return { idx: Int32Array.from(idx), dist: Float64Array.from(dist), prox: Float64Array.from(prox), minor: cell >= 0 && net.minor[cell] === 1 };
}

// ── 某天的流量 ───────────────────────────────────────────

export interface RoadDayContext {
  dateKey: string;
  /** 臺灣日 00:00（unix 秒） */
  dayStart: number;
  pack: FreewayVdPack | null;
  /** 臺北典型值能否套用 */
  typical: { applies: true } | { applies: false; reason: string };
  baseline: ReadonlyMap<string, VdBaselineEntry>;
}

export type FlowTerm =
  | { known: true; term: number; vehPerHour: number | null; sampleT: number | null; evidence: RoadEvidence; flowDays?: number }
  | { known: false; reason: string; evidence: RoadEvidence | null };

const flowTermOf = (q: number) => 1 - Math.exp(-Math.max(0, q) / ROAD_GRID.volumeScaleVehPerHour.value);

/** 一個來源在 [t0, t1] 的流量項（區間內取最大；國道原生 10 分槽，臺北典型逐小時） */
export function sourceFlowTerm(ctx: RoadDayContext, s: RoadSource, t0: number, t1: number): FlowTerm {
  switch (s.kind) {
    case "estimate": {
      const q = ROAD_GRID.estimateClassVehPerHour.value[s.cls ?? ""];
      if (q == null) return { known: false, reason: "road_class_unmapped", evidence: "inferred" };
      return { known: true, term: flowTermOf(q), vehPerHour: q, sampleT: null, evidence: "inferred" };
    }
    case "taipei_uncovered":
      return { known: false, reason: "taipei_road_not_reached_by_vd", evidence: null };
    case "taipei": {
      if (!ctx.typical.applies) return { known: false, reason: `typical_not_applicable(${ctx.typical.reason})`, evidence: "estimated" };
      const e = s.vdId ? ctx.baseline.get(s.vdId) : undefined;
      if (!e) return { known: false, reason: "typical_vd_missing", evidence: "estimated" };
      const payload = { flow: e.wd_flow, flowDays: e.wd_flow_days };
      let best: { q: number; t: number; days: number } | null = null;
      let missing: string | null = null;
      // 區間涵蓋的各個臺灣整點小時（≤ t 的最新一筆，不內插）
      for (let t = t0; ; t = Math.min(t1, (Math.floor((t + 8 * 3600) / 3600) + 1) * 3600 - 8 * 3600)) {
        const v = typicalFlowAt(payload, t);
        if ("missing" in v) missing ??= v.missing;
        else if (!best || v.vehPerHour > best.q) best = { q: v.vehPerHour, t, days: v.days };
        if (t >= t1) break;
      }
      if (!best) return { known: false, reason: `typical_${missing ?? "flow_null"}`, evidence: "estimated" };
      return { known: true, term: flowTermOf(best.q), vehPerHour: best.q, sampleT: best.t, evidence: "estimated", flowDays: best.days };
    }
    case "freeway": {
      if (!ctx.pack) return { known: false, reason: "freeway_vd_pack_missing", evidence: "observed" };
      if (!s.vdId) return { known: false, reason: "freeway_no_vd_within_gap", evidence: "observed" };
      const vd = ctx.pack.vds[s.vdId];
      if (!vd) return { known: false, reason: "freeway_vd_not_in_pack", evidence: "observed" };
      if (vd.day !== "ok") return { known: false, reason: `freeway_vd_${vd.day}`, evidence: "observed" };
      const k0 = Math.max(0, Math.floor((t0 - ctx.dayStart) / FREEWAY_SLOT_S));
      const k1 = Math.min(vd.v.length - 1, Math.floor((t1 - ctx.dayStart) / FREEWAY_SLOT_S));
      let best: { v: number; k: number } | null = null;
      for (let k = k0; k <= k1; k++) {
        const v = vd.v[k];
        if (v != null && (!best || v > best.v)) best = { v, k };
      }
      if (!best) return { known: false, reason: "freeway_vd_sample_missing", evidence: "observed" };
      const q = best.v * ROAD_GRID.freewaySampleToHourly.value;
      const fetched = ctx.pack.frames.slot_fetch_utc[best.k];
      return { known: true, term: flowTermOf(q), vehPerHour: q, sampleT: fetched ? Date.parse(fetched) / 1000 : ctx.dayStart + best.k * FREEWAY_SLOT_S, evidence: "observed" };
    }
  }
}

// ── 單點估計 ─────────────────────────────────────────────

export interface RoadPart {
  source: number;
  distanceM: number;
  potential: number | null;
  flow: FlowTerm;
}

export interface RoadEstimate {
  status: "active" | "inactive" | "unknown";
  /** 最高潛勢；unknown → null；inactive → 0 */
  potential: number | null;
  /** 貢獻最大者（active 時） */
  top: RoadPart | null;
  /** 所有候選（依來源索引）；含無法判斷的 */
  parts: RoadPart[];
  /** 所在格有小路（無資料） */
  minor: boolean;
  /** 第一個無法判斷原因（unknown 時才有意義） */
  unknownReason: string | null;
}

/**
 * 由候選來源與（可選的）每來源流量項快取算估計；grid 與單點共用。
 * collectParts=false 時不建 parts（網格整幀用，省配置；結果的 status／potential／top 相同）。
 */
export function roadEstimateFromNear(
  net: RoadNetwork, ctx: RoadDayContext, near: NearRoads, t0: number, t1: number,
  termOf: (si: number) => FlowTerm = (si) => sourceFlowTerm(ctx, net.sources[si]!, t0, t1),
  collectParts = true,
): RoadEstimate {
  const parts: RoadPart[] = [];
  let top: RoadPart | null = null;
  let topPotential = 0;
  let unknownReason: string | null = null;
  for (let i = 0; i < near.idx.length; i++) {
    const si = near.idx[i]!;
    const flow = termOf(si);
    const potential = flow.known ? near.prox[i]! * flow.term : null;
    if (potential == null) unknownReason ??= (flow as { reason: string }).reason;
    const better = potential != null && potential > 0 && (!top || potential > topPotential);
    if (collectParts || better) {
      const part = { source: si, distanceM: near.dist[i]!, potential, flow };
      if (collectParts) parts.push(part);
      if (better) { top = part; topPotential = potential; }
    }
  }
  if (near.minor) unknownReason ??= "minor_road_no_data";
  if (top) return { status: "active", potential: topPotential, top, parts, minor: near.minor, unknownReason };
  if (unknownReason) return { status: "unknown", potential: null, top: null, parts, minor: near.minor, unknownReason };
  return { status: "inactive", potential: 0, top: null, parts, minor: near.minor, unknownReason: null };
}

// ── 分級與網格碼 ─────────────────────────────────────────

export type RoadLevel = 0 | 1 | 2 | 3 | 4;
/** 網格碼＝證據基底＋分級：國道 0–4、臺北典型 10–14、新北推估 20–24；255 無法判斷 */
export const ROAD_EVIDENCE_BASE: Record<RoadEvidence, number> = { observed: 0, estimated: 10, inferred: 20 };

export function roadLevelOf(potential: number): RoadLevel {
  let k = 0;
  for (const e of ROAD_GRID.potentialClassEdges.value) if (potential >= e) k++;
  return k as RoadLevel;
}

/** 估計 → 網格碼（inactive＝離道路遠＝0 級，記在國道基底 0；顏色同「很低」的中性色） */
export function roadGridCode(est: RoadEstimate): number {
  if (est.status === "unknown") return GRID_UNKNOWN;
  if (est.status === "inactive" || !est.top) return 0;
  const ev = (est.top.flow as { evidence: RoadEvidence }).evidence;
  return ROAD_EVIDENCE_BASE[ev] + roadLevelOf(est.potential!);
}

export function decodeRoadGridCode(code: number): { level: RoadLevel; evidence: RoadEvidence } | null {
  if (code === GRID_UNKNOWN) return null;
  const evidence: RoadEvidence = code >= 20 ? "inferred" : code >= 10 ? "estimated" : "observed";
  return { level: (code % 10) as RoadLevel, evidence };
}

// ── 載入 ─────────────────────────────────────────────────

let networkPromise: Promise<RoadNetwork> | null = null;
export function fetchRoadNetwork(fetchImpl: typeof fetch = fetch): Promise<RoadNetwork> {
  networkPromise ??= withLoading(
    "sound:road-network",
    "聲景道路網",
    fetchImpl(ROAD_GRID.networkUrl.value).then(async (r) => {
      if (!r.ok) throw new Error(`road network HTTP ${r.status}`);
      const file = (await r.json()) as RoadNetworkFile;
      if (file.schema !== ROAD_NETWORK_SCHEMA || file.grid?.id !== GRID_SPEC.id) throw new Error("road network schema/grid mismatch");
      return compileRoadNetwork(file);
    }),
  ).catch((e) => {
    networkPromise = null;
    throw e;
  });
  return networkPromise;
}

/** 國道 VD 每日包；沒有（404、回 HTML、schema 不符）→ null（國道為無法判斷，不退回其他級） */
export async function fetchFreewayVdPack(dateKey: string, fetchImpl: typeof fetch = fetch): Promise<FreewayVdPack | null> {
  return withLoading(`sound:freeway-vd:${dateKey}`, `國道 VD ${dateKey}`, (async () => {
    try {
      const r = await fetchImpl(`${ROAD_GRID.freewayVdUrlPrefix.value}${encodeURIComponent(dateKey)}.json`);
      if (!r.ok) return null;
      const j = (await r.json()) as FreewayVdPack;
      if (j.schema !== FREEWAY_VD_SCHEMA || j.date_taiwan !== dateKey || j.unit !== "veh_per_min" || j.frames?.step_s !== FREEWAY_SLOT_S) return null;
      return j;
    } catch {
      return null;
    }
  })());
}

export function makeRoadDayContext(dateKey: string, dayStart: number, pack: FreewayVdPack | null, baseline: readonly VdBaselineEntry[]): RoadDayContext {
  return { dateKey, dayStart, pack, typical: typicalDayVerdict(dateKey), baseline: new Map(baseline.map((e) => [e.id, e])) };
}
