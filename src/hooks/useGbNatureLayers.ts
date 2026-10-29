import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_ACCESS_TYPES, GB_ANCIENT_WOODLAND_MINZOOM, GB_DESIGNATION_FALLBACK_COLOR, GB_DESIGNATION_FILTERS, GB_DESIGNATIONS,
  GB_FOREST_ROUTE_MINZOOM, GB_LANDSCAPE_FILL_FACTOR, GB_MPA_TYPES, GB_NATIONAL_TRAIL_COLOR,
  GB_NATIONAL_TRAIL_MINZOOM, GB_NATURE_MAP_ATTRIBUTION, GB_RECREATION_CATEGORIES, GB_RECREATION_MINZOOM,
  GB_RECREATION_SIGNAGE_MINZOOM, GB_RECREATION_UNCLASSIFIED_COLOR, GB_TPO_MINZOOM, GB_TRAIL_CATEGORIES, GB_TRAIL_UNCLASSIFIED_COLOR,
  GB_TREE_CATEGORIES, GB_WOODLAND_FALLBACK_COLOR, GB_WOODLAND_GROUPS, GB_WOODLAND_NI_COLOR, GB_WOODLAND_MINZOOM, GB_WOODLAND_NI_KIND,
  type GbDesignationFilter,
} from "../data/gbNatureTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 5 波自然與林業 7 層：保護區、海洋保護區（面）、林地（面）、森林遊憩（點）、步道（線）、開放進入地（面）、
 * 樹木保護（古老林地面＋TPO 面／點）。每層一個 PMTiles source，各自開關；靜態資料、不訂閱時間。
 * 大檔（林地 129MB、樹木保護 127MB）靠 layer minzoom 擋低 zoom 請求：未達 minzoom 時 mapbox 不抓該 source 的 tile。
 */
export const GB_PROTECTED_FILL_ID = "gb-protected-areas-fill";
export const GB_PROTECTED_LINE_ID = "gb-protected-areas-line";
export const GB_MPA_FILL_ID = "gb-marine-protected-areas-fill";
export const GB_MPA_LINE_ID = "gb-marine-protected-areas-line";
export const GB_WOODLAND_FILL_ID = "gb-woodland-fill";
export const GB_RECREATION_CIRCLE_ID = "gb-forest-recreation-circle";
export const GB_RECREATION_SIGNAGE_CIRCLE_ID = "gb-forest-recreation-signage-circle";
export const GB_NATIONAL_TRAIL_LINE_ID = "gb-trails-national-line";
export const GB_FOREST_ROUTE_LINE_ID = "gb-trails-forest-line";
export const GB_OPEN_ACCESS_FILL_ID = "gb-open-access-land-fill";
export const GB_ANCIENT_WOODLAND_FILL_ID = "gb-ancient-woodland-fill";
export const GB_TPO_FILL_ID = "gb-tpo-fill";
export const GB_TPO_CIRCLE_ID = "gb-tpo-circle";

type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
// mapbox v3 對 Multi* 回傳 "MultiPolygon"／"MultiPoint"，兩種都要收
const IS_POINT: Expr = ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false];
const IS_POLYGON: Expr = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];

function matchColor(field: string, pairs: readonly (readonly [unknown, string])[], fallback: string): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, c] of pairs) expr.push(v, c);
  expr.push(fallback);
  return expr;
}

/** 同時設多個 paint 屬性（update 共用）。 */
function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

// ─────────────────────────── 保護區 ───────────────────────────

const PROTECTED_SOURCE: SourceSpec = {
  id: "gb-protected-areas", file: "gb_protected_areas.pmtiles", minzoom: 4, maxzoom: 13, attribution: GB_NATURE_MAP_ATTRIBUTION.protected, loading: "英國保護區載入中",
};
const LANDSCAPE = GB_DESIGNATIONS.filter((d) => d.group === "landscape").map((d) => d.value);
const IS_LANDSCAPE: Expr = ["in", ["get", "designation"], ["literal", LANDSCAPE]];

