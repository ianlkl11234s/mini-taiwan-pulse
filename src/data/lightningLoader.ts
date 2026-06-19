import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey } from "../lib/loaderCache";

/**
 * 落雷 loader（RPC 214 get_lightning_recent(minutes)）
 *
 * - clamp 1~720 min（RPC 端再 clamp 一次）
 * - LIMIT 50000（雷雨季 1h 內可達數萬筆）
 * - 前端 cluster + zoom-gate 視覺由 overlayRegistry 處理
 * - cache TTL 60s（cron 1min 寫入，避免過度查詢）
 */

export interface LightningStrike {
  event_id: number;
  strike_ts: number;
  intensity_ka: number | null;
  strike_type: number; // 0=雲對地, 1=雲中
  lon: number;
  lat: number;
}

async function fetchLightningRecentUncached(minutes: number): Promise<LightningStrike[]> {
  const clamped = Math.min(720, Math.max(1, Math.floor(minutes)));
  const { data, error } = await withLoading(
    `lightning:${clamped}m`,
    `落雷最近 ${clamped} 分鐘`,
    supabase.rpc("get_lightning_recent", { minutes: clamped }),
  );
  if (error) throw new Error(`get_lightning_recent: ${error.message}`);
  return (data ?? []) as LightningStrike[];
}

const fetchLightningCached = cachedByKey<LightningStrike[]>(
  (key) => fetchLightningRecentUncached(Number(key)),
  60_000,
  8, // LRU 8 個不同 minutes 值（60 / 30 / 180 / ...）
);

export const fetchLightningRecent = (minutes: number): Promise<LightningStrike[]> =>
  fetchLightningCached(String(clampMinutes(minutes)));

export const invalidateLightning = (): void => fetchLightningCached.invalidate();

export function clampMinutes(m: number): number {
  if (!Number.isFinite(m)) return 60;
  return Math.min(720, Math.max(1, Math.floor(m)));
}

/** 0=雲對地（橘紅）/ 1=雲中（青）；對應 LegendPanel 配色 */
export const LIGHTNING_TYPE_COLORS: Record<number, string> = {
  0: "#fb923c", // 雲對地（CG）
  1: "#22d3ee", // 雲中（IC）
};

export const LIGHTNING_TYPE_LABELS: Record<number, string> = {
  0: "雲對地",
  1: "雲中",
};

export function lightningTypeColor(t: number | null | undefined): string {
  if (t == null) return "#9ca3af";
  return LIGHTNING_TYPE_COLORS[t] ?? "#9ca3af";
}

/** GeoJSON FeatureCollection — overlayRegistry 用（含 cluster source） */
export function toLightningFC(rows: LightningStrike[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        event_id: r.event_id,
        strike_ts: r.strike_ts,
        intensity_ka: r.intensity_ka,
        strike_type: r.strike_type,
      },
    })),
  };
}
