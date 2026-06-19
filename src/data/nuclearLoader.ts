import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

/**
 * 核安 loader（RPC 215 get_nuclear_radiation_status）
 *
 * 背景值 0.039~0.072 µSv/h（自然背景）
 * is_stale=true → 感測器離線，dose 值不可信（UI 必須區分「離線」與「真實警戒」）
 *
 * cache 5 min（CWA / AEC 寫入 ≥ 5 min interval）
 */

export interface NuclearStation {
  station_id: string;
  station_name: string;
  dose_usvh: number | null;
  is_stale: boolean;
  observed_ts: number;
  lon: number;
  lat: number;
}

async function fetchNuclearStatusUncached(): Promise<NuclearStation[]> {
  const { data, error } = await withLoading(
    "nuclear:status",
    "核安 51 站即時劑量",
    supabase.rpc("get_nuclear_radiation_status"),
  );
  if (error) throw new Error(`get_nuclear_radiation_status: ${error.message}`);
  return (data ?? []) as NuclearStation[];
}

const fetchNuclearCached = cachedOnce(fetchNuclearStatusUncached, 5 * 60_000);
export const fetchNuclearStatus = (): Promise<NuclearStation[]> => fetchNuclearCached();
export const invalidateNuclear = (): void => fetchNuclearCached.invalidate();

// ── timeline scrub（v2 Phase B+，RPC 225）─────────────────────
// 51 站每站約 5 min 一筆 measurement → 量化 ts 到最近 300s 就夠
async function fetchNuclearAtUncached(targetTs: number): Promise<NuclearStation[]> {
  const { data, error } = await withLoading(
    `nuclear:at:${targetTs}`,
    `核安 51 站 @ ${new Date(targetTs * 1000).toLocaleTimeString("zh-TW")}`,
    supabase.rpc("get_nuclear_radiation_at", { target_ts: targetTs }),
  );
  if (error) throw new Error(`get_nuclear_radiation_at: ${error.message}`);
  return (data ?? []) as NuclearStation[];
}

import { cachedByKey } from "../lib/loaderCache";
const fetchNuclearAtCached = cachedByKey<NuclearStation[]>(
  (key) => fetchNuclearAtUncached(Number(key)),
  5 * 60_000,
  16,
);

/** 量化 ts 到最近 300s（5min），nuclear 變化慢 cache 寬鬆 */
export function quantiseNuclearTs(ts: number): number {
  return Math.round(ts / 300) * 300;
}

export const fetchNuclearAt = (targetTs: number): Promise<NuclearStation[]> =>
  fetchNuclearAtCached(String(quantiseNuclearTs(targetTs)));

export const invalidateNuclearAt = (): void => fetchNuclearAtCached.invalidate();

/**
 * 劑量分級（µSv/h）：
 *  - normal: ≤ 0.072（自然背景上限）
 *  - watch: 0.072 ~ 0.2（略高於背景但仍安全）
 *  - warning: 0.2 ~ 0.5（持續觀察）
 *  - alarm: > 0.5（達 AEC 警戒）
 *  - stale: is_stale=true（任意劑量都歸 stale，灰色）
 *
 * 參考 AEC 即時劑量警示 0.5 µSv/h，國際 ICRP 公眾年劑量限值。
 */
export const NUCLEAR_DOSE_THRESHOLDS = {
  normal: 0.072,
  watch: 0.2,
  warning: 0.5,
} as const;

export type NuclearDoseLevel = "normal" | "watch" | "warning" | "alarm" | "stale";

export const NUCLEAR_LEVEL_COLORS: Record<NuclearDoseLevel, string> = {
  normal: "#22c55e",
  watch: "#facc15",
  warning: "#f97316",
  alarm: "#ef4444",
  stale: "#6b7280",
};

export const NUCLEAR_LEVEL_LABELS: Record<NuclearDoseLevel, string> = {
  normal: "正常",
  watch: "略高",
  warning: "觀察",
  alarm: "警戒",
  stale: "離線",
};

export function classifyNuclearDose(
  dose: number | null | undefined,
  isStale: boolean,
): NuclearDoseLevel {
  if (isStale) return "stale";
  if (dose == null) return "stale";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.normal) return "normal";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.watch) return "watch";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.warning) return "warning";
  return "alarm";
}

export function nuclearDoseColor(
  dose: number | null | undefined,
  isStale: boolean,
): string {
  return NUCLEAR_LEVEL_COLORS[classifyNuclearDose(dose, isStale)];
}

export function toNuclearFC(rows: NuclearStation[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => {
      const level = classifyNuclearDose(r.dose_usvh, r.is_stale);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: {
          station_id: r.station_id,
          station_name: r.station_name,
          dose_usvh: r.dose_usvh,
          is_stale: r.is_stale,
          observed_ts: r.observed_ts,
          level,
        },
      };
    }),
  };
}
