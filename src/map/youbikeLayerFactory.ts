import { deferUntilH3, requireH3 } from "./h3Runtime";
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

export type YoubikeHeightMode = "mixed" | "fullness" | "capacity";

export interface YoubikeLayerParams {
  opacity: number;
  extruded: boolean;
  elevationScale: number;
  contrast: number;
  heightMode?: YoubikeHeightMode;
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
    const boundary = requireH3().cellToBoundary(cell.h);
    const coords = boundary.map(([lat, lng]) => [lng, lat]);
    coords.push(coords[0]!);

    // 顏色：有車率直接映射（已經是 0~1），加 gamma 調整對比
    const colorNorm = Math.pow(Math.max(0, Math.min(1, cell.fr)), gamma);

    // 高度：依 heightMode 切換
    const mode = params.heightMode ?? "mixed";
    const capacityWeight = cell.sc / maxCapacity;
    const heightNorm =
      mode === "fullness" ? cell.fr :
      mode === "capacity" ? capacityWeight :
      cell.fr * capacityWeight; // mixed（預設）

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
        "fill-color-transition": { duration: 800, delay: 0 },
        "fill-opacity": 0.6,
        "fill-opacity-transition": { duration: 500, delay: 0 },
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
        "fill-extrusion-color-transition": { duration: 800, delay: 0 },
        "fill-extrusion-height": ["*", ["get", "height"], 5000],
        "fill-extrusion-height-transition": { duration: 800, delay: 0 },
        "fill-extrusion-opacity": 0.6,
        "fill-extrusion-opacity-transition": { duration: 500, delay: 0 },
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
  if (deferUntilH3("h3-youbike", visible && cells.length > 0, () => updateYoubikeLayer(map, cells, params, visible))) return;
  ensureYoubikeLayers(map);
  const source = map.getSource(SOURCE_ID);
  if (!source || source.type !== "geojson") return;

  // 關閉時只隱藏、不再轉 GeoJSON／setData（關閉後不該繼續算）；重開時會帶 visible=true 重跑
  if (!visible) {
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", "none");
    map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", "none");
    return;
  }

  if (cells.length > 0) {
    const geojson = youbikeCellsToGeoJSON(cells, params);
    source.setData(geojson);
  } else {
    source.setData({ type: "FeatureCollection", features: [] });
  }

  if (cells.length === 0) {
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", "none");
    map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", "none");
    return;
  }

  map.setLayoutProperty(FILL_LAYER_ID, "visibility", params.extruded ? "none" : "visible");
  map.setLayoutProperty(EXTRUSION_LAYER_ID, "visibility", params.extruded ? "visible" : "none");

  // 只改「目前顯示中」那一層的 paint：隱藏 layer 不會 recalculate，改 paint 留下的
  // transition prior（本層 fill-opacity 有 500ms 明示 transition）永遠清不掉 →
  // style.hasTransitions() 恆 true → 地圖無限重畫（A0）。切換 extruded 會帶新 params 重跑。
  if (params.extruded) {
    map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-opacity", params.opacity);
    map.setPaintProperty(EXTRUSION_LAYER_ID, "fill-extrusion-height",
      ["*", ["get", "height"], params.elevationScale * 100],
    );
  } else {
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", params.opacity);
  }
}
