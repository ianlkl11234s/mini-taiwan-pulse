// 菲律賓空品（OpenAQ v3）：Supabase RPC get_openaq_latest（gis-platform mig 563，資料表 mig 561，collector openaq 每小時）。
// 比照 LASS 微型感測（microSensorsLoader）：PM2.5 色階共用 MICRO_SENSOR_PM25_BANDS、缺值中性灰，顏色在 loader 預烤進 properties；
// 比照加拿大即時地震（caLiveQuakesLoader）：狀態 store 給圖例顯示站數與錯誤、請求世代防舊請求覆寫。
//
// 語意鐵則：
//   * value NULL＝無資料（不是 0）；資料裡有真實的 0.0，判斷一律用 != null。
//   * is_monitor=false＝低價感測器（非官方測站），圖例與 popup 都要明示；官方監測站另用白色粗框。
//   * 隱藏「近 30 天沒有資料」的站（站主 2026-11-20 決定；LASS 層 RPC 只回 15 分鐘內的點，沒有停更站先例）。
//   * 量測時間超過 3 小時＝過舊，點淡化、popup 標示；以「現在」計算，每次輪詢重建。

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { MICRO_SENSOR_NO_DATA_COLOR, microSensorPm25Color } from "./microSensorTypes";
import type { L3 } from "./caInfraTypes";

export const PH_OPENAQ_LATEST_RPC = "get_openaq_latest";
export const PH_OPENAQ_SERIES_RPC = "get_openaq_location_series";
export const PH_OPENAQ_COUNTRY = "PH";
/** RPC 時間窗（小時）：對齊收集器只寫 48 小時內的最新值；上游本身晚 1–2 小時。 */
export const PH_OPENAQ_WINDOW_HOURS = 48;
/** 超過這個時數的量測標「過舊」。 */
export const PH_OPENAQ_STALE_HOURS = 3;
/** 近這麼多天都沒有資料的站不畫。 */
export const PH_OPENAQ_HIDE_AFTER_DAYS = 30;
/** 輪詢間隔：上游每小時更新，10 分鐘足夠。 */
export const PH_OPENAQ_POLL_MS = 10 * 60_000;
export const PH_OPENAQ_NO_DATA_COLOR = MICRO_SENSOR_NO_DATA_COLOR;
/** 官方監測站的外框色（低價感測器用一般細框）。 */
export const PH_OPENAQ_MONITOR_RING = "#ffffff";

export const PH_OPENAQ_SOURCE = {
  org: "OpenAQ",
  url: "https://explore.openaq.org/",
  short: "OpenAQ（各站原始提供者署名見 popup）",
} as const;

export interface PhOpenaqStation {
  locationId: number;
  name: string | null;
  locality: string | null;
  providerName: string | null;
  ownerName: string | null;
  isMonitor: boolean;
  licenseNames: string | null;
  attributionName: string | null;
  attributionUrl: string | null;
  lon: number;
  lat: number;
  datetimeLast: string | null;
  observedAt: string | null;
  pm25: number | null;
  pm25ObservedAt: string | null;
  pm10: number | null;
  pm1: number | null;
  temperature: number | null;
  humidity: number | null;
  um003: number | null;
}

/** 只接受有限數字；null／undefined／空字串／非數字一律 null（避免 Number(null)＝0）。 */
export function finiteOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const timeMs = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

export function normalizePhOpenaqRows(rows: unknown): PhOpenaqStation[] {
  if (!Array.isArray(rows)) return [];
  const out: PhOpenaqStation[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const lon = finiteOrNull(raw.lon);
    const lat = finiteOrNull(raw.lat);
    const id = finiteOrNull(raw.location_id);
    if (lon == null || lat == null || id == null) continue; // 不合成座標
    out.push({
      locationId: id,
      name: strOrNull(raw.name),
      locality: strOrNull(raw.locality),
      providerName: strOrNull(raw.provider_name),
      ownerName: strOrNull(raw.owner_name),
      isMonitor: raw.is_monitor === true,
      licenseNames: strOrNull(raw.license_names),
      attributionName: strOrNull(raw.attribution_name),
      attributionUrl: strOrNull(raw.attribution_url),
      lon, lat,
      datetimeLast: strOrNull(raw.datetime_last),
      observedAt: strOrNull(raw.observed_at),
      pm25: finiteOrNull(raw.pm25),
      pm25ObservedAt: strOrNull(raw.pm25_observed_at),
      pm10: finiteOrNull(raw.pm10),
      pm1: finiteOrNull(raw.pm1),
      temperature: finiteOrNull(raw.temperature),
      humidity: finiteOrNull(raw.humidity),
      um003: finiteOrNull(raw.um003),
    });
  }
  return out;
}

