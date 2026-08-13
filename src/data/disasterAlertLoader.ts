import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";
import {
  ALERT_GROUPS,
  EXCLUDED_TERMS,
  alertGroupOf,
  alertTypeColor,
} from "./disasterAlertTypes";
import { isMapAlertFresh } from "./alertRules";

/**
 * NCDR 災害示警 (CAP) loader
 * - 來源：realtime.disaster_alerts (UPSERT by identifier)
 * - RPC：get_disaster_alert_dates / get_disaster_alerts_day(target_date)
 */

export interface DisasterAlertDateInfo {
  date: string;
  alerts: number;
}

export interface DisasterAlert {
  identifier: string;
  event: string | null;
  event_term: string | null;
  category: string | null;
  severity: string | null; // Extreme/Severe/Moderate/Minor/Unknown
  urgency: string | null;
  certainty: string | null;
  msg_type: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  area_desc: string | null;
  sender_name: string | null;
  author: string | null;
  /** unix 秒；缺失時為 0 */
  start_ts: number;
  /** unix 秒；缺失時為 Number.MAX_SAFE_INTEGER (視為長期有效) */
  end_ts: number;
  /** GeoJSON Geometry，可能為 null（無範圍時用 area_desc 顯示） */
  geometry: GeoJSON.Geometry | null;
}

interface RawRow {
  identifier: string;
  event: string | null;
  event_term: string | null;
  category: string | null;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  msg_type: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  area_desc: string | null;
  sender_name: string | null;
  author: string | null;
  sent_ts: number | null;
  effective_ts: number | null;
  onset_ts: number | null;
  expires_ts: number | null;
  geom: string | null;
}

const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

async function fetchDisasterAlertDatesUncached(): Promise<DisasterAlertDateInfo[]> {
  const { data, error } = await withLoading(
    "disaster-alert:dates",
    "災害示警日期",
    supabase.rpc("get_disaster_alert_dates"),
  );
  if (error) throw new Error(`get_disaster_alert_dates: ${error.message}`);
  return (data ?? []) as DisasterAlertDateInfo[];
}

const fetchDisasterAlertDatesCached = cachedOnce(fetchDisasterAlertDatesUncached, 10 * 60_000);

/** 取有災害示警的日期清單。10min TTL 快取，toggle 不重抓 */
export function fetchDisasterAlertDates(): Promise<DisasterAlertDateInfo[]> {
  return fetchDisasterAlertDatesCached();
}

async function fetchDisasterAlertsDayUncached(date: string): Promise<DisasterAlert[]> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `disaster-alerts:${date}`,
    `災害示警 ${date}`,
    supabase.rpc("get_disaster_alerts_day", { target_date: date }),
  );
  if (error) throw new Error(`get_disaster_alerts_day(${date}): ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const alerts: DisasterAlert[] = [];
  for (const r of rows) {
    let geometry: GeoJSON.Geometry | null = null;
    if (r.geom) {
      try {
        geometry = JSON.parse(r.geom) as GeoJSON.Geometry;
      } catch {
        geometry = null;
      }
    }
    const start =
      r.effective_ts ?? r.sent_ts ?? r.onset_ts ?? 0;
    const end =
      r.expires_ts ?? (r.effective_ts ? r.effective_ts + 6 * 3600 : FAR_FUTURE);

    alerts.push({
      identifier: r.identifier,
      event: r.event,
      event_term: r.event_term,
      category: r.category,
      severity: r.severity,
      urgency: r.urgency,
      certainty: r.certainty,
      msg_type: r.msg_type,
      headline: r.headline,
      description: r.description,
      instruction: r.instruction,
      area_desc: r.area_desc,
      sender_name: r.sender_name,
      author: r.author,
      start_ts: Number(start) || 0,
      end_ts: Number(end) || FAR_FUTURE,
      geometry,
    });
  }

  console.log(
    `[DisasterAlerts] Loaded ${alerts.length} alerts for ${date} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return alerts;
}

const fetchDisasterAlertsDayCached = cachedByKey(fetchDisasterAlertsDayUncached, 10 * 60_000);

/** 取指定日期的災害示警。10min TTL 快取，toggle 不重抓 */
export function fetchDisasterAlertsDay(date: string): Promise<DisasterAlert[]> {
  return fetchDisasterAlertsDayCached(date);
}

/** Severity → 顏色 (red/orange/yellow/blue/grey) */
export const SEVERITY_COLORS: Record<string, string> = {
  Extreme: "#dc2626",
  Severe: "#ea580c",
  Moderate: "#eab308",
  Minor: "#3b82f6",
  Unknown: "#9ca3af",
};

