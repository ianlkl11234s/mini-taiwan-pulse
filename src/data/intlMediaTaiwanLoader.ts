import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey } from "../lib/loaderCache";

const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_LIMIT = 200;

export function isIntlMediaPreviewEnabled(
  search = typeof window === "undefined" ? "" : window.location.search,
  isDev = import.meta.env.DEV,
): boolean {
  return isDev && new URLSearchParams(search).get("intlMediaPreview") === "1";
}

export interface IntlMediaMentionedLocation {
  name: string | null;
  countryCode: string | null;
  adm1Code: string | null;
  latitude: number | null;
  longitude: number | null;
  featureId: string | null;
  locationType: number | null;
}

export interface IntlMediaSourceLocation {
  city: string | null;
  country: string | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  level: "country" | "city" | null;
  method: "country_registry" | "outlet_registry" | "government_capital" | null;
  confidence: "verified" | "fallback" | null;
}

export interface IntlMediaTaiwanItem {
  id: string;
  sourceId: string;
  sourceStream: string | null;
  sourceDomain: string | null;
  /** Registry-provided country only; never infer from domain/TLD. */
  sourceCountry: string | null;
  /** Publisher/issuer origin anchor; this is not where the reported subject occurred. */
  sourceLocation: IntlMediaSourceLocation | null;
  sourceName: string;
  url: string | null;
  titleOriginal: string;
  summaryZh: string | null;
  /** GDELT GKG record timestamp, not necessarily the publisher's publication time. */
  gdeltRecordedTs: number;
  collectedAt: string | null;
  topics: string[];
  gkgThemes: string[];
  /** Places mentioned in GDELT metadata; independent of the publisher/issuer origin. */
  mentionedLocations: IntlMediaMentionedLocation[];
  importance: number | null;
  taiwanRelevance: number | null;
  sourceKind: "foreign_editorial_media";
  severitySource: "inferred";
  llmModel: string | null;
}

export interface IntlMediaTaiwanQuery {
  since?: string;
  limit?: number;
  minTaiwanRelevance?: 0 | 1 | 2 | 3;
}

type RawRow = Record<string, unknown>;

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = nonEmptyString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function boundedLevel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) return null;
  return value;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coordinatePair(
  latitudeValue: unknown,
  longitudeValue: unknown,
): { latitude: number | null; longitude: number | null } {
  const latitude = finiteNumber(latitudeValue);
  const longitude = finiteNumber(longitudeValue);
  if (
    latitude == null || longitude == null
    || latitude < -90 || latitude > 90
    || longitude < -180 || longitude > 180
  ) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : null;
}

function normalizeMentionedLocations(value: unknown): IntlMediaMentionedLocation[] {
  if (!Array.isArray(value)) return [];
  const locations: IntlMediaMentionedLocation[] = [];
  for (const raw of value.slice(0, 20)) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as RawRow;
    const coordinates = coordinatePair(row.latitude, row.longitude);
    const name = nonEmptyString(row.name);
    const countryCode = nonEmptyString(row.country_code);
    const adm1Code = nonEmptyString(row.adm1_code);
    const featureId = nonEmptyString(row.feature_id);
    const locationType = finiteNumber(row.location_type);
    if (
      !name && !countryCode && !adm1Code && !featureId
      && coordinates.latitude == null && coordinates.longitude == null
    ) continue;
    locations.push({
      name,
      countryCode,
      adm1Code,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      featureId,
      locationType: locationType != null && Number.isInteger(locationType) ? locationType : null,
    });
  }
  return locations;
}

function normalizeSourceLocation(row: RawRow): IntlMediaSourceLocation | null {
  const country = nonEmptyString(row.source_country);
  const city = nonEmptyString(row.source_city);
  const label = nonEmptyString(row.source_location_label);
  const level = enumValue(row.source_location_level, ["country", "city"] as const);
  const method = enumValue(
    row.source_location_method,
    ["country_registry", "outlet_registry", "government_capital"] as const,
  );
  const confidence = enumValue(
    row.source_location_confidence,
    ["verified", "fallback"] as const,
  );
  const coordinates = coordinatePair(row.source_latitude, row.source_longitude);
  if (
    !country && !city && !label && !level && !method && !confidence
    && coordinates.latitude == null && coordinates.longitude == null
  ) return null;
  return {
    city,
    country,
    label,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    level,
    method,
    confidence,
  };
}

function timestampSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
}

