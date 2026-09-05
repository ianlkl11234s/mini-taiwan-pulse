import { globalEventsToGeoJSON, type GlobalEventPoint, type GlobalEventRecord } from "./globalEventsLoader";
import { GLOBAL_EVENT_SEVERITIES } from "./globalEventsTypes";

export type GlobalEventsView = "recent7d" | "timeline";
export const GLOBAL_EVENT_ICON_RADIUS = 8;

/**
 * Rolling seven days, never the timeline's forward-looking seven-day window.
 * Floors to the minute so repeated calls that land in the same minute (periodic
 * refresh callers comparing bounds to detect a genuinely new window) produce an
 * identical, comparable key instead of always missing on raw millisecond `Date.now()`.
 */
export function recentGlobalEventWindow(nowMs = Date.now()): { start: string; end: string } {
  const alignedNow = Math.floor(nowMs / 60_000) * 60_000;
  return { start: new Date(alignedNow - 7 * 86_400_000).toISOString(), end: new Date(alignedNow).toISOString() };
}

/** Candidate RPC windows use source observed_at; delayed assessments still need to be
 * prefetched on their real available day. Widen retrieval only, never backdate visibility. */
export function globalEventCandidateLookbackWindow(bounds: { start: string; end: string }): { start: string; end: string } {
  const end = Date.parse(bounds.end);
  const start = Math.max(Date.parse(bounds.start) - 7 * 86_400_000, end - 31 * 86_400_000);
  return { start: new Date(start).toISOString(), end: bounds.end };
}

/** One latest version per event within the requested overview, not a fabricated end-time. */
export function selectGlobalEventsOverview<T extends GlobalEventRecord>(rows: readonly T[]): T[] {
  const winners = new Map<string, T>();
  for (const row of rows) {
    const old = winners.get(row.eventId);
    if (!old || (row.publicationNo ?? 0) > (old.publicationNo ?? 0)
      || ((row.publicationNo ?? 0) === (old.publicationNo ?? 0)
        && (Date.parse(row.displayFrom ?? "") || 0) > (Date.parse(old.displayFrom ?? "") || 0))) {
      winners.set(row.eventId, row);
    }
  }
  return dedupeGlobalEventPlaces(rows.filter((row) => {
    const winner = winners.get(row.eventId);
    return winner?.versionId === row.versionId
      && winner.lifecycleState !== "retracted" && winner.lifecycleState !== "superseded";
  }));
}

