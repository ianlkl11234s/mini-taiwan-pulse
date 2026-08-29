import type { Map as MapboxMap } from "mapbox-gl";

export interface GfwV4TrackPickPoint { x: number; y: number; }

export interface GfwV4TrackPickResult {
  feature: GeoJSON.Feature<GeoJSON.Point>;
  generation: number;
  frameEpoch: number;
  /** False once the formal layer advances to another applied frame, is hidden, or is disposed. */
  isCurrent: () => boolean;
}

export interface GfwV4TrackPickCandidate {
  generation: number;
  frameEpoch: number;
  pointIndex: number;
  coords: [number, number];
  result: Promise<GfwV4TrackPickResult | null>;
}

export const GFW_V4_TRACK_PICK_ALPHA_MIN = 32;

export function nearestGfwV4TrackPoint(
  map: Pick<MapboxMap, "project">,
  points: Float32Array,
  point: GfwV4TrackPickPoint,
  radiusPx = 5,
  pointAlphas?: Uint8Array,
): { pointIndex: number; coords: [number, number] } | null {
  let nearestIndex = -1;
  let nearestDistanceSq = radiusPx * radiusPx;
  for (let index = 0; index < points.length / 2; index += 1) {
    if (pointAlphas && (pointAlphas[index] ?? 0) < GFW_V4_TRACK_PICK_ALPHA_MIN) continue;
    const lon = points[index * 2]!;
    const lat = points[index * 2 + 1]!;
    const projected = map.project([lon, lat]);
    const dx = projected.x - point.x;
    const dy = projected.y - point.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq <= nearestDistanceSq) {
      nearestIndex = index;
      nearestDistanceSq = distanceSq;
    }
  }
  return nearestIndex < 0 ? null : {
    pointIndex: nearestIndex,
    coords: [points[nearestIndex * 2]!, points[nearestIndex * 2 + 1]!],
  };
}

type ActivePicker = (map: MapboxMap, point: GfwV4TrackPickPoint, radiusPx: number) => GfwV4TrackPickCandidate | null;
let activePicker: ActivePicker | null = null;

/** A formal v4 layer owns the picker only for its mounted lifetime. */
export function registerGfwV4TrackPicker(picker: ActivePicker): () => void {
  activePicker = picker;
  return () => { if (activePicker === picker) activePicker = null; };
}

export function beginGfwV4TrackPick(
  map: MapboxMap,
  point: GfwV4TrackPickPoint,
  radiusPx = 5,
): GfwV4TrackPickCandidate | null {
  return activePicker?.(map, point, radiusPx) ?? null;
}
