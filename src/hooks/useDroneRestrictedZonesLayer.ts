import type { Map as MapboxMap } from "mapbox-gl";

/** Temporary no-op stub; drone zones implementation is outside the wind/ocean renderer fix. */
export function useDroneZonesLayer(
  _mapRef: React.RefObject<MapboxMap | null>,
  _noFlyVisible: boolean,
  _restrictedVisible: boolean,
  _noFlyOpacity: number,
  _restrictedOpacity: number,
) {
  // no-op
}
