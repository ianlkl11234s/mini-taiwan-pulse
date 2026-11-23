import { globalEventsToGeoJSON, type GlobalEventPoint, type GlobalEventRecord } from "./globalEventsLoader";
import { GLOBAL_EVENT_SEVERITIES } from "./globalEventsTypes";

export type GlobalEventsView = "recent7d" | "timeline";
export const GLOBAL_EVENT_ICON_RADIUS = 8;

/**
 * Rolling selected days, never the timeline's forward-looking seven-day window.
 * Floors to the minute so repeated calls that land in the same minute (periodic
 * refresh callers comparing bounds to detect a genuinely new window) produce an
 * identical, comparable key instead of always missing on raw millisecond `Date.now()`.
 */
export function recentGlobalEventWindow(nowMs = Date.now(), days = 7): { start: string; end: string } {
  const alignedNow = Math.floor(nowMs / 60_000) * 60_000;
  return { start: new Date(alignedNow - days * 86_400_000).toISOString(), end: new Date(alignedNow).toISOString() };
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
    if (group.length > 6) {
      clusters.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
        properties: { group_key: groupKey, point_count: group.length, expanded: expandedGroups.has(groupKey) } });
      if (!expandedGroups.has(groupKey)) continue;
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

/** Thresholds measured on 2026-11-16..23 candidates (4,207 mapped events): 0.5 kept mostly
 * follow-ups/rewrites of one story; templated quake titles were the main false link. */
export const GLOBAL_EVENT_STORY_LINK = {
  maxHours: 48,
  sameCountryMin: 0.5,
  crossCountryMin: 0.6,
  /** Bigrams shared by more events than this carry no story identity (常見詞、套版字). */
  maxBigramEvents: 60,
} as const;

function titleBigrams(title: string): Set<string> {
  const han = title.replace(/[^㐀-鿿]/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < han.length - 1; i++) grams.add(han.slice(i, i + 2));
  return grams;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

export interface GlobalEventStoryLinks {
  /** eventId → eventIds that are possibly the same story (symmetric). */
  neighbours: Map<string, Set<string>>;
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

/**
 * "Possibly the same story" between different displayed events: similar zh titles within
 * 48 hours of source observation. Never merges events, never moves points; a link only says
 * two reports may describe one happening (not movement, cause or order). Computed on the
 * currently visible rows only, so filters bound it. Events at one shared coordinate get no
 * line (zero length) but still count as neighbours for selection highlight.
 */
export function globalEventStoryLinks(rows: readonly GlobalEventPoint[]): GlobalEventStoryLinks {
  interface Story { eventId: string; title: string; grams: Set<string>; time: number; countries: Set<string>; points: GlobalEventPoint[] }
  const stories = new Map<string, Story>();
  for (const row of rows) {
    const time = Date.parse(row.validFrom ?? "");
    let story = stories.get(row.eventId);
    if (!story) {
      story = { eventId: row.eventId, title: row.titleZhTw, grams: titleBigrams(row.titleZhTw), time, countries: new Set(), points: [] };
      stories.set(row.eventId, story);
    }
    if (row.countryCode) story.countries.add(`${row.countryCodeScheme ?? "published"}:${row.countryCode}`);
    story.points.push(row);
  }
  const list = [...stories.values()].filter((story) => Number.isFinite(story.time) && story.grams.size > 0);
  const index = new Map<string, number[]>();
  list.forEach((story, i) => { for (const gram of story.grams) { const ids = index.get(gram) ?? []; ids.push(i); index.set(gram, ids); } });
  const pairs = new Set<string>();
  for (const ids of index.values()) {
    if (ids.length < 2 || ids.length > GLOBAL_EVENT_STORY_LINK.maxBigramEvents) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) pairs.add(`${ids[x]}:${ids[y]}`);
  }
  const neighbours = new Map<string, Set<string>>();
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const pair of pairs) {
    const [i, j] = pair.split(":").map(Number);
    const a = list[i!]!;
    const b = list[j!]!;
    if (Math.abs(a.time - b.time) > GLOBAL_EVENT_STORY_LINK.maxHours * 3_600_000) continue;
    const sharesCountry = [...a.countries].some((country) => b.countries.has(country));
    const similarity = jaccard(a.grams, b.grams);
    if (sharesCountry ? similarity < GLOBAL_EVENT_STORY_LINK.sameCountryMin : similarity < GLOBAL_EVENT_STORY_LINK.crossCountryMin) continue;
    // Templated quake headlines ("XX 附近發生規模 N 地震") look alike across unrelated places.
    if (!sharesCountry && a.title.includes("地震") && b.title.includes("地震")) continue;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const set = neighbours.get(from.eventId) ?? new Set<string>();
      set.add(to.eventId); neighbours.set(from.eventId, set);
    }
    let best: { distance: number; from: GlobalEventPoint; to: GlobalEventPoint } | null = null;
    for (const from of a.points) for (const to of b.points) {
      const deltaLng = to.coordinates[0] - from.coordinates[0];
      const dx = deltaLng - 360 * Math.round(deltaLng / 360);
      const distance = dx ** 2 + (to.coordinates[1] - from.coordinates[1]) ** 2;
      if (!best || distance < best.distance) best = { distance, from, to };
    }
    if (best && best.distance > 0) features.push({ type: "Feature",
      geometry: { type: "LineString", coordinates: globalEventAssociationArc(best.from.coordinates, best.to.coordinates) },
      properties: { event_id: a.eventId, related_event_id: b.eventId, relation_kind: "same_story", similarity: Math.round(similarity * 100) / 100 } });
  }
  return { neighbours, lines: { type: "FeatureCollection", features } };
}

/** Age uses source observation for candidates and event validFrom for published
 * records. Availability is a separate upper bound; reassessment never renews age.
 * Missing dates and severity remain unknown, never silently become zero. */
export function filterGlobalEvents<T extends GlobalEventRecord>(
  rows: readonly T[], asOfSeconds: number, days: number, category = "all", minSeverity = 0, taiwanOnly = false,
): T[] {
  const end = asOfSeconds * 1000;
  const start = end - days * 86_400_000;
  return rows.filter((row) => {
    const timestamp = Date.parse(row.validFrom ?? (row.candidateId ? "" : row.publishedAt ?? row.displayFrom ?? ""));
    const available = Date.parse(row.displayFrom ?? row.availableAt ?? row.publishedAt ?? "");
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
      && Number.isFinite(available) && available <= end
      && (category === "all" || row.category === category)
      // Structured assessment only: prose and missing values cannot establish a relationship.
      && (!taiwanOnly || row.taiwanRelationship === "direct" || row.taiwanRelationship === "indirect")
      && (minSeverity === 0 || (row.severity !== null && row.severity >= minSeverity));
  });
}
