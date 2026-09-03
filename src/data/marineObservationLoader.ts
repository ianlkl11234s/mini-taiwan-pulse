import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

export type MarineSourceNetwork = "cwa" | "isohe";
export type MarineObservationFreshness = "fresh" | "delayed" | "stale" | "missing";

export interface MarineObservationBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface MarineObservationStation {
  stationUid: string;
  sourceNetwork: MarineSourceNetwork;
  sourceStationId: string;
  originOrg: string;
  distributionOrg: string;
  stationType: string;
  nameZh: string | null;
  nameEn: string | null;
  aliases: unknown[];
  longitude: number;
  latitude: number;
  observedElements: unknown[];
  sourceStatus: string | null;
  locationRevision: number | null;
  locationUpdatedAt: string | null;
  lastSeenAt: string | null;
}

export interface MarineObservationMetric {
  metricCode: string;
  depthKey: string;
  valueNumeric: number | null;
  unitSource: string | null;
  unitCanonical: string | null;
  verticalDatum: string | null;
  sourceStatus: string | null;
  qualityFlags: Record<string, unknown>;
  observedAt: string;
  receivedAt: string;
  ageSeconds: number | null;
  observationLongitude: number | null;
  observationLatitude: number | null;
  /** Defensive signal for an unexpected null in the latest-valid RPC. */
  hasValue: boolean;
}

export interface MarineObservationCurrentRow extends MarineObservationMetric {
  stationUid: string;
  sourceNetwork: MarineSourceNetwork;
  sourceStationId: string;
  originOrg: string;
  distributionOrg: string;
  stationType: string;
  nameZh: string | null;
  longitude: number;
  latitude: number;
}

export interface MarineObservationHistoryRow {
  observedAt: string;
  valueNumeric: number | null;
  unitSource: string | null;
  unitCanonical: string | null;
  verticalDatum: string | null;
  isMissing: boolean;
  isValid: boolean;
  missingReason: string | null;
  sourceStatus: string | null;
  qualityFlags: Record<string, unknown>;
}

export interface MarineObservationFeatureProperties {
  stationUid: string;
  sourceNetwork: MarineSourceNetwork;
  sourceStationId: string;
  originOrg: string;
  distributionOrg: string;
  stationType: string;
  nameZh: string;
  nameEn: string;
  sourceStatus: string;
  latestSourceStatus: string;
  latestObservedAt: string;
  latestReceivedAt: string;
  latestAgeSeconds: number | null;
  freshnessStatus: MarineObservationFreshness;
  metricCount: number;
  hasCurrentData: boolean;
  observedElements: unknown[];
  metrics: MarineObservationMetric[];
  lastSeenAt: string;
}

export type MarineObservationFeature = GeoJSON.Feature<
  GeoJSON.Point,
  MarineObservationFeatureProperties
>;

export type MarineObservationFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  MarineObservationFeatureProperties
>;

interface RawStationRow {
  station_uid?: unknown;
  source_network?: unknown;
  source_station_id?: unknown;
  origin_org?: unknown;
  distribution_org?: unknown;
  station_type?: unknown;
  name_zh?: unknown;
  name_en?: unknown;
  aliases?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  observed_elements?: unknown;
  source_status?: unknown;
  location_revision?: unknown;
  location_updated_at?: unknown;
  last_seen_at?: unknown;
}

interface RawCurrentRow {
  station_uid?: unknown;
  source_network?: unknown;
  source_station_id?: unknown;
  origin_org?: unknown;
  distribution_org?: unknown;
  station_type?: unknown;
  name_zh?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  metric_code?: unknown;
  depth_key?: unknown;
  value_numeric?: unknown;
  unit_source?: unknown;
  unit_canonical?: unknown;
  vertical_datum?: unknown;
  source_status?: unknown;
  quality_flags?: unknown;
  observed_at?: unknown;
  received_at?: unknown;
  age_seconds?: unknown;
  observation_longitude?: unknown;
  observation_latitude?: unknown;
}

interface RawHistoryRow {
  observed_at?: unknown;
  value_numeric?: unknown;
  unit_source?: unknown;
  unit_canonical?: unknown;
  vertical_datum?: unknown;
  is_missing?: unknown;
  is_valid?: unknown;
  missing_reason?: unknown;
  source_status?: unknown;
  quality_flags?: unknown;
}

export interface MarineObservationStationOptions {
  stationType?: string | null;
  bounds?: MarineObservationBounds;
  limit?: number;
}

