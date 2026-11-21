import { staticRpc, staticRpcFile } from "./staticRpc";
import { withLoading } from "../lib/loadingRegistry";

export interface FireEvent {
  case_id: string;
  occurred_ts: number; // unix sec
  longitude: number;
  latitude: number;
  county: string | null;
  township: string | null;
  cause: string | null;
  deaths: number;
  injuries: number;
  month: number | null;
  hour: number | null;
  response_minutes: number | null;
}

interface RawRow {
  c: string;
  t: number;
  lng: number;
  lat: number;
  cn: string | null;
  tw: string | null;
  cs: string | null;
  d: number | null;
  i: number | null;
  m: number | null;
  h: number | null;
  rm: number | null;
}

const cache = new Map<number, FireEvent[]>();

/** 讀年檔的結果：`error` 非 null＝讀取失敗（和「該年真的沒有資料」的空陣列分開）。 */
export interface FireYearResult {
  events: FireEvent[];
  error: string | null;
}

/**
 * 依民國年載入火災事件（一年 ~16k 筆），回傳結果與錯誤。
 * 讀 CDN 靜態快照（public.get_fire_events_by_year 的原樣輸出，每年一檔；111–113 年歷史資料不會再變）。
 * 失敗不進快取，再呼叫一次就是重試（長期時間條的「重試」用這支）。
 */
export async function loadFireEventsByYearResult(year: number): Promise<FireYearResult> {
  const cached = cache.get(year);
  if (cached) return { events: cached, error: null };

  const { data, error } = await withLoading(
    `fire-events:${year}`,
    `火災 ${year}`,
    staticRpcFile<RawRow[]>(`/static-rpc/get_fire_events_by_year_${year}.json`),
  );

  if (error) {
    console.warn(`[Fire] year=${year} snapshot error:`, error.message);
    return { events: [], error: error.message };
  }

  const rows = data ?? [];
  const events: FireEvent[] = rows.map((r) => ({
    case_id: r.c,
    occurred_ts: Number(r.t),
    longitude: Number(r.lng),
    latitude: Number(r.lat),
    county: r.cn,
    township: r.tw,
    cause: r.cs,
    deaths: r.d ?? 0,
    injuries: r.i ?? 0,
    month: r.m,
    hour: r.h,
    response_minutes: r.rm,
  }));
  cache.set(year, events);
  console.log(`[Fire] year=${year}: ${events.length} events`);
  return { events, error: null };
}

/** 依民國年載入火災事件；讀取失敗回空陣列（歷史模式與最新年度圖層沿用的舊介面）。 */
export async function loadFireEventsByYear(year: number): Promise<FireEvent[]> {
  return (await loadFireEventsByYearResult(year)).events;
}

/** 取可用年份（前端可動態擴展 scrubber 範圍） */
export async function loadFireEventYears(): Promise<{ year: number; n: number }[]> {
  const { data, error } = await withLoading(
    "fire:years",
    "火災年份",
    staticRpc<{ year: number; n: number }[]>("get_fire_event_years"),
  );
  if (error || !data) {
    console.warn(`[Fire] get_fire_event_years error:`, error?.message);
    return [];
  }
  return data.map((r) => ({
    year: Number(r.year),
    n: Number(r.n),
  }));
}
