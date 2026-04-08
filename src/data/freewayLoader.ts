import { supabase } from "../lib/supabase";

export interface FreewayDateInfo {
  date: string;
  records: number;
  sections: number;
  snapshots: number;
}

/** 單一時間點快照（unix 秒 / 等級 1-5 / 速度 km/h 或 null） */
export interface FreewaySnapshot {
  ts: number;
  level: number;
  speed: number | null;
}

/** 一條路段 + 該日所有時間點 */
export interface FreewaySection {
  section_id: string;
  section_name: string | null;
  road_name: string | null;
  direction_label: string | null;
  /** LineString [[lng,lat],...] */
  coords: [number, number][];
  /** 按時間升序 */
  timeline: FreewaySnapshot[];
}

export interface FreewayDayData {
  date: string;
  sections: FreewaySection[];
  /** 全部 snapshot ts 的 min / max，給 timeline hint */
  timeRange: { start: number; end: number };
}

/** 取得可用日期 */
export async function fetchFreewayDates(): Promise<FreewayDateInfo[]> {
  const { data, error } = await supabase.rpc("get_freeway_dates");
  if (error) throw new Error(`get_freeway_dates: ${error.message}`);
  return (data ?? []) as FreewayDateInfo[];
}

interface RawRow {
  section_id: string;
  section_name: string | null;
  road_name: string | null;
  direction_label: string | null;
  geom: string; // GeoJSON LineString string
  timeline: string; // "ts,level,speed;ts,level,speed;..."
}

function parseTimeline(s: string): FreewaySnapshot[] {
  if (!s) return [];
  const out: FreewaySnapshot[] = [];
  for (const part of s.split(";")) {
    const [tsStr, lvStr, spStr] = part.split(",");
    if (!tsStr) continue;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts)) continue;
    const level = Number(lvStr);
    const speed = spStr === "" || spStr == null ? null : Number(spStr);
    out.push({ ts, level: Number.isFinite(level) ? level : 0, speed });
  }
  return out;
}

function parseLineString(geojsonStr: string): [number, number][] {
  try {
    const g = JSON.parse(geojsonStr) as GeoJSON.LineString;
    if (g.type !== "LineString") return [];
    return g.coordinates as [number, number][];
  } catch {
    return [];
  }
}

/** 載入某一天全部路段 timeline */
export async function fetchFreewayDay(date: string): Promise<FreewayDayData> {
  const t0 = performance.now();
  const { data, error } = await supabase.rpc("get_freeway_congestion_day", { target_date: date });
  if (error) throw new Error(`get_freeway_congestion_day(${date}): ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const sections: FreewaySection[] = [];
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const r of rows) {
    const coords = parseLineString(r.geom);
    if (coords.length < 2) continue;
    const timeline = parseTimeline(r.timeline);
    if (timeline.length === 0) continue;
    for (const s of timeline) {
      if (s.ts < minTs) minTs = s.ts;
      if (s.ts > maxTs) maxTs = s.ts;
    }
    sections.push({
      section_id: r.section_id,
      section_name: r.section_name,
      road_name: r.road_name,
      direction_label: r.direction_label,
      coords,
      timeline,
    });
  }

  console.log(
    `[Freeway] Loaded ${sections.length} sections for ${date} in ${(performance.now() - t0).toFixed(0)}ms`,
  );

  return {
    date,
    sections,
    timeRange: {
      start: Number.isFinite(minTs) ? minTs : 0,
      end: Number.isFinite(maxTs) ? maxTs : 0,
    },
  };
}

/** 等級 1~5 對應顏色（順暢 / 車多 / 略壅塞 / 壅塞 / 嚴重壅塞；0 = 無資料） */
export const CONGESTION_COLORS: Record<number, string> = {
  0: "#808080",
  1: "#22c55e",
  2: "#eab308",
  3: "#f97316",
  4: "#ef4444",
  5: "#991b1b",
};

export const CONGESTION_LABELS: Record<number, string> = {
  0: "無資料",
  1: "順暢",
  2: "車多",
  3: "略壅塞",
  4: "壅塞",
  5: "嚴重壅塞",
};

/** 二分搜尋：找 timeline 中 ts <= t 的最後一筆 */
export function findSnapshotAt(timeline: FreewaySnapshot[], t: number): FreewaySnapshot | null {
  if (timeline.length === 0) return null;
  if (t < timeline[0]!.ts) return null;
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid]!.ts <= t) lo = mid;
    else hi = mid - 1;
  }
  return timeline[lo]!;
}

/** 根據當前時間建立 GeoJSON FeatureCollection（每條路段一個 feature） */
export function buildFreewayGeoJSON(
  day: FreewayDayData | null,
  currentTime: number,
): GeoJSON.FeatureCollection {
  if (!day) return { type: "FeatureCollection", features: [] };
  const features: GeoJSON.Feature[] = [];
  for (const sec of day.sections) {
    const snap = findSnapshotAt(sec.timeline, currentTime);
    const level = snap?.level ?? 0;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: sec.coords },
      properties: {
        section_id: sec.section_id,
        section_name: sec.section_name ?? "",
        road_name: sec.road_name ?? "",
        direction_label: sec.direction_label ?? "",
        level,
        color: CONGESTION_COLORS[level] ?? CONGESTION_COLORS[0],
        speed: snap?.speed ?? null,
        snapshot_ts: snap?.ts ?? 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
