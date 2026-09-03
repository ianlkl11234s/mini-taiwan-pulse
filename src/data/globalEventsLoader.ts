import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey, cachedOnce } from "../lib/loaderCache";

export type GlobalEventLifecycle = "published" | "archived" | "superseded" | "retracted";
export type GlobalEventLocationKind = "event_point" | "city_center" | "country_center";
export type GlobalEventTransitionKind = "new_event" | "version_update";

export interface GlobalEventPoint {
  eventId: string;
  versionId: string;
  versionNo: number | null;
  publicationNo: number | null;
  lifecycleState: GlobalEventLifecycle | null;
  eventPlaceId: string;
  titleZhTw: string;
  summaryZhTw: string | null;
  category: string | null;
  severity: number | null;
  confidence: number | null;
  validFrom: string | null;
  publishedAt: string | null;
  explicitValidTo: string | null;
  displayFrom: string | null;
  displayTo: string | null;
  placeKey: string | null;
  placeName: string | null;
  countryCode: string | null;
  admin1: string | null;
  admin2: string | null;
  precision: string | null;
  locationSource: string | null;
  displayPlaceId: string | null;
  locationKind: GlobalEventLocationKind | null;
  isProxy: boolean;
  representativePrecision: string | null;
  proxyForEventPlaceId: string | null;
  locationLineage: string | null;
  coordinates: [number, number];
}

