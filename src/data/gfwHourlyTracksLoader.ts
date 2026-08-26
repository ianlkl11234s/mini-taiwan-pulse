import { withLoading } from "../lib/loadingRegistry";
import { loadGfwGzipJsonAsset } from "./gfwHourlyDetailLoader";
import { gfwShipTypeBucket, shipTypeBucketLabel } from "./shipTrails";
import {
  isGfwHourlyProductionManifestUrl,
  parseGfwHourlyUnifiedManifest,
  resolveGfwHourlyRootManifestUrl,
} from "./gfwHourlyReleaseManifest";
import type { GfwDetailBucket, GfwUnifiedTrackFrame } from "./gfwHourlyReleaseManifest";

export const GFW_HOURLY_TRACKS_LOCAL_MANIFEST_URL = "/gfw_hourly_tracks_poc/manifest.json";

/** Production 預設走同域 unified root，env 僅作 CDN origin override；Vite dev 走 local POC。 */
export function resolveGfwHourlyTracksManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
  shadowEnabled = import.meta.env.VITE_GFW_HOURLY_V3_SHADOW_ENABLED === "true",
): string | null {
  return resolveGfwHourlyRootManifestUrl(GFW_HOURLY_TRACKS_LOCAL_MANIFEST_URL, cdnBase, isDev, shadowEnabled);
}

export interface GfwHourlyTrack {
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  segmentIndex: number;
  approximate: true;
  sourceDataset: string;
  coordinates: GeoJSON.Position[];
  observedTimes: string[];
  observedTimesMs: number[];
}

export interface GfwHourlyTrackCollection {
  tracks: GfwHourlyTrack[];
  displayDate: string;
  fullFidelity: boolean;
}

export interface GfwHourlyTrackDayEntry {
  displayDate: string;
  path: string;
  bytes: number;
  features: number;
  points: number;
  format?: "geojson" | "pmtiles";
  detailBuckets?: readonly GfwDetailBucket[];
}

export interface GfwHourlyTrackManifest {
  manifestUrl: string;
  releaseId: string;
  latestCompleteDate: string;
  dateStart: string;
  dateEnd: string;
  generatedAt: string | null;
  fullFidelity: boolean;
  days: ReadonlyMap<string, GfwHourlyTrackDayEntry>;
  sourceLayers?: { edges: string; singletons: string } | null;
  frames?: ReadonlyMap<string, GfwUnifiedTrackFrame>;
  attribution?: { label: string; href: string };
}

export interface GfwHourlyTrackFrameNode {
  trackId: string;
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  shipTypeBucket: string | null;
  coordinate: GeoJSON.Position;
  observedEpoch: number;
  toEpoch: number | null;
  toCoordinate: GeoJSON.Position | null;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const nullableString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : null;
};

const strictUtcDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};

const finiteCoordinate = (raw: unknown): GeoJSON.Position | null =>
  Array.isArray(raw) && raw.length >= 2 && typeof raw[0] === "number" && Number.isFinite(raw[0]) &&
  typeof raw[1] === "number" && Number.isFinite(raw[1]) ? [raw[0], raw[1]] : null;

function parseObservedTimes(raw: unknown): string[] | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  const times = value as string[];
  // Explicit UTC is part of the exporter contract; a timezone-less ISO value must fail closed.
  if (times.some((time) => !/(?:Z|[+]00:00)$/.test(time))) return null;
  return times;
}