function httpUrl(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function normalizeRow(row: RawRow): IntlMediaTaiwanItem | null {
  if (row.source_kind !== "foreign_editorial_media") return null;

  const idValue = row.id;
  const id = typeof idValue === "number" || typeof idValue === "bigint"
    ? String(idValue)
    : nonEmptyString(idValue);
  const titleOriginal = nonEmptyString(row.title_original);
  const gdeltRecordedTs = timestampSeconds(row.published_ts);
  if (!id || !titleOriginal || gdeltRecordedTs == null) return null;

  const sourceDomain = nonEmptyString(row.source_domain);
  const sourceId = nonEmptyString(row.source_id) ?? sourceDomain ?? "unknown";
  const sourceCountry = nonEmptyString(row.source_country);

  return {
    id,
    sourceId,
    sourceStream: nonEmptyString(row.source_stream),
    sourceDomain,
    sourceCountry,
    sourceLocation: normalizeSourceLocation(row),
    sourceName: nonEmptyString(row.source_name) ?? sourceDomain ?? sourceId,
    url: httpUrl(row.url),
    titleOriginal,
    summaryZh: nonEmptyString(row.summary_zh),
    gdeltRecordedTs,
    collectedAt: nonEmptyString(row.collected_at),
    topics: stringArray(row.topics),
    gkgThemes: stringArray(row.gkg_themes),
    mentionedLocations: normalizeMentionedLocations(row.gkg_locations),
    importance: boundedLevel(row.importance),
    taiwanRelevance: boundedLevel(row.taiwan_relevance),
    sourceKind: "foreign_editorial_media",
    severitySource: "inferred",
    llmModel: nonEmptyString(row.llm_model),
  };
}

/** Public for RPC contract tests. Invalid or non-editorial rows are discarded conservatively. */
export function normalizeIntlMediaTaiwanRows(rows: unknown): IntlMediaTaiwanItem[] {
  if (!Array.isArray(rows)) return [];
  const normalized: IntlMediaTaiwanItem[] = [];
  for (const row of rows) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) continue;
    const item = normalizeRow(row as RawRow);
    if (item) normalized.push(item);
  }
  return normalized.sort((a, b) => b.gdeltRecordedTs - a.gdeltRecordedTs);
}

interface ResolvedQuery {
  since: string;
  limit: number;
  minTaiwanRelevance: 0 | 1 | 2 | 3;
}

async function fetchUncached(cacheKey: string): Promise<IntlMediaTaiwanItem[]> {
  if (!supabaseConfigured) throw new Error("Supabase 尚未設定，無法載入國際媒體資料");
  const query = JSON.parse(cacheKey) as ResolvedQuery;
  const request = supabase.rpc("get_intl_media_taiwan", {
    p_since: query.since,
    p_limit: query.limit,
    p_min_taiwan_relevance: query.minTaiwanRelevance,
  });
  const { data, error } = await withLoading(
    `intl-media-taiwan:${query.since}:${query.minTaiwanRelevance}`,
    "國際媒體涉台報導",
    request,
  );
  if (error) throw new Error(`get_intl_media_taiwan: ${error.message}`);
  return normalizeIntlMediaTaiwanRows(data);
}

const fetchCached = cachedByKey(fetchUncached, CACHE_TTL_MS, 8);

async function fetchPreviewFixture(): Promise<IntlMediaTaiwanItem[]> {
  const { intlMediaTaiwanPreviewRows } = await import(
    "./__fixtures__/intlMediaTaiwanPreview"
  );
  return normalizeIntlMediaTaiwanRows(intlMediaTaiwanPreviewRows);
}

/** Load metadata-only international media rows through public.get_intl_media_taiwan. */
export function fetchIntlMediaTaiwan(
  query: IntlMediaTaiwanQuery = {},
): Promise<IntlMediaTaiwanItem[]> {
  if (isIntlMediaPreviewEnabled()) return fetchPreviewFixture();
  const bucketNow = Math.floor(Date.now() / CACHE_TTL_MS) * CACHE_TTL_MS;
  const since = query.since ?? new Date(bucketNow - DEFAULT_LOOKBACK_MS).toISOString();
  const limit = Math.max(1, Math.min(DEFAULT_LIMIT, Math.floor(query.limit ?? DEFAULT_LIMIT)));
  const minTaiwanRelevance = query.minTaiwanRelevance ?? 2;
  return fetchCached(JSON.stringify({ since, limit, minTaiwanRelevance } satisfies ResolvedQuery));
}

export function visibleIntlMediaTaiwan(
  items: IntlMediaTaiwanItem[],
  windowStartTs: number,
  playbackTs: number,
  includeFrozenPreview = false,
): IntlMediaTaiwanItem[] {
  if (includeFrozenPreview) return items;
  return items.filter(
    (item) => item.gdeltRecordedTs >= windowStartTs && item.gdeltRecordedTs <= playbackTs,
  );
}

export function invalidateIntlMediaTaiwanCache(): void {
  fetchCached.invalidate();
}
