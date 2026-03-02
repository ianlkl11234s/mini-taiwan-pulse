import { cellToBoundary } from "h3-js";
import type { Map as MapboxMap } from "mapbox-gl";
import type { H3CellData } from "../data/h3Loader";

const SOURCE_ID = "h3-population-src";
const FILL_LAYER_ID = "h3-population-fill";
const EXTRUSION_LAYER_ID = "h3-population-ext";

// ── Color scales ──

const DAY_COLORS: [number, number, number][] = [
  [255, 255, 178],
  [254, 204, 92],
  [253, 141, 60],
  [240, 59, 32],
  [189, 0, 38],
];

const NIGHT_COLORS: [number, number, number][] = [
  [178, 226, 226],
  [102, 194, 164],
  [44, 162, 95],
  [0, 109, 148],
  [1, 70, 99],
];

function logNorm(value: number, maxVal: number): number {
  if (value <= 0 || maxVal <= 0) return 0;
  return Math.log1p(value) / Math.log1p(maxVal);
}

function interpolateColor(colors: [number, number, number][], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (colors.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, colors.length - 1);
  const frac = idx - lo;
  const c0 = colors[lo]!;
  const c1 = colors[hi]!;
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  return `rgb(${r},${g},${b})`;
}

// ── Public interface ──

export interface H3LayerParams {
  metric: "day" | "night";
  opacity: number;
  extruded: boolean;
  elevationScale: number;
}

/**
 * Convert H3 cells to GeoJSON FeatureCollection with pre-computed color + height.
 */
function h3CellsToGeoJSON(
  cells: H3CellData[],
  params: H3LayerParams,
): GeoJSON.FeatureCollection {
  const { metric } = params;
  const colors = metric === "day" ? DAY_COLORS : NIGHT_COLORS;
  const getValue = (d: H3CellData) => (metric === "day" ? d.d : d.n);

  let maxVal = 0;
  for (const c of cells) {
    const v = getValue(c);
    if (v > maxVal) maxVal = v;
  }
  if (maxVal === 0) maxVal = 1;

  const features: GeoJSON.Feature[] = cells.map((cell) => {
    // cellToBoundary returns [lat, lng][], GeoJSON needs [lng, lat][]
    const boundary = cellToBoundary(cell.h);
    const coords = boundary.map(([lat, lng]) => [lng, lat]);
    coords.push(coords[0]!); // close ring

    const val = getValue(cell);
    const norm = logNorm(val, maxVal);

    return {
      type: "Feature" as const,
      properties: {
        color: interpolateColor(colors, norm),
        value: val,
        height: norm, // 0~1, scaled by elevationScale at paint time
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

/**
 * Ensure H3 source + layers exist on the map.
 * Safe to call repeatedly (idempotent) — needed after style changes.
 */
export function ensureH3Layers(map: MapboxMap): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.6,
      },
    });
  }
  if (!map.getLayer(EXTRUSION_LAYER_ID)) {
    map.addLayer({
      id: EXTRUSION_LAYER_ID,
      type: "fill-extrusion",
      source: SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["*", ["get", "height"], 5000],
        "fill-extrusion-opacity": 0.6,
      },
    });
  }
}

/**
 * Update the H3 layer data + paint properties.
 */
export function updateH3Layer(
  map: MapboxMap,
  cells: H3CellData[],
  params: H3LayerParams,
  visible: boolean,
): void {
  ensureH3Layers(map);
  const source = map.getSource(SOURCE_ID);
  if (!source || source.type !== "geojson") return;

  // Update GeoJSON data
  if (cells.length > 0) {
    const geojson = h3CellsToGeoJSON(cells, params);
    source.setData(geojson);
  } else {
    source.setData({ type: "FeatureCollection", features: [] });
  }

  // Visibility: overall on/off + fill vs extrusion toggle
  if (!visible || cells.length === 0) {
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", "none");
    map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", "none");
    return;
  }

  map.setLayoutProperty(FILL_LAYER_ID, "visibility", params.extruded ? "none" : "visible");
  map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", params.extruded ? "visible" : "none");

  // Paint properties
  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", params.opacity);
  map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-opacity", params.opacity);
  map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-height",
    ["*", ["get", "height"], params.elevationScale * 100],
  );
}

/**
 * Set H3 layers visibility (without changing data).
 */
export function setH3Visible(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(FILL_LAYER_ID)) {
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
  if (map.getLayer(EXTRUSION_LAYER_ID)) {
    map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", "none"); // extrusion managed by updateH3Layer
  }
}

/**
 * Determine H3 resolution based on map zoom level.
 */
export function getH3Resolution(zoom: number): number {
  if (zoom < 9.5) return 7;
  if (zoom < 12) return 8;
  return 9;
}
