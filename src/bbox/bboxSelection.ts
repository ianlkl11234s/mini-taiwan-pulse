export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

const COORDINATE_PRECISION = 5;
const MIN_SPAN = 1e-7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function bboxFromCorners(a: LngLatPoint, b: LngLatPoint): Bbox | null {
  if (![a.lng, a.lat, b.lng, b.lat].every(Number.isFinite)) return null;

  const west = clamp(Math.min(a.lng, b.lng), -180, 180);
  const east = clamp(Math.max(a.lng, b.lng), -180, 180);
  const south = clamp(Math.min(a.lat, b.lat), -90, 90);
  const north = clamp(Math.max(a.lat, b.lat), -90, 90);

  if (east - west < MIN_SPAN || north - south < MIN_SPAN) return null;
  return { west, south, east, north };
}

export function formatCoordinate(value: number): string {
  return value.toFixed(COORDINATE_PRECISION);
}

export function formatBbox(bbox: Bbox): string {
  return [bbox.west, bbox.south, bbox.east, bbox.north]
    .map(formatCoordinate)
    .join(", ");
}

export function bboxToFeature(bbox: Bbox): GeoJSON.Feature<GeoJSON.Polygon> {
  const { west, south, east, north } = bbox;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ]],
    },
  };
}

export function bboxDimensionsKm(bbox: Bbox): { width: number; height: number } {
  const middleLatitude = (bbox.south + bbox.north) / 2;
  const width = (bbox.east - bbox.west) * 111.32 * Math.cos(middleLatitude * Math.PI / 180);
  const height = (bbox.north - bbox.south) * 110.57;
  return { width: Math.abs(width), height: Math.abs(height) };
}
