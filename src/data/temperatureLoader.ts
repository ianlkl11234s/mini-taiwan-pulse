/**
 * temperatureLoader.ts — 載入溫度網格資料（Supabase RPC）
 */

import { supabase, todayTaiwan } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

export interface TemperatureGridData {
  metadata: {
    rows: number;
    cols: number;
    bottomLeftLon: number;
    bottomLeftLat: number;
    resolutionDeg: number;
    tempMin: number;
    tempMax: number;
  };
  /** 陸地 cell 在 full grid 中的 flat indices */
  landIndices: number[];
  frames: {
    /** Unix timestamp（秒），實際觀測時間 */
    time: number;
    /** 每個 land cell 的溫度值（整數，實際溫度 × 10） */
    values: number[];
  }[];
}

// ── Grid constants（CWA 0.03° 溫度網格） ──
const GRID_ROWS = 120;
const GRID_COLS = 67;
const GRID_BOTTOM_LAT = 21.88;
const GRID_BOTTOM_LNG = 120.0;
const GRID_RESOLUTION = 0.03;

/**
 * 從 grid_lat/grid_lng 計算在 full grid 中的 flat index
 */
function gridCoordsToIndex(lat: number, lng: number): number {
  const row = Math.round((lat - GRID_BOTTOM_LAT) / GRID_RESOLUTION);
  const col = Math.round((lng - GRID_BOTTOM_LNG) / GRID_RESOLUTION);
  return row * GRID_COLS + col;
}

/** 找最近有資料的日期。10min TTL 快取，toggle 不重打 get_temperature_dates */
const resolveTargetDate = cachedOnce(async (): Promise<string> => {
  const { data: dates, error: datesErr } = await supabase.rpc("get_temperature_dates");
  if (datesErr) throw new Error(`get_temperature_dates: ${datesErr.message}`);
  if (!dates || dates.length === 0) throw new Error("No temperature data available");

  const today = todayTaiwan();
  const targetDate = (dates as { date: string; frames: number; cells: number }[])
    .filter((d) => d.date <= today && d.frames >= 10)
    .pop()?.date;
  return targetDate ?? (dates as { date: string }[])[dates.length - 1]!.date;
}, 10 * 60_000);

async function loadTemperatureGridForDateUncached(targetDate: string): Promise<TemperatureGridData> {
  const t0 = performance.now();

  const [gridRes, framesRes] = await withLoading(
    `temperature:${targetDate}`,
    `溫度網格 ${targetDate}`,
    Promise.all([
      supabase.rpc("get_temperature_grid_info", { target_date: targetDate }),
      supabase.rpc("get_temperature_frames", { target_date: targetDate }),
    ]),
  );

  if (gridRes.error) throw new Error(`get_temperature_grid_info: ${gridRes.error.message}`);
  if (framesRes.error) throw new Error(`get_temperature_frames: ${framesRes.error.message}`);

  const gridCells = gridRes.data as { grid_lat: number; grid_lng: number }[];
  const rawFrames = framesRes.data as { observed_at: string; cell_count: number; temps: string }[];

  if (!gridCells.length || !rawFrames.length) {
    throw new Error(`Empty temperature data for ${targetDate}`);
  }

  const landIndices = gridCells.map((c) => gridCoordsToIndex(c.grid_lat, c.grid_lng));

  let tempMin = Infinity;
  let tempMax = -Infinity;

  const frames = rawFrames.map((raw) => {
    const time = Math.floor(new Date(raw.observed_at).getTime() / 1000);
    const values = raw.temps.split(",").map((v) => {
      const temp = parseFloat(v);
      if (temp < tempMin) tempMin = temp;
      if (temp > tempMax) tempMax = temp;
      return Math.round(temp * 10);
    });
    return { time, values };
  });

  const elapsed = (performance.now() - t0).toFixed(0);
  console.log(
    `[Temperature/Supabase] ${targetDate}: ${frames.length} frames, ${landIndices.length} cells, ${elapsed}ms`
  );

  return {
    metadata: {
      rows: GRID_ROWS,
      cols: GRID_COLS,
      bottomLeftLon: GRID_BOTTOM_LNG,
      bottomLeftLat: GRID_BOTTOM_LAT,
      resolutionDeg: GRID_RESOLUTION,
      tempMin: Math.round(tempMin * 10) / 10,
      tempMax: Math.round(tempMax * 10) / 10,
    },
    landIndices,
    frames,
  };
}

const loadTemperatureGridForDateCached = cachedByKey(loadTemperatureGridForDateUncached, 10 * 60_000);

/** 載入最近有資料日的溫度網格。10min TTL + LRU 快取，toggle 不重抓 */
export async function loadTemperatureGrid(): Promise<TemperatureGridData> {
  const targetDate = await resolveTargetDate();
  return loadTemperatureGridForDateCached(targetDate);
}