export function dedupeGlobalEventPlaces<T extends GlobalEventRecord>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    // Qwen explicitly linked these candidates to the same batch-scoped event. Source-derived
    // place IDs may differ while the real point/semantics are identical; only the display dedupes.
    const placeIdentity = row.aiGroupId && row.coordinates !== null
      ? `${coordinateKey(row.coordinates)}/${row.locationKind}/${row.countryCodeScheme ?? ""}:${row.countryCode ?? ""}`
      : row.placeKey ?? row.displayPlaceId ?? row.eventPlaceId;
    const key = `${row.eventId}/${placeIdentity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coordinateKey(coordinates: readonly number[]): string {
  return coordinates.map((value) => value.toFixed(6)).join(",");
}

/** Camera-independent layout. Native symbol offsets move pixels, never geographic anchors. */
export function layoutGlobalEventPoints(
  rows: readonly GlobalEventPoint[],
  expandedGroups: ReadonlySet<string> = new Set(),
): {
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  anchors: GeoJSON.FeatureCollection<GeoJSON.Point>;
  clusters: GeoJSON.FeatureCollection<GeoJSON.Point>;
} {
  const groups = new Map<string, GlobalEventPoint[]>();
  for (const row of dedupeGlobalEventPlaces(rows)) {
    const key = coordinateKey(row.coordinates);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const points: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  const anchors: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  const clusters: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  for (const [groupKey, group] of groups) {
    group.sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (group.length > 6 && !expandedGroups.has(groupKey)) {
      clusters.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
        properties: { group_key: groupKey, point_count: group.length } });
      continue;
    }
    if (group.length > 1) anchors.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
      properties: { group_key: groupKey, display_only: true } });
    for (const [index, row] of group.entries()) {
      const feature = globalEventsToGeoJSON([row]).features[0]!;
      const iconScale = (GLOBAL_EVENT_SEVERITIES.find((item) => item.value === row.severity)?.radius ?? 4.5) / GLOBAL_EVENT_ICON_RADIUS;
      let offsetX = 0;
      let offsetY = 0;
      if (group.length > 1) {
        const ring = Math.floor(index / 12);
        const count = Math.min(12, group.length - ring * 12);
        const angle = (index % 12) * 2 * Math.PI / count - Math.PI / 2;
        const radius = group.length === 2 ? 13 : Math.max(22, Math.min(12, group.length) * 4) + ring * 30;
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }
      feature.properties = { ...feature.properties, original_lng: row.coordinates[0], original_lat: row.coordinates[1],
        display_offset: group.length > 1, colocated_count: group.length,
        display_offset_x: offsetX, display_offset_y: offsetY, icon_scale: iconScale,
        // Mapbox multiplies icon-offset by icon-size; normalize so severity never changes spacing.
        icon_offset: [offsetX / iconScale, offsetY / iconScale] };
      points.features.push(feature);
    }
  }
  return { points, anchors, clusters };
}

/** Static quadratic association arc. Unwrapped longitude takes the short dateline crossing. */
export function globalEventAssociationArc(from: [number, number], to: [number, number]): number[][] {
  const toLng = to[0] + 360 * Math.round((from[0] - to[0]) / 360);
  const dx = toLng - from[0];
  const dy = to[1] - from[1];
  const bend = 0.18;
  const control = [(from[0] + toLng) / 2 - dy * bend, Math.max(-80, Math.min(80, (from[1] + to[1]) / 2 + dx * bend))];
  return Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0]! + t ** 2 * toLng,
      (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1]! + t ** 2 * to[1]];
  });
}

/** Minimum spanning association tree: connected but no invented origin/direction or all-pairs hairball. */
export function globalEventRelations(rows: readonly GlobalEventPoint[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const countryIdentity = (row: GlobalEventPoint): string | null => {
    if (row.countryCode) return `${row.countryCodeScheme ?? "published"}:${row.countryCode}`;
    // Published representative points already carry verified country-level semantics even
    // when legacy event_places omitted country_code. Use the named country, never infer ISO.
    return row.locationKind === "country_center" && row.placeName?.trim()
      ? `country-name:${row.placeName.normalize("NFKC").trim()}` : null;
  };
  const events = new Map<string, GlobalEventPoint[]>();
  for (const row of dedupeGlobalEventPlaces(rows)) {
    const country = countryIdentity(row);
    if (!country) continue;
    const places = events.get(row.eventId) ?? [];
    if (!places.some((p) => countryIdentity(p) === country)) places.push(row);
    events.set(row.eventId, places);
  }
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const [eventId, unsorted] of events) {
    const places = [...unsorted].sort((a, b) => countryIdentity(a)!.localeCompare(countryIdentity(b)!));
    if (places.length < 2) continue;
    const connected = [places.shift()!];
    while (places.length) {
      let best = { distance: Infinity, from: connected[0]!, index: 0 };
      for (const from of connected) for (const [index, to] of places.entries()) {
        const deltaLng = to.coordinates[0] - from.coordinates[0];
        const dx = deltaLng - 360 * Math.round(deltaLng / 360);
        const distance = dx ** 2 + (to.coordinates[1] - from.coordinates[1]) ** 2;
        if (distance < best.distance) best = { distance, from, index };
      }
      const to = places.splice(best.index, 1)[0]!;
      if (best.distance > 0) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: globalEventAssociationArc(best.from.coordinates, to.coordinates) },
        properties: { ...globalEventsToGeoJSON([to]).features[0]!.properties, event_id: eventId, relation_kind: "association" } });
      connected.push(to);
    }
  }
  return { type: "FeatureCollection", features };
}
