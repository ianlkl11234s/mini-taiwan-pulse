import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, LABEL, MAP_SEAM, labelHaloPaint } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import { VN_ADMIN_COLOR, VN_DENSITY_BREAKS, VN_NOT_COVERED_COLOR } from "../data/vnDataLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 越南第 0–1 波（2026-11-13）：行政邊界（34 省面＋省名）與人口密度（34 省）。靜態 PMTiles、不訂閱時間。
 * 其餘 10 層重用菲律賓規格引擎（`usePhDataLayer`，規格在 `data/vnDataLayers.ts`）。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；省名用 `province_label` 點。
 * - 人口密度：序列色階（YlOrBr）依固定斷點分 5 級；沒有密度的面畫灰色「未涵蓋」，不畫成 0。
 * 只有省一級（縣級已取消、社沒有幾何），不需要層級 select。
 */
type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);

function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

// ═════════════════════════ 行政邊界 ═════════════════════════

export const VN_ADMIN_KEY = "vnAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）。 */
export const VN_ADMIN_LAYER_IDS = { fill: "vn-admin-province-fill", line: "vn-admin-province-line", label: "vn-admin-province-label" } as const;
const ADMIN_SOURCE: SourceSpec = { id: "vn-admin", file: "vn_admin_boundaries.pmtiles", minzoom: 3, maxzoom: 12, attribution: "", loading: "越南行政邊界載入中" };

export function useVnAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const ids = VN_ADMIN_LAYER_IDS;
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(VN_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(VN_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  const labelPaint = () => ({ "text-color": isDark ? "#e5e7eb" : "#374151", "text-opacity": clamp01(opacity / def), ...labelHaloPaint(isDark) });
  useGbPmtilesLayers(mapRef, ADMIN_SOURCE, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: ADMIN_SOURCE.id, "source-layer": "province", minzoom: 3,
        layout: { visibility: "none" }, paint: { "fill-color": VN_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: ADMIN_SOURCE.id, "source-layer": "province", minzoom: 3,
        layout: { visibility: "none", ...hookLineLayout(VN_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
    {
      id: ids.label,
      layer: () => ({ id: ids.label, type: "symbol", source: ADMIN_SOURCE.id, "source-layer": "province_label", minzoom: 5,
        layout: {
          visibility: "none", "text-field": ["get", "name"], "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, LABEL.badge[0], 9, LABEL.badge[1]], "text-allow-overlap": false,
        },
        paint: labelPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.label, labelPaint()),
    },
  ], [opacity, isDark]);
}

// ═════════════════════════ 人口 ═════════════════════════

export const VN_POP_KEY = "vnPopulation";
export const VN_POP_LAYER_IDS = { fill: "vn-population-province-fill", line: "vn-population-province-line" } as const;
const POP_SOURCE: SourceSpec = { id: "vn-population", file: "vn_population.pmtiles", minzoom: 3, maxzoom: 10, attribution: "", loading: "越南人口載入中" };

/** 5 級密度色（色盤庫 YlOrBr 暗／淡版重新取樣；圖例共用）。 */
export function vnDensityColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("YlOrBr", isDark)!, VN_DENSITY_BREAKS.length + 1);
}
/** 沒有密度欄 → 灰（未涵蓋）；其餘依密度 step。 */
export function vnDensityColorExpr(isDark: boolean): Expr {
  const colors = vnDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", "density_per_km2"], 0], colors[0]];
  VN_DENSITY_BREAKS.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["!", ["has", "density_per_km2"]], VN_NOT_COVERED_COLOR, step];
}

export function useVnPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const ids = VN_POP_LAYER_IDS;
  const def = opacityDefault(VN_POP_KEY, 0.7);
  const fillPaint = () => hookFillPaint(VN_POP_KEY, ids.fill, { "fill-color": vnDensityColorExpr(isDark), "fill-opacity": clamp01(opacity) },
    { "fill-color": vnDensityColorExpr(isDark), "fill-opacity": def }, isDark);
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(VN_POP_KEY, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
    { "line-color": seam, "line-width": 0.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, POP_SOURCE, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: POP_SOURCE.id, "source-layer": "province", minzoom: 3,
        layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.fill, fillPaint()),
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: POP_SOURCE.id, "source-layer": "province", minzoom: 3,
        layout: { visibility: "none", ...hookLineLayout(VN_POP_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}
