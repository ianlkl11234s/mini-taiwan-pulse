import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export interface EarthquakeEvent {
  event_id: string;
  magnitude: number;
  depth_km: number;
  epicenter_lat: number;
  epicenter_lng: number;
  location_desc: string | null;
  occurred_ts: number; // unix seconds
  report_type: string | null;
}

interface RawRow {
  event_id: string;
  magnitude: number | null;
  depth_km: number | null;
  epicenter_lat: number | null;
  epicenter_lng: number | null;
  location_desc: string | null;
  occurred_at: string;
  report_type: string | null;
}

async function fetchEarthquakesUncached(): Promise<EarthquakeEvent[]> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    "earthquakes",
    "地震事件",
    supabase
      .from("earthquake_events")
      .select("event_id,magnitude,depth_km,epicenter_lat,epicenter_lng,location_desc,occurred_at,report_type")
      .order("occurred_at", { ascending: true })
      .limit(5000),
  );

  if (error) throw new Error(`Supabase earthquake_events: ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const events: EarthquakeEvent[] = [];
  for (const r of rows) {
    if (r.epicenter_lat == null || r.epicenter_lng == null || r.magnitude == null) continue;
    events.push({
      event_id: r.event_id,
      magnitude: Number(r.magnitude),
      depth_km: r.depth_km == null ? 0 : Number(r.depth_km),
      epicenter_lat: Number(r.epicenter_lat),
      epicenter_lng: Number(r.epicenter_lng),
      location_desc: r.location_desc,
      occurred_ts: Math.floor(new Date(r.occurred_at).getTime() / 1000),
      report_type: r.report_type,
    });
  }

  console.log(`[Earthquake] Loaded ${events.length} events in ${(performance.now() - t0).toFixed(0)}ms`);
  return events;
}

const fetchEarthquakesCached = cachedOnce(fetchEarthquakesUncached, 15 * 60_000);

/** 一次撈取所有地震事件（資料量小，~數百筆）。15min TTL 快取，toggle 不重抓 */
export function fetchEarthquakes(): Promise<EarthquakeEvent[]> {
  return fetchEarthquakesCached();
}

// ══════════════════════════════════════════════════════════════════
//  Monitor 地震卡摘要
// ══════════════════════════════════════════════════════════════════
//
// 刻意**不**復用 fetchEarthquakes()：那支是地圖層契約（asc + limit 5000），
// 底表一旦超過 5000 列就只會拿到**最舊**的 5000 筆，「最新地震」會靜默取到舊事件
// （2026-08 實測 1089 列，尚未觸頂，但這種失敗不會有人回報）。
// 這裡改打兩個小查詢：最新 20 筆（desc）+ 24h 計數（head，不傳 body）。
//
// 同樣刻意不包 withLoading：Monitor 面板背景輪詢（15min），非圖層載入 ——
// 理由同 loadingRegistryContract.test.ts 對 airportPaxLoader 的豁免；
// 該 ratchet 只掃 supabase.rpc/staticRpc，`.from()` 不在掃描範圍，無需登記。

export interface EarthquakeSummary {
  /** 最新「有感」地震（CWA local/significant 報告優先，退回最新任一筆）；無則 null */
  latest: {
    magnitude: number;
    depth_km: number;
    location_desc: string;
    occurred_ts: number;
    report_type: string | null;
  } | null;
  /** 24h 內事件數（含 catalog 目錄，代表近日地震活動量） */
  count24h: number;
}

/** 「有感」= 非目錄（catalog）報告。null report_type 視同有感（保守，不靠 DB 端 neq 濾 null） */
function isFeltReport(reportType: string | null): boolean {
  return reportType !== "catalog";
}

async function fetchEarthquakeSummaryUncached(): Promise<EarthquakeSummary> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [latestRes, countRes] = await Promise.all([
    supabase
      .from("earthquake_events")
      .select("magnitude,depth_km,location_desc,occurred_at,report_type")
      .order("occurred_at", { ascending: false })
      .limit(20),
    supabase
      .from("earthquake_events")
      .select("event_id", { count: "exact", head: true })
      .gte("occurred_at", since),
  ]);
  if (latestRes.error) throw new Error(`Supabase earthquake_events: ${latestRes.error.message}`);
  if (countRes.error) throw new Error(`Supabase earthquake_events 24h: ${countRes.error.message}`);

  const rows = (latestRes.data ?? []) as RawRow[];
  const pick = rows.find((r) => isFeltReport(r.report_type) && r.magnitude != null) ?? rows[0];
  return {
    latest: pick
      ? {
          magnitude: pick.magnitude == null ? 0 : Number(pick.magnitude),
          depth_km: pick.depth_km == null ? 0 : Number(pick.depth_km),
          location_desc: pick.location_desc ?? "",
          occurred_ts: Math.floor(new Date(pick.occurred_at).getTime() / 1000),
          report_type: pick.report_type,
        }
      : null,
    count24h: countRes.count ?? 0,
  };
}

const fetchEarthquakeSummaryCached = cachedOnce(fetchEarthquakeSummaryUncached, 15 * 60_000);

/** 給 Monitor 地震卡：最新有感地震 + 24h 次數 */
export function fetchEarthquakeSummary(): Promise<EarthquakeSummary> {
  return fetchEarthquakeSummaryCached();
}

export const invalidateEarthquakeSummary = (): void => fetchEarthquakeSummaryCached.invalidate();

/** 轉成 GeoJSON FeatureCollection */
export function earthquakesToGeoJSON(events: EarthquakeEvent[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.epicenter_lng, e.epicenter_lat] },
      properties: {
        event_id: e.event_id,
        magnitude: e.magnitude,
        depth_km: e.depth_km,
        location_desc: e.location_desc ?? "",
        occurred_ts: e.occurred_ts,
        report_type: e.report_type ?? "",
      },
    })),
  };
}
