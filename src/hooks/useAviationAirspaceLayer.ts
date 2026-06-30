import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Temporary no-op stub to unblock the in-progress GLOBAL CLIMATE visual QA.
 * Aviation PMTiles/rendering implementation is not part of the wind/ocean current fix.
 */
export function useAviationAirspaceLayer(
  _mapRef: React.RefObject<MapboxMap | null>,
  _controlVisible: boolean,
  _restrictedVisible: boolean,
  _controlOpacity: number,
  _restrictedOpacity: number,
) {
  // no-op
}