/** 站的最後活動時間：RPC 時間窗內最新量測與 OpenAQ datetime_last 取較新者（datetime_last 會比 /latest 晚更新）。 */
export function phOpenaqLastSeenMs(s: Pick<PhOpenaqStation, "observedAt" | "datetimeLast">): number | null {
  const a = timeMs(s.observedAt);
  const b = timeMs(s.datetimeLast);
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/** 近 30 天有資料才畫；兩個時間都沒有（例：Spartan 站 datetime_last NULL）＝隱藏。 */
export function phOpenaqVisible(s: Pick<PhOpenaqStation, "observedAt" | "datetimeLast">, nowMs: number): boolean {
  const seen = phOpenaqLastSeenMs(s);
  return seen != null && nowMs - seen <= PH_OPENAQ_HIDE_AFTER_DAYS * 86_400_000;
}

export type PhOpenaqFreshness = "fresh" | "stale" | "noData";

/** PM2.5 的新鮮度：沒有 PM2.5 值＝noData；量測超過 3 小時＝stale。 */
export function phOpenaqFreshness(s: Pick<PhOpenaqStation, "pm25" | "pm25ObservedAt">, nowMs: number): PhOpenaqFreshness {
  if (s.pm25 == null) return "noData";
  const t = timeMs(s.pm25ObservedAt);
  if (t == null) return "noData";
  return nowMs - t > PH_OPENAQ_STALE_HOURS * 3_600_000 ? "stale" : "fresh";
}

/** 過舊判斷（popup 以開啟當下的 now 現算）。 */
export function phOpenaqIsStale(iso: string | null, nowMs: number): boolean {
  const t = timeMs(iso);
  return t != null && nowMs - t > PH_OPENAQ_STALE_HOURS * 3_600_000;
}

export interface PhOpenaqSummary { shown: number; hidden: number; fresh: number; stale: number; noData: number; monitorsShown: number; monitorsHidden: number }

/** GeoJSON：顏色、新鮮度、隱藏規則都在這裡算好；paint 只 get，不在表達式裡 to-number（null 會變 0）。 */
export function buildPhOpenaqGeoJSON(stations: PhOpenaqStation[], nowMs: number): { fc: GeoJSON.FeatureCollection<GeoJSON.Point>; summary: PhOpenaqSummary } {
  const summary: PhOpenaqSummary = { shown: 0, hidden: 0, fresh: 0, stale: 0, noData: 0, monitorsShown: 0, monitorsHidden: 0 };
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const s of stations) {
    if (!phOpenaqVisible(s, nowMs)) {
      summary.hidden += 1;
      if (s.isMonitor) summary.monitorsHidden += 1;
      continue;
    }
    const freshness = phOpenaqFreshness(s, nowMs);
    summary.shown += 1;
    summary[freshness] += 1;
    if (s.isMonitor) summary.monitorsShown += 1;
    // properties 不放 null：Mapbox 會丟掉 null 屬性，popup 端以「不存在＝無資料」解讀
    const props: Record<string, unknown> = {
      location_id: s.locationId,
      is_monitor: s.isMonitor,
      freshness,
      color: freshness === "noData" ? PH_OPENAQ_NO_DATA_COLOR : microSensorPm25Color(s.pm25),
    };
    const put = (k: string, v: string | number | null) => { if (v != null) props[k] = v; };
    put("name", s.name); put("locality", s.locality); put("provider_name", s.providerName); put("owner_name", s.ownerName);
    put("license_names", s.licenseNames); put("attribution_name", s.attributionName); put("attribution_url", s.attributionUrl);
    put("datetime_last", s.datetimeLast); put("observed_at", s.observedAt);
    put("pm25", s.pm25); put("pm25_observed_at", s.pm25ObservedAt); put("pm10", s.pm10); put("pm1", s.pm1);
    put("temperature", s.temperature); put("humidity", s.humidity); put("um003", s.um003);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: props });
  }
  return { fc: { type: "FeatureCollection", features }, summary };
}

