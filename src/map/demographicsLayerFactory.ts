import { cellToBoundary } from "h3-js";
import type { Map as MapboxMap } from "mapbox-gl";
import type { DemographicH3CellData } from "../data/h3Loader";

// ── Layer IDs ──

const POP_COUNT_SRC = "h3-pop-count-src";
const POP_COUNT_FILL = "h3-pop-count-fill";
const POP_COUNT_EXT = "h3-pop-count-ext";

const INDICATORS_SRC = "h3-indicators-src";
const INDICATORS_FILL = "h3-indicators-fill";
const INDICATORS_EXT = "h3-indicators-ext";

// ── Inferno color scale ──

const INFERNO: [number, number, number][] = [
  [0, 0, 4],
  [120, 28, 109],
  [226, 88, 34],
  [249, 189, 49],
  [252, 255, 164],
];

// ── Normalization helpers ──

function logNorm(value: number, maxVal: number): number {
  if (value <= 0 || maxVal <= 0) return 0;
  return Math.log1p(value) / Math.log1p(maxVal);
}

function linearNorm(value: number, maxVal: number): number {
  if (maxVal <= 0) return 0;
  return Math.max(0, Math.min(1, value / maxVal));
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

// ── Metric key mapping ──

/** 數量指標（log 正規化） */
const COUNT_METRICS = new Set(["p", "hh", "m", "f"]);

/** 從 DemographicH3CellData 中取指定 metric 的值 */
function getMetricValue(cell: DemographicH3CellData, metric: string): number {
  return (cell as unknown as Record<string, number>)[metric] ?? 0;
}

// ── GeoJSON builder ──

function demographicsToGeoJSON(
  cells: DemographicH3CellData[],
  metric: string,
  contrast: number,
): GeoJSON.FeatureCollection {
  const isCount = COUNT_METRICS.has(metric);
  const gamma = contrast;

  // Find max value
  let maxVal = 0;
  for (const c of cells) {
    const v = getMetricValue(c, metric);
    if (v > maxVal) maxVal = v;
  }
  if (maxVal === 0) maxVal = 1;

  const features: GeoJSON.Feature[] = cells.map((cell) => {
    const boundary = cellToBoundary(cell.h);
    const coords = boundary.map(([lat, lng]) => [lng, lat]);
    coords.push(coords[0]!);

    const val = getMetricValue(cell, metric);
    const raw = isCount ? logNorm(val, maxVal) : linearNorm(val, maxVal);
    const norm = Math.pow(raw, gamma);

    return {
      type: "Feature" as const,
      properties: {
        color: interpolateColor(INFERNO, norm),
        value: val,
        height: norm,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

// ── Params interfaces ──

export interface PopCountParams {
  opacity: number;
  contrast: number;
  extruded: boolean;
  elevationScale: number;
}

export interface IndicatorsParams {
  category: string;
  metric: string;
  opacity: number;
  contrast: number;
  extruded: boolean;
  elevationScale: number;
}

// ── Ensure layers (idempotent) ──

function ensureSourceAndLayers(
  map: MapboxMap,
  srcId: string,
  fillId: string,
  extId: string,
): void {
  if (!map.getSource(srcId)) {
    map.addSource(srcId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(fillId)) {
    map.addLayer({
      id: fillId,
      type: "fill",
      source: srcId,
      layout: { visibility: "none" },
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.6,
      },
    });
  }
  if (!map.getLayer(extId)) {
    map.addLayer({
      id: extId,
      type: "fill-extrusion",
      source: srcId,
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["*", ["get", "height"], 5000],
        "fill-extrusion-opacity": 0.6,
      },
    });
  }
}

export function ensurePopCountLayers(map: MapboxMap): void {
  ensureSourceAndLayers(map, POP_COUNT_SRC, POP_COUNT_FILL, POP_COUNT_EXT);
}

export function ensureIndicatorsLayers(map: MapboxMap): void {
  ensureSourceAndLayers(map, INDICATORS_SRC, INDICATORS_FILL, INDICATORS_EXT);
}

// ── Update layer data + paint ──

function updateDemographicsLayer(
  map: MapboxMap,
  srcId: string,
  fillId: string,
  extId: string,
  cells: DemographicH3CellData[],
  metric: string,
  opacity: number,
  contrast: number,
  extruded: boolean,
  elevationScale: number,
  visible: boolean,
): void {
  ensureSourceAndLayers(map, srcId, fillId, extId);
  const source = map.getSource(srcId);
  if (!source || source.type !== "geojson") return;

  if (cells.length > 0) {
    const geojson = demographicsToGeoJSON(cells, metric, contrast);
    source.setData(geojson);
  } else {
    source.setData({ type: "FeatureCollection", features: [] });
  }

  if (!visible || cells.length === 0) {
    map.setLayoutProperty(fillId, "visibility", "none");
    map.setLayoutProperty(extId, "visibility", "none");
    return;
  }
  map.setLayoutProperty(fillId, "visibility", extruded ? "none" : "visible");
  map.setLayoutProperty(extId, "visibility", extruded ? "visible" : "none");

  map.setPaintProperty(fillId, "fill-opacity", opacity);
  map.setPaintProperty(extId, "fill-extrusion-opacity", opacity);
  map.setPaintProperty(extId, "fill-extrusion-height",
    ["*", ["get", "height"], elevationScale * 100],
  );
}

export function updatePopCountLayer(
  map: MapboxMap,
  cells: DemographicH3CellData[],
  params: PopCountParams,
  visible: boolean,
): void {
  updateDemographicsLayer(
    map, POP_COUNT_SRC, POP_COUNT_FILL, POP_COUNT_EXT,
    cells, "p", params.opacity, params.contrast,
    params.extruded, params.elevationScale, visible,
  );
}

export function updateIndicatorsLayer(
  map: MapboxMap,
  cells: DemographicH3CellData[],
  params: IndicatorsParams,
  visible: boolean,
): void {
  updateDemographicsLayer(
    map, INDICATORS_SRC, INDICATORS_FILL, INDICATORS_EXT,
    cells, params.metric, params.opacity, params.contrast,
    params.extruded, params.elevationScale, visible,
  );
}
