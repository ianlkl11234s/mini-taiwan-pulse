/**
 * aqiImageryLoader — 載入 airtw 色階 raster 影像（Supabase RPC）
 *
 * 對照 cwaImageryLoader：單次 RPC 回 metadata + base64，避開 N 個並發 fetch。
 * 差異：
 *  - 一次只載 1 個 product（AQI / PM25 / ...）；切換產品時呼叫端須 revoke 舊 objectURL。
 *  - bbox 固定全台（由 RPC 硬編回傳）。
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { base64ToObjectUrl } from "./cwaImageryLoader";
import type { AqiProduct } from "../types";

export interface AqiImageryFrame {
  product: AqiProduct;
  observedAtIso: string;
  observedAtMs: number;
  mimeType: string;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  imageSize: number;
}

export interface AqiImageryBundle {
  product: AqiProduct;
  frames: AqiImageryFrame[];             // 依 observedAtMs 升序
  urls: Map<string, string>;             // observedAtIso → object URL
}

interface RawRow {
  product_type: string;
  observed_at: string;
  mime_type: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  image_b64: string;
}

/**
 * 載入指定產品過去 sinceHours 小時的 frames。
 * 回傳的 urls 由 caller 負責 revokeObjectURL。
 */
export async function loadAqiImageryBatch(
  product: AqiProduct,
  sinceHours: number,
): Promise<AqiImageryBundle> {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const key = `aqi-imagery-batch:${product}`;
  const label = `空氣品質色階 ${product}`;

  const { data, error } = await withLoading(
    key,
    label,
    supabase.rpc("get_aqi_imagery_frames_batch", {
      p_product: product,
      p_since: since,
    }),
  );

  if (error) throw new Error(`get_aqi_imagery_frames_batch(${product}): ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const frames: AqiImageryFrame[] = [];
  const urls = new Map<string, string>();

  for (const r of rows) {
    frames.push({
      product,
      observedAtIso: r.observed_at,
      observedAtMs: new Date(r.observed_at).getTime(),
      mimeType: r.mime_type,
      lonMin: r.lon_min,
      lonMax: r.lon_max,
      latMin: r.lat_min,
      latMax: r.lat_max,
      imageSize: r.image_b64.length,
    });
    urls.set(r.observed_at, base64ToObjectUrl(r.image_b64, r.mime_type));
  }

  frames.sort((a, b) => a.observedAtMs - b.observedAtMs);
  return { product, frames, urls };
}
