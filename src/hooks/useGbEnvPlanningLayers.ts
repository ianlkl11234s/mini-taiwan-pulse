import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BROWNFIELD_ATTRIBUTION, GB_BROWNFIELD_COLOR, GB_BROWNFIELD_COUNT, GB_BROWNFIELD_MINZOOM, GB_BROWNFIELD_STATUSES, GB_BROWNFIELD_TILE_ZOOM,
  GB_ENV_FALLBACK_COLOR, GB_ENV_HOLLOW_STROKE, GB_NOISE_ATTRIBUTION, GB_NOISE_BANDS, GB_NOISE_MINZOOM, GB_NOISE_TILE_ZOOM,
  GB_PLANNING_ATTRIBUTION, GB_PLANNING_CONSTRAINTS, GB_PLANNING_MINZOOM, GB_PLANNING_TILE_ZOOM, GB_POLLUTION_ATTRIBUTION,
  GB_POLLUTION_COLOR, GB_POLLUTION_MINZOOM, GB_POLLUTION_TILE_ZOOM, GB_RECYCLING_ATTRIBUTION, GB_RECYCLING_CENTRE_MINZOOM,
  GB_RECYCLING_CONTAINER_MINZOOM, GB_RECYCLING_KINDS, GB_RECYCLING_TILE_ZOOM, GB_WASTE_PERMITS_ATTRIBUTION, GB_WASTE_PERMITS_COLOR,
  GB_WASTE_PERMITS_MINZOOM, GB_WASTE_PERMITS_TILE_ZOOM, type GbRecyclingKind, gbBrownfieldView, gbNoiseSourceView, gbPlanningView, gbWasteAuthorityView,
} from "../data/gbEnvPlanningTypes";
import { gbHeatmapBuild, gbMaskFilter, gbWithFilter, useGbPmtilesLayers, useGbRepPointLayers, type GbDisplayMode, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 11 波環境與規劃 6 層：規劃限制區（面，類別選單）、棕地登記冊（點，許可狀態選單）、回收點（點，中心／回收桶）、
 * 廢棄物處理許可（點，主管機關選單）、污染排放申報（點，只有蘇格蘭 SEPA；檔案本身不含英格蘭）、策略噪音（面，道路／鐵路選單）。
 * 靜態資料、不訂閱時間。
 *
 * R5（P-4／G-2，2026-10-30）：棕地（3 萬點）、回收桶（1.1 萬點）z<10 熱區、z≥10 畫點；
 * 回收中心、廢棄物處理許可、污染排放申報 <1 萬點直接 z5 起畫。
 */
export const GB_PLANNING_FILL_ID = "gb-planning-constraints-fill";
export const GB_PLANNING_LINE_ID = "gb-planning-constraints-line";
/** §3.8 V-1／V-5：代表點檔（analytics 另出，z4–10）的熱區與點模式 circle */
export const GB_PLANNING_HEATMAP_ID = "gb-planning-constraints-points-heatmap";
export const GB_PLANNING_POINT_CIRCLE_ID = "gb-planning-constraints-points-circle";
export const GB_BROWNFIELD_CIRCLE_ID = "gb-brownfield-circle";
export const GB_RECYCLING_CENTRE_CIRCLE_ID = "gb-recycling-centre-circle";
export const GB_RECYCLING_CONTAINER_CIRCLE_ID = "gb-recycling-container-circle";
export const GB_WASTE_PERMITS_CIRCLE_ID = "gb-waste-permits-circle";
export const GB_POLLUTION_CIRCLE_ID = "gb-pollution-inventory-circle";
export const GB_NOISE_FILL_ID = "gb-noise-fill";
export const GB_BROWNFIELD_HEATMAP_ID = "gb-brownfield-heatmap";
export const GB_RECYCLING_CONTAINER_HEATMAP_ID = "gb-recycling-container-heatmap";

type MapRef = React.RefObject<MapboxMap | null>;
type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};

// ─────────────────────────── 規劃限制區 ───────────────────────────

