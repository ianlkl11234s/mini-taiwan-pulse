import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 新聞事件 (CNA 等來源 geocoded) loader
 * - 來源：Supabase RPC get_news_events_day(p_day) / get_news_event_dates()
 * - Supabase 未設定時 fallback 靜態檔 ./geo/news_events.geojson（舊行為：全量、不分日）
 * - properties 形狀與 public/geo/news_events.geojson 完全相同，
 *   下游（overlayRegistry newsEvents / useNewsTimeline / NewsEventPanel）零改動
 */

export interface NewsEventDateInfo {
  day: string; // "YYYY-MM-DD"
  event_count: number;
}

interface RawRow {
  id: number;
  source: string | null;
  url: string | null;
  title: string | null;
  summary: string | null;
  category: string | null;
  location_name: string | null;
  county: string | null;
  lon: number | null;
  lat: number | null;
  published_ts: string | null; // timestamptz → ISO string
  confidence: number | null;
}

const STATIC_URL = "./geo/news_events.geojson";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function formatPublished(tsSec: number): string {
  if (!tsSec) return "";
  return new Date(tsSec * 1000).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

/** RPC rows → 與靜態檔相同 properties 形狀的 FeatureCollection */
function rowsToGeoJSON(rows: RawRow[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (r.lon == null || r.lat == null) continue;
    const tsSec = r.published_ts ? Math.floor(Date.parse(r.published_ts) / 1000) : 0;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        // ── 與 public/geo/news_events.geojson 完全相同的欄位（下游契約） ──
        title: r.title ?? "",
        summary: r.summary ?? "",
        category: r.category ?? "",
        rss_category: "",
        link: r.url ?? "",
        published: formatPublished(tsSec),
        location_name: r.location_name ?? "",
        location_type: "",
        confidence: r.confidence ?? 0,
        note: "",
        is_primary: true, // RPC 每事件僅一點，皆為主要地點
        published_ts: tsSec, // unix 秒（useNewsTimeline filter 用）
        // ── RPC 額外欄位（additive，不影響既有下游） ──
        id: r.id,
        source: r.source ?? "",
        county: r.county ?? "",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

// ── 靜態 fallback（Supabase 未設定時，維持舊「全量單檔」行為） ──

async function fetchStaticNewsEventsUncached(): Promise<GeoJSON.FeatureCollection> {
  const fc = await withLoading(
    "news-events:static",
    "新聞事件",
    fetch(STATIC_URL).then((r) => {
      if (!r.ok) throw new Error(`fetch ${STATIC_URL}: HTTP ${r.status}`);
      return r.json() as Promise<GeoJSON.FeatureCollection>;
    }),
  );
  return fc ?? EMPTY_FC;
}

const fetchStaticNewsEventsCached = cachedOnce(fetchStaticNewsEventsUncached, 15 * 60_000);

// ── 日期清單 ──

async function fetchNewsEventDatesUncached(): Promise<NewsEventDateInfo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_news_event_dates");
  if (error) throw new Error(`get_news_event_dates: ${error.message}`);
  return (data ?? []) as NewsEventDateInfo[];
}

const fetchNewsEventDatesCached = cachedOnce(fetchNewsEventDatesUncached, 10 * 60_000);

/** 取有新聞事件的日期清單。10min TTL 快取，toggle 不重抓 */
export function fetchNewsEventDates(): Promise<NewsEventDateInfo[]> {
  return fetchNewsEventDatesCached();
}

// ── 按日載入 ──

async function fetchNewsEventsDayUncached(date: string): Promise<GeoJSON.FeatureCollection> {
  if (!supabaseConfigured) return fetchStaticNewsEventsCached();

  const t0 = performance.now();
  const { data, error } = await withLoading(
    `news-events:${date}`,
    `新聞事件 ${date}`,
    supabase.rpc("get_news_events_day", { p_day: date }),
  );
  if (error) throw new Error(`get_news_events_day(${date}): ${error.message}`);

  const fc = rowsToGeoJSON((data ?? []) as RawRow[]);
  console.log(
    `[NewsEvents] Loaded ${fc.features.length} events for ${date} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return fc;
}

const fetchNewsEventsDayCached = cachedByKey(fetchNewsEventsDayUncached, 10 * 60_000);

/** 取指定日期的新聞事件 FeatureCollection。10min TTL + LRU 快取，toggle / 重回日期不重抓 */
export function fetchNewsEventsDay(date: string): Promise<GeoJSON.FeatureCollection> {
  return fetchNewsEventsDayCached(date);
}
