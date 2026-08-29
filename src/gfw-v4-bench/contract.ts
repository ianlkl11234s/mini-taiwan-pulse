import {
  DEFAULT_TRACK_BUCKETS,
  TRACK_BUCKETS,
  type BenchAssetEntry,
  type BenchDayEntry,
  type BenchManifest,
  type TrackAssetFormat,
  type TrackBucket,
  type TrackPack,
  type TrackPoint,
  type TrackSegment,
  type VesselMember,
  type WorkloadCoverage,
} from "./types";

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isBucket = (value: unknown): value is TrackBucket =>
  typeof value === "string" && TRACK_BUCKETS.includes(value as TrackBucket);
const isFormat = (value: unknown): value is TrackAssetFormat => value === "json.gz" || value === "binary";
const optionalString = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
};
const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const isNonNegativeInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function safeAssetPath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") &&
    !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

function assetKey(bucket: TrackBucket, format: TrackAssetFormat): string {
  return `${bucket}|${format}`;
}

/**
 * Local POC manifest adapter boundary. Collector changes should be handled here only.
 *
 * schema_version=1:
 * { release_id, bbox, days:[{display_date, assets:[{bucket,format,path,bytes,sha256,points,segments}]}] }
 */
export function parseBenchManifest(raw: unknown, manifestUrl: string): BenchManifest | null {
  if (!isObject(raw) || raw.schema_version !== 1 || !isDate(raw.release_id) || !Array.isArray(raw.bbox) ||
    raw.bbox.length !== 4 || raw.bbox.some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    !Array.isArray(raw.days)) return null;
  const days = new Map<string, BenchDayEntry>();
  for (const candidate of raw.days) {
    if (!isObject(candidate) || !isDate(candidate.display_date) || !Array.isArray(candidate.assets) ||
      days.has(candidate.display_date)) return null;
    const assets = new Map<string, BenchAssetEntry>();
    for (const item of candidate.assets) {
      if (!isObject(item) || !isBucket(item.bucket) || !isFormat(item.format) || !safeAssetPath(item.path)) return null;
      const key = assetKey(item.bucket, item.format);
      if (assets.has(key)) return null;
      const bytes = item.bytes === null || item.bytes === undefined ? null : item.bytes;
      const sha256 = item.sha256 === null || item.sha256 === undefined ? null : item.sha256;
      if ((bytes !== null && (!Number.isInteger(bytes) || (bytes as number) < 0)) ||
        !isNonNegativeInteger(item.points) || !isNonNegativeInteger(item.segments) ||
        (sha256 !== null && (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(sha256)))) return null;
      assets.set(key, {
        bucket: item.bucket,
        format: item.format,
        path: item.path,
        bytes: bytes as number | null,
        sha256,
        points: item.points,
        segments: item.segments,
      });
    }
    days.set(candidate.display_date, { displayDate: candidate.display_date, assets });
  }
  if (days.size === 0) return null;
  return {
    manifestUrl,
    releaseId: raw.release_id,
    bbox: raw.bbox as [number, number, number, number],
    days,
  };
}

export function workloadCoverage(
  manifest: BenchManifest,
  displayDate: string,
  enabledBuckets: ReadonlySet<TrackBucket>,
  format: TrackAssetFormat,
): WorkloadCoverage | null {
  const day = manifest.days.get(displayDate);
  if (!day) return null;
  const enabledInOrder = TRACK_BUCKETS.filter((bucket) => enabledBuckets.has(bucket));
  const preset = enabledInOrder.length === TRACK_BUCKETS.length
    ? "all"
    : enabledInOrder.length === DEFAULT_TRACK_BUCKETS.length && DEFAULT_TRACK_BUCKETS.every((bucket) => enabledBuckets.has(bucket))
      ? "default"
      : "custom";
  // This is workload completion, not catalog coverage. Optional buckets that
  // were intentionally not fetched must not make the default day-pack appear
  // partially loaded.
  const workloadBuckets = preset === "default" ? DEFAULT_TRACK_BUCKETS : enabledInOrder;
  let enabledPoints = 0;
  let enabledSegments = 0;
  let totalPoints = 0;
  let totalSegments = 0;
  for (const bucket of workloadBuckets) {
    const asset = day.assets.get(assetKey(bucket, format));
    if (!asset || asset.points === undefined || asset.segments === undefined) continue;
    totalPoints += asset.points;
    totalSegments += asset.segments;
    enabledPoints += asset.points;
    enabledSegments += asset.segments;
  }
  return {
    preset,
    enabled: { points: enabledPoints, segments: enabledSegments },
    total: { points: totalPoints, segments: totalSegments },
    pointFraction: totalPoints === 0 ? 0 : enabledPoints / totalPoints,
    segmentFraction: totalSegments === 0 ? 0 : enabledSegments / totalSegments,
  };
}