const PLANNING_SOURCE: SourceSpec = {
  id: "gb-planning-constraints", file: "gb_planning_constraints.pmtiles", ...GB_PLANNING_TILE_ZOOM,
  attribution: GB_PLANNING_ATTRIBUTION, loading: "英國規劃限制區載入中",
};
function planningColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "constraint"], ""]];
  for (const c of GB_PLANNING_CONSTRAINTS) expr.push(c.value, c.color);
  expr.push(GB_ENV_FALLBACK_COLOR);
  return expr;
}
/** 綠帶淡填色（資料編碼透明度：大面積只當範圍提示，不蓋住保育區）。 */
function planningFillOpacity(op: number): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "constraint"], ""]];
  for (const c of GB_PLANNING_CONSTRAINTS) expr.push(c.value, clamp01(op) * c.fill);
  expr.push(clamp01(op));
  return expr;
}
/** 類別選單 → filter；全部回 null。 */
export function gbPlanningFilter(viewIdx: number): Expr | null {
  const view = gbPlanningView(viewIdx);
  return view === "all" ? null : ["==", ["get", "constraint"], view];
}

const PLANNING_POINTS_SOURCE: SourceSpec = {
  id: "gb-planning-constraints-points", file: "gb_planning_constraints_points.pmtiles", minzoom: 4, maxzoom: 10,
  attribution: GB_PLANNING_ATTRIBUTION, loading: "英國規劃限制區代表點載入中",
};

/**
 * 規劃限制區：預設「點」（小而零散的面，§3.8 V-5）——熱區到 z10、之後畫代表點；「面」模式熱區到 z8、之後畫面。
 * 類別選單（保育區／Article 4／綠帶／全部）同時篩熱區、代表點與面。
 */