type JsonObject = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function nullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableInteger(value: unknown): number | null {
  const number = nullableFiniteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function lifecycle(value: unknown): GlobalEventLifecycle | null {
  return value === "published" || value === "archived" || value === "superseded" || value === "retracted"
    ? value
    : null;
}

function locationKind(value: unknown): GlobalEventLocationKind | null {
  return value === "event_point" || value === "city_center" || value === "country_center"
    ? value
    : null;
}

function pointCoordinates(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const geometry = value as JsonObject;
  if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  const lng = Number(geometry.coordinates[0]);
  const lat = Number(geometry.coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

export function parseGlobalEventPoint(row: JsonObject): GlobalEventPoint | null {
  const coordinates = pointCoordinates(row.geometry);
  if (!coordinates) return null;
  return {
    eventId: String(row.event_id ?? ""),
    versionId: String(row.version_id ?? ""),
    versionNo: nullableInteger(row.version_no),
    publicationNo: nullableInteger(row.publication_no),
    lifecycleState: lifecycle(row.lifecycle_state),
    eventPlaceId: String(row.event_place_id ?? ""),
    titleZhTw: String(row.title_zh_tw ?? "未命名事件"),
    summaryZhTw: nullableString(row.summary_zh_tw),
    category: nullableString(row.category),
    severity: nullableFiniteNumber(row.severity),
    confidence: nullableFiniteNumber(row.confidence),
    validFrom: nullableString(row.valid_from),
    publishedAt: nullableString(row.published_at),
    explicitValidTo: nullableString(row.explicit_valid_to),
    displayFrom: nullableString(row.display_from),
    displayTo: nullableString(row.display_to),
    placeKey: nullableString(row.place_key),
    placeName: nullableString(row.name),
    countryCode: nullableString(row.country_code),
    admin1: nullableString(row.admin1),
    admin2: nullableString(row.admin2),
    precision: nullableString(row.precision),
    locationSource: nullableString(row.location_source),
    displayPlaceId: nullableString(row.display_place_id),
    locationKind: locationKind(row.location_kind),
    isProxy: row.is_proxy === true,
    representativePrecision: nullableString(row.representative_precision),
    proxyForEventPlaceId: nullableString(row.proxy_for_event_place_id),
    locationLineage: nullableString(row.location_lineage),
    coordinates,
  };
}

async function fetchGlobalEventsCurrentUncached(): Promise<GlobalEventPoint[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "global-events:current",
    "全球重要事件",
    supabase.rpc("get_global_event_places_current", {
      p_category: null,
      p_before_published_at: null,
      p_limit: 100,
    }),
  );
  if (error) throw new Error(`Supabase get_global_event_places_current: ${error.message}`);
  return ((data ?? []) as JsonObject[])
    .map(parseGlobalEventPoint)
    .filter((event): event is GlobalEventPoint => event !== null);
}

export const fetchGlobalEventsCurrent = cachedOnce(fetchGlobalEventsCurrentUncached, 5 * 60_000);

async function fetchGlobalEventsWindowUncached(cacheKey: string): Promise<GlobalEventPoint[]> {
  if (!supabaseConfigured) return [];
  const [windowStart, windowEnd] = cacheKey.split("|");
  if (!windowStart || !windowEnd) throw new Error("Global Events window key is invalid");
  const { data, error } = await withLoading(
    `global-events:window:${cacheKey}`,
    "全球重要事件歷史",
    supabase.rpc("get_global_event_places_window", {
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_category: null,
      p_limit_events: 100,
    }),
  );
  if (error) throw new Error(`Supabase get_global_event_places_window: ${error.message}`);
  return ((data ?? []) as JsonObject[])
    .map(parseGlobalEventPoint)
    .filter((event): event is GlobalEventPoint => event !== null);
}

const fetchGlobalEventsWindowCached = cachedByKey(fetchGlobalEventsWindowUncached, 10 * 60_000, 8);

export function fetchGlobalEventsWindow(
  windowStart: string,
  windowEnd: string,
): Promise<GlobalEventPoint[]> {
  return fetchGlobalEventsWindowCached(`${windowStart}|${windowEnd}`);
}

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareVersions(a: GlobalEventPoint, b: GlobalEventPoint): number {
  return (a.publicationNo ?? -1) - (b.publicationNo ?? -1)
    || (a.versionNo ?? -1) - (b.versionNo ?? -1)
    || (timestampMs(a.publishedAt) ?? -Infinity) - (timestampMs(b.publishedAt) ?? -Infinity)
    || a.versionId.localeCompare(b.versionId);
}

/**
 * 從 RPC 回傳的 immutable versions 選出時間軸時刻可見的版本。
 * 區間一律是 half-open [displayFrom, displayTo)；NULL displayTo 保持開放，
 * 不推測事件結束時間。每個 event 只取最高 publication_no 的 active version，
 * 但保留該版本的全部 place rows，讓跨國事件同時出現在多個國家。
 */
export function selectGlobalEventPlacesAt(
  events: readonly GlobalEventPoint[],
  timelineSeconds: number,
): GlobalEventPoint[] {
  if (!Number.isFinite(timelineSeconds)) return [];
  const timelineMs = timelineSeconds * 1000;
  const active = events.filter((event) => {
    const from = timestampMs(event.displayFrom);
    const to = timestampMs(event.displayTo);
    if (from === null || (event.displayTo !== null && to === null)) return false;
    return from <= timelineMs && (to === null || timelineMs < to);
  });

  const winnerByEvent = new Map<string, GlobalEventPoint>();
  for (const event of active) {
    const current = winnerByEvent.get(event.eventId);
    if (!current || compareVersions(event, current) > 0) winnerByEvent.set(event.eventId, event);
  }

  const winnerVersionByEvent = new Map<string, string>();
  for (const [eventId, event] of winnerByEvent) {
    if (event.lifecycleState === "published" || event.lifecycleState === "archived") {
      winnerVersionByEvent.set(eventId, event.versionId);
    }
  }
  return active.filter((event) => winnerVersionByEvent.get(event.eventId) === event.versionId);
}

export function globalEventsToGeoJSON(
  events: readonly GlobalEventPoint[],
  transitions: ReadonlyMap<string, GlobalEventTransitionKind> = new Map(),
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      id: event.displayPlaceId ?? event.eventPlaceId,
      geometry: { type: "Point", coordinates: event.coordinates },
      properties: {
        event_id: event.eventId,
        version_id: event.versionId,
        version_no: event.versionNo,
        publication_no: event.publicationNo,
        lifecycle_state: event.lifecycleState,
        event_place_id: event.eventPlaceId,
        title_zh_tw: event.titleZhTw,
        summary_zh_tw: event.summaryZhTw,
        category: event.category,
        severity: event.severity,
        confidence: event.confidence,
        valid_from: event.validFrom,
        published_at: event.publishedAt,
        explicit_valid_to: event.explicitValidTo,
        display_from: event.displayFrom,
        display_to: event.displayTo,
        place_key: event.placeKey,
        place_name: event.placeName,
        country_code: event.countryCode,
        admin1: event.admin1,
        admin2: event.admin2,
        precision: event.precision,
        location_source: event.locationSource,
        display_place_id: event.displayPlaceId,
        location_kind: event.locationKind,
        is_proxy: event.isProxy,
        representative_precision: event.representativePrecision,
        proxy_for_event_place_id: event.proxyForEventPlaceId,
        location_lineage: event.locationLineage,
        transition_kind: transitions.get(event.eventId) ?? null,
      },
    })),
  };
}
