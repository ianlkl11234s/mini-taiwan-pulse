// 氣候 UV 場點擊讀值 — click 地圖任一點回傳該處風速/風向（或流速/流向）。
// 資料就是粒子動畫用的同一張 UV PNG，前端雙線性取樣，零後端成本。
// 對齊 climateParticleLineLayer 的取樣語意（alpha mask + 全球經度 wrap）。
import { loadClimateRaster, type ClimateRasterData } from "../map/climateParticleLineLayer";

export interface ClimateFieldSample {
  /** 東向分量 m/s */
  u: number;
  /** 北向分量 m/s */
  v: number;
  /** 合成速度 m/s */
  speed: number;
  valid_at: string | null;
}

const WIND_PNG = "/climate/wind10m_latest.png";
const WIND_META = "/climate/wind10m_latest.json";
const CURRENTS_PNG = "/climate/currents_latest.png";
const CURRENTS_META = "/climate/currents_latest.json";

const cache = new Map<string, Promise<ClimateRasterData>>();

function getRaster(pngUrl: string, metaUrl: string): Promise<ClimateRasterData> {
  let p = cache.get(pngUrl);
  if (!p) {
    p = loadClimateRaster(pngUrl, metaUrl);
    // 載入失敗不要 cache 住 rejected promise，下次 click 再試
    p.catch(() => cache.delete(pngUrl));
    cache.set(pngUrl, p);
  }
  return p;
}

function samplePixel(raster: ClimateRasterData, px: number, py: number): [number, number, number] {
  const { meta, data } = raster;
  const ix = Math.max(0, Math.min(meta.width - 1, px));
  const iy = Math.max(0, Math.min(meta.height - 1, py));
  const idx = (iy * meta.width + ix) * 4;
  return [data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 3] ?? 0];
}

/** 在經緯度處雙線性取樣 UV；落在 bbox 外或 alpha mask（陸地/無效）→ null。 */
function sampleAt(raster: ClimateRasterData, lon: number, lat: number): ClimateFieldSample | null {
  const { meta } = raster;
  const [lonMin, latMin, lonMax, latMax] = meta.bbox;
  const lonSpan = Math.max(1e-6, lonMax - lonMin);
  const latSpan = Math.max(1e-6, latMax - latMin);
  const isGlobalX = Math.abs(lonMax - lonMin) > 300;

  let x = (lon - lonMin) / lonSpan;
  const y = (latMax - lat) / latSpan;
  if (y < 0 || y > 1) return null;
  if (isGlobalX) x = ((x % 1) + 1) % 1;
  else if (x < 0 || x > 1) return null;

  // mask 用最近像素判定（與粒子引擎 sampleValid 一致）
  const nearPx = Math.round(x * (meta.width - 1));
  const nearPy = Math.round(y * (meta.height - 1));
  if (samplePixel(raster, nearPx, nearPy)[2] < 128) return null;

  const fx = x * (meta.width - 1);
  const fy = y * (meta.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, meta.width - 1);
  const y1 = Math.min(y0 + 1, meta.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const [r00, g00] = samplePixel(raster, x0, y0);
  const [r10, g10] = samplePixel(raster, x1, y0);
  const [r01, g01] = samplePixel(raster, x0, y1);
  const [r11, g11] = samplePixel(raster, x1, y1);
  const r = (r00 * (1 - tx) + r10 * tx) * (1 - ty) + (r01 * (1 - tx) + r11 * tx) * ty;
  const g = (g00 * (1 - tx) + g10 * tx) * (1 - ty) + (g01 * (1 - tx) + g11 * tx) * ty;
  const u = meta.u_min + (r / 255) * (meta.u_max - meta.u_min);
  const v = meta.v_min + (g / 255) * (meta.v_max - meta.v_min);
  return { u, v, speed: Math.hypot(u, v), valid_at: meta.valid_at ?? null };
}

export interface ClimateFieldClickResult {
  wind: ClimateFieldSample | null;
  currents: ClimateFieldSample | null;
}

/**
 * click 讀值入口：依開啟的圖層取樣風場/海流。兩者皆無效（陸地上的海流、
 * bbox 外）→ 回傳 null，讓呼叫端 fallback 回「清空 featureInfo」。
 */
export async function sampleClimateFields(
  want: { wind: boolean; currents: boolean },
  lon: number,
  lat: number,
): Promise<ClimateFieldClickResult | null> {
  const [wind, currents] = await Promise.all([
    want.wind
      ? getRaster(WIND_PNG, WIND_META).then((ras) => sampleAt(ras, lon, lat)).catch(() => null)
      : Promise.resolve(null),
    want.currents
      ? getRaster(CURRENTS_PNG, CURRENTS_META).then((ras) => sampleAt(ras, lon, lat)).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (!wind && !currents) return null;
  return { wind, currents };
}
