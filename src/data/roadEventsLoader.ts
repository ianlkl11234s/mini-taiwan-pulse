import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * TDX 即時路況事件 loader
 * - 來源：realtime.road_events（4 個 source）
 * - RPC：get_road_events_dates / get_road_events_day(target_date)
 *
 * source 對應：
 *   live_freeway  — 國道即時事件（純點）
 *   live_highway  — 省道即時事件（純點）
 *   live_city     — 縣市即時事件（點為主，偏基隆）
 *   event_city    — 縣市預告事件（面/線/點混合，12hr 長壽）
 */

export interface RoadEventDateInfo {
  date: string;
  events: number;
}

export interface RoadEvent {
  event_id: string;
  source: string;
  event_type: number | null;  // 1=壅塞/事故 2=施工 3=事故 5=災害 7=活動/管制 8=其他
  severity: number | null;
  road_name: string | null;
  direction: string | null;
  start_km: number | null;
  end_km: number | null;
  title: string | null;
  description: string | null;
  location_other: string | null;
  blocked_lanes: string | null;
  /** GeoJSON Geometry（已過濾 null 和 (0,0)） */
  geometry: GeoJSON.Geometry | null;
  matched_section_id: string | null;
  enrich_status: string | null;
  /** UNIX 秒；0 表示無資料 */
  start_ts: number;
  /** UNIX 秒；null 表示無限期 */
  end_ts: number | null;
  last_updated_ts: number;
}

interface RawRow {
  event_id: string;
  source: string;
  event_type: number | null;
  severity: number | null;
  road_name: string | null;
  direction: string | null;
  start_km: number | null;
  end_km: number | null;
  title: string | null;
  description: string | null;
  location_other: string | null;
  blocked_lanes: string | null;
  geom: string | null;
  matched_section_id: string | null;
  enrich_status: string | null;
  effective_ts: number | null;
  expire_ts: number | null;
  last_updated_ts: number | null;
}

export async function fetchRoadEventDates(): Promise<RoadEventDateInfo[]> {
  const { data, error } = await supabase.rpc("get_road_events_dates");
  if (error) throw new Error(`get_road_events_dates: ${error.message}`);
  return (data ?? []) as RoadEventDateInfo[];
}

export async function fetchRoadEventsDay(date: string): Promise<RoadEvent[]> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `road-events:${date}`,
    `即時路況 ${date}`,
    supabase.rpc("get_road_events_day", { target_date: date }),
  );
  if (error) throw new Error(`get_road_events_day(${date}): ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const events: RoadEvent[] = [];
  for (const r of rows) {
    let geometry: GeoJSON.Geometry | null = null;
    if (r.geom) {
      try {
        geometry = JSON.parse(r.geom) as GeoJSON.Geometry;
      } catch {
        geometry = null;
      }
    }
    if (!geometry) continue;

    events.push({
      event_id: r.event_id,
      source: r.source,
      event_type: r.event_type,
      severity: r.severity,
      road_name: r.road_name,
      direction: r.direction,
      start_km: r.start_km,
      end_km: r.end_km,
      title: r.title,
      description: r.description,
      location_other: r.location_other,
      blocked_lanes: r.blocked_lanes,
      geometry,
      matched_section_id: r.matched_section_id,
      enrich_status: r.enrich_status,
      start_ts: Number(r.effective_ts) || 0,
      end_ts: r.expire_ts != null ? Number(r.expire_ts) : null,
      last_updated_ts: Number(r.last_updated_ts) || 0,
    });
  }

  console.log(
    `[RoadEvents] Loaded ${events.length} events for ${date} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return events;
}

// ── event_type 顏色（對應 sidebar 呈現設計） ──
export const EVENT_TYPE_COLORS: Record<number, string> = {
  3: "#ef4444", // 事故 → 紅
  1: "#eab308", // 壅塞或事故 → 黃
  2: "#f97316", // 施工 → 橘
  7: "#a855f7", // 活動/管制 → 紫
  5: "#dc2626", // 災害/障礙 → 深紅
};

export const EVENT_TYPE_LABELS: Record<number, string> = {
  1: "壅塞/事故",
  2: "施工",
  3: "事故",
  4: "其他",
  5: "災害/障礙",
  6: "其他",
  7: "活動/管制",
  8: "其他",
};

export const DEFAULT_EVENT_COLOR = "#6b7280"; // 未知/其他 → 灰

export function eventTypeColor(type: number | null | undefined): string {
  if (type == null) return DEFAULT_EVENT_COLOR;
  return EVENT_TYPE_COLORS[type] ?? DEFAULT_EVENT_COLOR;
}

/** 將 events 轉成 GeoJSON FeatureCollection（含當前 active 標記） */
export function roadEventsToGeoJSON(
  events: RoadEvent[],
  currentTime: number,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const e of events) {
    if (!e.geometry) continue;
    // end_ts null = 無限期（長駐 event_city 預告）
    const active =
      (e.start_ts === 0 || currentTime >= e.start_ts) &&
      (e.end_ts == null || currentTime < e.end_ts);
    features.push({
      type: "Feature",
      geometry: e.geometry,
      properties: {
        event_id: e.event_id,
        source: e.source,
        event_type: e.event_type ?? 0,
        severity: e.severity ?? 0,
        road_name: e.road_name ?? "",
        direction: e.direction ?? "",
        start_km: e.start_km ?? 0,
        end_km: e.end_km ?? 0,
        title: e.title ?? "",
        description: e.description ?? "",
        location_other: e.location_other ?? "",
        blocked_lanes: e.blocked_lanes ?? "",
        color: eventTypeColor(e.event_type),
        start_ts: e.start_ts,
        end_ts: e.end_ts ?? -1,
        active: active ? 1 : 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
