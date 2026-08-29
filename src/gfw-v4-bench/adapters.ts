import { parseJsonTrackPack, parseVesselMember } from "./contract";
import type { TrackAssetFormat, TrackBucket, TrackPack, TrackPoint, TrackSegment, VesselMember } from "./types";

const MAGIC = "GFW4TRK1";
const HEADER_BYTES = 24;
type BinaryMetadata = {
  schema_version: 1;
  display_date: string;
  bucket: TrackBucket;
  vessels: unknown[];
  segments: Array<{ track_id: string; vessel_index: number; point_offset: number; point_count: number }>;
};

async function maybeGunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const view = new Uint8Array(bytes);
  if (view[0] !== 0x1f || view[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function decodeJsonGzipTrackPack(bytes: ArrayBuffer, date: string, bucket: TrackBucket): Promise<TrackPack> {
  const decoded = await maybeGunzip(bytes);
  const raw = JSON.parse(new TextDecoder().decode(decoded)) as unknown;
  const pack = parseJsonTrackPack(raw, date, bucket);
  if (!pack) throw new Error("Invalid JSON.gz track-pack contract");
  return pack;
}

/**
 * Compact typed POC contract (little-endian):
 * 8-byte ASCII magic GFW4TRK1; u32 version; u32 metadata bytes; u32 point count;
 * u32 segment count; metadata JSON; Float32 lon[N]; Float32 lat[N]; Uint32 UTC epoch[N].
 */
export function decodeBinaryTrackPack(bytes: ArrayBuffer, date: string, bucket: TrackBucket): TrackPack {
  if (bytes.byteLength < HEADER_BYTES) throw new Error("Binary track-pack header truncated");
  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  const header = new DataView(bytes);
  const version = header.getUint32(8, true);
  const metadataBytes = header.getUint32(12, true);
  const pointCount = header.getUint32(16, true);
  const segmentCount = header.getUint32(20, true);
  const arraysBytes = pointCount * 12;
  if (magic !== MAGIC || version !== 1 || (HEADER_BYTES + metadataBytes) % 4 !== 0 || HEADER_BYTES + metadataBytes + arraysBytes !== bytes.byteLength) {
    throw new Error("Invalid binary track-pack envelope");
  }
  const metadata = JSON.parse(new TextDecoder().decode(bytes.slice(HEADER_BYTES, HEADER_BYTES + metadataBytes))) as BinaryMetadata;
  if (metadata.schema_version !== 1 || metadata.display_date !== date || metadata.bucket !== bucket ||
    !Array.isArray(metadata.vessels) || !Array.isArray(metadata.segments) || metadata.segments.length !== segmentCount) {
    throw new Error("Invalid binary track-pack metadata");
  }
  const vessels: VesselMember[] = [];
  for (const value of metadata.vessels) {
    const vessel = parseVesselMember(value);
    if (!vessel) throw new Error("Invalid binary vessel table");
    vessels.push(vessel);
  }
  const base = HEADER_BYTES + metadataBytes;
  const lon = new Float32Array(bytes, base, pointCount);
  const lat = new Float32Array(bytes, base + pointCount * 4, pointCount);
  const epoch = new Uint32Array(bytes, base + pointCount * 8, pointCount);
  const segments: TrackSegment[] = [];
  const ids = new Set<string>();
  for (const segment of metadata.segments) {
    const end = segment.point_offset + segment.point_count;
    const vessel = vessels[segment.vessel_index];
    if (!segment.track_id || ids.has(segment.track_id) || !vessel || segment.point_count < 1 || end > pointCount) {
      throw new Error("Invalid binary segment index");
    }
    ids.add(segment.track_id);
    const points: TrackPoint[] = [];
    for (let index = segment.point_offset; index < end; index++) {
      const point = { lon: lon[index]!, lat: lat[index]!, epoch: epoch[index]! };
      if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat) || point.lon < -180 || point.lon > 180 ||
        point.lat < -90 || point.lat > 90 || (points.length > 0 && point.epoch <= points[points.length - 1]!.epoch)) {
        throw new Error("Invalid binary point sequence");
      }
      points.push(point);
    }
    segments.push({ trackId: segment.track_id, vessel, points });
  }
  if (segments.reduce((sum, segment) => sum + segment.points.length, 0) !== pointCount) {
    throw new Error("Binary point table is not fully owned by segments");
  }
  return { displayDate: date, bucket, segments, pointCount };
}

export async function decodeTrackAsset(
  bytes: ArrayBuffer,
  format: TrackAssetFormat,
  date: string,
  bucket: TrackBucket,
): Promise<TrackPack> {
  return format === "binary"
    ? decodeBinaryTrackPack(await maybeGunzip(bytes), date, bucket)
    : decodeJsonGzipTrackPack(bytes, date, bucket);
}

export const BINARY_TRACK_PACK_MAGIC = MAGIC;