export interface MarineObservationCurrentOptions {
  metricCodes?: readonly string[] | null;
  bounds?: MarineObservationBounds;
  maxAgeMinutes?: number;
  limit?: number;
}

export interface MarineObservationLayerOptions
  extends MarineObservationStationOptions, MarineObservationCurrentOptions {}

export interface MarineObservationHistoryParams {
  stationUid: string;
  metricCode: string;
  from: string;
  to: string;
  depthKey?: string;
  limit?: number;
}

const NETWORKS = new Set<MarineSourceNetwork>(["cwa", "isohe"]);
const STATION_CACHE_TTL_MS = 15 * 60_000;
const CURRENT_CACHE_TTL_MS = 5 * 60_000;
const HISTORY_CACHE_TTL_MS = 10 * 60_000;
const MAX_HISTORY_MS = 31 * 24 * 60 * 60_000;

/** The feeds have different expected cadences; do not apply one shared age threshold. */
export const MARINE_OBSERVATION_FRESHNESS_MINUTES: Record<
  MarineSourceNetwork,
  { fresh: number; delayed: number }
> = {
  cwa: { fresh: 120, delayed: 360 },
  isohe: { fresh: 20, delayed: 60 },
};

function assertSourceNetwork(value: string): asserts value is MarineSourceNetwork {
  if (!NETWORKS.has(value as MarineSourceNetwork)) {
    throw new Error(`Unsupported marine observation source network: ${value}`);
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundsParams(bounds?: MarineObservationBounds) {
  return {
    p_min_lon: bounds?.minLon ?? null,
    p_min_lat: bounds?.minLat ?? null,
    p_max_lon: bounds?.maxLon ?? null,
    p_max_lat: bounds?.maxLat ?? null,
  };
}

function stableKey(value: unknown): string {
  return JSON.stringify(value);
}

export function normalizeMarineObservationStation(
  row: RawStationRow,
): MarineObservationStation | null {
  const sourceNetwork = requiredString(row.source_network);
  if (!NETWORKS.has(sourceNetwork as MarineSourceNetwork)) return null;
  const longitude = nullableNumber(row.longitude);
  const latitude = nullableNumber(row.latitude);
  if (longitude === null || latitude === null) return null;

  return {
    stationUid: requiredString(row.station_uid),
    sourceNetwork: sourceNetwork as MarineSourceNetwork,
    sourceStationId: requiredString(row.source_station_id),
    originOrg: requiredString(row.origin_org),
    distributionOrg: requiredString(row.distribution_org),
    stationType: requiredString(row.station_type),
    nameZh: nullableString(row.name_zh),
    nameEn: nullableString(row.name_en),
    aliases: jsonArray(row.aliases),
    longitude,
    latitude,
    observedElements: jsonArray(row.observed_elements),
    sourceStatus: nullableString(row.source_status),
    locationRevision: nullableNumber(row.location_revision),
    locationUpdatedAt: nullableString(row.location_updated_at),
    lastSeenAt: nullableString(row.last_seen_at),
  };
}

export function normalizeMarineObservationCurrentRow(
  row: RawCurrentRow,
): MarineObservationCurrentRow | null {
  const sourceNetwork = requiredString(row.source_network);
  if (!NETWORKS.has(sourceNetwork as MarineSourceNetwork)) return null;
  const longitude = nullableNumber(row.longitude);
  const latitude = nullableNumber(row.latitude);
  if (longitude === null || latitude === null) return null;
  const valueNumeric = nullableNumber(row.value_numeric);
  return {
    stationUid: requiredString(row.station_uid),
    sourceNetwork: sourceNetwork as MarineSourceNetwork,
    sourceStationId: requiredString(row.source_station_id),
    originOrg: requiredString(row.origin_org),
    distributionOrg: requiredString(row.distribution_org),
    stationType: requiredString(row.station_type),
    nameZh: nullableString(row.name_zh),
    longitude,
    latitude,
    metricCode: requiredString(row.metric_code),
    depthKey: requiredString(row.depth_key) || "surface",
    valueNumeric,
    unitSource: nullableString(row.unit_source),
    unitCanonical: nullableString(row.unit_canonical),
    verticalDatum: nullableString(row.vertical_datum),
    sourceStatus: nullableString(row.source_status),
    qualityFlags: jsonObject(row.quality_flags),
    observedAt: requiredString(row.observed_at),
    receivedAt: requiredString(row.received_at),
    ageSeconds: nullableNumber(row.age_seconds),
    observationLongitude: nullableNumber(row.observation_longitude),
    observationLatitude: nullableNumber(row.observation_latitude),
    hasValue: valueNumeric !== null,
  };
}

export function normalizeMarineObservationHistoryRow(
  row: RawHistoryRow,
): MarineObservationHistoryRow {
  return {
    observedAt: requiredString(row.observed_at),
    valueNumeric: nullableNumber(row.value_numeric),
    unitSource: nullableString(row.unit_source),
    unitCanonical: nullableString(row.unit_canonical),
    verticalDatum: nullableString(row.vertical_datum),
    isMissing: row.is_missing === true,
    isValid: row.is_valid === true,
    missingReason: nullableString(row.missing_reason),
    sourceStatus: nullableString(row.source_status),
    qualityFlags: jsonObject(row.quality_flags),
  };
}

const stationCache = keyedThunkCache<MarineObservationStation[]>(STATION_CACHE_TTL_MS);
const currentCache = keyedThunkCache<MarineObservationCurrentRow[]>(CURRENT_CACHE_TTL_MS);
const historyCache = keyedThunkCache<MarineObservationHistoryRow[]>(HISTORY_CACHE_TTL_MS);

export function fetchMarineObservationStations(
  sourceNetwork: MarineSourceNetwork,
  options: MarineObservationStationOptions = {},
): Promise<MarineObservationStation[]> {
  assertSourceNetwork(sourceNetwork);
  const params = {
    p_source_network: sourceNetwork,
    p_station_type: options.stationType ?? null,
    ...boundsParams(options.bounds),
    p_limit: options.limit ?? 1000,
  };
  return stationCache(stableKey(params), async () => {
    const { data, error } = await withLoading(
      `marine-observation:${sourceNetwork}:stations`,
      `${sourceNetwork === "cwa" ? "CWA 海洋觀測站" : "ISOHE 港區海氣象站"}站點`,
      supabase.rpc("get_marine_observation_stations", params),
    );
    if (error) throw new Error(`get_marine_observation_stations(${sourceNetwork}): ${error.message}`);
    return ((data ?? []) as RawStationRow[])
      .map(normalizeMarineObservationStation)
      .filter((station): station is MarineObservationStation => (
        station !== null && station.sourceNetwork === sourceNetwork
      ));
  });
}

export function fetchMarineObservationCurrent(
  sourceNetwork: MarineSourceNetwork,
  options: MarineObservationCurrentOptions = {},
): Promise<MarineObservationCurrentRow[]> {
  assertSourceNetwork(sourceNetwork);
  const params = {
    p_source_network: sourceNetwork,
    p_metric_codes: options.metricCodes ? [...options.metricCodes] : null,
    ...boundsParams(options.bounds),
    p_max_age_minutes: options.maxAgeMinutes ?? 240,
    p_limit: options.limit ?? 2000,
  };
  return currentCache(stableKey(params), async () => {
    const { data, error } = await withLoading(
      `marine-observation:${sourceNetwork}:current`,
      `${sourceNetwork === "cwa" ? "CWA 海洋觀測站" : "ISOHE 港區海氣象站"}最新觀測`,
      supabase.rpc("get_marine_observation_current", params),
    );
    if (error) throw new Error(`get_marine_observation_current(${sourceNetwork}): ${error.message}`);
    return ((data ?? []) as RawCurrentRow[])
      .map(normalizeMarineObservationCurrentRow)
      .filter((row): row is MarineObservationCurrentRow => (
        row !== null && row.sourceNetwork === sourceNetwork
      ));
  });
}

export function marineObservationFreshness(
  sourceNetwork: MarineSourceNetwork,
  ageSeconds: number | null,
): MarineObservationFreshness {
  if (ageSeconds === null) return "missing";
  const thresholds = MARINE_OBSERVATION_FRESHNESS_MINUTES[sourceNetwork];
  if (ageSeconds <= thresholds.fresh * 60) return "fresh";
  if (ageSeconds <= thresholds.delayed * 60) return "delayed";
  return "stale";
}

export function buildMarineObservationFeatures(
  sourceNetwork: MarineSourceNetwork,
  stations: readonly MarineObservationStation[],
  currentRows: readonly MarineObservationCurrentRow[],
): MarineObservationFeatureCollection {
  assertSourceNetwork(sourceNetwork);
  const metricsByStation = new Map<string, MarineObservationMetric[]>();
  for (const row of currentRows) {
    if (row.sourceNetwork !== sourceNetwork) continue;
    const stationUid = row.stationUid;
    if (!stationUid) continue;
    const metrics = metricsByStation.get(stationUid) ?? [];
    metrics.push(row);
    metricsByStation.set(stationUid, metrics);
  }

  const features: MarineObservationFeature[] = [];
  for (const station of stations) {
    if (station.sourceNetwork !== sourceNetwork) continue;
    const metrics = (metricsByStation.get(station.stationUid) ?? []).sort((a, b) => (
      a.metricCode.localeCompare(b.metricCode) || a.depthKey.localeCompare(b.depthKey)
    ));
    const latestMetric = metrics.reduce<MarineObservationMetric | null>((latest, metric) => {
      if (!latest) return metric;
      return metric.observedAt > latest.observedAt ? metric : latest;
    }, null);
    const ages = metrics
      .map((metric) => metric.ageSeconds)
      .filter((age): age is number => age !== null);
    const latestAgeSeconds = ages.length > 0 ? Math.min(...ages) : null;

    features.push({
      type: "Feature",
      id: station.stationUid,
      geometry: { type: "Point", coordinates: [station.longitude, station.latitude] },
      properties: {
        stationUid: station.stationUid,
        sourceNetwork: station.sourceNetwork,
        sourceStationId: station.sourceStationId,
        originOrg: station.originOrg,
        distributionOrg: station.distributionOrg,
        stationType: station.stationType,
        nameZh: station.nameZh ?? "",
        nameEn: station.nameEn ?? "",
        sourceStatus: station.sourceStatus ?? "",
        latestSourceStatus: latestMetric?.sourceStatus ?? "",
        latestObservedAt: latestMetric?.observedAt ?? "",
        latestReceivedAt: latestMetric?.receivedAt ?? "",
        latestAgeSeconds,
        freshnessStatus: marineObservationFreshness(sourceNetwork, latestAgeSeconds),
        metricCount: metrics.length,
        hasCurrentData: metrics.length > 0,
        observedElements: station.observedElements,
        metrics,
        lastSeenAt: station.lastSeenAt ?? "",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export async function loadMarineObservationFeatures(
  sourceNetwork: MarineSourceNetwork,
  options: MarineObservationLayerOptions = {},
): Promise<MarineObservationFeatureCollection> {
  const [stations, current] = await Promise.all([
    fetchMarineObservationStations(sourceNetwork, options),
    fetchMarineObservationCurrent(sourceNetwork, options),
  ]);
  return buildMarineObservationFeatures(sourceNetwork, stations, current);
}

/** Alias kept for call sites that use fetch* naming. */
export const fetchMarineObservationLayer = loadMarineObservationFeatures;

export function loadMarineObservationHistory(
  params: MarineObservationHistoryParams,
): Promise<MarineObservationHistoryRow[]> {
  if (!params.stationUid) throw new Error("Marine observation history requires stationUid");
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(params.metricCode)) {
    throw new Error(`Invalid marine observation metricCode: ${params.metricCode}`);
  }
  const fromMs = Date.parse(params.from);
  const toMs = Date.parse(params.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    throw new Error("Marine observation history requires a valid ascending time range");
  }
  if (toMs - fromMs > MAX_HISTORY_MS) {
    throw new Error("Marine observation history range cannot exceed 31 days");
  }
  const rpcParams = {
    p_station_uid: params.stationUid,
    p_metric_code: params.metricCode,
    p_from: params.from,
    p_to: params.to,
    p_depth_key: params.depthKey ?? "surface",
    p_limit: params.limit ?? 2000,
  };
  const cacheKey = stableKey(rpcParams);
  return historyCache(cacheKey, async () => {
    const { data, error } = await withLoading(
      `marine-observation:history:${params.stationUid}:${params.metricCode}:${rpcParams.p_depth_key}`,
      `海洋觀測歷史 ${params.metricCode}`,
      supabase.rpc("get_marine_observation_history", rpcParams),
    );
    if (error) {
      throw new Error(
        `get_marine_observation_history(${params.stationUid}, ${params.metricCode}): ${error.message}`,
      );
    }
    return ((data ?? []) as RawHistoryRow[]).map(normalizeMarineObservationHistoryRow);
  });
}

/** Alias kept for popup code that uses fetch* naming. */
export const fetchMarineObservationHistory = loadMarineObservationHistory;

export function invalidateMarineObservationCache(): void {
  stationCache.invalidate();
  currentCache.invalidate();
  historyCache.invalidate();
}
