// USGS 全球地震 loader（from public.earthquakes_global view，migration 261）
import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export interface EarthquakeGlobalEvent {
  event_id: string;
  mag: number;
  place: string;
  depth_km: number;
  lng: number;
  lat: number;
  observed_ts: number; // unix seconds
}

type GeomLike =
  | { type: string; coordinates: [number, number, number?] }
  | string
  | null
  | undefined;

interface RawRow {
  event_id: string;
  mag: number | null;
  place: string | null;
  observed_at: string;
  depth_km: number | null;
  geom?: GeomLike;
}

function extractLngLat(geom: GeomLike): [number, number] | null {
  if (!geom) return null;
  if (typeof geom === "object" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [Number(lng), Number(lat)];
  }
  return null;
}

async function fetchEarthquakesGlobalUncached(): Promise<EarthquakeGlobalEvent[]> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    "earthquakes-global",
    "全球地震 USGS",
    supabase
      .from("earthquakes_global")
      .select("event_id,mag,place,observed_at,depth_km,geom")
      .order("observed_at", { ascending: false })
      .limit(2000),
  );
  if (error) throw new Error(`Supabase earthquakes_global: ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const events: EarthquakeGlobalEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (r.mag == null) { skipped++; continue; }
    const ll = extractLngLat(r.geom);
    if (!ll) { skipped++; continue; }
    events.push({
      event_id: r.event_id,
      mag: Number(r.mag),
      place: r.place ?? "",
      depth_km: r.depth_km == null ? 0 : Number(r.depth_km),
      lng: ll[0],
      lat: ll[1],
      observed_ts: Math.floor(new Date(r.observed_at).getTime() / 1000),
    });
  }
  console.log(`[EarthquakesGlobal] Loaded ${events.length} events (skipped ${skipped}) in ${(performance.now() - t0).toFixed(0)}ms`);
  return events;
}

const fetchEarthquakesGlobalCached = cachedOnce(fetchEarthquakesGlobalUncached, 10 * 60_000);

export function fetchEarthquakesGlobal(): Promise<EarthquakeGlobalEvent[]> {
  return fetchEarthquakesGlobalCached();
}

export function earthquakesGlobalToGeoJSON(events: EarthquakeGlobalEvent[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lng, e.lat] },
      properties: {
        event_id: e.event_id,
        mag: e.mag,
        place: e.place,
        depth_km: e.depth_km,
        observed_ts: e.observed_ts,
      },
    })),
  };
}
