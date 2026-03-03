/**
 * temperatureLoader.ts — 載入預處理後的溫度網格資料
 */

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

let cached: TemperatureGridData | null = null;

export async function loadTemperatureGrid(): Promise<TemperatureGridData> {
  if (cached) return cached;

  const res = await fetch("./temperature_grid.json");
  if (!res.ok) throw new Error(`Failed to load temperature_grid.json: ${res.status}`);
  cached = await res.json();
  return cached!;
}