export function gbDesignationFilterFromIdx(idx: number): GbDesignationFilter {
  return GB_DESIGNATION_FILTERS[idx] ?? "all";
}
/** 「類別」選項 → filter；all 回 null（不設 filter）。 */
export function gbDesignationFilterExpr(filter: GbDesignationFilter): Expr | null {
  if (filter === "all") return null;
  return ["in", ["get", "designation"], ["literal", GB_DESIGNATIONS.filter((d) => d.group === filter).map((d) => d.value)]];
}
function designationColor(): Expr {
  return matchColor("designation", GB_DESIGNATIONS.map((d) => [d.value, d.color] as const), GB_DESIGNATION_FALLBACK_COLOR);
}
/** 景觀類淡填色（資料編碼透明度：大面積不蓋住其他保護區）。 */
const protectedFillOpacity = (op: number): Expr => ["case", IS_LANDSCAPE, clamp01(op) * GB_LANDSCAPE_FILL_FACTOR, clamp01(op)];

export function useGbProtectedAreasLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, filterIdx: number, isDark: boolean) {
  const def = opacityDefault("gbProtectedAreas", 0.45);
  const filter = gbDesignationFilterExpr(gbDesignationFilterFromIdx(filterIdx));
  const fillPaint = (op: number) => hookFillPaint("gbProtectedAreas", GB_PROTECTED_FILL_ID,
    { "fill-color": designationColor(), "fill-opacity": protectedFillOpacity(op) },
    { "fill-color": designationColor(), "fill-opacity": protectedFillOpacity(def) }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbProtectedAreas", GB_PROTECTED_LINE_ID,
    { "line-color": designationColor(), "line-width": 1, "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": designationColor(), "line-width": 1, "line-opacity": 0.9 }, isDark);
  useGbPmtilesLayers(mapRef, PROTECTED_SOURCE, visible, () => [
    {
      id: GB_PROTECTED_FILL_ID,
      layer: () => ({
        id: GB_PROTECTED_FILL_ID, type: "fill", source: PROTECTED_SOURCE.id, "source-layer": "gb_protected_areas", minzoom: 5,
        ...(filter ? { filter } : {}),
        // 景觀類（國家公園、AONB、NSA）最下層，國際指定最上層
        layout: { visibility: "none", "fill-sort-key": ["case", IS_LANDSCAPE, 0, ["in", ["get", "designation"], ["literal", ["sssi", "nnr"]]], 1, 2] },
        paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => {
        map.setFilter(GB_PROTECTED_FILL_ID, (filter ?? null) as any);
        map.setPaintProperty(GB_PROTECTED_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any);
      },
    },
    {
      id: GB_PROTECTED_LINE_ID,
      layer: () => ({
        id: GB_PROTECTED_LINE_ID, type: "line", source: PROTECTED_SOURCE.id, "source-layer": "gb_protected_areas", minzoom: 5,
        ...(filter ? { filter } : {}),
        layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => {
        map.setFilter(GB_PROTECTED_LINE_ID, (filter ?? null) as any);
        map.setPaintProperty(GB_PROTECTED_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any);
      },
    },
  ], [opacity, filterIdx, isDark]);
}

// ─────────────────────────── 海洋保護區 ───────────────────────────

const MPA_SOURCE: SourceSpec = {
  id: "gb-marine-protected-areas", file: "gb_marine_protected_areas.pmtiles", minzoom: 4, maxzoom: 12, attribution: GB_NATURE_MAP_ATTRIBUTION.mpa, loading: "英國海洋保護區載入中",
};
const mpaColor = (): Expr => matchColor("mpa_type", GB_MPA_TYPES.map((m) => [m.value, m.color] as const), GB_DESIGNATION_FALLBACK_COLOR);

export function useGbMarineProtectedAreasLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbMarineProtectedAreas", 0.5);
  const fillPaint = (op: number) => hookFillPaint("gbMarineProtectedAreas", GB_MPA_FILL_ID,
    { "fill-color": mpaColor(), "fill-opacity": clamp01(op) }, { "fill-color": mpaColor(), "fill-opacity": def }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbMarineProtectedAreas", GB_MPA_LINE_ID,
    { "line-color": mpaColor(), "line-width": 1, "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": mpaColor(), "line-width": 1, "line-opacity": 0.9 }, isDark);
  useGbPmtilesLayers(mapRef, MPA_SOURCE, visible, () => [
    {
      id: GB_MPA_FILL_ID,
      layer: () => ({
        id: GB_MPA_FILL_ID, type: "fill", source: MPA_SOURCE.id, "source-layer": "gb_marine_protected_areas", minzoom: 4,
        layout: { visibility: "none" }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_MPA_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_MPA_LINE_ID,
      layer: () => ({
        id: GB_MPA_LINE_ID, type: "line", source: MPA_SOURCE.id, "source-layer": "gb_marine_protected_areas", minzoom: 4,
        layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_MPA_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

// ─────────────────────────── 林地 ───────────────────────────

const WOODLAND_SOURCE: SourceSpec = {
  id: "gb-woodland", file: "gb_woodland_nfi.pmtiles", minzoom: 5, maxzoom: 13, attribution: GB_NATURE_MAP_ATTRIBUTION.woodland, loading: "英國林地載入中",
};
function woodlandColor(): Expr {
  const pairs = GB_WOODLAND_GROUPS.map((g) => [[...g.types], g.color] as const);
  return ["case", ["==", ["get", "kind"], GB_WOODLAND_NI_KIND], GB_WOODLAND_NI_COLOR, matchColor("forest_type", pairs, GB_WOODLAND_FALLBACK_COLOR)];
}

export function useGbWoodlandLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbWoodland", 0.7);
  const paint = (op: number) => hookFillPaint("gbWoodland", GB_WOODLAND_FILL_ID,
    { "fill-color": woodlandColor(), "fill-opacity": clamp01(op) }, { "fill-color": woodlandColor(), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, WOODLAND_SOURCE, visible, () => [{
    id: GB_WOODLAND_FILL_ID,
    layer: () => ({
      id: GB_WOODLAND_FILL_ID, type: "fill", source: WOODLAND_SOURCE.id, "source-layer": "gb_woodland_nfi", minzoom: GB_WOODLAND_MINZOOM,
      layout: { visibility: "none" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_WOODLAND_FILL_ID, "fill-opacity", paint(opacity)["fill-opacity"] as any),
  }], [opacity, isDark]);
}

// ─────────────────────────── 森林遊憩 ───────────────────────────

const RECREATION_SOURCE: SourceSpec = {
  id: "gb-forest-recreation", file: "gb_forest_recreation.pmtiles", minzoom: 8, maxzoom: 14, attribution: GB_NATURE_MAP_ATTRIBUTION.recreation, loading: "英國森林遊憩設施載入中",
};
const IS_SIGNAGE: Expr = ["==", ["get", "category"], "signage"];
const recreationColor = (): Expr => matchColor("category", GB_RECREATION_CATEGORIES.map((c) => [c.value, c.color] as const), GB_RECREATION_UNCLASSIFIED_COLOR);

function recreationPaint(isDark: boolean, opacity: number, scale: number, tier: "S" | "M") {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius(tier, scale / scaleDefault("gbForestRecreation")),
    "circle-color": recreationColor(),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbForestRecreation", 0.75)),
  };
}

export function useGbForestRecreationLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, RECREATION_SOURCE, visible, () => [
    {
      // 指標與步道標 12,637 點：z12 起、小點，畫在下層
      id: GB_RECREATION_SIGNAGE_CIRCLE_ID,
      layer: () => ({
        id: GB_RECREATION_SIGNAGE_CIRCLE_ID, type: "circle", source: RECREATION_SOURCE.id, "source-layer": "gb_forest_recreation",
        minzoom: GB_RECREATION_SIGNAGE_MINZOOM, filter: IS_SIGNAGE, layout: { visibility: "none" }, paint: recreationPaint(isDark, opacity, scale, "S"),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_RECREATION_SIGNAGE_CIRCLE_ID, recreationPaint(isDark, opacity, scale, "S")),
    },
    {
      id: GB_RECREATION_CIRCLE_ID,
      layer: () => ({
        id: GB_RECREATION_CIRCLE_ID, type: "circle", source: RECREATION_SOURCE.id, "source-layer": "gb_forest_recreation",
        minzoom: GB_RECREATION_MINZOOM, filter: ["!", IS_SIGNAGE], layout: { visibility: "none" }, paint: recreationPaint(isDark, opacity, scale, "M"),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_RECREATION_CIRCLE_ID, recreationPaint(isDark, opacity, scale, "M")),
    },
  ], [opacity, scale, isDark]);
}

// ─────────────────────────── 步道 ───────────────────────────

const TRAILS_SOURCE: SourceSpec = {
  id: "gb-trails", file: "gb_trails.pmtiles", minzoom: 6, maxzoom: 14, attribution: GB_NATURE_MAP_ATTRIBUTION.trails, loading: "英國步道載入中",
};
const forestRouteColor = (): Expr => matchColor("category", GB_TRAIL_CATEGORIES.flatMap((c) => c.raw.map((r) => [r, c.color] as const)), GB_TRAIL_UNCLASSIFIED_COLOR);
const zoomWidth = (tier: keyof typeof LINE_WIDTH): Expr => ["interpolate", ["linear"], ["zoom"], 10, LINE_WIDTH[tier][0], 14, LINE_WIDTH[tier][1]];

export function useGbTrailsLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbTrails", 0.85);
  const nationalPaint = (op: number) => hookLinePaint("gbTrails", GB_NATIONAL_TRAIL_LINE_ID,
    { "line-color": GB_NATIONAL_TRAIL_COLOR, "line-width": zoomWidth("emphasis"), "line-opacity": clamp01(op) },
    { "line-color": GB_NATIONAL_TRAIL_COLOR, "line-width": zoomWidth("emphasis"), "line-opacity": def }, isDark);
  const forestPaint = (op: number) => hookLinePaint("gbTrails", GB_FOREST_ROUTE_LINE_ID,
    { "line-color": forestRouteColor(), "line-width": zoomWidth("standard"), "line-opacity": clamp01(op) },
    { "line-color": forestRouteColor(), "line-width": zoomWidth("standard"), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, TRAILS_SOURCE, visible, () => [
    {
      id: GB_FOREST_ROUTE_LINE_ID,
      layer: () => ({
        id: GB_FOREST_ROUTE_LINE_ID, type: "line", source: TRAILS_SOURCE.id, "source-layer": "gb_trails", minzoom: GB_FOREST_ROUTE_MINZOOM,
        filter: ["==", ["get", "route_class"], "forest_route"],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: forestPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_FOREST_ROUTE_LINE_ID, "line-opacity", forestPaint(opacity)["line-opacity"] as any),
    },
    {
      id: GB_NATIONAL_TRAIL_LINE_ID,
      layer: () => ({
        id: GB_NATIONAL_TRAIL_LINE_ID, type: "line", source: TRAILS_SOURCE.id, "source-layer": "gb_trails", minzoom: GB_NATIONAL_TRAIL_MINZOOM,
        filter: ["==", ["get", "route_class"], "national_trail"],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: nationalPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_NATIONAL_TRAIL_LINE_ID, "line-opacity", nationalPaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

// ─────────────────────────── 開放進入地 ───────────────────────────

const OPEN_ACCESS_SOURCE: SourceSpec = {
  id: "gb-open-access-land", file: "gb_open_access_land.pmtiles", minzoom: 6, maxzoom: 13, attribution: GB_NATURE_MAP_ATTRIBUTION.openAccess, loading: "英國開放進入地載入中",
};
const openAccessColor = (): Expr => matchColor("access_type", GB_ACCESS_TYPES.map((a) => [a.value, a.color] as const), GB_DESIGNATION_FALLBACK_COLOR);

export function useGbOpenAccessLandLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbOpenAccessLand", 0.6);
  const paint = (op: number) => hookFillPaint("gbOpenAccessLand", GB_OPEN_ACCESS_FILL_ID,
    { "fill-color": openAccessColor(), "fill-opacity": clamp01(op) }, { "fill-color": openAccessColor(), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, OPEN_ACCESS_SOURCE, visible, () => [{
    id: GB_OPEN_ACCESS_FILL_ID,
    layer: () => ({
      id: GB_OPEN_ACCESS_FILL_ID, type: "fill", source: OPEN_ACCESS_SOURCE.id, "source-layer": "gb_open_access_land", minzoom: 8,
      layout: { visibility: "none" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_OPEN_ACCESS_FILL_ID, "fill-opacity", paint(opacity)["fill-opacity"] as any),
  }], [opacity, isDark]);
}

// ─────────────────────────── 樹木保護 ───────────────────────────

const TREE_SOURCE: SourceSpec = {
  id: "gb-tree-protection", file: "gb_tree_protection.pmtiles", minzoom: 7, maxzoom: 14, attribution: GB_NATURE_MAP_ATTRIBUTION.tree, loading: "英國樹木保護載入中",
};
const treeColor = (): Expr => matchColor("category", GB_TREE_CATEGORIES.map((c) => [c.value, c.color] as const), GB_DESIGNATION_FALLBACK_COLOR);
const IS_TPO: Expr = ["in", ["get", "category"], ["literal", ["tpo_zone", "tpo_tree"]]];

function tpoCirclePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbTreeProtection")),
    "circle-color": treeColor(),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbTreeProtection", 0.7)),
  };
}

export function useGbTreeProtectionLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const def = opacityDefault("gbTreeProtection", 0.7);
  const awPaint = (op: number) => hookFillPaint("gbTreeProtection", GB_ANCIENT_WOODLAND_FILL_ID,
    { "fill-color": treeColor(), "fill-opacity": clamp01(op) }, { "fill-color": treeColor(), "fill-opacity": def }, isDark);
  const tpoPaint = (op: number) => hookFillPaint("gbTreeProtection", GB_TPO_FILL_ID,
    { "fill-color": treeColor(), "fill-opacity": clamp01(op) }, { "fill-color": treeColor(), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, TREE_SOURCE, visible, () => [
    {
      id: GB_ANCIENT_WOODLAND_FILL_ID,
      layer: () => ({
        id: GB_ANCIENT_WOODLAND_FILL_ID, type: "fill", source: TREE_SOURCE.id, "source-layer": "gb_tree_protection", minzoom: GB_ANCIENT_WOODLAND_MINZOOM,
        filter: ["all", IS_POLYGON, ["==", ["get", "category"], "ancient_woodland"]],
        layout: { visibility: "none" }, paint: awPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_ANCIENT_WOODLAND_FILL_ID, "fill-opacity", awPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_TPO_FILL_ID,
      layer: () => ({
        id: GB_TPO_FILL_ID, type: "fill", source: TREE_SOURCE.id, "source-layer": "gb_tree_protection", minzoom: GB_TPO_MINZOOM,
        filter: ["all", IS_POLYGON, IS_TPO],
        layout: { visibility: "none" }, paint: tpoPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_TPO_FILL_ID, "fill-opacity", tpoPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_TPO_CIRCLE_ID,
      layer: () => ({
        id: GB_TPO_CIRCLE_ID, type: "circle", source: TREE_SOURCE.id, "source-layer": "gb_tree_protection", minzoom: GB_TPO_MINZOOM,
        filter: ["all", IS_POINT, IS_TPO], layout: { visibility: "none" }, paint: tpoCirclePaint(isDark, opacity, scale),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_TPO_CIRCLE_ID, tpoCirclePaint(isDark, opacity, scale)),
    },
  ], [opacity, scale, isDark]);
}
