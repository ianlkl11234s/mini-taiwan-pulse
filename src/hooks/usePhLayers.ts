import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, MAP_SEAM } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { PH_ADMIN_COLOR, PH_ADMIN_LEVELS, PH_DENSITY_BREAKS, PH_NOT_COVERED_COLOR, PH_PLANT_STATUSES, PH_PLANT_STATUS_DEFAULT, phKigExcludeFilter, phText, type PhAdminLevel } from "../data/phDataLayers";
export { phColorExpr, phPartCatFilter, phHeatmapId, phSourceSpec, usePhDataLayer } from "./intlPhSpecLayers";
import type { PhRasterSpec } from "../data/phWavesLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./intlPmtilesLayers";

/**
 * 菲律賓第 0–1 波（2026-11-13）：行政邊界、人口（四層級 select）與規格驅動 8 層。靜態 PMTiles、不訂閱時間。
 * 規格在 `data/phDataLayers.ts`；layer id 以字面值寫在規格（gisClickRegistry／lineFillTiers 以字面值比對）。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度：序列色階（YlOrBr）依固定斷點分 6 級；`pop_status=not_covered`（或沒有密度）畫灰色「未涵蓋」，不畫成 0。
 * - 規格驅動層：V-1 點線從圖磚起點直接畫，加油站（≥1 萬點）拉遠改熱區；V-4 一個類別多選涵蓋全部子圖層。
 */
type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const sig = (v: unknown) => JSON.stringify(v);
const levelAt = (idx: number | undefined, fallback: PhAdminLevel): PhAdminLevel => PH_ADMIN_LEVELS[idx ?? -1]?.value ?? fallback;


// ═════════════════════════ 行政邊界 ═════════════════════════

export const PH_ADMIN_KEY = "phAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）；順序＝PH_ADMIN_LEVELS。 */
export const PH_ADMIN_LAYER_IDS = {
  region: { fill: "ph-admin-region-fill", line: "ph-admin-region-line" },
  province: { fill: "ph-admin-province-fill", line: "ph-admin-province-line" },
  municipality: { fill: "ph-admin-municipality-fill", line: "ph-admin-municipality-line" },
  barangay: { fill: "ph-admin-barangay-fill", line: "ph-admin-barangay-line" },
} as const;

function levelSource(prefix: string, file: string, level: (typeof PH_ADMIN_LEVELS)[number], loading: string): SourceSpec {
  return { id: `${prefix}-${level.value}`, file, minzoom: level.srcMinzoom, maxzoom: level.srcMaxzoom, attribution: "", loading };
}

const ADMIN_SOURCES = PH_ADMIN_LEVELS.map((lv) => levelSource("ph-admin", "ph_admin_boundaries.pmtiles", lv, "菲律賓行政邊界載入中"));

function useAdminLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = PH_ADMIN_LEVELS[i]!;
  const ids = PH_ADMIN_LAYER_IDS[level.value];
  const filter = phKigExcludeFilter(level.value);
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(PH_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(PH_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, ADMIN_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom, ...(filter ? { filter } : {}),
        layout: { visibility: "none" }, paint: { "fill-color": PH_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom, ...(filter ? { filter } : {}),
        layout: { visibility: "none", ...hookLineLayout(PH_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** `levelIdx`：PH_ADMIN_LEVELS 順序（0 region、1 province、2 municipality、3 barangay）；一次只顯示一層，popup 不會重複命中。 */
export function usePhAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level = levelAt(levelIdx, "region");
  useAdminLevel(mapRef, 0, visible && level === "region", opacity, isDark);
  useAdminLevel(mapRef, 1, visible && level === "province", opacity, isDark);
  useAdminLevel(mapRef, 2, visible && level === "municipality", opacity, isDark);
  useAdminLevel(mapRef, 3, visible && level === "barangay", opacity, isDark);
}

// ═════════════════════════ 人口 ═════════════════════════

export const PH_POP_KEY = "phPopulation";
export const PH_POP_LAYER_IDS = {
  region: { fill: "ph-population-region-fill", line: "ph-population-region-line" },
  province: { fill: "ph-population-province-fill", line: "ph-population-province-line" },
  municipality: { fill: "ph-population-municipality-fill", line: "ph-population-municipality-line" },
  barangay: { fill: "ph-population-barangay-fill", line: "ph-population-barangay-line" },
} as const;
const POP_SOURCES = PH_ADMIN_LEVELS.map((lv) => levelSource("ph-population", "ph_population.pmtiles", lv, "菲律賓人口載入中"));

/** 6 級密度色（色盤庫 YlOrBr 暗／淡版重新取樣；圖例共用）。 */
export function phDensityColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("YlOrBr", isDark)!, PH_DENSITY_BREAKS.length + 1);
}
/** 未涵蓋（`not_covered` 或沒有密度欄）→ 灰；其餘依密度 step。 */
export function phDensityColorExpr(isDark: boolean): Expr {
  const colors = phDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", "density_per_km2"], 0], colors[0]];
  PH_DENSITY_BREAKS.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["any", ["==", ["get", "pop_status"], "not_covered"], ["!", ["has", "density_per_km2"]]], PH_NOT_COVERED_COLOR, step];
}

function usePopLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = PH_ADMIN_LEVELS[i]!;
  const ids = PH_POP_LAYER_IDS[level.value];
  const filter = phKigExcludeFilter(level.value);
  const def = opacityDefault(PH_POP_KEY, 0.7);
  const fillPaint = () => hookFillPaint(PH_POP_KEY, ids.fill, { "fill-color": phDensityColorExpr(isDark), "fill-opacity": clamp01(opacity) },
    { "fill-color": phDensityColorExpr(isDark), "fill-opacity": def }, isDark);
  // 面之間的細縫（同級相鄰面不糊成一片）；底圖色、細線
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(PH_POP_KEY, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
    { "line-color": seam, "line-width": 0.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, POP_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: POP_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom, ...(filter ? { filter } : {}),
        layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.fill, fillPaint()),
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: POP_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom, ...(filter ? { filter } : {}),
        layout: { visibility: "none", ...hookLineLayout(PH_POP_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** 人口預設 province（國家全覽 z5 就有圖磚，§3.8 V-1）。 */
export function usePhPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level = levelAt(levelIdx, "province");
  usePopLevel(mapRef, 0, visible && level === "region", opacity, isDark);
  usePopLevel(mapRef, 1, visible && level === "province", opacity, isDark);
  usePopLevel(mapRef, 2, visible && level === "municipality", opacity, isDark);
  usePopLevel(mapRef, 3, visible && level === "barangay", opacity, isDark);
}

// ═════════════════════════ 規格驅動 8 層 ═════════════════════════

/** 電廠狀態多選（預設運轉中＋興建中）。 */
export function phPlantStatusFilter(mask: number | undefined): Expr | null {
  const ids = PH_PLANT_STATUSES.map((s) => s.id);
  const selected = mask === undefined || !Number.isFinite(mask) ? [...PH_PLANT_STATUS_DEFAULT] : selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return null;
  if (selected.length === 0) return NONE;
  return ["in", ["get", "status"], ["literal", selected]];
}

// ═════════════════════════ Raster 4 層（2026-11-16） ═════════════════════════

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

/** 山體陰影、色別標高、建成面積、樹冠流失：PNG raster PMTiles，比照 useCaHillshadeLayer 插在底圖第一個 symbol 下、地球儀走 pmtilesRasterCustomSource。 */
export function usePhRasterLayer(mapRef: MapRef, spec: PhRasterSpec, visible: boolean, opacity: number) {
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
