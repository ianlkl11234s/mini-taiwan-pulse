import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../../map/lineFillSpec";
import { BOUNDARY_GRAY, MAP_SEAM } from "../../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../../map/palettes";
import { paramDefault } from "../../data/layerParamsSpec";
import {
  ID_ADMIN_COLOR, ID_ADMIN_LEVELS, ID_DENSITY_BREAKS_BY_LEVEL, ID_IDM_BREAKS_BY_LEVEL, ID_LEVELS_2, ID_NOT_COVERED_COLOR, ID_POP_KEY, ID_RURAL_KEY,
  phText, type IdAdminLevel, type IdLevel2,
} from "./idDataLayers";
import type { IdRasterSpec } from "./idWavesLayers";
import { useGbPmtilesLayers, type SourceSpec } from "../../hooks/intlPmtilesLayers";

/**
 * 印尼第 0–3 波（2026-11-23）：行政邊界（國界／省／縣市）、人口、農村發展指數 IDM（省／縣市兩層級 select）與 5 張 raster。靜態 PMTiles、不訂閱時間。
 * 其餘 19 層重用菲律賓規格引擎（`usePhDataLayer`，規格在 `data/idWavesLayers.ts`）。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度、IDM：序列色階依固定斷點分 6 級；沒有值（IDM 82 個無村縣市）畫灰色「未涵蓋」，不畫成 0。
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

export const ID_ADMIN_KEY = "idAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）；順序＝ID_ADMIN_LEVELS。 */
export const ID_ADMIN_LAYER_IDS = {
  country: { fill: "id-admin-country-fill", line: "id-admin-country-line" },
  province: { fill: "id-admin-province-fill", line: "id-admin-province-line" },
  kabkota: { fill: "id-admin-kabkota-fill", line: "id-admin-kabkota-line" },
} as const;
const ADMIN_SOURCES = ID_ADMIN_LEVELS.map((lv) => levelSource("id-admin", "id_admin_boundaries.pmtiles", lv, "印尼行政邊界載入中"));

function useAdminLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = ID_ADMIN_LEVELS[i]!;
  const ids = ID_ADMIN_LAYER_IDS[level.value];
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(ID_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(ID_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, ADMIN_SOURCES[i]!, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: { "fill-color": ID_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: ADMIN_SOURCES[i]!.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(ID_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** `levelIdx`：ID_ADMIN_LEVELS 順序（0 國界、1 省、2 縣市）；一次只顯示一層，popup 不會重複命中。 */
export function useIdAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: IdAdminLevel = ID_ADMIN_LEVELS[levelIdx ?? -1]?.value ?? "province";
  useAdminLevel(mapRef, 0, visible && level === "country", opacity, isDark);
  useAdminLevel(mapRef, 1, visible && level === "province", opacity, isDark);
  useAdminLevel(mapRef, 2, visible && level === "kabkota", opacity, isDark);
}

// ═════════════════════════ 分級面（人口、IDM）共用 ═════════════════════════

/** 6 級色（色盤庫暗／淡版重新取樣；圖例共用）。 */
export function idRampColors(palette: string, isDark: boolean): string[] {
  return resampleRamp(paletteRamp(palette, isDark)!, 6);
}
/** 值欄位缺漏（沒有該屬性）→ 灰「未涵蓋」；其餘依斷點 step。 */
function stepColorExpr(prop: string, breaks: readonly number[], colors: string[]): Expr {
  const step: unknown[] = ["step", ["to-number", ["get", prop], 0], colors[0]];
  breaks.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["!", ["has", prop]], ID_NOT_COVERED_COLOR, step];
}

function useChoroplethLevel(mapRef: MapRef, opts: { key: string; prefix: string; file: string; loading: string; ids: Record<IdLevel2, { fill: string; line: string }>; colorExpr: (level: IdLevel2, isDark: boolean) => Expr; defOpacity: number },
  i: number, visible: boolean, opacity: number, isDark: boolean) {
  const level = ID_LEVELS_2[i]!;
  const ids = opts.ids[level.value];
  const source = levelSource(opts.prefix, opts.file, level, opts.loading);
  const def = opacityDefault(opts.key, opts.defOpacity);
  const fillPaint = () => hookFillPaint(opts.key, ids.fill, { "fill-color": opts.colorExpr(level.value, isDark), "fill-opacity": clamp01(opacity) },
    { "fill-color": opts.colorExpr(level.value, isDark), "fill-opacity": def }, isDark);
  // 面之間的細縫（同級相鄰面不糊成一片）；底圖色、細線
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(opts.key, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
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
        layout: { visibility: "none", ...hookLineLayout(opts.key, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

// ═════════════════════════ 人口 ═════════════════════════

export const ID_POP_LAYER_IDS = {
  province: { fill: "id-population-province-fill", line: "id-population-province-line" },
  kabkota: { fill: "id-population-kabkota-fill", line: "id-population-kabkota-line" },
} as const;
export const idDensityColors = (isDark: boolean) => idRampColors("YlOrBr", isDark);
export function idDensityColorExpr(isDark: boolean, level: IdLevel2 = "province"): Expr {
  return stepColorExpr("density_per_km2", ID_DENSITY_BREAKS_BY_LEVEL[level], idDensityColors(isDark));
}
const POP_OPTS = { key: ID_POP_KEY, prefix: "id-population", file: "id_population.pmtiles", loading: "印尼人口載入中", ids: ID_POP_LAYER_IDS, colorExpr: (l: IdLevel2, d: boolean) => idDensityColorExpr(d, l), defOpacity: 0.7 };

/** 人口預設 province（國家全覽 z4 就有圖磚，§3.8 V-1）；選項順序＝ID_LEVELS_2。 */
export function useIdPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: IdLevel2 = ID_LEVELS_2[levelIdx ?? -1]?.value ?? "province";
  useChoroplethLevel(mapRef, POP_OPTS, 0, visible && level === "province", opacity, isDark);
  useChoroplethLevel(mapRef, POP_OPTS, 1, visible && level === "kabkota", opacity, isDark);
}

// ═════════════════════════ 農村發展指數 IDM ═════════════════════════

export const ID_RURAL_LAYER_IDS = {
  province: { fill: "id-rural-province-fill", line: "id-rural-province-line" },
  kabkota: { fill: "id-rural-kabkota-fill", line: "id-rural-kabkota-line" },
} as const;
export const idIdmColors = (isDark: boolean) => idRampColors("PuBuGn", isDark);
export function idIdmColorExpr(isDark: boolean, level: IdLevel2 = "province"): Expr {
  return stepColorExpr("idm_mean", ID_IDM_BREAKS_BY_LEVEL[level], idIdmColors(isDark));
}
const RURAL_OPTS = { key: ID_RURAL_KEY, prefix: "id-rural", file: "id_rural_development.pmtiles", loading: "印尼農村發展指數載入中", ids: ID_RURAL_LAYER_IDS, colorExpr: (l: IdLevel2, d: boolean) => idIdmColorExpr(d, l), defOpacity: 0.7 };

export function useIdRuralDevelopmentLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const level: IdLevel2 = ID_LEVELS_2[levelIdx ?? -1]?.value ?? "province";
  useChoroplethLevel(mapRef, RURAL_OPTS, 0, visible && level === "province", opacity, isDark);
  useChoroplethLevel(mapRef, RURAL_OPTS, 1, visible && level === "kabkota", opacity, isDark);
}

// ═════════════════════════ Raster 5 層 ═════════════════════════

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

/** 山體陰影、色別標高、InaRISK：PNG raster PMTiles，插在底圖第一個 symbol 下、地球儀走 pmtilesRasterCustomSource。 */
export function useIdRasterLayer(mapRef: MapRef, spec: IdRasterSpec, visible: boolean, opacity: number) {
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
