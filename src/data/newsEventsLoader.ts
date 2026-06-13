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
interface RawCluster {
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

/** 篩選等級 — RPC v2 參數對應 */
export type NewsFilterLevel = "critical" | "important" | "local" | "all";

interface FilterParams {
  min_gr: number;
  require_event: boolean;
  min_sev: number;
}

const FILTER_PRESETS: Record<NewsFilterLevel, FilterParams> = {
  critical:  { min_gr: 3, require_event: true,  min_sev: 2 },
  important: { min_gr: 2, require_event: true,  min_sev: 1 },
  local:     { min_gr: 1, require_event: false, min_sev: 0 },
  all:       { min_gr: 0, require_event: false, min_sev: 0 },
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
  // cacheKey 格式："YYYY-MM-DD|<filterLevel>"
  const [date, filterLevel = "important"] = cacheKey.split("|");
  if (!supabaseConfigured) return fetchStaticNewsEventsCached();

  const preset = FILTER_PRESETS[filterLevel as NewsFilterLevel] ?? FILTER_PRESETS.important;
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `news-events:${cacheKey}`,
    `新聞事件 ${date} (${filterLevel})`,
    supabase.rpc("get_news_events_day_clustered_v2", {
      p_day: date,
      p_min_gis_relevance: preset.min_gr,
      p_require_event: preset.require_event,
      p_min_severity: preset.min_sev,
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
  filterLevel: NewsFilterLevel = "important",
): Promise<GeoJSON.FeatureCollection> {
  return fetchNewsEventsDayCached(`${date}|${filterLevel}`);
}
