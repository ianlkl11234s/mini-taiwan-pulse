import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../../map/lineFillSpec";
import { BOUNDARY_GRAY, MAP_SEAM } from "../../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../../map/palettes";
import { paramDefault } from "../../data/layerParamsSpec";
import { phText, TH_ADMIN_COLOR, TH_ADMIN_LEVELS, TH_DENSITY_BREAKS_BY_LEVEL, TH_NOT_COVERED_COLOR, TH_POP_LEVELS, type ThAdminLevel, type ThPopLevel } from "./thDataLayers";
import { useGbPmtilesLayers, type SourceSpec } from "../../hooks/intlPmtilesLayers";
import type { ThRasterSpec } from "./thWavesLayers";

/**
 * 泰國第 0–1 波（2026-11-22）：行政邊界（國界／府／amphoe／tambon 四層級 select）與人口（府／amphoe 兩層級 select）。靜態 PMTiles、不訂閱時間。
 * 其餘 8 層重用菲律賓規格引擎（`usePhDataLayer`，規格在 `data/thDataLayers.ts`）。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度：序列色階（YlOrBr）依固定斷點分 6 級（沿用菲律賓）；`pop_status=not_covered`（或沒有密度）畫灰色「未涵蓋」，不畫成 0。
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

export const TH_ADMIN_KEY = "thAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）；順序＝TH_ADMIN_LEVELS。 */
export const TH_ADMIN_LAYER_IDS = {
  country: { fill: "th-admin-country-fill", line: "th-admin-country-line" },
  province: { fill: "th-admin-province-fill", line: "th-admin-province-line" },
  amphoe: { fill: "th-admin-amphoe-fill", line: "th-admin-amphoe-line" },
  tambon: { fill: "th-admin-tambon-fill", line: "th-admin-tambon-line" },
} as const;
const ADMIN_SOURCES = TH_ADMIN_LEVELS.map((lv) => levelSource("th-admin", "th_admin_boundaries.pmtiles", lv, "泰國行政邊界載入中"));

function useAdminLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = TH_ADMIN_LEVELS[i]!;
  const ids = TH_ADMIN_LAYER_IDS[level.value];
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(TH_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(TH_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, ADMIN_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: { "fill-color": TH_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(TH_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** `levelIdx`：TH_ADMIN_LEVELS 順序（0 國界、1 府、2 amphoe、3 tambon）；一次只顯示一層，popup 不會重複命中。 */
export function useThAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: ThAdminLevel = TH_ADMIN_LEVELS[levelIdx ?? -1]?.value ?? "province";
  useAdminLevel(mapRef, 0, visible && level === "country", opacity, isDark);
  useAdminLevel(mapRef, 1, visible && level === "province", opacity, isDark);
  useAdminLevel(mapRef, 2, visible && level === "amphoe", opacity, isDark);
  useAdminLevel(mapRef, 3, visible && level === "tambon", opacity, isDark);
}

// ═════════════════════════ 人口 ═════════════════════════

export const TH_POP_KEY = "thPopulation";
export const TH_POP_LAYER_IDS = {
  province: { fill: "th-population-province-fill", line: "th-population-province-line" },
  amphoe: { fill: "th-population-amphoe-fill", line: "th-population-amphoe-line" },
} as const;
const POP_SOURCES = TH_POP_LEVELS.map((lv) => levelSource("th-population", "th_population.pmtiles", lv, "泰國人口載入中"));

/** 6 級密度色（色盤庫 YlOrBr 暗／淡版重新取樣；圖例共用）。 */
export function thDensityColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("YlOrBr", isDark)!, TH_DENSITY_BREAKS_BY_LEVEL.province.length + 1);
}
/** 未涵蓋（`not_covered` 或沒有密度欄）→ 灰；其餘依密度 step。 */
export function thDensityColorExpr(isDark: boolean, level: ThPopLevel = "province"): Expr {
  const colors = thDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", "density_latest"], 0], colors[0]];
  TH_DENSITY_BREAKS_BY_LEVEL[level].forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["any", ["==", ["get", "pop_status"], "not_covered"], ["!", ["has", "density_latest"]]], TH_NOT_COVERED_COLOR, step];
}

function usePopLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = TH_POP_LEVELS[i]!;
  const ids = TH_POP_LAYER_IDS[level.value];
  const def = opacityDefault(TH_POP_KEY, 0.7);
  const fillPaint = () => hookFillPaint(TH_POP_KEY, ids.fill, { "fill-color": thDensityColorExpr(isDark, level.value), "fill-opacity": clamp01(opacity) },
    { "fill-color": thDensityColorExpr(isDark, level.value), "fill-opacity": def }, isDark);
  // 面之間的細縫（同級相鄰面不糊成一片）；底圖色、細線
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(TH_POP_KEY, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
    { "line-color": seam, "line-width": 0.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, POP_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: POP_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.fill, fillPaint()),
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: POP_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(TH_POP_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** 人口預設 province（國家全覽 z5 就有圖磚，§3.8 V-1）；選項順序＝TH_POP_LEVELS。 */
export function useThPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: ThPopLevel = TH_POP_LEVELS[levelIdx ?? -1]?.value ?? "province";
  usePopLevel(mapRef, 0, visible && level === "province", opacity, isDark);
  usePopLevel(mapRef, 1, visible && level === "amphoe", opacity, isDark);
}

// ═════════════════════════ Raster 2 層（2026-11-22 第 2 波） ═════════════════════════

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

/** 山體陰影、色別標高：PNG raster PMTiles，比照 usePhRasterLayer 插在底圖第一個 symbol 下、地球儀走 pmtilesRasterCustomSource。 */
export function useThRasterLayer(mapRef: MapRef, spec: ThRasterSpec, visible: boolean, opacity: number) {
  const source: SourceSpec = { id: spec.sourceId, file: spec.file, minzoom: spec.minzoom, maxzoom: spec.maxzoom, attribution: phText(spec.sourceShort), loading: spec.loading, raster: { tileSize: 256 } };
  useGbPmtilesLayers(mapRef, source, visible, () => [{
    id: spec.layerId,
    layer: () => ({
      id: spec.layerId, type: "raster", source: source.id, minzoom: spec.minzoom,
      layout: { visibility: "none" }, paint: { "raster-opacity": clamp01(opacity), "raster-fade-duration": 0 },
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(spec.layerId, "raster-opacity", clamp01(opacity)),
    before: firstSymbolLayerId,
  }], [spec.key, opacity]);
}
