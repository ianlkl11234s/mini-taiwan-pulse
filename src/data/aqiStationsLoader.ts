/**
 * aqiStationsLoader — 環境部 77 站即時觀測
 *
 * 兩支 RPC：
 *   - get_aqi_stations_latest()        無 timeline 時走這個（air_quality_current 直讀）
 *   - get_aqi_stations_at(p_observed)  timeline replay 取指定時刻的每站最新一筆
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import type { AqiStation } from "../types";

interface RawRow {
  station_id: string;
  station_name: string | null;
  county: string | null;
  lon: number;
  lat: number;
  observed_at: string;
  aqi: number | null;
  pollutant: string | null;
  status: string | null;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
}

function toStation(r: RawRow): AqiStation {
  return {
    stationId: r.station_id,
    stationName: r.station_name,
    county: r.county,
    lon: r.lon,
    lat: r.lat,
    observedAt: r.observed_at,
    aqi: r.aqi,
    pollutant: r.pollutant,
    status: r.status,
    pm25: r.pm25,
    pm10: r.pm10,
    o3: r.o3,
    no2: r.no2,
    so2: r.so2,
    co: r.co,
    windSpeed: r.wind_speed,
    windDirection: r.wind_direction,
  };
}

/** 取指定時刻的 77 站觀測（timeline replay） */
export async function fetchAqiStationsAt(observedAt: Date): Promise<AqiStation[]> {
  const iso = observedAt.toISOString();
  const key = `aqi-stations:${iso.slice(0, 13)}`; // 同小時合併 loading
  const { data, error } = await withLoading(
    key,
    `空氣品質測站 ${iso.slice(0, 16)}`,
    supabase.rpc("get_aqi_stations_at", { p_observed_at: iso }),
  );
  if (error) throw new Error(`get_aqi_stations_at: ${error.message}`);
  return (data ?? []).map(toStation);
}

async function fetchAqiStationsLatestUncached(): Promise<AqiStation[]> {
  const { data, error } = await withLoading(
    "aqi-stations:latest",
    "空氣品質測站 (latest)",
    supabase.rpc("get_aqi_stations_latest"),
  );
  if (error) throw new Error(`get_aqi_stations_latest: ${error.message}`);
  return (data ?? []).map(toStation);
}

const fetchAqiStationsLatestCached = cachedOnce(fetchAqiStationsLatestUncached, 5 * 60_000);

/** 取最新 77 站觀測（無 timeline fallback）。5min TTL 快取，toggle 不重抓 */
export function fetchAqiStationsLatest(): Promise<AqiStation[]> {
  return fetchAqiStationsLatestCached();
}

/** 測站列表 → Mapbox 圖層用 GeoJSON FeatureCollection */
export function buildStationsGeoJSON(stations: AqiStation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        stationId: s.stationId,
        stationName: s.stationName ?? "",
        county: s.county ?? "",
        observedAt: s.observedAt,
        aqi: s.aqi ?? -1,
        pollutant: s.pollutant ?? "",
        status: s.status ?? "",
        pm25: s.pm25 ?? -1,
        pm10: s.pm10 ?? -1,
        o3: s.o3 ?? -1,
        no2: s.no2 ?? -1,
        so2: s.so2 ?? -1,
        co: s.co ?? -1,
        windSpeed: s.windSpeed ?? -1,
        windDirection: s.windDirection ?? -1,
      },
    })),
  };
}
