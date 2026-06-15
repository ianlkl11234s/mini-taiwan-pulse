import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 新聞事件 (CNA 等來源 geocoded) loader
 * - 來源：Supabase RPC get_news_events_day_clustered（階段 B：按鄉鎮聚合）
 *         + get_news_event_dates（日期清單）
 * - Supabase 未設定時 fallback 靜態檔 ./geo/news_events.geojson
 *
 * 階段 B 輸出 properties（每個 Feature 代表一個鄉鎮 cluster）：
 *  - title/summary/category/link/published/published_ts/confidence/is_primary
 *    皆對應該 cluster「最新一則」事件（向後相容既有 useNewsTimeline filter + popup）
 *  - event_count：cluster 內事件數（給 paint 半徑放大用）
 *  - events_json：jsonb 字串，含整批事件清單（給 popup 多則清單渲染）
 */

export interface NewsEventDateInfo {
  day: string; // "YYYY-MM-DD"
  event_count: number;
}

/** RPC get_news_events_day_clustered_v2 回傳 row */
export interface RawCluster {
  lon: number | null;
  lat: number | null;
  county: string | null;
  location_name: string | null;
  event_count: number | null;
  latest_category: string | null;
  latest_published_ts: string | null; // timestamptz → ISO string
  max_severity: number | null;
  max_gis_relevance: number | null;
  events: ClusterEvent[] | null;       // jsonb array
}

/** events_json 內每一則的 shape（RPC jsonb_build_object 對齊） */
export interface ClusterEvent {
  id: number;
  title: string;
  summary: string | null;
  category: string | null;
  source: string | null;
  url: string | null;
  /** unix 秒（RPC 已 extract epoch） */
  published_ts: number;
  confidence: number | null;
  /** v2（migration 164/165）：可能為 null（舊資料未評估） */
  gis_relevance: number | null;
  severity: number | null;
  is_event: boolean | null;
}

/** 篩選參數（三軸，照 Intel Panel 設計） */
export interface NewsFilter {
  /** 0 全部 / 2 地方+ / 3 重大（RPC p_min_gis_relevance） */
  minRelevance: 0 | 2 | 3;
  /** true 只看事件，false 含聲明（RPC p_require_event） */
  eventsOnly: boolean;
  /** 0 全部 / 1 個案+ / 2 區域+（RPC p_min_severity） */
  minSeverity: 0 | 1 | 2;
}

/** 預設 ≈ 舊「important」 */
export const DEFAULT_NEWS_FILTER: NewsFilter = {
  minRelevance: 2,
  eventsOnly: true,
  minSeverity: 1,
};

const STATIC_URL = "./geo/news_events.geojson";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function formatPublished(tsSec: number): string {
  if (!tsSec) return "";
  return new Date(tsSec * 1000).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

/** Clustered RPC rows → FeatureCollection（每個 Feature 是一個鄉鎮 cluster） */
function clustersToGeoJSON(rows: RawCluster[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (r.lon == null || r.lat == null) continue;
    const events = (r.events ?? []) as ClusterEvent[];
    if (events.length === 0) continue;
    const latest = events[0]; // RPC 已按 published_ts DESC 排
    if (!latest) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        // ── 向後相容欄位（既有 useNewsTimeline filter、舊版 popup、paint 都讀這些） ──
        title: latest.title ?? "",
        summary: latest.summary ?? "",
        category: r.latest_category ?? latest.category ?? "",
        rss_category: "",
        link: latest.url ?? "",
        published: formatPublished(latest.published_ts ?? 0),
        location_name: r.location_name ?? "",
        location_type: "",
        confidence: latest.confidence ?? 0,
        note: "",
        is_primary: true,
        published_ts: latest.published_ts ?? 0, // unix 秒（useNewsTimeline filter 用）
        // ── 階段 B 新增 ──
        event_count: r.event_count ?? events.length,
        county: r.county ?? "",
        events_json: JSON.stringify(events), // popup 多則清單渲染
        // ── 階段 B+ 新增（migration 165 v2）：給 paint 條件式判斷 critical ──
        max_severity: r.max_severity ?? latest.severity ?? 0,
        max_gis_relevance: r.max_gis_relevance ?? latest.gis_relevance ?? 0,
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

async function fetchNewsEventsDayUncached(cacheKey: string): Promise<GeoJSON.FeatureCollection> {
  // cacheKey 格式："YYYY-MM-DD|<gr>|<ev>|<sv>"
  const [date, gr = "2", ev = "1", sv = "1"] = cacheKey.split("|");
  if (!supabaseConfigured) return fetchStaticNewsEventsCached();

  const filter: NewsFilter = {
    minRelevance: Number(gr) as 0 | 2 | 3,
    eventsOnly: ev === "1",
    minSeverity: Number(sv) as 0 | 1 | 2,
  };
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `news-events:${cacheKey}`,
    `新聞事件 ${date} (gr${filter.minRelevance}/sv${filter.minSeverity}${filter.eventsOnly ? "/ev" : ""})`,
    supabase.rpc("get_news_events_day_clustered_v2", {
      p_day: date,
      p_min_gis_relevance: filter.minRelevance,
      p_require_event: filter.eventsOnly,
      p_min_severity: filter.minSeverity,
    }),
  );
  if (error) throw new Error(`get_news_events_day_clustered_v2(${cacheKey}): ${error.message}`);

  const fc = clustersToGeoJSON((data ?? []) as RawCluster[]);
  const totalEvents = fc.features.reduce(
    (acc, f) => acc + (typeof f.properties?.event_count === "number" ? f.properties.event_count : 0),
    0,
  );
  console.log(
    `[NewsEvents] Loaded ${fc.features.length} clusters (${totalEvents} events) for ${cacheKey} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return fc;
}

const fetchNewsEventsDayCached = cachedByKey(fetchNewsEventsDayUncached, 10 * 60_000);

/** 取指定日期 + 篩選等級的新聞事件 FeatureCollection。10min TTL + LRU 快取 */
export function fetchNewsEventsDay(
  date: string,
  filter: NewsFilter = DEFAULT_NEWS_FILTER,
): Promise<GeoJSON.FeatureCollection> {
  const cacheKey = `${date}|${filter.minRelevance}|${filter.eventsOnly ? 1 : 0}|${filter.minSeverity}`;
  return fetchNewsEventsDayCached(cacheKey);
}

/** Intel Panel 用：取 raw cluster 列（含每 cluster 的 events[]）+ flat events */
export async function fetchNewsEventsDayClusters(
  date: string,
  filter: NewsFilter = DEFAULT_NEWS_FILTER,
): Promise<RawCluster[]> {
  if (!supabaseConfigured) return [];
  const cacheKey = `${date}|${filter.minRelevance}|${filter.eventsOnly ? 1 : 0}|${filter.minSeverity}`;
  const { data, error } = await withLoading(
    `news-events-clusters:${cacheKey}`,
    `新聞事件清單 ${date}`,
    supabase.rpc("get_news_events_day_clustered_v2", {
      p_day: date,
      p_min_gis_relevance: filter.minRelevance,
      p_require_event: filter.eventsOnly,
      p_min_severity: filter.minSeverity,
    }),
  );
  if (error) {
    console.warn(`[NewsEvents] clusters ${cacheKey} failed:`, error.message);
    return [];
  }
  return (data ?? []) as RawCluster[];
}