export function useGbPlanningConstraintsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, mode: GbDisplayMode, viewIdx: number, isDark: boolean) {
  const def = opacityDefault("gbPlanningConstraints", 0.35);
  const filter = gbPlanningFilter(viewIdx);
  const heatStyle = useHeatmapStyleSignature(["gbPlanningConstraints"]);
  useGbRepPointLayers(mapRef, {
    key: "gbPlanningConstraints", source: PLANNING_POINTS_SOURCE, sourceLayer: "gb_planning_constraints_points",
    heatId: GB_PLANNING_HEATMAP_ID, circleId: GB_PLANNING_POINT_CIRCLE_ID, count: 18_727,
    polygonMinzoom: GB_PLANNING_MINZOOM, heatIntensity: 2, opacityDefault: def,
  }, { visible, mode, opacity, scale: scale / scaleDefault("gbPlanningConstraints"), isDark, color: planningColor(), filter }, heatStyle);
  const fillPaint = (op: number) => hookFillPaint("gbPlanningConstraints", GB_PLANNING_FILL_ID,
    { "fill-color": planningColor(), "fill-opacity": planningFillOpacity(op) },
    { "fill-color": planningColor(), "fill-opacity": planningFillOpacity(def) }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbPlanningConstraints", GB_PLANNING_LINE_ID,
    { "line-color": planningColor(), "line-width": 1, "line-opacity": clamp01(op / def) * 0.8 },
    { "line-color": planningColor(), "line-width": 1, "line-opacity": 0.8 }, isDark);
  useGbPmtilesLayers(mapRef, PLANNING_SOURCE, visible && mode === "polygon", () => [
    {
      id: GB_PLANNING_FILL_ID,
      layer: () => ({
        id: GB_PLANNING_FILL_ID, type: "fill", source: PLANNING_SOURCE.id, "source-layer": "gb_planning_constraints", minzoom: GB_PLANNING_MINZOOM,
        ...(filter ? { filter } : {}),
        // 綠帶最下層、Article 4 中間、保育區最上層
        layout: { visibility: "none", "fill-sort-key": ["match", ["get", "constraint"], "green_belt", 0, "article_4", 1, 2] },
        paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => {
        map.setFilter(GB_PLANNING_FILL_ID, (filter ?? null) as any);
        map.setPaintProperty(GB_PLANNING_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any);
      },
    },
    {
      id: GB_PLANNING_LINE_ID,
      layer: () => ({
        id: GB_PLANNING_LINE_ID, type: "line", source: PLANNING_SOURCE.id, "source-layer": "gb_planning_constraints", minzoom: GB_PLANNING_MINZOOM,
        ...(filter ? { filter } : {}),
        layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => {
        map.setFilter(GB_PLANNING_LINE_ID, (filter ?? null) as any);
        map.setPaintProperty(GB_PLANNING_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any);
      },
    },
  ], [opacity, viewIdx, isDark]);
}

// ─────────────────────────── 棕地登記冊 ───────────────────────────

const BROWNFIELD_SOURCE: SourceSpec = {
  id: "gb-brownfield", file: "gb_brownfield.pmtiles", ...GB_BROWNFIELD_TILE_ZOOM, attribution: GB_BROWNFIELD_ATTRIBUTION, loading: "英國棕地登記冊載入中",
};
const KNOWN_STATUSES = GB_BROWNFIELD_STATUSES.filter((s) => s.value !== "other").map((s) => s.value);
/** permission_status 歸類：null 與未列舉值都算 other（未載明）。 */
const STATUS_EXPR: Expr = ["match", ["coalesce", ["get", "permission_status"], ""], KNOWN_STATUSES, ["get", "permission_status"], "other"];
function statusMatch(pick: (s: (typeof GB_BROWNFIELD_STATUSES)[number]) => unknown): Expr {
  const expr: unknown[] = ["match", STATUS_EXPR];
  for (const s of GB_BROWNFIELD_STATUSES) expr.push(s.value, pick(s));
  expr.push(pick(GB_BROWNFIELD_STATUSES[GB_BROWNFIELD_STATUSES.length - 1]!));
  return expr;
}
export function gbBrownfieldFilter(viewIdx: number): Expr | null {
  const view = gbBrownfieldView(viewIdx);
  return view === "all" ? null : ["==", STATUS_EXPR, view];
}
/** 同色、填色強度依許可進度；未許可同色空心、已完成／其他／未載明灰色空心；其餘底圖色細縫（P-2）。 */
function brownfieldPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbBrownfield", 0.75));
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbBrownfield")),
    "circle-color": GB_BROWNFIELD_COLOR,
    "circle-opacity": statusMatch((s) => op * s.fill),
    "circle-stroke-color": statusMatch((s) => (s.hollow ? (s.neutral ? GB_ENV_FALLBACK_COLOR : GB_BROWNFIELD_COLOR) : seam["circle-stroke-color"])),
    "circle-stroke-width": statusMatch((s) => (s.hollow ? GB_ENV_HOLLOW_STROKE : seam["circle-stroke-width"])),
    "circle-stroke-opacity": statusMatch((s) => (s.hollow ? op : seam["circle-stroke-opacity"])),
  };
}

const BROWNFIELD_POINTS_FROM = densePointsFromZoom(GB_BROWNFIELD_COUNT, GB_BROWNFIELD_MINZOOM);
// 只有英格蘭、都市集中：倫敦／曼徹斯特在 2 已飽和（2026-10-30 全英 z5.5 目視）
const BROWNFIELD_HEAT_INTENSITY = 1.5;

export function useGbBrownfieldLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, viewIdx: number, isDark: boolean) {
  const filter = gbBrownfieldFilter(viewIdx);
  const heatStyle = useHeatmapStyleSignature(["gbBrownfield"]);
  useGbPmtilesLayers(mapRef, BROWNFIELD_SOURCE, visible, () => [gbHeatmapBuild({
    id: GB_BROWNFIELD_HEATMAP_ID, key: "gbBrownfield", sourceId: BROWNFIELD_SOURCE.id, sourceLayer: "gb_brownfield",
    maxzoom: heatmapMaxzoom(BROWNFIELD_POINTS_FROM), filter,
    isDark, opacityScale: clamp01(opacity) / opacityDefault("gbBrownfield", 0.75), intensity: BROWNFIELD_HEAT_INTENSITY,
  }), {
    id: GB_BROWNFIELD_CIRCLE_ID,
    layer: () => ({
      id: GB_BROWNFIELD_CIRCLE_ID, type: "circle", source: BROWNFIELD_SOURCE.id, "source-layer": "gb_brownfield", minzoom: BROWNFIELD_POINTS_FROM,
      ...(filter ? { filter } : {}),
      // 已許可畫在上面
      layout: { visibility: "none", "circle-sort-key": statusMatch((s) => s.fill) },
      paint: brownfieldPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_BROWNFIELD_CIRCLE_ID, (filter ?? null) as any);
      setPaint(map, GB_BROWNFIELD_CIRCLE_ID, brownfieldPaint(isDark, opacity, scale));
    },
  }], [opacity, scale, viewIdx, isDark, heatStyle]);
}

// ─────────────────────────── 回收點 ───────────────────────────

const RECYCLING_SOURCE: SourceSpec = {
  id: "gb-recycling-points", file: "gb_recycling_points.pmtiles", ...GB_RECYCLING_TILE_ZOOM, attribution: GB_RECYCLING_ATTRIBUTION, loading: "英國回收點載入中",
};
function recyclingPaint(kind: (typeof GB_RECYCLING_KINDS)[number], isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius(kind.value === "centre" ? "M" : "S", scale / scaleDefault("gbRecyclingCentres")),
    "circle-color": kind.color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbRecyclingCentres", 0.75)),
  };
}

