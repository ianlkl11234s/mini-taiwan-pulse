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
  8,
);

export const fetchLightningRecent = (minutes: number): Promise<LightningStrike[]> =>
  fetchLightningCached(String(clampMinutes(minutes)));

export const invalidateLightning = (): void => fetchLightningCached.invalidate();

// ── timeline 窗（v2 Phase B+，RPC 224）─────────────────────────
// key 用「ts 量化到最近 60s + halfMin」避免每次 throttle tick 都打 RPC
async function fetchLightningWindowUncached(
  centerTs: number,
  halfMin: number,
): Promise<LightningStrike[]> {
  const half = clampMinutes(halfMin);
  const { data, error } = await withLoading(
    `lightning:window:${centerTs}|${half}m`,
    `落雷 ±${half} 分鐘`,
    supabase.rpc("get_lightning_window", { center_ts: centerTs, half_min: half }),
  );
  if (error) throw new Error(`get_lightning_window: ${error.message}`);
  return (data ?? []) as LightningStrike[];
}

const fetchLightningWindowCached = cachedByKey<LightningStrike[]>(
  (key) => {
    const [ts, half] = key.split("|").map(Number);
    return fetchLightningWindowUncached(ts!, half!);
  },
  60_000,
  32, // 32 個量化 ts × halfMin 組合
);

/** 量化 ts 到最近 60s（scrub 時 60s 內視為同一查詢，cache hit）*/
export function quantiseLightningTs(ts: number): number {
  return Math.round(ts / 60) * 60;
}

export const fetchLightningWindow = (centerTs: number, halfMin: number): Promise<LightningStrike[]> =>
  fetchLightningWindowCached(`${quantiseLightningTs(centerTs)}|${clampMinutes(halfMin)}`);

export const invalidateLightningWindow = (): void => fetchLightningWindowCached.invalidate();

// ── day preload（v2 Phase B++，RPC 226）─────────────────────
// 整天落雷一次抓，前端 client-side filter + fade，scrub 不再打 server。
// 2026-06-26：分 raw + wrapped — prefetch 走 raw（背景靜默不灌 LOADING panel）。
async function fetchLightningDayRaw(dateKey: string): Promise<LightningStrike[]> {
  const { data, error } = await supabase.rpc("get_lightning_day", { date_key: dateKey });
  if (error) throw new Error(`get_lightning_day: ${error.message}`);
  return (data ?? []) as LightningStrike[];
}
const fetchLightningDayCached = cachedByKey<LightningStrike[]>(
  fetchLightningDayRaw,
  10 * 60_000,
  8, // 配合 timeline rangeDays 最高 7 + 1 spare
);
/** Foreground — 顯示 LOADING tracker。Hook 應該用這個載當前日。 */
export const fetchLightningDay = (dateKey: string): Promise<LightningStrike[]> =>
  withLoading(`lightning:day:${dateKey}`, `落雷 ${dateKey} 整日`, fetchLightningDayCached(dateKey));
/** Prefetch — 靜默，不灌 LOADING panel。與 fetchLightningDay 共用 cache。 */
export const prefetchLightningDay = (dateKey: string): Promise<LightningStrike[]> =>
  fetchLightningDayCached(dateKey);
export const invalidateLightningDay = (dateKey?: string): void =>
  fetchLightningDayCached.invalidate(dateKey);

/**
 * 計算落雷在 currentTs 看到的 alpha（0~1）：
 *  - age < 0：尚未發生，alpha 0
 *  - age < fadeInSec：淡入
 *  - age < lifeSec - fadeOutSec：全顯
 *  - age < lifeSec：淡出
 *  - age ≥ lifeSec：消失
 *
 * 設計：fadeIn 短（0.4s 感覺像「閃光」），fadeOut 長（總壽命的 40%）。
 */
export function lightningAlpha(
  strikeTs: number,
  currentTs: number,
  lifeSec: number,
  fadeInSec: number = 0.4,
): number {
  const age = currentTs - strikeTs;
  if (age < 0) return 0;
  if (age >= lifeSec) return 0;
  if (age < fadeInSec) return age / fadeInSec;
  const fadeOutSec = Math.max(0.1, lifeSec * 0.4);
  const fadeOutStart = lifeSec - fadeOutSec;
  if (age < fadeOutStart) return 1;
  return Math.max(0, (lifeSec - age) / fadeOutSec);
}

/**
 * 過濾事件並組成帶 alpha 的 FC，供 hook 每 tick setData 用。
 * 跳過 alpha = 0 的，避免 source 攜帶無謂 feature。
 */
export function toLightningFCAt(
  rows: LightningStrike[],
  currentTs: number,
  lifeSec: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const r of rows) {
    const a = lightningAlpha(r.strike_ts, currentTs, lifeSec);
    if (a <= 0) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        event_id: r.event_id,
        strike_ts: r.strike_ts,
        intensity_ka: r.intensity_ka,
        strike_type: r.strike_type,
        alpha: a,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

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
