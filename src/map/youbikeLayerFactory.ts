import { cellToBoundary } from "h3-js";
import type { Map as MapboxMap } from "mapbox-gl";
import type { YoubikeH3CellData } from "../data/youbikeH3Loader";

const SOURCE_ID = "h3-youbike-src";
const FILL_LAYER_ID = "h3-youbike-fill";
const EXTRUSION_LAYER_ID = "h3-youbike-ext";

// RdYlGn reversed: 紅(滿車) → 黃(中等) → 綠(有車)
// 語義：fr = 有車率，高=有車(綠)，低=沒車(紅)
const FULLNESS_COLORS: [number, number, number][] = [
  [215, 48, 39],    // 0.0 — 沒車，紅
  [252, 141, 89],   // 0.25
  [254, 224, 139],  // 0.5 — 中等，黃
  [145, 207, 96],   // 0.75
  [26, 152, 80],    // 1.0 — 有車，綠
];

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

export interface YoubikeLayerParams {
  opacity: number;
  extruded: boolean;
  elevationScale: number;
  contrast: number;
}

function youbikeCellsToGeoJSON(
  cells: YoubikeH3CellData[],
  params: YoubikeLayerParams,
): GeoJSON.FeatureCollection {
  const gamma = params.contrast ?? 1;

  // 找最大 capacity（用於高度正規化）
  let maxCapacity = 0;
  for (const c of cells) {
    if (c.sc > maxCapacity) maxCapacity = c.sc;
  }
  if (maxCapacity === 0) maxCapacity = 1;

  const features: GeoJSON.Feature[] = cells.map((cell) => {
    const boundary = cellToBoundary(cell.h);
    const coords = boundary.map(([lat, lng]) => [lng, lat]);
    coords.push(coords[0]!);

    // 顏色：有車率直接映射（已經是 0~1），加 gamma 調整對比
    const colorNorm = Math.pow(Math.max(0, Math.min(1, cell.fr)), gamma);

    // 高度：有車率 × capacity 權重（兩者都影響高度，隨時間動態變化）
    const capacityWeight = cell.sc / maxCapacity;
    const heightNorm = cell.fr * capacityWeight;

    return {
      type: "Feature" as const,
      properties: {
        color: interpolateColor(FULLNESS_COLORS, colorNorm),
        value: cell.fr,
        capacity: cell.sc,
        height: heightNorm,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

export function ensureYoubikeLayers(map: MapboxMap): void {
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

export function updateYoubikeLayer(
  map: MapboxMap,
  cells: YoubikeH3CellData[],
  params: YoubikeLayerParams,
  visible: boolean,
): void {
  ensureYoubikeLayers(map);
  const source = map.getSource(SOURCE_ID);
  if (!source || source.type !== "geojson") return;

  if (cells.length > 0) {
    const geojson = youbikeCellsToGeoJSON(cells, params);
    source.setData(geojson);
  } else {
    source.setData({ type: "FeatureCollection", features: [] });
  }

  if (!visible || cells.length === 0) {
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", "none");
    map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", "none");
    return;
  }

  map.setLayoutProperty(FILL_LAYER_ID, "visibility", params.extruded ? "none" : "visible");
  map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", params.extruded ? "visible" : "none");

  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", params.opacity);
  map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-opacity", params.opacity);
  map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-height",
    ["*", ["get", "height"], params.elevationScale * 100],
  );
}
