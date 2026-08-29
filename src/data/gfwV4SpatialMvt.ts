export const GFW_V4_TRACK_FRAME_SOURCE_LAYER = "gfw_v4_track_frame";
export interface GfwV4MvtPoint {
  lon: number; lat: number; vesselId: string; trackId: string; mmsi: string | null; shipName: string | null;
  vesselType: string | null; flag: string | null; shipTypeBucket: string; observedAt: string; observedEpoch: number;
  toLon: number | null; toLat: number | null; toEpoch: number | null;
}
type Properties = Record<string, unknown>;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nullableText = (value: unknown): string | null => text(value) ? value : null;

/** Fail closed: only a point with the frozen vessel identity contract may enter GPU buffers. */
export function parseGfwV4TrackFrameMvtFeature(raw: { id?: unknown; type?: unknown; properties?: Properties; geometry: readonly { x: number; y: number }[][] }, lon: number, lat: number): GfwV4MvtPoint | null {
  const properties = raw.properties;
  // MVT feature.id is an optional uint64; immutable string identity lives in properties.
  if (raw.type !== 1 || !properties || !text(properties.vessel_id) || !text(properties.track_id) || !text(properties.ship_type_bucket) || !text(properties.observed_at) || !finite(properties.observed_epoch) || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  // to_* is intentionally optional: a missing successor is a singleton, never a fabricated future line.
  const successor = [properties.to_at, properties.to_epoch, properties.to_lat, properties.to_lon];
  if (successor.some((value) => value !== undefined) && (!text(properties.to_at) || !finite(properties.to_epoch) || !finite(properties.to_lat) || !finite(properties.to_lon))) return null;
  if (raw.geometry.length !== 1 || raw.geometry[0]?.length !== 1) return null;
  return {
    lon, lat, vesselId: properties.vessel_id, trackId: properties.track_id, mmsi: nullableText(properties.mmsi),
    shipName: nullableText(properties.ship_name), vesselType: nullableText(properties.vessel_type), flag: nullableText(properties.flag),
    shipTypeBucket: properties.ship_type_bucket, observedAt: properties.observed_at, observedEpoch: properties.observed_epoch,
    toLon: finite(properties.to_lon) ? properties.to_lon : null, toLat: finite(properties.to_lat) ? properties.to_lat : null,
    toEpoch: finite(properties.to_epoch) ? properties.to_epoch : null,
  };
}
