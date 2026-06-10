/**
 * microSensorsLoader — LASS AirBox / 環境部微感測 IoT
 *
 * MVP：只提供「最新快照」RPC。一次回 ~500 筆。
 * 未來加 hourly pre-aggregate 後會另外包裝 replay 版本。
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import type { MicroSensor } from "../types";

interface RawRow {
  device_id: string;
  source: string;
  area: string | null;
  app: string | null;
  lon: number;
  lat: number;
  observed_at: string;
  pm25: number | null;
  pm10: number | null;
  pm1: number | null;
  temperature: number | null;
  humidity: number | null;
}

function toSensor(r: RawRow): MicroSensor {
  return {
    deviceId: r.device_id,
    source: r.source,
    area: r.area,
    app: r.app,
    lon: r.lon,
    lat: r.lat,
    observedAt: r.observed_at,
    pm25: r.pm25,
    pm10: r.pm10,
    pm1: r.pm1,
    temperature: r.temperature,
    humidity: r.humidity,
  };
}

async function fetchMicroSensorsLatestUncached(): Promise<MicroSensor[]> {
  const { data, error } = await withLoading(
    "micro-sensors:latest",
    "LASS 微型感測器",
    supabase.rpc("get_micro_sensors_latest"),
  );
  if (error) throw new Error(`get_micro_sensors_latest: ${error.message}`);
  return (data ?? []).map(toSensor);
}

const fetchMicroSensorsLatestCached = cachedOnce(fetchMicroSensorsLatestUncached, 5 * 60_000);

/** 最新微感測快照。5min TTL 快取，toggle 不重抓 */
export function fetchMicroSensorsLatest(): Promise<MicroSensor[]> {
  return fetchMicroSensorsLatestCached();
}

/**
 * LASS 色階：以 PM2.5 為主，對應 PM2.5 AQI sub-index 常用分級
 * 0-15 綠 / 15-35 黃 / 35-54 橙 / 54-150 紅 / 150+ 紫
 * 這是針對「PM2.5 濃度」而非 AQI 的近似色；實際供 circle-color 用。
 */
export function pm25ToColor(pm25: number | null): string {
  if (pm25 == null || !Number.isFinite(pm25)) return "#707070";
  if (pm25 <= 15) return "#009966";
  if (pm25 <= 35) return "#FFDE33";
  if (pm25 <= 54) return "#FF9933";
  if (pm25 <= 150) return "#CC0033";
  return "#660099";
}

export function buildMicroSensorsGeoJSON(sensors: MicroSensor[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sensors.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        deviceId: s.deviceId,
        source: s.source,
        area: s.area ?? "",
        app: s.app ?? "",
        observedAt: s.observedAt,
        pm25: s.pm25 ?? -1,
        pm10: s.pm10 ?? -1,
        pm1: s.pm1 ?? -1,
        temperature: s.temperature ?? -999,
        humidity: s.humidity ?? -1,
        color: pm25ToColor(s.pm25),
      },
    })),
  };
}