/** 回收桶 11,412 點（≥1 萬）→ R5 熱區；回收中心 1,547 點直接畫。 */
const RECYCLING_CONTAINER_POINTS_FROM = densePointsFromZoom(GB_RECYCLING_KINDS[1]!.count, GB_RECYCLING_CONTAINER_MINZOOM);
// 回收中心點蓋在上面 → 強度調高（2026-10-30 全英 z5.5 目視）
const RECYCLING_HEAT_INTENSITY = 3;
const recyclingKindFilter = (kind: GbRecyclingKind): Expr => ["==", ["get", "kind"], kind];

export function useGbRecyclingCentresLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  const heatStyle = useHeatmapStyleSignature(["gbRecyclingCentres"]);
  // §3.8 V-4：回收中心／回收桶多選
  const kindFilter = gbMaskFilter("kind", kindMask, GB_RECYCLING_KINDS.map((k) => k.value));
  const build = (id: string, kind: (typeof GB_RECYCLING_KINDS)[number]) => ({
    id,
    layer: () => ({
      id, type: "circle", source: RECYCLING_SOURCE.id, "source-layer": "gb_recycling_points",
      minzoom: kind.value === "centre" ? GB_RECYCLING_CENTRE_MINZOOM : RECYCLING_CONTAINER_POINTS_FROM,
      filter: recyclingKindFilter(kind.value),
      layout: { visibility: "none" }, paint: recyclingPaint(kind, isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map: MapboxMap) => setPaint(map, id, recyclingPaint(kind, isDark, opacity, scale)),
  });
  // 回收中心（量少、範圍大）畫在回收桶上面
  useGbPmtilesLayers(mapRef, RECYCLING_SOURCE, visible, () => gbWithFilter([
    gbHeatmapBuild({
      id: GB_RECYCLING_CONTAINER_HEATMAP_ID, key: "gbRecyclingCentres", sourceId: RECYCLING_SOURCE.id, sourceLayer: "gb_recycling_points",
      maxzoom: heatmapMaxzoom(RECYCLING_CONTAINER_POINTS_FROM), filter: recyclingKindFilter("container"),
      isDark, opacityScale: clamp01(opacity) / opacityDefault("gbRecyclingCentres", 0.75), intensity: RECYCLING_HEAT_INTENSITY,
    }),
    build(GB_RECYCLING_CONTAINER_CIRCLE_ID, GB_RECYCLING_KINDS[1]!),
    build(GB_RECYCLING_CENTRE_CIRCLE_ID, GB_RECYCLING_KINDS[0]!),
  ], kindFilter), [opacity, scale, kindMask, isDark, heatStyle]);
}

// ─────────────────────────── 廢棄物處理許可 ───────────────────────────

const WASTE_PERMITS_SOURCE: SourceSpec = {
  id: "gb-waste-permits", file: "gb_waste_permits.pmtiles", ...GB_WASTE_PERMITS_TILE_ZOOM, attribution: GB_WASTE_PERMITS_ATTRIBUTION, loading: "英國廢棄物處理許可載入中",
};
export function gbWastePermitsFilter(viewIdx: number): Expr | null {
  const view = gbWasteAuthorityView(viewIdx);
  return view === "all" ? null : ["==", ["get", "authority"], view];
}
function wastePermitsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbWastePermits")),
    "circle-color": GB_WASTE_PERMITS_COLOR,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbWastePermits", 0.8)),
  };
}

export function useGbWastePermitsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, viewIdx: number, isDark: boolean) {
  const filter = gbWastePermitsFilter(viewIdx);
  useGbPmtilesLayers(mapRef, WASTE_PERMITS_SOURCE, visible, () => [{
    id: GB_WASTE_PERMITS_CIRCLE_ID,
    layer: () => ({
      id: GB_WASTE_PERMITS_CIRCLE_ID, type: "circle", source: WASTE_PERMITS_SOURCE.id, "source-layer": "gb_waste_permits", minzoom: GB_WASTE_PERMITS_MINZOOM,
      ...(filter ? { filter } : {}),
      layout: { visibility: "none" }, paint: wastePermitsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_WASTE_PERMITS_CIRCLE_ID, (filter ?? null) as any);
      setPaint(map, GB_WASTE_PERMITS_CIRCLE_ID, wastePermitsPaint(isDark, opacity, scale));
    },
  }], [opacity, scale, viewIdx, isDark]);
}

