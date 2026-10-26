// 各國颱風預報 loader（public.typhoon_agency_forecasts，gis-platform mig 476）
// NCDR 彙整 JTWC／JMA／NMC／CWA／KMA 五家預報路徑，每家每版 0/24/48/72/96/120 h 共 6 點。
// collector 每 30 分抓、同一發佈時間 DO NOTHING → 表裡是各家「每一版」，可回放。
//
// 時間軸語意：時刻 t 顯示每家「issued_at ≤ t 的最新一版」。靜態 filter 表達不了「最新」，
// 所以在這裡先幫每版算 [valid_from, valid_until)：valid_from＝issued_at、
// valid_until＝同家下一版 issued_at（沒有下一版則 issued_at + STALE_AFTER_SEC），
// hook 用 `valid_from ≤ t < valid_until` 篩，與颱風軌跡「現在位置」光圈同一招。
import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { TYPHOON_AGENCY_ORG, isTyphoonAgency, type TyphoonAgency } from "./typhoonTypes";

/** 實際資料端點（layer-plan §3）；彈窗 SourceFooter 的原始下載頁 */
const NCDR_SOURCE_URL = "https://satis.ncdr.nat.gov.tw/kml/multityroute.aspx";

export interface TyphoonAgencyForecastRow {
  agency: TyphoonAgency;
  track_index: number;
  issued_ts: number;
  issued_label: string;
  lead_hour: number;
  valid_ts: number;
  center_lat: number;
  center_lon: number;
  /** 配對到的颱風鍵；null＝該版 0 小時點 ±6h、300 km 內配不到觀測點（照畫、不掛名） */
  storm_key: string | null;
  matched_name_en: string | null;
}

interface RawRow {
  agency: string;
  track_index: number | null;
  issued_at: string;
  issued_label: string | null;
  lead_hour: number | null;
  valid_at: string;
  center_lat: number | string | null;
  center_lon: number | string | null;
  storm_key: string | null;
  matched_name_en: string | null;
}

/** 回看 14 天（與颱風軌跡同窗）；每版 30 列、只在有颱風時寫，量級數百列 */
const LOOKBACK_SEC = 14 * 24 * 3600;
const MAX_ROWS = 5000;
/**
 * 某家最新一版之後若再無新版，撐這麼久就不畫（颱風消散後 collector 不再有新版，
 * 避免舊預報永遠掛在地圖上）。各家約 6 小時一版，36 小時＝漏好幾版才算過期。
 */
export const AGENCY_FORECAST_STALE_AFTER_SEC = 36 * 3600;

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseAgencyForecastRows(rows: RawRow[]): TyphoonAgencyForecastRow[] {
  const out: TyphoonAgencyForecastRow[] = [];
  for (const r of rows) {
    const lat = toNum(r.center_lat);
    const lon = toNum(r.center_lon);
    const lead = toNum(r.lead_hour);
    if (!isTyphoonAgency(r.agency) || lat == null || lon == null || lead == null) continue;
    out.push({
      agency: r.agency,
      track_index: toNum(r.track_index) ?? 0,
      issued_ts: Math.floor(new Date(r.issued_at).getTime() / 1000),
      issued_label: r.issued_label ?? "",
      lead_hour: lead,
      valid_ts: Math.floor(new Date(r.valid_at).getTime() / 1000),
      center_lat: lat,
      center_lon: lon,
      storm_key: r.storm_key ?? null,
      matched_name_en: r.matched_name_en ?? null,
    });
  }
  return out;
}

async function fetchAgencyForecastsUncached(): Promise<TyphoonAgencyForecastRow[]> {
  const sinceIso = new Date(Date.now() - LOOKBACK_SEC * 1000).toISOString();
  const { data, error } = await withLoading(
    "typhoon-agency-forecasts",
    "各國颱風預報 NCDR",
    supabase
      .from("typhoon_agency_forecasts")
      .select("agency,track_index,issued_at,issued_label,lead_hour,valid_at,center_lat,center_lon,storm_key,matched_name_en")
      .gte("issued_at", sinceIso)
      .order("issued_at", { ascending: false })
      .limit(MAX_ROWS),
  );
  if (error) throw new Error(`Supabase typhoon_agency_forecasts: ${error.message}`);
  return parseAgencyForecastRows((data ?? []) as RawRow[]);
}