function parseTrack(raw: unknown): GfwHourlyTrack | null {
  if (!isObject(raw) || raw.type !== "Feature" || !isObject(raw.geometry)) return null;
  if (raw.geometry.type !== "LineString" || !Array.isArray(raw.geometry.coordinates)) return null;
  if (!isObject(raw.properties)) return null;

  const coordinates: GeoJSON.Position[] = [];
  for (const coordinate of raw.geometry.coordinates) {
    if (
      !Array.isArray(coordinate) || coordinate.length < 2 ||
      typeof coordinate[0] !== "number" || !Number.isFinite(coordinate[0]) ||
      typeof coordinate[1] !== "number" || !Number.isFinite(coordinate[1])
    ) return null;
    coordinates.push([coordinate[0], coordinate[1]]);
  }
  if (coordinates.length < 2) return null;

  const p = raw.properties;
  const observedTimes = parseObservedTimes(p.observed_times);
  if (!observedTimes || observedTimes.length !== coordinates.length) return null;
  const observedTimesMs = observedTimes.map((value) => Date.parse(value));
  if (observedTimesMs.some((value) => !Number.isFinite(value))) return null;
  for (let i = 1; i < observedTimesMs.length; i++) {
    if (observedTimesMs[i]! <= observedTimesMs[i - 1]!) return null;
  }
  if (p.start_at !== observedTimes[0] || p.end_at !== observedTimes[observedTimes.length - 1]) return null;

  if (typeof p.vessel_id !== "string" || p.vessel_id.trim() === "") return null;
  if (!Number.isInteger(p.segment_index) || (p.segment_index as number) < 0) return null;
  if (p.approximate !== true || typeof p.source_dataset !== "string" || p.source_dataset === "") return null;
  if (p.point_count !== undefined && p.point_count !== coordinates.length) return null;

  return {
    vesselId: p.vessel_id,
    mmsi: nullableString(p.mmsi),
    shipName: nullableString(p.ship_name),
    vesselType: nullableString(p.vessel_type),
    flag: nullableString(p.flag),
    segmentIndex: p.segment_index as number,
    approximate: true,
    sourceDataset: p.source_dataset,
    coordinates,
    observedTimes,
    observedTimesMs,
  };
}

function safeDayPath(value: unknown, releaseId: string, displayDate: string): string | null {
  if (typeof value !== "string") return null;
  const expected = `releases/${releaseId}/days/${displayDate}.geojson`;
  return value === expected ? value : null;
}

export function parseGfwHourlyTrackManifest(
  raw: unknown,
  manifestUrl = GFW_HOURLY_TRACKS_LOCAL_MANIFEST_URL,
): GfwHourlyTrackManifest | null {
  const unified = parseGfwHourlyUnifiedManifest(raw, manifestUrl);
  if (unified) {
    return {
      manifestUrl,
      releaseId: unified.releaseId,
      latestCompleteDate: unified.latestCompleteDate,
      dateStart: unified.dateStart,
      dateEnd: unified.dateEnd,
      generatedAt: unified.generatedAt,
      fullFidelity: unified.fullFidelity,
      days: unified.trackDays,
      sourceLayers: unified.trackSourceLayers,
      frames: unified.trackFrames,
      attribution: unified.attribution,
    };
  }
  // Production CDN 只接受單一 root v2；舊 v1 只是 dev POC adapter。
  if (isGfwHourlyProductionManifestUrl(manifestUrl)) return null;
  if (!isObject(raw) || raw.schema_version !== 1 || !Array.isArray(raw.days)) return null;
  const releaseId = strictUtcDate(raw.release_id);
  const latestCompleteDate = strictUtcDate(raw.latest_complete_date);
  const dateStart = strictUtcDate(raw.date_start);
  const dateEnd = strictUtcDate(raw.date_end);
  if (!releaseId || !latestCompleteDate || !dateStart || !dateEnd) return null;
  if (dateStart > dateEnd || dateEnd > latestCompleteDate || releaseId !== latestCompleteDate) return null;
  if (!isObject(raw.track_contract)) return null;
  if (
    raw.track_contract.frontend_load !== "one_UTC_display_day_partition" ||
    raw.track_contract.maximum_lookback_hours !== 3 ||
    raw.track_contract.lookahead_hours_for_linear_interpolation !== 1 ||
    raw.track_contract.interpolation !== "linear_between_adjacent_hourly_grid_centers" ||
    !Array.isArray(raw.track_contract.supported_trail_hours) ||
    raw.track_contract.supported_trail_hours.join(",") !== "0.5,1,2,3"
  ) return null;

  const days = new Map<string, GfwHourlyTrackDayEntry>();
  for (const value of raw.days) {
    if (!isObject(value)) return null;
    const displayDate = strictUtcDate(value.display_date);
    const path = displayDate ? safeDayPath(value.path, releaseId, displayDate) : null;
    if (
      !displayDate || !path || displayDate < dateStart || displayDate > dateEnd || days.has(displayDate) ||
      !Number.isInteger(value.bytes) || (value.bytes as number) < 0 ||
      !Number.isInteger(value.features) || (value.features as number) < 0 ||
      !Number.isInteger(value.points) || (value.points as number) < 0
    ) return null;
    days.set(displayDate, {
      displayDate,
      path,
      bytes: value.bytes as number,
      features: value.features as number,
      points: value.points as number,
      format: "geojson",
      detailBuckets: [],
    });
  }
  let expectedDayCount = 0;
  for (
    let cursor = Date.parse(`${dateStart}T00:00:00Z`);
    cursor <= Date.parse(`${dateEnd}T00:00:00Z`);
    cursor += 86_400_000
  ) {
    expectedDayCount += 1;
    if (!days.has(new Date(cursor).toISOString().slice(0, 10))) return null;
  }
  if (days.size !== expectedDayCount) return null;
  return {
    manifestUrl,
    releaseId,
    latestCompleteDate,
    dateStart,
    dateEnd,
    generatedAt: nullableString(raw.generated_at),
    fullFidelity: false,
    days,
    sourceLayers: null,
    frames: new Map(),
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
  };
}

