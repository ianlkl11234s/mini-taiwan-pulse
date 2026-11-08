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

/**
 * 依民國年載入火災事件（一年 ~16k 筆）。
 * 讀 CDN 靜態快照（public.get_fire_events_by_year 的原樣輸出，每年一檔；111–113 年歷史資料不會再變）。
 */
export async function loadFireEventsByYear(year: number): Promise<FireEvent[]> {
  const cached = cache.get(year);
  if (cached) return cached;

  const { data, error } = await withLoading(
    `fire-events:${year}`,
    `火災 ${year}`,
    staticRpcFile<RawRow[]>(`/static-rpc/get_fire_events_by_year_${year}.json`),
  );

  if (error) {
    console.warn(`[Fire] year=${year} snapshot error:`, error.message);
    return [];
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
  return events;
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