export function findAsset(
  manifest: BenchManifest,
  displayDate: string,
  bucket: TrackBucket,
  format: TrackAssetFormat,
): BenchAssetEntry | null {
  return manifest.days.get(displayDate)?.assets.get(assetKey(bucket, format)) ?? null;
}

export function resolveAssetUrl(manifest: BenchManifest, entry: BenchAssetEntry): string {
  return new URL(entry.path, new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost")).toString();
}

const POPUP_STRING_FIELDS = [
  ["entry_timestamp", "entryTimestamp"],
  ["exit_timestamp", "exitTimestamp"],
  ["imo", "imo"],
  ["callsign", "callsign"],
  ["first_transmission_date", "firstTransmissionDate"],
  ["last_transmission_date", "lastTransmissionDate"],
  ["dataset", "dataset"],
  ["geartype", "geartype"],
] as const satisfies ReadonlyArray<readonly [string, keyof VesselMember]>;

/**
 * Shared JSON/binary vessel-table boundary. Legacy five-field records remain
 * valid; every additional popup field fails closed when present with a wrong type.
 */
export function parseVesselMember(raw: unknown): VesselMember | null {
  if (!isObject(raw) || typeof raw.vessel_id !== "string" || raw.vessel_id.trim() === "") return null;
  const mmsi = optionalString(raw.mmsi);
  const shipName = optionalString(raw.ship_name);
  const vesselType = optionalString(raw.vessel_type);
  const flag = optionalString(raw.flag);
  if (mmsi === undefined || shipName === undefined || vesselType === undefined || flag === undefined) return null;
  const vessel: VesselMember = { vesselId: raw.vessel_id, mmsi, shipName, vesselType, flag };
  if (hasOwn(raw, "hours")) {
    if (raw.hours !== null && (typeof raw.hours !== "number" || !Number.isFinite(raw.hours))) return null;
    vessel.hours = raw.hours as number | null;
  }
  for (const [wireKey, memberKey] of POPUP_STRING_FIELDS) {
    if (!hasOwn(raw, wireKey)) continue;
    const value = optionalString(raw[wireKey]);
    if (value === undefined) return null;
    Object.assign(vessel, { [memberKey]: value });
  }
  return vessel;
}

function parsePoint(raw: unknown): TrackPoint | null {
  if (!Array.isArray(raw) || raw.length !== 3 || raw.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  const [lon, lat, epoch] = raw as number[];
  if (lon === undefined || lat === undefined || epoch === undefined || lon < -180 || lon > 180 || lat < -90 || lat > 90 || !Number.isInteger(epoch)) return null;
  return { lon, lat, epoch };
}

function validateSegment(trackId: unknown, vessel: unknown, pointsRaw: unknown): TrackSegment | null {
  if (typeof trackId !== "string" || trackId.length === 0 || !Array.isArray(pointsRaw) || pointsRaw.length < 1) return null;
  const parsedVessel = parseVesselMember(vessel);
  if (!parsedVessel) return null;
  const points: TrackPoint[] = [];
  for (const value of pointsRaw) {
    const point = parsePoint(value);
    if (!point || (points.length > 0 && point.epoch <= points[points.length - 1]!.epoch)) return null;
    points.push(point);
  }
  return { trackId, vessel: parsedVessel, points };
}

export function parseJsonTrackPack(raw: unknown, expectedDate: string, expectedBucket: TrackBucket): TrackPack | null {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.display_date !== expectedDate || raw.bucket !== expectedBucket ||
    !Array.isArray(raw.segments)) return null;
  const segments: TrackSegment[] = [];
  const trackIds = new Set<string>();
  let pointCount = 0;
  for (const candidate of raw.segments) {
    if (!isObject(candidate)) return null;
    const segment = validateSegment(candidate.track_id, candidate.vessel, candidate.points);
    if (!segment || trackIds.has(segment.trackId)) return null;
    trackIds.add(segment.trackId);
    segments.push(segment);
    pointCount += segment.points.length;
  }
  if (raw.segment_count !== segments.length || raw.point_count !== pointCount) return null;
  return { displayDate: expectedDate, bucket: expectedBucket, segments, pointCount };
}

export const __contractTestOnly = { validateSegment, assetKey };
