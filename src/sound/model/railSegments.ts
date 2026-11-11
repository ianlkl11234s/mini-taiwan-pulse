/**
 * 鐵道站間結構分類（地下／高架／地面）— 聲景鐵道 adapter 用來排除地下段。
 *
 * 依據：Pulse 的軌道與車站資料沒有結構屬性（2026-11-11 查 public/rail 各系統 stations／tracks properties、
 * mini-taipei-v3、gis-wiki 皆無），改用 OpenStreetMap 的 tunnel／bridge／layer 標記，
 * 以 `scripts/preprocess/build-rail-segments.py` 逐「相鄰兩站」取樣比對軌道幾何，產出
 * `railSegmentTable.generated.ts`（查詢、門檻、OSM 資料時間都寫在 RAIL_SEGMENT_TABLE_META）。
 * 授權：© OpenStreetMap contributors，ODbL 1.0（衍生資料，引用要標示）。
 *
 * 規則：
 * - 表內沒有的站對、比對不到 OSM、洞口過渡段、多條軌道結果不一致 → unknown（**不當地面**）。
 * - 站點本身：前後兩段結構相同才採用，否則 unknown（車站常在洞口旁）。
 * - OSM 沒標 tunnel／bridge／layer 的鐵道依 OSM 慣例視為地面；這是資料標記的假設，不是實地查證。
 */
import { RAIL_SEGMENT_REASON, RAIL_SEGMENT_TABLE, RAIL_SEGMENT_TABLE_META, type RailSegmentCode } from "./railSegmentTable.generated";

export type RailStructure = "underground" | "elevated" | "at_grade" | "surface" | "unknown";

const CODE: Record<RailSegmentCode, RailStructure> = {
  U: "underground",
  E: "elevated",
  G: "at_grade",
  S: "surface",
  X: "unknown",
};

export interface SegmentStructure {
  structure: RailStructure;
  /** osm_tunnel／osm_bridge_or_layer_gt0／osm_unmatched／not_in_table… */
  reason: string;
  /** [地下比例, 高架＋地面比例, 未比對比例]；表內沒有時 null */
  shares: [number, number, number] | null;
}

export const RAIL_SEGMENT_SOURCE = {
  osmBase: RAIL_SEGMENT_TABLE_META.osmBase,
  license: RAIL_SEGMENT_TABLE_META.license,
  generator: RAIL_SEGMENT_TABLE_META.generator,
} as const;

export function segmentKey(system: string, a: string, b: string): string {
  return a < b ? `${system}|${a}|${b}` : `${system}|${b}|${a}`;
}

/** 相鄰兩站（依軌道 progress 順序）之間的結構；查不到 → unknown */
export function segmentStructure(
  system: string,
  a: string,
  b: string,
  table: Readonly<Record<string, readonly [RailSegmentCode, number, number, number, number]>> = RAIL_SEGMENT_TABLE,
  reasons: Readonly<Record<string, string>> = RAIL_SEGMENT_REASON,
): SegmentStructure {
  const key = segmentKey(system, a, b);
  const row = table[key];
  if (!row) return { structure: "unknown", reason: "not_in_table", shares: null };
  return { structure: CODE[row[0]], reason: reasons[key] ?? "", shares: [row[1], row[2], row[3]] };
}

export interface StructureInterval {
  pStart: number;
  pEnd: number;
  from: string;
  to: string;
  structure: RailStructure;
  reason: string;
}

/** 一條軌道依 station_progress 排序後的結構區間（progress 0–1） */
export function trackStructureIntervals(
  system: string,
  stationProgress: Readonly<Record<string, number>>,
  lookup: (system: string, a: string, b: string) => SegmentStructure = segmentStructure,
): StructureInterval[] {
  const ordered = Object.entries(stationProgress)
    .filter(([, p]) => typeof p === "number" && Number.isFinite(p))
    .sort((x, y) => x[1] - y[1]);
  const out: StructureInterval[] = [];
  for (let i = 0; i + 1 < ordered.length; i++) {
    const [a, pa] = ordered[i]!;
    const [b, pb] = ordered[i + 1]!;
    if (!(pb > pa)) continue;
    const s = lookup(system, a, b);
    out.push({ pStart: pa, pEnd: pb, from: a, to: b, structure: s.structure, reason: s.reason });
  }
  return out;
}

/** progress p 的結構；落在兩區間交界（車站）時兩邊相同才採用，否則 unknown；區間外 → unknown */
export function structureAtProgress(intervals: readonly StructureInterval[], p: number): RailStructure {
  const hits = intervals.filter((iv) => p >= iv.pStart - 1e-9 && p <= iv.pEnd + 1e-9);
  if (hits.length === 0) return "unknown";
  const first = hits[0]!.structure;
  return hits.every((h) => h.structure === first) ? first : "unknown";
}