const fetchAgencyForecastsCached = cachedOnce(fetchAgencyForecastsUncached, 10 * 60_000);

export function fetchTyphoonAgencyForecasts(): Promise<TyphoonAgencyForecastRow[]> {
  return fetchAgencyForecastsCached();
}

/** 定期刷新用：清掉快取後重抓（圖層開著時才會呼叫） */
export function refetchTyphoonAgencyForecasts(): Promise<TyphoonAgencyForecastRow[]> {
  fetchAgencyForecastsCached.invalidate();
  return fetchAgencyForecastsCached();
}

/** 一家一版一條路徑（agency × track_index × issued_ts） */
export interface AgencyForecastTrack {
  agency: TyphoonAgency;
  track_index: number;
  issued_ts: number;
  issued_label: string;
  valid_from: number;
  valid_until: number;
  storm_key: string | null;
  matched_name_en: string | null;
  points: TyphoonAgencyForecastRow[];
}

export function groupAgencyTracks(rows: TyphoonAgencyForecastRow[]): AgencyForecastTrack[] {
  const byVersion = new Map<string, AgencyForecastTrack>();
  for (const r of rows) {
    const k = `${r.agency}::${r.track_index}::${r.issued_ts}`;
    let t = byVersion.get(k);
    if (!t) {
      t = {
        agency: r.agency, track_index: r.track_index, issued_ts: r.issued_ts, issued_label: r.issued_label,
        valid_from: r.issued_ts, valid_until: r.issued_ts + AGENCY_FORECAST_STALE_AFTER_SEC,
        storm_key: r.storm_key, matched_name_en: r.matched_name_en, points: [],
      };
      byVersion.set(k, t);
    }
    t.points.push(r);
    t.storm_key ??= r.storm_key;
    t.matched_name_en ??= r.matched_name_en;
  }
  const tracks = [...byVersion.values()];
  for (const t of tracks) t.points.sort((a, b) => a.lead_hour - b.lead_hour);
  // 同家同 track_index 依發佈時間排序，下一版的 issued_at 就是這版的 valid_until
  const series = new Map<string, AgencyForecastTrack[]>();
  for (const t of tracks) {
    const k = `${t.agency}::${t.track_index}`;
    const arr = series.get(k);
    if (arr) arr.push(t);
    else series.set(k, [t]);
  }
  for (const arr of series.values()) {
    arr.sort((a, b) => a.issued_ts - b.issued_ts);
    for (let i = 0; i < arr.length - 1; i++) {
      arr[i]!.valid_until = Math.min(arr[i]!.valid_until, arr[i + 1]!.issued_ts);
    }
  }
  return tracks.sort((a, b) => a.issued_ts - b.issued_ts);
}

/** 給圖例：時刻 t 各家正在顯示的那一版（沒有則不列） */
export function activeAgencyVersions(tracks: AgencyForecastTrack[], t: number): AgencyForecastTrack[] {
  return tracks.filter((tr) => tr.valid_from <= t && tr.valid_until > t);
}

export function agencyForecastsToGeoJSON(tracks: AgencyForecastTrack[]): {
  lines: GeoJSON.FeatureCollection;
  points: GeoJSON.FeatureCollection;
} {
  const lines: GeoJSON.Feature[] = [];
  const points: GeoJSON.Feature[] = [];
  for (const t of tracks) {
    const base = {
      agency: t.agency,
      track_index: t.track_index,
      issued_ts: t.issued_ts,
      issued_label: t.issued_label,
      valid_from: t.valid_from,
      valid_until: t.valid_until,
      storm_key: t.storm_key,
      matched_name_en: t.matched_name_en,
      label: `${t.agency.toUpperCase()} ${t.issued_label}`,
      source_org: TYPHOON_AGENCY_ORG,
      source_url: NCDR_SOURCE_URL,
    };
    if (t.points.length >= 2) {
      lines.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: t.points.map((p) => [p.center_lon, p.center_lat]) },
        properties: base,
      });
    }
    const lastLead = t.points[t.points.length - 1]?.lead_hour;
    for (const p of t.points) {
      points.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.center_lon, p.center_lat] },
        properties: { ...base, lead_hour: p.lead_hour, valid_ts: p.valid_ts, is_last: p.lead_hour === lastLead },
      });
    }
  }
  return {
    lines: { type: "FeatureCollection", features: lines },
    points: { type: "FeatureCollection", features: points },
  };
}