export function parseGfwHourlyTrackCollection(
  raw: unknown,
  expectedDisplayDate: string,
  fullFidelity = false,
): GfwHourlyTrackCollection | null {
  if (!isObject(raw) || raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
  if (!isObject(raw.metadata) || raw.metadata.schema_version !== 1) return null;
  if (
    raw.metadata.display_date !== expectedDisplayDate ||
    raw.metadata.display_timezone !== "UTC" ||
    raw.metadata.interpolation !== "linear_between_adjacent_hourly_grid_centers" ||
    !Array.isArray(raw.metadata.supported_trail_hours) ||
    raw.metadata.supported_trail_hours.join(",") !== "0.5,1,2,3" ||
    !isObject(raw.metadata.overlap) ||
    raw.metadata.overlap.lookback_hours !== 3 ||
    raw.metadata.overlap.lookahead_hours !== 1
  ) return null;
  const dayStartMs = Date.parse(`${expectedDisplayDate}T00:00:00Z`);
  const windowStartMs = Date.parse(String(raw.metadata.overlap.window_start));
  const windowEndMs = Date.parse(String(raw.metadata.overlap.window_end));
  if (
    !Number.isFinite(dayStartMs) ||
    !/(?:Z|[+]00:00)$/.test(String(raw.metadata.overlap.window_start)) ||
    !/(?:Z|[+]00:00)$/.test(String(raw.metadata.overlap.window_end)) ||
    windowStartMs !== dayStartMs - 3 * 3_600_000 ||
    windowEndMs !== dayStartMs + 25 * 3_600_000
  ) return null;
  const tracks: GfwHourlyTrack[] = [];
  for (const feature of raw.features) {
    const parsed = parseTrack(feature);
    // Contract is all-or-nothing: one malformed segment must not be drawn with shifted timestamps.
    if (!parsed) return null;
    if (
      parsed.observedTimesMs[0]! < windowStartMs ||
      parsed.observedTimesMs[parsed.observedTimesMs.length - 1]! > windowEndMs
    ) return null;
    tracks.push(parsed);
  }

  const pointCount = tracks.reduce((sum, track) => sum + track.coordinates.length, 0);
  if (
    raw.metadata.feature_count !== tracks.length ||
    raw.metadata.point_count !== pointCount
  ) return null;

  return { tracks, displayDate: expectedDisplayDate, fullFidelity };
}

/** v3 hourly endpoint frame: only same-segment `to_*` fields permit interpolation. */
export function parseGfwHourlyTrackFrame(raw: unknown, expectedObservedAt: string): GfwHourlyTrackFrameNode[] | null {
  if (!isObject(raw) || raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
  const expectedEpoch = Date.parse(expectedObservedAt) / 1000;
  if (!Number.isInteger(expectedEpoch)) return null;
  const nodes: GfwHourlyTrackFrameNode[] = [];
  const seen = new Set<string>();
  for (const feature of raw.features) {
    if (!isObject(feature) || feature.type !== "Feature" || !isObject(feature.geometry) || feature.geometry.type !== "Point" ||
      !isObject(feature.properties)) return null;
    const coordinate = finiteCoordinate(feature.geometry.coordinates);
    const p = feature.properties;
    if (!coordinate || typeof p.track_id !== "string" || !p.track_id || typeof p.vessel_id !== "string" || !p.vessel_id ||
      !Number.isInteger(p.observed_epoch) || p.observed_epoch !== expectedEpoch) return null;
    const toFields = [p.to_epoch, p.to_lon, p.to_lat];
    const hasTo = toFields.some((value) => value !== undefined && value !== null);
    const toEpoch = typeof p.to_epoch === "number" ? p.to_epoch : null;
    const toLon = typeof p.to_lon === "number" ? p.to_lon : null;
    const toLat = typeof p.to_lat === "number" ? p.to_lat : null;
    if (hasTo && (toEpoch === null || !Number.isInteger(toEpoch) || toLon === null || !Number.isFinite(toLon) ||
      toLat === null || !Number.isFinite(toLat) || toEpoch <= p.observed_epoch)) return null;
    const key = `${p.track_id}|${p.vessel_id}`;
    if (seen.has(key)) return null;
    seen.add(key);
    nodes.push({
      trackId: p.track_id,
      vesselId: p.vessel_id,
      mmsi: nullableString(p.mmsi), shipName: nullableString(p.ship_name), vesselType: nullableString(p.vessel_type), flag: nullableString(p.flag),
      shipTypeBucket: nullableString(p.ship_type_bucket),
      coordinate,
      observedEpoch: p.observed_epoch,
      toEpoch: hasTo ? toEpoch : null,
      toCoordinate: hasTo && toLon !== null && toLat !== null ? [toLon, toLat] : null,
    });
  }
  return nodes;
}

export async function loadGfwHourlyTracksFrame(
  manifest: GfwHourlyTrackManifest,
  observedAt: string,
): Promise<GfwHourlyTrackFrameNode[] | null> {
  const entry = manifest.frames?.get(observedAt);
  if (!entry) return null;
  return parseGfwHourlyTrackFrame(await loadGfwGzipJsonAsset(manifest.manifestUrl, entry), observedAt);
}

/** v3 frame node only interpolates within the exporter-declared adjacent segment. */
export function gfwHourlyTrackFrameEndpoints(
  nodes: readonly GfwHourlyTrackFrameNode[],
  timeSeconds: number,
  fullFidelity: boolean,
): GeoJSON.FeatureCollection {
  const selectedEpoch = timeSeconds;
  const grouped = new Map<string, GfwHourlyTrackFrameNode[]>();
  const locations = new Map<string, GeoJSON.Position>();
  for (const node of nodes) {
    // 缺 `to_*` 只代表一個瞬時觀測，絕不可把它硬 hold 成一小時的船頭。
    if (selectedEpoch < node.observedEpoch || (node.toEpoch === null && selectedEpoch !== node.observedEpoch) ||
      (node.toEpoch !== null && selectedEpoch > node.toEpoch)) continue;
    const ratio = node.toEpoch !== null && node.toCoordinate !== null
      ? (selectedEpoch - node.observedEpoch) / (node.toEpoch - node.observedEpoch) : 0;
    const coordinate: GeoJSON.Position = node.toCoordinate
      ? [node.coordinate[0]! + (node.toCoordinate[0]! - node.coordinate[0]!) * ratio, node.coordinate[1]! + (node.toCoordinate[1]! - node.coordinate[1]!) * ratio]
      : node.coordinate;
    const key = `${coordinate[0]},${coordinate[1]}`;
    const values = grouped.get(key) ?? [];
    values.push(node);
    grouped.set(key, values);
    locations.set(key, coordinate);
  }
  return {
    type: "FeatureCollection",
    features: [...grouped.entries()].map(([key, members]) => {
      const first = members[0]!;
      const vessels = members.map((member) => ({ vessel_id: member.vesselId, mmsi: member.mmsi, ship_name: member.shipName, vessel_type: member.vesselType, flag: member.flag }));
      const buckets = new Set(members.map((member) => member.shipTypeBucket ?? gfwShipTypeBucket(member.vesselType)));
      const mixed = buckets.size > 1;
      const bucket = first.shipTypeBucket ?? gfwShipTypeBucket(first.vesselType);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: locations.get(key)! },
        properties: {
          vessel_id: first.vesselId, track_ids: members.map((member) => member.trackId).join(","),
          mmsi: first.mmsi, ship_name: first.shipName, vessel_type: first.vesselType, flag: first.flag,
          vessel_count: members.length, vessels_json: JSON.stringify(vessels), mixed_type: mixed ? 1 : 0,
          ship_type_bucket: mixed ? "mixed" : bucket, ship_type_label: mixed ? "混合船種 Mixed" : shipTypeBucketLabel(bucket as ReturnType<typeof gfwShipTypeBucket>),
          selected_time: new Date(selectedEpoch * 1000).toISOString(), interpolated: selectedEpoch === first.observedEpoch ? 0 : 1,
          full_fidelity: fullFidelity ? 1 : 0, source_dataset: "Global Fishing Watch", endpoint_grouped: 1,
        },
      };
    }),
  };
}