// ─────────────────────────── 污染排放申報（蘇格蘭 SEPA） ───────────────────────────

const POLLUTION_SOURCE: SourceSpec = {
  id: "gb-pollution-inventory", file: "gb_pollution_inventory_sepa.pmtiles", ...GB_POLLUTION_TILE_ZOOM, attribution: GB_POLLUTION_ATTRIBUTION, loading: "英國污染排放申報載入中",
};
/** 任一途徑（空氣或水體）申報有排放。 */
export const GB_POLLUTION_RELEASED: Expr = ["any", ["==", ["get", "release_air"], "yes"], ["==", ["get", "release_water"], "yes"]];
/** 有申報排放實心；已申報途徑皆無排放＝同色空心（資料編碼描邊 P-9）。 */
function pollutionPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbPollutionInventory", 0.85));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbPollutionInventory")),
    "circle-color": GB_POLLUTION_COLOR,
    "circle-opacity": ["case", GB_POLLUTION_RELEASED, op, 0],
    "circle-stroke-color": ["case", GB_POLLUTION_RELEASED, seam["circle-stroke-color"], GB_POLLUTION_COLOR],
    "circle-stroke-width": ["case", GB_POLLUTION_RELEASED, seam["circle-stroke-width"], GB_ENV_HOLLOW_STROKE],
    "circle-stroke-opacity": ["case", GB_POLLUTION_RELEASED, seam["circle-stroke-opacity"], op],
  };
}

export function useGbPollutionInventoryLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, POLLUTION_SOURCE, visible, () => [{
    id: GB_POLLUTION_CIRCLE_ID,
    layer: () => ({
      id: GB_POLLUTION_CIRCLE_ID, type: "circle", source: POLLUTION_SOURCE.id, "source-layer": "gb_pollution_inventory", minzoom: GB_POLLUTION_MINZOOM,
      layout: { visibility: "none" }, paint: pollutionPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_POLLUTION_CIRCLE_ID, pollutionPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 策略噪音地圖 ───────────────────────────

const NOISE_SOURCE: SourceSpec = {
  id: "gb-noise", file: "gb_noise.pmtiles", ...GB_NOISE_TILE_ZOOM, attribution: GB_NOISE_ATTRIBUTION, loading: "英國策略噪音地圖載入中",
};
function noiseColor(): Expr {
  const expr: unknown[] = ["match", ["to-number", ["get", "band_min_db"], 0]];
  for (const b of GB_NOISE_BANDS) expr.push(b.min, b.color);
  expr.push("rgba(0,0,0,0)");
  return expr;
}
export const gbNoiseFilter = (sourceIdx: number): Expr => ["==", ["get", "noise_source"], gbNoiseSourceView(sourceIdx)];

export function useGbNoiseLayer(mapRef: MapRef, visible: boolean, opacity: number, sourceIdx: number, isDark: boolean) {
  const def = opacityDefault("gbNoise", 0.55);
  const paint = (op: number) => hookFillPaint("gbNoise", GB_NOISE_FILL_ID,
    { "fill-color": noiseColor(), "fill-opacity": clamp01(op) }, { "fill-color": noiseColor(), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, NOISE_SOURCE, visible, () => [{
    id: GB_NOISE_FILL_ID,
    layer: () => ({
      id: GB_NOISE_FILL_ID, type: "fill", source: NOISE_SOURCE.id, "source-layer": "gb_noise", minzoom: GB_NOISE_MINZOOM,
      filter: gbNoiseFilter(sourceIdx),
      // 高噪音帶畫在上面
      layout: { visibility: "none", "fill-sort-key": ["to-number", ["get", "band_min_db"], 0] }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_NOISE_FILL_ID, gbNoiseFilter(sourceIdx) as any);
      map.setPaintProperty(GB_NOISE_FILL_ID, "fill-opacity", paint(opacity)["fill-opacity"] as any);
    },
  }], [opacity, sourceIdx, isDark]);
}
