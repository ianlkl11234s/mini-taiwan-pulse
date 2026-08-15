// USGS 全球地震 loader（from public.earthquakes_global view，migration 261）
import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

/**
 * 「回溯天數」選項（SSOT）—— 圖層參數 select 與本 loader 的查詢窗共用同一份。
 * 1 = 僅顯示當日（台北日界）；其餘為 timeline 游標往前的滾動視窗。
 * DB 現有 46 天（日均 ~180 筆），30 天撐得住。
 */
export const EARTHQUAKE_GLOBAL_DAY_OPTIONS = [1, 3, 7, 14, 30] as const;
export const EARTHQUAKE_GLOBAL_DAYS_DEFAULT = 14;

/**
 * 查詢窗比顯示窗多抓的天數。
 *
 * 查詢窗錨在 **timeline 選定日**（不是掛鐘現在）—— 往回拉日期時顯示窗整段跟著往前移，
 * 錨在掛鐘就會讓最舊那幾天靜默空掉（使用者看到「越往回拉地震越少」，比報錯更糟）。
 *
 * 錨定後仍留 7 天緩衝的理由：日期通知走 debounce（`dateNotifier` quietMs 300，
 * 見 timeStore），連續 scrub 跨多日時錨點會短暫落後於游標；緩衝讓那段過渡期
 * 仍有資料可畫。7 天 = 全域 timeline 視窗上限（`timeStore.setRangeDays`）。
 */
const FETCH_SLACK_DAYS = 7;

/**
 * 安全上限。錨定日 + 30 天 + 7 天緩衝約 6.6k 筆，此值純粹防呆。
 *
 * ⚠️ 觸頂時 `order desc` 丟掉的是**最舊的**（正是往回拉時要看的那段）。查詢**不設上界**
 * （抓到比錨定日更新的資料無害，filter 本來就會擋），所以 DB 保留天數若日後遠超過
 * 60 天，這裡要補 `.lt("observed_at", 錨定日+緩衝)` 把查詢窗兩端都夾住。
 */
const MAX_ROWS = 12000;

/** 台北日 key（YYYY-MM-DD）→ 該日 00:00 的 unix 秒。與 timeStore.getDateKey() 同一套日界 */
function taipeiDayKeyToUnix(dateKey: string): number | null {
  const ms = Date.parse(`${dateKey}T00:00:00+08:00`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export interface EarthquakeGlobalEvent {
  event_id: string;
  mag: number;
  place: string;
  depth_km: number;
  lng: number;
  lat: number;
  observed_ts: number; // unix seconds
}

type GeomLike =
  | { type: string; coordinates: [number, number, number?] }
  | string
  | null
  | undefined;

interface RawRow {
  event_id: string;
  mag: number | null;
  place: string | null;
  observed_at: string;
  depth_km: number | null;
  geom?: GeomLike;
}

function extractLngLat(geom: GeomLike): [number, number] | null {
  if (!geom) return null;
  if (typeof geom === "object" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [Number(lng), Number(lat)];
  }
  return null;
}

async function fetchEarthquakesGlobalUncached(
  days: number,
  dateKey: string,
): Promise<EarthquakeGlobalEvent[]> {
  const t0 = performance.now();
  // 顯示窗下界 = 游標 - N 天，而游標最早落在錨定日 00:00 → 查詢下界從錨定日 00:00 起算
  const anchorStart = taipeiDayKeyToUnix(dateKey) ?? Math.floor(Date.now() / 1000);
  const sinceIso = new Date((anchorStart - (days + FETCH_SLACK_DAYS) * 86400) * 1000).toISOString();
  const { data, error } = await withLoading(
    // id 帶天數 + 日期：快速切換選項／日期時，前一發 fetch 的 end() 不會把後一發的 loading 提早關掉
    `earthquakes-global-d${days}-${dateKey}`,
    "全球地震 USGS",
    supabase
      .from("earthquakes_global")
      .select("event_id,mag,place,observed_at,depth_km,geom")
      .gte("observed_at", sinceIso)
      .order("observed_at", { ascending: false })
      .limit(MAX_ROWS),
  );
  if (error) throw new Error(`Supabase earthquakes_global: ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  if (rows.length >= MAX_ROWS) {
    console.warn(`[EarthquakesGlobal] 觸頂 ${MAX_ROWS} 筆（錨定 ${dateKey} 回溯 ${days} 天），最舊的資料已被截斷`);
  }
  const events: EarthquakeGlobalEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (r.mag == null) { skipped++; continue; }
    const ll = extractLngLat(r.geom);
    if (!ll) { skipped++; continue; }
    events.push({
      event_id: r.event_id,
      mag: Number(r.mag),
      place: r.place ?? "",
      depth_km: r.depth_km == null ? 0 : Number(r.depth_km),
      lng: ll[0],
      lat: ll[1],
      observed_ts: Math.floor(new Date(r.observed_at).getTime() / 1000),
    });
  }
  console.log(`[EarthquakesGlobal] Loaded ${events.length} events (skipped ${skipped}, ${days}d @${dateKey}) in ${(performance.now() - t0).toFixed(0)}ms`);
  return events;
}

// 查詢有參數了 → keyedThunkCache（key = 回溯天數 + 錨定日）；
// 切回抓過的組合不重打 DB。16 筆 LRU ≈ 一次 session 內 scrub 幾天 × 幾種天數。
const earthquakesGlobalCache = keyedThunkCache<EarthquakeGlobalEvent[]>(10 * 60_000, 16);

/**
 * @param days    回溯天數（顯示窗長度；查詢窗 = days + 緩衝）
 * @param dateKey 錨定日（YYYY-MM-DD，台北時區）—— 傳 `timeStore.getDateKey()`
 */
export function fetchEarthquakesGlobal(
  days: number = EARTHQUAKE_GLOBAL_DAYS_DEFAULT,
  dateKey: string,
): Promise<EarthquakeGlobalEvent[]> {
  const d = Number.isFinite(days) ? Math.max(1, Math.min(90, Math.round(days))) : EARTHQUAKE_GLOBAL_DAYS_DEFAULT;
  return earthquakesGlobalCache(`d${d}_${dateKey}`, () => fetchEarthquakesGlobalUncached(d, dateKey));
}

export function earthquakesGlobalToGeoJSON(events: EarthquakeGlobalEvent[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lng, e.lat] },
      properties: {
        event_id: e.event_id,
        mag: e.mag,
        place: e.place,
        depth_km: e.depth_km,
        observed_ts: e.observed_ts,
      },
    })),
  };
}