function frameCoordinate(node: GfwHourlyTrackFrameNode, epoch: number): GeoJSON.Position | null {
  if (epoch < node.observedEpoch) return null;
  if (epoch === node.observedEpoch) return node.coordinate;
  if (node.toEpoch === null || node.toCoordinate === null || epoch > node.toEpoch) return null;
  const ratio = (epoch - node.observedEpoch) / (node.toEpoch - node.observedEpoch);
  return [
    node.coordinate[0]! + (node.toCoordinate[0]! - node.coordinate[0]!) * ratio,
    node.coordinate[1]! + (node.toCoordinate[1]! - node.coordinate[1]!) * ratio,
  ];
}

/**
 * v3 short trail only uses hourly frame segments that overlap the selected window.
 * It clips at both ends; no PMTiles all-day edge and no segment geometry after selected time.
 */
export function gfwHourlyTrackFrameTrail(
  frames: ReadonlyMap<number, readonly GfwHourlyTrackFrameNode[]>,
  timeSeconds: number,
  trailingHours: number,
  fullFidelity: boolean,
  displayDate: string,
): { lines: GeoJSON.FeatureCollection; endpoints: GeoJSON.FeatureCollection } {
  const selected = Math.floor(timeSeconds);
  const start = selected - Math.round(Math.max(0.5, trailingHours) * 3_600);
  const lines: GeoJSON.Feature[] = [];
  const endpointNodes = frames.get(Math.floor(selected / 3_600) * 3_600) ?? [];
  for (const nodes of frames.values()) for (const node of nodes) {
    if (node.toEpoch === null || node.toCoordinate === null) continue;
    const from = Math.max(start, node.observedEpoch);
    const to = Math.min(selected, node.toEpoch);
    if (from >= to) continue;
    const fromCoordinate = frameCoordinate(node, from);
    const toCoordinate = frameCoordinate(node, to);
    if (!fromCoordinate || !toCoordinate) continue;
    const bucket = node.shipTypeBucket ?? gfwShipTypeBucket(node.vesselType);
    lines.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [fromCoordinate, toCoordinate] },
      properties: {
        track_id: node.trackId, vessel_id: node.vesselId, mmsi: node.mmsi, ship_name: node.shipName,
        vessel_type: node.vesselType, flag: node.flag, ship_type_bucket: bucket, ship_type_label: shipTypeBucketLabel(bucket as ReturnType<typeof gfwShipTypeBucket>),
        selected_time: new Date(selected * 1_000).toISOString(), start_at: new Date(from * 1_000).toISOString(),
        end_at: new Date(to * 1_000).toISOString(), point_count: 2, interpolated: 1,
        display_date: displayDate,
        full_fidelity: fullFidelity ? 1 : 0, source_dataset: "Global Fishing Watch", approximate: 1,
      },
    });
  }
  return { lines: { type: "FeatureCollection", features: lines }, endpoints: gfwHourlyTrackFrameEndpoints(endpointNodes, timeSeconds, fullFidelity) };
}

