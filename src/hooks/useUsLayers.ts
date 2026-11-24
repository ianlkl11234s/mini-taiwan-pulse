import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, MAP_SEAM } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import {
  US_ADMIN_COLOR, US_ADMIN_LEVELS, US_DENSITY_BREAKS_BY_LEVEL, US_NOT_COVERED_COLOR, US_POP_KEY, US_POP_LEVELS, type UsAdminLevel, type UsPopLevel,
} from "../data/usDataLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./intlPmtilesLayers";

/**
 * 美國第 0–1 波（2026-11-25）：行政邊界（州／郡）與人口密度（州／郡／普查區）。靜態 PMTiles、不訂閱時間。
 * 其餘 9 層重用菲律賓規格引擎（`usePhDataLayer`，規格在 `data/usDataLayers.ts`）。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度：序列色階依固定斷點分 6 級；沒有值畫灰色「未涵蓋」，不畫成 0。
 */
type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);

function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

function levelSource(prefix: string, file: string, level: { value: string; srcMinzoom: number; srcMaxzoom: number }, loading: string): SourceSpec {
  return { id: `${prefix}-${level.value}`, file, minzoom: level.srcMinzoom, maxzoom: level.srcMaxzoom, attribution: "", loading };
}

// ═════════════════════════ 行政邊界 ═════════════════════════

export const US_ADMIN_KEY = "usAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）；順序＝US_ADMIN_LEVELS。 */
export const US_ADMIN_LAYER_IDS = {
  state: { fill: "us-admin-state-fill", line: "us-admin-state-line" },
  county: { fill: "us-admin-county-fill", line: "us-admin-county-line" },
} as const;
const ADMIN_SOURCES = US_ADMIN_LEVELS.map((lv) => levelSource("us-admin", "us_admin_boundaries.pmtiles", lv, "美國行政邊界載入中"));

function useAdminLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = US_ADMIN_LEVELS[i]!;
  const ids = US_ADMIN_LAYER_IDS[level.value];
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(US_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(US_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, ADMIN_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: { "fill-color": US_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(US_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** `levelIdx`：US_ADMIN_LEVELS 順序（0 州、1 郡）；一次只顯示一層，popup 不會重複命中。 */
export function useUsAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: UsAdminLevel = US_ADMIN_LEVELS[levelIdx ?? -1]?.value ?? "state";
  useAdminLevel(mapRef, 0, visible && level === "state", opacity, isDark);
  useAdminLevel(mapRef, 1, visible && level === "county", opacity, isDark);
}

// ═════════════════════════ 人口 ═════════════════════════

export const US_POP_LAYER_IDS = {
  state: { fill: "us-population-state-fill", line: "us-population-state-line" },
  county: { fill: "us-population-county-fill", line: "us-population-county-line" },
  tract: { fill: "us-population-tract-fill", line: "us-population-tract-line" },
} as const;
/** 6 級色（色盤庫暗／淡版重新取樣；圖例共用）。 */
export const usDensityColors = (isDark: boolean) => resampleRamp(paletteRamp("YlOrBr", isDark)!, 6);
/** 值欄位缺漏（沒有該屬性）→ 灰「未涵蓋」；其餘依斷點 step。 */
export function usDensityColorExpr(isDark: boolean, level: UsPopLevel = "state"): Expr {
  const colors = usDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", "density_per_km2"], 0], colors[0]];
  US_DENSITY_BREAKS_BY_LEVEL[level].forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["!", ["has", "density_per_km2"]], US_NOT_COVERED_COLOR, step];
}

function usePopLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = US_POP_LEVELS[i]!;
  const ids = US_POP_LAYER_IDS[level.value];
  const source = levelSource("us-population", "us_population.pmtiles", level, "美國人口載入中");
  const def = opacityDefault(US_POP_KEY, 0.7);
  const fillPaint = () => hookFillPaint(US_POP_KEY, ids.fill, { "fill-color": usDensityColorExpr(isDark, level.value), "fill-opacity": clamp01(opacity) },
    { "fill-color": usDensityColorExpr(isDark, level.value), "fill-opacity": def }, isDark);
  // 面之間的細縫（同級相鄰面不糊成一片）；底圖色、細線
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(US_POP_KEY, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
    { "line-color": seam, "line-width": 0.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, source, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: source.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.fill, fillPaint()),
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: source.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(US_POP_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** 人口預設 state（國家全覽 z3 就有圖磚，§3.8 V-1）；選項順序＝US_POP_LEVELS。 */
export function useUsPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: UsPopLevel = US_POP_LEVELS[levelIdx ?? -1]?.value ?? "state";
  usePopLevel(mapRef, 0, visible && level === "state", opacity, isDark);
  usePopLevel(mapRef, 1, visible && level === "county", opacity, isDark);
  usePopLevel(mapRef, 2, visible && level === "tract", opacity, isDark);
}
