import { withLoading } from "../lib/loadingRegistry";
import { gfwShipTypeBucket, shipTypeBucketLabel } from "./shipTrails";
import {
  isGfwHourlyProductionManifestUrl,
  parseGfwHourlyUnifiedManifest,
  resolveGfwHourlyRootManifestUrl,
} from "./gfwHourlyReleaseManifest";

export const GFW_HOURLY_TRACKS_LOCAL_MANIFEST_URL = "/gfw_hourly_tracks_poc/manifest.json";

/** Production 預設走同域 unified root，env 僅作 CDN origin override；Vite dev 走 local POC。 */
export function resolveGfwHourlyTracksManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
): string | null {
  return resolveGfwHourlyRootManifestUrl(GFW_HOURLY_TRACKS_LOCAL_MANIFEST_URL, cdnBase, isDev);
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
}

export interface GfwHourlyTrackDayEntry {
  displayDate: string;
  path: string;
  bytes: number;
  features: number;
  points: number;
}

export interface GfwHourlyTrackManifest {
  manifestUrl: string;
  releaseId: string;
  latestCompleteDate: string;
  dateStart: string;
  dateEnd: string;
  generatedAt: string | null;
  days: ReadonlyMap<string, GfwHourlyTrackDayEntry>;
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
      days: unified.trackDays,
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
    days,
  };
}

export function parseGfwHourlyTrackCollection(
  raw: unknown,
  expectedDisplayDate: string,
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

  return { tracks, displayDate: expectedDisplayDate };
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
        ? parseGfwHourlyTrackCollection(await response.json(), displayDate)
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
    const properties = runtimeProperties(track, selectedMs, points, endpoint?.interpolated ?? false);
    if (points.length >= 2) {
      lines.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: points.map((point) => point.coordinate) },
        properties,
      });
    }
    if (endpoint) {
      endpoints.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: endpoint.coordinate },
        properties: { ...properties, endpoint: "selected_time" },
      });
    }
  }

  return {
    lines: { type: "FeatureCollection", features: lines },
    endpoints: { type: "FeatureCollection", features: endpoints },
  };
}
