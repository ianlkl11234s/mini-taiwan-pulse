import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

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

/**
 * TDX live sources are polled every 5 minutes; planned city events every
 * 12 hours.  These limits apply only when TDX omitted ExpireTime: a supplied
 * effective/expire interval remains authoritative, including long-running
 * construction.
 */
const SOURCE_FRESHNESS_SECONDS: Readonly<Record<string, number>> = {
  live_freeway: 20 * 60,
  live_highway: 20 * 60,
  live_city: 20 * 60,
  event_city: 36 * 60 * 60,
};

/**
 * Whether an event has a source-supported lifecycle at `currentTime`.
 *
 * Unknown effective times are deliberately not treated as epoch 0.  Events
 * without an ExpireTime require a recent observation from a known TDX source;
 * otherwise a stale historical row would look indefinitely active.
 */
export function isRoadEventActive(event: RoadEvent, currentTime: number): boolean {
  if (!Number.isFinite(currentTime) || event.start_ts <= 0 || !Number.isFinite(event.start_ts)) {
    return false;
  }
  if (currentTime < event.start_ts) return false;

  if (event.end_ts != null) {
    return Number.isFinite(event.end_ts) && event.end_ts > event.start_ts && currentTime < event.end_ts;
  }

  const freshness = SOURCE_FRESHNESS_SECONDS[event.source];
  if (!freshness || event.last_updated_ts <= 0 || !Number.isFinite(event.last_updated_ts)) {
    return false;
  }
  return currentTime <= event.last_updated_ts + freshness;
}

// ── 事故強調（脈動／已排除變灰）──

/** 同時脈動的事故上限（取最新）。與 fire119Live 一致 */
export const ROAD_EVENT_PULSE_MAX = 20;
/** 已排除事故保留灰點的時間（秒）：給使用者看到「剛排除」，之後從圖上消失 */
export const ROAD_EVENT_CLEARED_GRACE_SEC = 30 * 60;
/** 已排除事故的灰色（design token：與 liveIncidents 的 PBS_CLEARED_COLOR／返隊灰同值） */
export const ROAD_EVENT_CLEARED_COLOR = "#6b7280";

/** 這些 event_type 不可能是事故（施工、活動／管制、災害／障礙） */
const NON_ACCIDENT_TYPES = new Set([2, 5, 7]);
const ACCIDENT_TEXT_RE = /事故|車禍/;

/**
 * 是否為「事故」類事件（純函式）。
 * - TDX EventType 3 ＝ 事故，直接算。
 * - EventType 1（壅塞/事故）、4／6／8（其他）、無類別：只有標題／描述／其他位置文字含「事故」「車禍」才算；
 *   純壅塞、道路障礙不算。
 * - 救護類（臺南「緊急救護」等）不算：救護案件在站主限定層，公開層不凸顯（站主決定 2026-11-17）。
 * - EventType 2／5／7（施工、災害、活動／管制）一律不算，即使文字提到事故。
 */
export function isAccidentEvent(
  e: Pick<RoadEvent, "event_type" | "title" | "description" | "location_other">,
): boolean {
  if (e.event_type === 3) return true;
  if (e.event_type != null && NON_ACCIDENT_TYPES.has(e.event_type)) return false;
  return ACCIDENT_TEXT_RE.test(`${e.title ?? ""} ${e.description ?? ""} ${e.location_other ?? ""}`);
}

/**
 * 事件被視為「結束」的時刻（UNIX 秒）。
 * TDX 沒有「已排除」狀態欄：有 ExpireTime 就用它；沒有（即時來源常見）就用
 * 最後更新時間 ＋ 該來源新鮮度上限（來源不再回報＝已排除）。判斷不了回 null。
 */
export function roadEventEndedAt(event: RoadEvent): number | null {
  if (event.start_ts <= 0 || !Number.isFinite(event.start_ts)) return null;
  if (event.end_ts != null) {
    return Number.isFinite(event.end_ts) && event.end_ts > event.start_ts ? event.end_ts : null;
  }
  const freshness = SOURCE_FRESHNESS_SECONDS[event.source];
  if (!freshness || event.last_updated_ts <= 0 || !Number.isFinite(event.last_updated_ts)) return null;
  return event.last_updated_ts + freshness;
}