export const SEVERITY_LABELS: Record<string, string> = {
  Extreme: "極端 Extreme",
  Severe: "嚴重 Severe",
  Moderate: "中度 Moderate",
  Minor: "輕度 Minor",
  Unknown: "未分類 Unknown",
};

export function severityColor(sev: string | null | undefined): string {
  if (!sev) return SEVERITY_COLORS.Unknown!;
  return SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.Unknown!;
}

/** 幾何 bbox 中心（centroid 點用，零依賴的簡化版） */
function geometryCenter(geom: GeoJSON.Geometry): [number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const x = coords[0] as number;
      const y = coords[1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) visit(c);
  };
  if (geom.type === "GeometryCollection") {
    for (const g of geom.geometries) {
      const c = geometryCenter(g);
      if (c) return c;
    }
    return null;
  }
  visit(geom.coordinates);
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * 逐 part 的 bbox 中心（pulse 錨點用）
 *
 * 大面積特報常是**散布**的 MultiPolygon（例：高溫特報只涵蓋北部與台東兩塊），
 * 整體 bbox 中心會落在兩塊之間的空白處 —— 環會閃在沒發警報的地方。
 * 故 pulse 改成每個 part 各放一顆錨點。
 */
function geometryPartCenters(geom: GeoJSON.Geometry, max = 12): [number, number][] {
  const out: [number, number][] = [];
  const push = (g: GeoJSON.Geometry) => {
    if (out.length >= max) return;
    const c = geometryCenter(g);
    if (c) out.push(c);
  };
  if (geom.type === "GeometryCollection") {
    for (const g of geom.geometries) push(g);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      push({ type: "Polygon", coordinates: poly });
    }
  } else {
    push(geom);
  }
  return out;
}

/** 觸發地圖 pulse 的 severity（CAP 原文值） */
const PULSE_SEVERITY = new Set(["Severe", "Extreme"]);

/**
 * 將 alerts 轉成 GeoJSON FeatureCollection（含當前 active 標記）
 *
 * - 排除 EXCLUDED_TERMS（地震/消防安檢/系統測試）
 * - properties.group / tcolor：5 群組分層 + event_term 分色用
 * - 小範圍事件群（emitPoints）另發 centroid 點 feature（is_pt=1），
 *   低 zoom 時 0.5km 火災圓等小 polygon 仍可見
 * - `pulse=1`：active ∧ severity≥Severe ∧ 仍新鮮（alertRules 群組門檻），供 B2 脈動層用。
 *   fresh gate 是必要的 —— 沒有它，藤枝休園（Severe、expires 2027）會在地圖上全年 pulse。
 * - 大面積特報群（emitPoints=false）平常不補點，但 pulse 需要 Point 幾何才畫得出來，
 *   故 severe 時補一顆 **is_pt=2** 的 pulse 錨點（既有 -fill/-line/-point 三層的
 *   filter 是 is_pt==0 / ==1，吃不到 2，視覺不受影響）
 */
export function alertsToGeoJSON(
  alerts: DisasterAlert[],
  currentTime: number,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const a of alerts) {
    if (!a.geometry) continue;
    if (a.event_term && EXCLUDED_TERMS.has(a.event_term)) continue;
    const active = currentTime >= a.start_ts && currentTime < a.end_ts;
    const group = alertGroupOf(a.event_term);
    // start_ts = effective ?? sent ?? onset，即「這則示警發布/生效的時刻」，
    // 與側欄 alertRules 用的 sent_ts 同語意
    const pulse =
      active &&
      PULSE_SEVERITY.has(a.severity ?? "") &&
      isMapAlertFresh(group, a.start_ts, currentTime)
        ? 1
        : 0;
    const properties = {
      identifier: a.identifier,
      event: a.event ?? "",
      event_term: a.event_term ?? "",
      severity: a.severity ?? "Unknown",
      color: severityColor(a.severity),
      group,
      tcolor: alertTypeColor(a.event_term),
      headline: a.headline ?? "",
      area_desc: a.area_desc ?? "",
      sender_name: a.sender_name ?? a.author ?? "",
      start_ts: a.start_ts,
      end_ts: a.end_ts,
      active: active ? 1 : 0,
      pulse,
    };
    features.push({
      type: "Feature",
      geometry: a.geometry,
      properties: { ...properties, is_pt: 0 },
    });
    if (ALERT_GROUPS[group].emitPoints) {
      // 小範圍事件群：維持原本「整體 bbox 中心一顆點」，pulse 與底下的點同址
      const center = geometryCenter(a.geometry);
      if (center) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: { ...properties, is_pt: 1 },
        });
      }
    } else if (pulse === 1) {
      // 大面積特報群：平常不補點，severe 時逐 part 補 pulse 錨點
      for (const center of geometryPartCenters(a.geometry)) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: { ...properties, is_pt: 2 },
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}
