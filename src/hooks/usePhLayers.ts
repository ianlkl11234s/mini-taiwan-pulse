import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, LINE_DASH, MAP_SEAM, POINT_STROKE_DATA_ENCODED, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import {
  PH_ADMIN_COLOR, PH_ADMIN_LEVELS, PH_CAT_OTHER_ID, PH_DENSITY_BREAKS, PH_NOT_COVERED_COLOR, PH_PLANT_STATUSES, PH_PLANT_STATUS_DEFAULT,
  phCatOptionIds, phKigExcludeFilter, type PhAdminLevel, type PhLayerSpec, type PhPart,
} from "../data/phDataLayers";
import { gbAllOf, gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

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
/** 全關時的永假 filter（不移除 layer，換底圖重掛也一致）。 */
const NONE: Expr = ["==", ["literal", "__ph_none__"], "__ph_part__"];
const levelAt = (idx: number | undefined, fallback: PhAdminLevel): PhAdminLevel => PH_ADMIN_LEVELS[idx ?? -1]?.value ?? fallback;

function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

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

/** 子圖層的類別色：match(類別值) → 色；不屬於已列類別 → otherColor（或主色）。 */
export function phColorExpr(spec: PhLayerSpec, part: PhPart): Expr {
  const expr: unknown[] = ["match", part.cat.expr];
  const seen = new Set<string>();
  for (const c of spec.cats) {
    if (c.parts && !c.parts.includes(part.id)) continue;
    const values = c.values.filter((v) => !seen.has(v));
    values.forEach((v) => seen.add(v));
    if (values.length) expr.push(values.length === 1 ? values[0] : values, c.color);
  }
  expr.push(spec.otherColor ?? spec.color);
  return expr;
}

/** 類別多選 → 子圖層 filter：全選／未給＝null；該子圖層的類別全關＝永假；選了「其他」補上「不屬於已列類別」。 */
export function phPartCatFilter(spec: PhLayerSpec, part: PhPart, mask: number | undefined): Expr | null {
  if (mask === undefined || !Number.isFinite(mask)) return null;
  const ids = phCatOptionIds(spec);
  const selected = new Set(selectedMultiSelectValues(mask, ids));
  const mine = spec.cats.filter((c) => !c.parts || c.parts.includes(part.id));
  const withOther = !!spec.otherLabel;
  const allOn = mine.every((c) => selected.has(c.id)) && (!withOther || selected.has(PH_CAT_OTHER_ID));
  if (allOn) return null;
  const chosen = mine.filter((c) => selected.has(c.id)).flatMap((c) => [...c.values]);
  const hit: Expr | null = chosen.length ? ["in", part.cat.expr, ["literal", chosen]] : null;
  const other: Expr | null = withOther && selected.has(PH_CAT_OTHER_ID) ? ["!", ["in", part.cat.expr, ["literal", mine.flatMap((c) => [...c.values])]]] : null;
  if (hit && other) return ["any", hit, other];
  return hit ?? other ?? NONE;
}

/** 電廠狀態多選（預設運轉中＋興建中）。 */
export function phPlantStatusFilter(mask: number | undefined): Expr | null {
  const ids = PH_PLANT_STATUSES.map((s) => s.id);
  const selected = mask === undefined || !Number.isFinite(mask) ? [...PH_PLANT_STATUS_DEFAULT] : selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return null;
  if (selected.length === 0) return NONE;
  return ["in", ["get", "status"], ["literal", selected]];
}

function pointRadiusExpr(spec: PhLayerSpec, part: PhPart, scale: number): Expr | number {
  const k = scale / scaleDefault(spec.key);
  if (part.size) {
    const bands = part.size.bands;
    const step: unknown[] = ["step", ["to-number", ["get", part.size.prop], 0], bands[0]!.radius];
    for (const b of bands.slice(1)) step.push(b.min, b.radius);
    // 規格同一子圖層混有不帶該數值的點（微電網）：沒有欄位者用 M 階
    return ["*", ["case", ["has", part.size.prop], step, pointRadius("M")], k];
  }
  const sized = spec.cats.filter((c) => c.radius !== undefined && (!c.parts || c.parts.includes(part.id)));
  if (sized.length) {
    const m: unknown[] = ["match", part.cat.expr];
    for (const c of sized) m.push(c.values.length === 1 ? c.values[0] : [...c.values], c.radius);
    m.push(pointRadius("S"));
    return ["*", m, k];
  }
  return pointRadius(spec.key === "phFuelStations" || part.id === "ph-tanks-circle" || part.id === "ph-power-substations-circle" ? "S" : "M", k);
}

function pointPaint(spec: PhLayerSpec, part: PhPart, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const def = opacityDefault(spec.key, 0.85);
  const base = { "circle-radius": pointRadiusExpr(spec, part, scale), "circle-color": phColorExpr(spec, part), "circle-opacity": op, ...pointStrokePaint(isDark, op / def) };
  if (!part.ring) return base;
  // 描邊＝資料編碼（mapStyleScale POINT_STROKE_DATA_ENCODED）：符合者白框 2px，其餘底圖色細縫
  const theme = isDark ? "dark" : "light";
  return {
    ...base,
    "circle-stroke-color": ["case", part.ring.when, isDark ? "#ffffff" : "#111827", POINT_STROKE_DATA_ENCODED.color[theme]],
    "circle-stroke-width": ["case", part.ring.when, 2, 1],
    "circle-stroke-opacity": Math.min(1, POINT_STROKE_DATA_ENCODED.opacity[theme] * (op / def)),
  };
}

function lineWidthExpr(part: PhPart): Expr | number {
  if (!part.lineWidth) return ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2];
  const at = (i: 0 | 1) => {
    const m: unknown[] = ["match", part.cat.expr];
    for (const [v, w] of Object.entries(part.lineWidth!)) m.push(v, w[i]);
    m.push(i === 0 ? 0.5 : 1);
    return m;
  };
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

export const phHeatmapId = (spec: PhLayerSpec) => `${spec.parts[0]!.id.replace(/-circle$/, "")}-heatmap`;

export function phSourceSpec(spec: PhLayerSpec): SourceSpec {
  return { id: spec.sourceId, file: spec.file, minzoom: spec.srcMinzoom, maxzoom: spec.srcMaxzoom, attribution: spec.sourceOrg, loading: spec.loading.zh };
}

/** 規格驅動層：每個子圖層一個 layer（同一個 source）；`extraFilter`（電廠狀態）疊在所有子圖層上。 */
export function usePhDataLayer(mapRef: MapRef, spec: PhLayerSpec, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number, extraFilter?: Expr | null) {
  const source = phSourceSpec(spec);
  const heatStyle = useHeatmapStyleSignature(spec.heat ? [spec.key] : []);
  const filters = spec.parts.map((part) => gbAllOf(part.filter, phPartCatFilter(spec, part, catMask), extraFilter ?? null));
  const def = opacityDefault(spec.key, 0.85);
  useGbPmtilesLayers(mapRef, source, visible, () => {
    const builds: LayerBuild[] = [];
    spec.parts.forEach((part, i) => {
      const filter = filters[i] ?? null;
      const pointsFrom = spec.heat && part.geom === "point" ? densePointsFromZoom(spec.count, part.minzoom) : part.minzoom;
      if (spec.heat && part.geom === "point") {
        builds.push(gbHeatmapBuild({
          id: phHeatmapId(spec), key: spec.key, sourceId: source.id, sourceLayer: part.sourceLayer, maxzoom: heatmapMaxzoom(pointsFrom), filter,
          isDark, opacityScale: clamp01(opacity) / def, intensity: spec.heat.intensity,
        }));
      }
      const base = { source: source.id, "source-layer": part.sourceLayer, minzoom: pointsFrom, ...(filter ? { filter } : {}) };
      if (part.geom === "point") {
        builds.push({
          id: part.id,
          layer: () => ({ id: part.id, type: "circle", ...base, layout: { visibility: "none", ...(part.size ? { "circle-sort-key": ["-", 0, ["to-number", ["get", part.size.prop], 0]] } : {}) },
            paint: pointPaint(spec, part, isDark, opacity, scale) } as unknown as AnyLayer),
          update: (map) => { map.setFilter(part.id, (filter ?? null) as any); setPaint(map, part.id, pointPaint(spec, part, isDark, opacity, scale)); },
        });
        return;
      }
      const paint = () => hookLinePaint(spec.key, part.id,
        { "line-color": phColorExpr(spec, part), "line-width": lineWidthExpr(part), "line-opacity": clamp01(opacity), ...(part.dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) },
        { "line-color": phColorExpr(spec, part), "line-width": lineWidthExpr(part), "line-opacity": def, ...(part.dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) }, isDark);
      builds.push({
        id: part.id,
        layer: () => ({ id: part.id, type: "line", ...base, layout: { visibility: "none", ...hookLineLayout(spec.key, part.id) }, paint: paint() } as unknown as AnyLayer),
        update: (map) => { map.setFilter(part.id, (filter ?? null) as any); map.setPaintProperty(part.id, "line-opacity", paint()["line-opacity"] as any); },
      });
    });
    return builds;
  }, [spec.key, opacity, scale, isDark, heatStyle, sig(filters)]);
}