export async function loadGfwHourlyTrackManifest(): Promise<GfwHourlyTrackManifest | null> {
  const manifestUrl = resolveGfwHourlyTracksManifestUrl();
  if (!manifestUrl) return null;
  return withLoading(
    "gfw-hourly-tracks:manifest",
    "GFW 航跡版本資訊",
    fetch(manifestUrl, { cache: "no-cache" })
      .then(async (response) => response.ok
        ? parseGfwHourlyTrackManifest(await response.json(), manifestUrl)
        : null)
      .catch(() => null),
  );
}

const dayPromises = new Map<string, Promise<GfwHourlyTrackCollection | null>>();

export function loadGfwHourlyTracksDay(
  manifest: GfwHourlyTrackManifest,
  displayDate: string,
): Promise<GfwHourlyTrackCollection | null> {
  const entry = manifest.days.get(displayDate);
  if (!entry) return Promise.resolve(null);
  const key = `${manifest.releaseId}|${displayDate}`;
  const cached = dayPromises.get(key);
  if (cached) return cached;
  const promise = withLoading(
    `gfw-hourly-tracks:day:${key}`,
    `GFW 航跡 ${displayDate} UTC`,
    fetch(new URL(
      entry.path,
      new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost"),
    ).toString(), { cache: "force-cache" })
      .then(async (response) => response.ok
        ? parseGfwHourlyTrackCollection(await response.json(), displayDate, manifest.fullFidelity)
        : null)
      .catch(() => null),
  );
  dayPromises.set(key, promise);
  void promise.then((data) => {
    // 暫時 HTTP/network/parse 失敗不可變成整個 session 的永久空 cache。
    if (!data && dayPromises.get(key) === promise) dayPromises.delete(key);
  });
  return promise;
}

