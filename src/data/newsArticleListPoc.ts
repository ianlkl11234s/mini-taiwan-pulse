import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/** News-location evidence POC：尚未接入 IntelPanel 或 production feature flag。 */
export type NewsArticleLocationScope = "taiwan_local" | "taiwan_multi" | "taiwan_national" | "foreign" | "unknown";
export type NewsArticleBucket = "all" | "unlocated" | "national" | "foreign";
export type NewsArticleLocationStatus = "accepted" | "ambiguous" | "unresolved" | "rejected";
export type NewsArticleLocationPrecision = "address" | "poi" | "intersection" | "road_segment" | "village" | "township" | "county" | "country" | "none";
export type NewsArticleLocationRole = "event_site" | "affected_area" | "reporting_location" | "organization_location" | "background";

export interface NewsArticleListPocParams {
  day: string;
  bucket?: NewsArticleBucket;
  limit?: number;
  beforePublishedTs?: string | null;
}

export interface NewsArticleListPocRow {
  articleId: string;
  title: string;
  summary: string | null;
  sourceName: string | null;
  url: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  placeName: string | null;
  eventOccurredFrom: string | null;
  eventOccurredTo: string | null;
  eventTimePrecision: string | null;
  locationScope: NewsArticleLocationScope;
  locationStatus: NewsArticleLocationStatus;
  locationPrecision: NewsArticleLocationPrecision;
  evidenceText: string | null;
  evidenceField: string | null;
  locationRole: NewsArticleLocationRole | null;
  geometryKind: string | null;
  county: string | null;
  township: string | null;
  adminCode: string | null;
  locationResolver: string | null;
  locationMethodVersion: string | null;
  locationReviewStatus: string | null;
  articleRelationCount: number | null;
  eventReportCount: number | null;
  locationCandidateCount: number;
  acceptedLocationCount: number;
}

type JsonObject = Record<string, unknown>;

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function nullableCount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function locationScope(value: unknown): NewsArticleLocationScope | null {
  return value === "taiwan_local" || value === "taiwan_multi" || value === "taiwan_national" || value === "foreign" || value === "unknown" ? value : null;
}

function locationStatus(value: unknown): NewsArticleLocationStatus | null {
  return value === "accepted" || value === "ambiguous" || value === "unresolved" || value === "rejected" ? value : null;
}

function locationPrecision(value: unknown): NewsArticleLocationPrecision | null {
  return value === "address" || value === "poi" || value === "intersection" || value === "road_segment" || value === "village" || value === "township" || value === "county" || value === "country" || value === "none" ? value : null;
}

function locationRole(value: unknown): NewsArticleLocationRole | null | undefined {
  if (value == null || value === "") return null;
  return value === "event_site" || value === "affected_area" || value === "reporting_location" || value === "organization_location" || value === "background" ? value : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 將 RPC snake_case row 轉為前端不可誤解的明確資料契約。 */
export function parseNewsArticleListPocRow(value: unknown): NewsArticleListPocRow | null {
  if (!isObject(value)) return null;
  const articleId = nullableText(value.article_id);
  const title = nullableText(value.title);
  const scope = locationScope(value.article_scope);
  const status = locationStatus(value.location_status);
  const precision = locationPrecision(value.location_precision);
  const role = locationRole(value.location_role);
  const candidateCount = nullableCount(value.location_candidate_count);
  const acceptedCount = nullableCount(value.accepted_location_count);
  if (articleId === null || title === null || scope === null || status === null || precision === null || role === undefined || candidateCount === null || acceptedCount === null) return null;

  return {
    articleId,
    title,
    summary: nullableText(value.summary),
    sourceName: nullableText(value.source_name),
    url: nullableText(value.canonical_url),
    publishedAt: nullableText(value.published_at),
    fetchedAt: nullableText(value.fetched_at),
    placeName: nullableText(value.place_name),
    eventOccurredFrom: nullableText(value.event_occurred_from),
    eventOccurredTo: nullableText(value.event_occurred_to),
    eventTimePrecision: nullableText(value.event_time_precision),
    locationScope: scope,
    locationStatus: status,
    locationPrecision: precision,
    evidenceText: nullableText(value.evidence_text),
    evidenceField: nullableText(value.evidence_field),
    locationRole: role,
    geometryKind: nullableText(value.geometry_kind),
    county: nullableText(value.county),
    township: nullableText(value.township),
    adminCode: nullableText(value.admin_code),
    locationResolver: nullableText(value.location_resolver),
    locationMethodVersion: nullableText(value.location_method_version),
    locationReviewStatus: nullableText(value.location_review_status),
    articleRelationCount: nullableCount(value.article_relation_count),
    eventReportCount: nullableCount(value.event_report_count),
    locationCandidateCount: candidateCount,
    acceptedLocationCount: acceptedCount,
  };
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

/**
 * 讀取文章定位證據 POC。RPC 限制為 1..100；結果格式錯誤要明確失敗，不能偽裝成空清單。
 */
export async function fetchNewsArticleListPoc(
  { day, bucket = "all", limit = 50, beforePublishedTs = null }: NewsArticleListPocParams,
  signal?: AbortSignal,
): Promise<NewsArticleListPocRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("NEWS_ARTICLE_LIST_POC_INVALID_DAY");
  if (!(bucket === "all" || bucket === "unlocated" || bucket === "national" || bucket === "foreign")) throw new Error("NEWS_ARTICLE_LIST_POC_INVALID_BUCKET");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("NEWS_ARTICLE_LIST_POC_INVALID_LIMIT");
  if (!supabaseConfigured) throw new Error("NEWS_ARTICLE_LIST_POC_SOURCE_NOT_CONFIGURED");
  if (signal?.aborted) throw abortError(signal);

  const request = supabase.rpc("get_news_articles_poc", {
    p_day: day,
    p_bucket: bucket,
    p_limit: limit,
    p_before_published_ts: beforePublishedTs,
  });
  const abortable = request as typeof request & { abortSignal?: (nextSignal: AbortSignal) => typeof request };
  const { data, error } = await withLoading(
    `news-articles-poc:${day}:${bucket}:${limit}:${beforePublishedTs ?? "first"}`,
    "新聞定位證據",
    signal && abortable.abortSignal ? abortable.abortSignal(signal) : request,
  );
  if (signal?.aborted) throw abortError(signal);
  if (error) throw new Error(`get_news_articles_poc: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("NEWS_ARTICLE_LIST_POC_INVALID_RPC_RESPONSE");

  const rows = data.map(parseNewsArticleListPocRow);
  if (rows.some((row) => row === null)) throw new Error("NEWS_ARTICLE_LIST_POC_INVALID_RPC_RESPONSE");
  return rows as NewsArticleListPocRow[];
}