/** 事故狀態：active＝進行中、cleared＝已排除（結束後 30 分內）、null＝非事故或已過期不顯示 */
export type RoadEventAccidentState = "active" | "cleared" | null;

export function roadEventAccidentState(event: RoadEvent, currentTime: number): RoadEventAccidentState {
  if (!isAccidentEvent(event) || !Number.isFinite(currentTime)) return null;
  if (isRoadEventActive(event, currentTime)) return "active";
  const endedAt = roadEventEndedAt(event);
  if (endedAt == null || currentTime < event.start_ts) return null;
  return currentTime >= endedAt && currentTime < endedAt + ROAD_EVENT_CLEARED_GRACE_SEC ? "cleared" : null;
}

function eventKey(e: RoadEvent): string {
  return `${e.source}|${e.event_id}`;
}

/** 脈動對象：進行中的點狀事故，依開始時間取最新 max 個 */
export function pickPulseEventKeys(events: RoadEvent[], currentTime: number, max = ROAD_EVENT_PULSE_MAX): Set<string> {
  const live = events.filter((e) => e.geometry?.type === "Point" && roadEventAccidentState(e, currentTime) === "active");
  live.sort((a, b) => b.start_ts - a.start_ts || eventKey(a).localeCompare(eventKey(b)));
  return new Set(live.slice(0, max).map(eventKey));
}

/**
 * 地圖上「顯示什麼」的簽章：進行中事件 ＋ 事故狀態（脈動／已排除）。
 * 簽章不變就不重送 GeoJSON（timeStore 訂閱用）。
 */
export function roadEventsDisplayKey(events: RoadEvent[], currentTime: number): string {
  const pulse = pickPulseEventKeys(events, currentTime);
  let key = "";
  for (const e of events) {
    const acc = roadEventAccidentState(e, currentTime);
    if (acc === "cleared") key += `${eventKey(e)}:c|`;
    else if (isRoadEventActive(e, currentTime)) key += `${eventKey(e)}:${pulse.has(eventKey(e)) ? "p" : "a"}|`;
  }
  return key;
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

async function fetchRoadEventDatesUncached(): Promise<RoadEventDateInfo[]> {
  const { data, error } = await withLoading(
    "road-events:dates",
    "道路事件日期",
    supabase.rpc("get_road_events_dates"),
  );
  if (error) throw new Error(`get_road_events_dates: ${error.message}`);
  return (data ?? []) as RoadEventDateInfo[];
}

const fetchRoadEventDatesCached = cachedOnce(fetchRoadEventDatesUncached, 10 * 60_000);

/** 取有路況事件的日期清單。10min TTL 快取，toggle 不重抓 */
export function fetchRoadEventDates(): Promise<RoadEventDateInfo[]> {
  return fetchRoadEventDatesCached();
}

async function fetchRoadEventsDayUncached(date: string): Promise<RoadEvent[]> {
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
      // Keep missing/invalid source times distinct from a real timestamp.
      // isRoadEventActive rejects the 0 sentinel instead of treating it as
      // "active since epoch".
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

const fetchRoadEventsDayCached = cachedByKey(fetchRoadEventsDayUncached, 10 * 60_000);

/** 取指定日期的路況事件。10min TTL 快取，toggle 不重抓 */
export function fetchRoadEventsDay(date: string): Promise<RoadEvent[]> {
  return fetchRoadEventsDayCached(date);
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
  const pulse = pickPulseEventKeys(events, currentTime);
  for (const e of events) {
    if (!e.geometry) continue;
    const active = isRoadEventActive(e, currentTime);
    const acc = roadEventAccidentState(e, currentTime);
    const cleared = acc === "cleared";
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
        color: cleared ? ROAD_EVENT_CLEARED_COLOR : eventTypeColor(e.event_type),
        start_ts: e.start_ts,
        end_ts: e.end_ts ?? -1,
        active: active ? 1 : 0,
        // 事故強調：acc_state 0＝非事故／1＝進行中／2＝已排除；show＝地圖要畫（進行中或剛排除）；pulse＝脈動
        acc_state: acc === "active" ? 1 : cleared ? 2 : 0,
        show: active || cleared ? 1 : 0,
        pulse: pulse.has(eventKey(e)) ? 1 : 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
