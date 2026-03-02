import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Layer } from "@deck.gl/core";
import type { Map as MapboxMap } from "mapbox-gl";

let overlay: MapboxOverlay | null = null;

/**
 * Initialize deck.gl MapboxOverlay on a Mapbox map instance.
 * Uses interleaved mode for correct rendering with Mapbox + Three.js layers.
 */
export function initDeckOverlay(map: MapboxMap): void {
  if (overlay) return; // already initialized
  overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);
}

/**
 * Update the deck.gl layers rendered by the overlay.
 */
export function updateDeckLayers(layers: Layer[]): void {
  if (!overlay) return;
  overlay.setProps({ layers });
}

/**
 * Remove the overlay from the map (cleanup).
 */
export function removeDeckOverlay(map: MapboxMap): void {
  if (overlay) {
    map.removeControl(overlay);
    overlay = null;
  }
}
