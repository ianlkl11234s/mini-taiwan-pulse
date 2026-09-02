import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export interface GlobalEventPoint {
  eventId: string;
  versionId: string;
  eventPlaceId: string;
  titleZhTw: string;
  summaryZhTw: string | null;
  category: string | null;
  severity: number | null;
  confidence: number | null;
  validFrom: string | null;
  publishedAt: string | null;
  placeKey: string | null;
  placeName: string | null;
  countryCode: string | null;
  admin1: string | null;
  admin2: string | null;
  precision: string | null;
  locationSource: string | null;
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
    eventPlaceId: String(row.event_place_id ?? ""),
    titleZhTw: String(row.title_zh_tw ?? "未命名事件"),
    summaryZhTw: nullableString(row.summary_zh_tw),
    category: nullableString(row.category),
    severity: nullableFiniteNumber(row.severity),
    confidence: nullableFiniteNumber(row.confidence),
    validFrom: nullableString(row.valid_from),
    publishedAt: nullableString(row.published_at),
    placeKey: nullableString(row.place_key),
    placeName: nullableString(row.name),
    countryCode: nullableString(row.country_code),
    admin1: nullableString(row.admin1),
    admin2: nullableString(row.admin2),
    precision: nullableString(row.precision),
    locationSource: nullableString(row.location_source),
    coordinates,
  };
}

async function fetchGlobalEventsUncached(): Promise<GlobalEventPoint[]> {
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

export const fetchGlobalEvents = cachedOnce(fetchGlobalEventsUncached, 5 * 60_000);

export function globalEventsToGeoJSON(
  events: readonly GlobalEventPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: event.coordinates },
      properties: {
        event_id: event.eventId,
        version_id: event.versionId,
        event_place_id: event.eventPlaceId,
        title_zh_tw: event.titleZhTw,
        summary_zh_tw: event.summaryZhTw,
        category: event.category,
        severity: event.severity,
        confidence: event.confidence,
        valid_from: event.validFrom,
        published_at: event.publishedAt,
        place_key: event.placeKey,
        place_name: event.placeName,
        country_code: event.countryCode,
        admin1: event.admin1,
        admin2: event.admin2,
        precision: event.precision,
        location_source: event.locationSource,
      },
    })),
  };
}
