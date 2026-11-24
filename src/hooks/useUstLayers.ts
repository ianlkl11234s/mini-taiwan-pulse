import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, MAP_SEAM } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import {
  UST_ADMIN_COLOR, UST_ADMIN_DEFAULT, UST_ADMIN_LEVELS, UST_DENSITY_BREAKS, UST_DENSITY_PROP, UST_NAME, UST_NOT_COVERED_COLOR, UST_POP_LEVELS, type UstCc, type UstLevel,
} from "../data/ustDataLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./intlPmtilesLayers";

/**
 * 美國屬地第 0 波（2026-11-25）：波多黎各、關島的行政邊界與人口密度（層級 select）。靜態 PMTiles、不訂閱時間。比照 `useIdLayers.ts`。
 * - 行政界：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度：序列色階 6 級；沒有值（關島 9 個區塊群）畫灰「未涵蓋」，不畫成 0。
 * Hook 數固定：每地依層級數各呼叫一次（PR 3＋2、GU 2＋2），不因選項改變。
 */
type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);

function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

const levelSource = (prefix: string, file: string, level: UstLevel, loading: string): SourceSpec =>
  ({ id: `${prefix}-${level.value}`, file, minzoom: level.srcMinzoom, maxzoom: level.srcMaxzoom, attribution: "", loading });

/** layer id：`<cc>-admin-<level>-fill|line`、`<cc>-population-<level>-fill|line`（gisClickRegistry 以字面值登記）。 */
const ADMIN_IDS: Record<string, { fill: string; line: string }> = {
  "pr-territory": { fill: "pr-admin-territory-fill", line: "pr-admin-territory-line" },
  "pr-municipio": { fill: "pr-admin-municipio-fill", line: "pr-admin-municipio-line" },
  "pr-barrio": { fill: "pr-admin-barrio-fill", line: "pr-admin-barrio-line" },
  "gu-territory": { fill: "gu-admin-territory-fill", line: "gu-admin-territory-line" },
  "gu-village": { fill: "gu-admin-village-fill", line: "gu-admin-village-line" },
};
const POP_IDS: Record<string, { fill: string; line: string }> = {
  "pr-municipio": { fill: "pr-population-municipio-fill", line: "pr-population-municipio-line" },
  "pr-barrio": { fill: "pr-population-barrio-fill", line: "pr-population-barrio-line" },
  "gu-village": { fill: "gu-population-village-fill", line: "gu-population-village-line" },
  "gu-blockgroup": { fill: "gu-population-blockgroup-fill", line: "gu-population-blockgroup-line" },
};
export const ustAdminLayerIds = (cc: UstCc, level: string) => ADMIN_IDS[`${cc}-${level}`]!;
export const ustPopLayerIds = (cc: UstCc, level: string) => POP_IDS[`${cc}-${level}`]!;

function useAdminLevel(mapRef: MapRef, cc: UstCc, level: UstLevel, visible: boolean, opacity: number, isDark: boolean) {
  const key = `${cc}AdminBoundaries`;
  const ids = ustAdminLayerIds(cc, level.value);
  const source = levelSource(`${cc}-admin`, `${cc}_admin_boundaries.pmtiles`, level, `${UST_NAME[cc].zh}行政邊界載入中`);
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(key, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(key, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, source, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: source.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none" }, paint: { "fill-color": UST_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: source.id, "source-layer": level.value, minzoom: level.srcMinzoom,
        layout: { visibility: "none", ...hookLineLayout(key, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

function pickLevel(levels: readonly UstLevel[], idx: number | undefined, fallback: string): string {
  return levels[idx ?? -1]?.value ?? fallback;
}

export function usePrAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const L = UST_ADMIN_LEVELS.pr;
  const level = pickLevel(L, levelIdx, UST_ADMIN_DEFAULT.pr);
  useAdminLevel(mapRef, "pr", L[0]!, visible && level === L[0]!.value, opacity, isDark);
  useAdminLevel(mapRef, "pr", L[1]!, visible && level === L[1]!.value, opacity, isDark);
  useAdminLevel(mapRef, "pr", L[2]!, visible && level === L[2]!.value, opacity, isDark);
}
export function useGuAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const L = UST_ADMIN_LEVELS.gu;
  const level = pickLevel(L, levelIdx, UST_ADMIN_DEFAULT.gu);
  useAdminLevel(mapRef, "gu", L[0]!, visible && level === L[0]!.value, opacity, isDark);
  useAdminLevel(mapRef, "gu", L[1]!, visible && level === L[1]!.value, opacity, isDark);
}

// ═════════════════════════ 人口密度 ═════════════════════════

/** 6 級色（YlOrBr 暗／淡版重新取樣；圖例共用）。 */
export const ustDensityColors = (isDark: boolean) => resampleRamp(paletteRamp("YlOrBr", isDark)!, 6);
export function ustDensityColorExpr(cc: UstCc, level: string, isDark: boolean): Expr {
  const colors = ustDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", UST_DENSITY_PROP], 0], colors[0]];
  UST_DENSITY_BREAKS[cc][level]!.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["!", ["has", UST_DENSITY_PROP]], UST_NOT_COVERED_COLOR, step];
}

function usePopLevel(mapRef: MapRef, cc: UstCc, level: UstLevel, visible: boolean, opacity: number, isDark: boolean) {
  const key = `${cc}Population`;
  const ids = ustPopLayerIds(cc, level.value);
  const source = levelSource(`${cc}-population`, `${cc}_population.pmtiles`, level, `${UST_NAME[cc].zh}人口載入中`);
  const def = opacityDefault(key, 0.7);
  const color = () => ustDensityColorExpr(cc, level.value, isDark);
  const fillPaint = () => hookFillPaint(key, ids.fill, { "fill-color": color(), "fill-opacity": clamp01(opacity) }, { "fill-color": color(), "fill-opacity": def }, isDark);
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(key, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
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
        layout: { visibility: "none", ...hookLineLayout(key, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** 預設第一層（PR 市、GU 村）。 */
export function useUstPopulationLayers(mapRef: MapRef, cc: UstCc, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const L = UST_POP_LEVELS[cc];
  const level = pickLevel(L, levelIdx, L[0]!.value);
  usePopLevel(mapRef, cc, L[0]!, visible && level === L[0]!.value, opacity, isDark);
  usePopLevel(mapRef, cc, L[1]!, visible && level === L[1]!.value, opacity, isDark);
}
export function usePrPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  useUstPopulationLayers(mapRef, "pr", visible, opacity, levelIdx, isDark);
}
export function useGuPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  useUstPopulationLayers(mapRef, "gu", visible, opacity, levelIdx, isDark);
}
