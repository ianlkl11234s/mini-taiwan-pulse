import { globalEventsToGeoJSON, type GlobalEventPoint, type GlobalEventRecord } from "./globalEventsLoader";

export type GlobalEventsView = "recent7d" | "timeline";
type XY = { x: number; y: number };
export interface EventProjection {
  project(coordinates: [number, number]): XY;
  unproject(point: [number, number]): { lng: number; lat: number };
}

/** Rolling seven days, never the timeline's forward-looking seven-day window. */
export function recentGlobalEventWindow(nowMs = Date.now()): { start: string; end: string } {
  return { start: new Date(nowMs - 7 * 86_400_000).toISOString(), end: new Date(nowMs).toISOString() };
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

/** Display-only spider offsets; source coordinates remain unchanged and travel in popup props. */
export function layoutGlobalEventPoints(
  rows: readonly GlobalEventPoint[],
  projection: EventProjection,
  expandedGroups: ReadonlySet<string> = new Set(),
): {
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  connectors: GeoJSON.FeatureCollection<GeoJSON.LineString>;
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
  const connectors: GeoJSON.FeatureCollection<GeoJSON.LineString> = { type: "FeatureCollection", features: [] };
  const clusters: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  for (const [groupKey, group] of groups) {
    group.sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (group.length > 6 && !expandedGroups.has(groupKey)) {
      clusters.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
        properties: { group_key: groupKey, point_count: group.length } });
      continue;
    }
    for (const [index, row] of group.entries()) {
      const feature = globalEventsToGeoJSON([row]).features[0]!;
      feature.properties = { ...feature.properties, original_lng: row.coordinates[0], original_lat: row.coordinates[1],
        display_offset: group.length > 1, colocated_count: group.length };
      if (group.length > 1) {
        const origin = projection.project(row.coordinates);
        const ring = Math.floor(index / 12);
        const count = Math.min(12, group.length - ring * 12);
        const angle = (index % 12) * 2 * Math.PI / count - Math.PI / 2;
        const radius = group.length === 2 ? 13 : Math.max(22, Math.min(12, group.length) * 4) + ring * 30;
        const offset = projection.unproject([origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius]);
        feature.geometry = { type: "Point", coordinates: [offset.lng, offset.lat] };
        connectors.features.push({ type: "Feature", geometry: { type: "LineString", coordinates: [row.coordinates, [offset.lng, offset.lat]] },
          properties: { event_id: row.eventId, display_only: true } });
      }
      points.features.push(feature);
    }
  }
  return { points, connectors, clusters };
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