// ── 狀態 store（圖例用 useSyncExternalStore 讀） ──

export interface PhOpenaqStatus {
  state: "idle" | "loading" | "ready" | "error";
  summary: PhOpenaqSummary | null;
  error: string | null;
}

let status: PhOpenaqStatus = { state: "idle", summary: null, error: null };
const listeners = new Set<() => void>();
const setStatus = (next: PhOpenaqStatus) => { status = next; listeners.forEach((l) => l()); };
export const phOpenaqStatus = {
  get: () => status,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

let requestGen = 0;

/** 抓最新快照並建 GeoJSON；失敗寫進狀態並丟錯（呼叫端清空 source，不留舊資料）。 */
export async function fetchPhOpenaqLatest(nowMs = Date.now()): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const gen = ++requestGen;
  const setIfLatest = (next: PhOpenaqStatus) => { if (gen === requestGen) setStatus(next); };
  setStatus({ ...status, state: "loading", error: null });
  try {
    const { data, error } = await withLoading(
      "ph-openaq:latest",
      "菲律賓空品（OpenAQ）",
      supabase.rpc(PH_OPENAQ_LATEST_RPC, { p_country: PH_OPENAQ_COUNTRY, p_hours: PH_OPENAQ_WINDOW_HOURS }),
    );
    if (error) throw new Error(`${PH_OPENAQ_LATEST_RPC}: ${error.message}`);
    const { fc, summary } = buildPhOpenaqGeoJSON(normalizePhOpenaqRows(data), nowMs);
    setIfLatest({ state: "ready", summary, error: null });
    return fc;
  } catch (e) {
    setIfLatest({ state: "error", summary: null, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

export interface PhOpenaqSeriesPoint { t: number; v: number }

/** 單站近 7 天 PM2.5 走勢（popup）：NULL 值丟掉、不畫成 0；回傳時間遞增。 */
export function toPhOpenaqPm25Series(rows: unknown): PhOpenaqSeriesPoint[] {
  if (!Array.isArray(rows)) return [];
  const pts: PhOpenaqSeriesPoint[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    if (r.parameter !== "pm25") continue;
    const v = finiteOrNull(r.value);
    const t = timeMs(strOrNull(r.observed_at));
    if (v == null || t == null) continue;
    pts.push({ t: Math.floor(t / 1000), v });
  }
  return pts.sort((a, b) => a.t - b.t);
}

export async function fetchPhOpenaqSeries(locationId: number, days = 7): Promise<PhOpenaqSeriesPoint[]> {
  const { data, error } = await withLoading(
    `ph-openaq:series:${locationId}`,
    "菲律賓空品走勢",
    supabase.rpc(PH_OPENAQ_SERIES_RPC, { p_location_id: locationId, p_days: days }),
  );
  if (error) throw new Error(`${PH_OPENAQ_SERIES_RPC}: ${error.message}`);
  return toPhOpenaqPm25Series(data);
}

/** 圖例與 popup 共用的說明（三語）。 */
export const PH_OPENAQ_NOTES: readonly L3[] = [
  { zh: "低價感測器（Clarity、AirGradient 等）由民間或地方單位設置，非官方監測站，數值未經官方校正，僅供參考。", en: "Low-cost sensors (Clarity, AirGradient, etc.) are run by community groups or local offices. They are not official monitors and readings are not officially calibrated.", ja: "低価格センサー（Clarity、AirGradient など）は民間・自治体が設置したもので公式測定局ではなく、公式な校正を経ていない参考値です。" },
  { zh: `僅顯示近 ${PH_OPENAQ_HIDE_AFTER_DAYS} 天有資料的測站。`, en: `Only stations with data in the last ${PH_OPENAQ_HIDE_AFTER_DAYS} days are shown.`, ja: `直近 ${PH_OPENAQ_HIDE_AFTER_DAYS} 日にデータがある局のみ表示。` },
  { zh: "上游約晚 1–2 小時；每 10 分鐘重抓。", en: "Upstream lags about 1–2 hours; refreshed every 10 minutes.", ja: "上流は約 1–2 時間遅れ。10 分ごとに再取得。" },
];
