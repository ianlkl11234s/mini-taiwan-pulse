/**
 * microSensorsLoader — LASS AirBox / 環境部微感測 IoT
 *
 * MVP：只提供「最新快照」RPC。一次回 ~500 筆。
 * 未來加 hourly pre-aggregate 後會另外包裝 replay 版本。
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import {
  microSensorPm25Color,
  microSensorTemperatureColor,
  microSensorHumidityColor,
} from "./microSensorTypes";
import type { MicroSensor } from "../types";

interface RawRow {
  device_id: string;
  source: string;
  area: string | null;
  app: string | null;
  /** 站名。DB live.micro_sensor_readings 有存，但 RPC 升級前不會回傳 → 必須 null-safe */
  site_name?: string | null;
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
    siteName: r.site_name ?? null,
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
 * 三種顯示模式的顏色一次全烤進 properties（色階 SSOT = data/microSensorTypes.ts）：
 * 切模式時 hook 只需 setPaintProperty 換 `["get", colorPm25|colorTemp|colorHum]`，
 * 不必重建 GeoJSON。缺值一律吃 MICRO_SENSOR_NO_DATA_COLOR 中性灰。
 */
export function buildMicroSensorsGeoJSON(sensors: MicroSensor[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sensors.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        deviceId: s.deviceId,
        siteName: s.siteName ?? "",
        source: s.source,
        area: s.area ?? "",
        app: s.app ?? "",
        observedAt: s.observedAt,
        pm25: s.pm25 ?? -1,
        pm10: s.pm10 ?? -1,
        pm1: s.pm1 ?? -1,
        temperature: s.temperature ?? -999,
        humidity: s.humidity ?? -1,
        colorPm25: microSensorPm25Color(s.pm25),
        colorTemp: microSensorTemperatureColor(s.temperature),
        colorHum: microSensorHumidityColor(s.humidity),
      },
    })),
  };
}