export function gfwHourlyTracksUtcDate(timeSeconds: number): string | null {
  const date = new Date(Math.round(timeSeconds * 1000));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

interface TimedCoordinate {
  coordinate: GeoJSON.Position;
  timeMs: number;
  interpolated: boolean;
}

function coordinateAt(track: GfwHourlyTrack, timeMs: number): TimedCoordinate | null {
  const times = track.observedTimesMs;
  const lastIndex = times.length - 1;
  if (timeMs < times[0]! || timeMs > times[lastIndex]!) return null;

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const observedMs = times[mid]!;
    if (observedMs === timeMs) {
      return { coordinate: track.coordinates[mid]!, timeMs, interpolated: false };
    }
    if (observedMs < timeMs) low = mid + 1;
    else high = mid - 1;
  }

  const leftIndex = high;
  const rightIndex = low;
  if (leftIndex < 0 || rightIndex > lastIndex) return null;
  const leftMs = times[leftIndex]!;
  const rightMs = times[rightIndex]!;
  const ratio = (timeMs - leftMs) / (rightMs - leftMs);
  const left = track.coordinates[leftIndex]!;
  const right = track.coordinates[rightIndex]!;
  return {
    coordinate: [
      left[0]! + (right[0]! - left[0]!) * ratio,
      left[1]! + (right[1]! - left[1]!) * ratio,
    ],
    timeMs,
    interpolated: true,
  };
}

function trackSlice(track: GfwHourlyTrack, fromMs: number, toMs: number): TimedCoordinate[] {
  const start = coordinateAt(track, fromMs);
  const end = coordinateAt(track, toMs);
  if (!start || !end || fromMs > toMs) return [];

  const points: TimedCoordinate[] = [start];
  for (let i = 0; i < track.observedTimesMs.length; i++) {
    const observedMs = track.observedTimesMs[i]!;
    if (observedMs <= fromMs || observedMs >= toMs) continue;
    points.push({ coordinate: track.coordinates[i]!, timeMs: observedMs, interpolated: false });
  }
  if (toMs > fromMs) points.push(end);
  return points;
}

