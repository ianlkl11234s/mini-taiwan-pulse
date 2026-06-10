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