function runtimeProperties(
  track: GfwHourlyTrack,
  selectedMs: number,
  points: TimedCoordinate[],
  endpointInterpolated: boolean,
  fullFidelity: boolean,
) {
  const shipTypeBucket = gfwShipTypeBucket(track.vesselType);
  return {
    vessel_id: track.vesselId,
    mmsi: track.mmsi,
    ship_name: track.shipName,
    vessel_type: track.vesselType,
    ship_type_bucket: shipTypeBucket,
    ship_type_label: shipTypeBucketLabel(shipTypeBucket),
    flag: track.flag,
    segment_index: track.segmentIndex,
    approximate: 1,
    full_fidelity: fullFidelity ? 1 : 0,
    source_dataset: track.sourceDataset,
    coordinate_semantics: "GFW_HIGH_grid_cell_center",
    selected_time: new Date(selectedMs).toISOString(),
    interpolated: endpointInterpolated ? 1 : 0,
    start_at: new Date(points[0]!.timeMs).toISOString(),
    end_at: new Date(points[points.length - 1]!.timeMs).toISOString(),
    point_count: points.length,
    segment_point_count: track.coordinates.length,
  };
}

/**
 * 依時間軸裁出每個既有 segment 的拖尾。只在單一上游 segment 的相鄰觀測之間
 * 作時間比例線性內插，不會跨缺訊／跳點切口，也不會在 segment 範圍外外插假船頭。
 */
export function gfwHourlyTracksFrame(
  collection: GfwHourlyTrackCollection,
  timeSeconds: number,
  trailingHours: number,
): { lines: GeoJSON.FeatureCollection; endpoints: GeoJSON.FeatureCollection } {
  const selectedMs = Math.round(timeSeconds * 1000);
  const fromMs = selectedMs - Math.max(0.5, trailingHours) * 3_600_000;
  const lines: GeoJSON.Feature[] = [];
  const endpoints: GeoJSON.Feature[] = [];

  for (const track of collection.tracks) {
    const firstMs = track.observedTimesMs[0]!;
    const lastMs = track.observedTimesMs[track.observedTimesMs.length - 1]!;
    if (selectedMs < firstMs || fromMs > lastMs) continue;

    const sliceFromMs = Math.max(fromMs, firstMs);
    const sliceToMs = Math.min(selectedMs, lastMs);
    const points = trackSlice(track, sliceFromMs, sliceToMs);
    if (points.length === 0) continue;

    const endpoint = coordinateAt(track, selectedMs);
    const properties = runtimeProperties(track, selectedMs, points, endpoint?.interpolated ?? false, collection.fullFidelity);
    if (points.length >= 2) {
      lines.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: points.map((point) => point.coordinate) },
        properties,
      });
    }
    if (endpoint) endpoints.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: endpoint.coordinate },
      properties: { ...properties, endpoint: "selected_time" },
    });
  }

  const endpointGroups = new Map<string, GeoJSON.Feature[]>();
  for (const endpoint of endpoints) {
    const [lon, lat] = (endpoint.geometry as GeoJSON.Point).coordinates;
    const key = `${lon},${lat}`; // exact runtime coordinate, intentionally no spatial snap/rounding
    const group = endpointGroups.get(key) ?? [];
    group.push(endpoint);
    endpointGroups.set(key, group);
  }
  const groupedEndpoints: GeoJSON.Feature[] = [];
  for (const group of endpointGroups.values()) {
    const first = group[0]!;
    const vessels = group.map((feature) => {
      const p = feature.properties ?? {};
      return {
        vessel_id: String(p.vessel_id),
        mmsi: typeof p.mmsi === "string" ? p.mmsi : null,
        ship_name: typeof p.ship_name === "string" ? p.ship_name : null,
        vessel_type: typeof p.vessel_type === "string" ? p.vessel_type : null,
        flag: typeof p.flag === "string" ? p.flag : null,
      };
    });
    const buckets = new Set(group.map((feature) => String(feature.properties?.ship_type_bucket ?? "other")));
    const mixed = buckets.size > 1;
    groupedEndpoints.push({
      ...first,
      properties: {
        ...first.properties,
        vessel_count: vessels.length,
        vessels_json: JSON.stringify(vessels),
        mixed_type: mixed ? 1 : 0,
        ship_type_bucket: mixed ? "mixed" : first.properties?.ship_type_bucket,
        ship_type_label: mixed ? "混合船種 Mixed" : first.properties?.ship_type_label,
        endpoint_grouped: 1,
      },
    });
  }

  return {
    lines: { type: "FeatureCollection", features: lines },
    endpoints: { type: "FeatureCollection", features: groupedEndpoints },
  };
}
