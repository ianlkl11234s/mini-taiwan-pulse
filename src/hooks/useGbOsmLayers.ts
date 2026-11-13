import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookLinePaint } from "../map/lineFillSpec";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BRIDGES_TUNNELS_TILE_ZOOM, GB_OSM13_ATTRIBUTION, GB_NH_ATTRIBUTION, GB_PLACES_OF_WORSHIP_COUNT, GB_PLACES_OF_WORSHIP_TILE_ZOOM,
  GB_PUBLIC_FACILITIES_COUNT, GB_PUBLIC_FACILITIES_TILE_ZOOM, GB_PUBLIC_FACILITY_KINDS, GB_ROAD_FACILITIES_TILE_ZOOM, GB_ROAD_FACILITY_KINDS,
  GB_STRUCTURES, GB_WORSHIP_KINDS, gbOsmKindColor, type GbOsmKindDef,
} from "../data/gbOsmTypes";
import { gbMajorRoadsWidthExpr } from "./useGbTransportLayers";
import { gbHeatmapBuild, gbMaskFilter, gbWithFilter, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 13 波 OSM 4 層（2026-11-13 快照）：主要道路橋梁與隧道（線，橋實線、隧道虛線，寬依道路等級）、
 * 道路設施（點，<1 萬點 z5 起直接畫）、公共設施與宗教場所（點，≥1 萬點 R5：低縮放熱區、z10 起畫點）。
 * 四層都依類別多選篩選（§3.8 V-4），熱區跟著篩。靜態資料、不訂閱時間。
 * 圖磚 minzoom 照 analytics 成品：四層都是 z5 起（2026-11-14 橋隧、公共設施、宗教場所由 z6／z7 重切成 z5），英國全覽 z5.5 都畫得出來。
 */
export const GB_BRIDGES_LINE_ID = "gb-bridges-tunnels-bridge-line";
export const GB_TUNNELS_LINE_ID = "gb-bridges-tunnels-tunnel-line";
export const GB_ROAD_FACILITIES_CIRCLE_ID = "gb-road-facilities-circle";
export const GB_PUBLIC_FACILITIES_CIRCLE_ID = "gb-public-facilities-circle";
export const GB_PUBLIC_FACILITIES_HEATMAP_ID = "gb-public-facilities-heatmap";
export const GB_PLACES_OF_WORSHIP_CIRCLE_ID = "gb-places-of-worship-circle";
export const GB_PLACES_OF_WORSHIP_HEATMAP_ID = "gb-places-of-worship-heatmap";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function kindColor(field: string, kinds: readonly GbOsmKindDef[], isDark: boolean): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const k of kinds) expr.push(k.value, gbOsmKindColor(k, isDark));
  expr.push(gbOsmKindColor({ colorIndex: null }, isDark));
  return expr;
}
function pointPaint(key: string, color: unknown, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault(key)),
    "circle-color": color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault(key, 0.8)),
  };
}

// ─────────────────────────── 主要道路橋梁與隧道（gb_bridges_tunnels.pmtiles） ───────────────────────────

const BRIDGES_SOURCE: SourceSpec = {
  id: "gb-bridges-tunnels", file: "gb_bridges_tunnels.pmtiles", ...GB_BRIDGES_TUNNELS_TILE_ZOOM,
  attribution: GB_OSM13_ATTRIBUTION, loading: "英國橋梁與隧道載入中",
};
/** 隧道虛線（L-3 型態區分，不能依資料，故拆成兩個 line 子圖層）。 */
const TUNNEL_DASH = [2, 1.5];
const ROAD_SORT: Expr = ["match", ["get", "road_class"], "motorway", 2, "a_road", 1, 0];

export function useGbBridgesTunnelsLayer(mapRef: MapRef, visible: boolean, opacity: number, structureMask: number | undefined, isDark: boolean) {
  const key = "gbBridgesTunnels";
  const def = opacityDefault(key, 0.85);
  const filter = gbMaskFilter("structure", structureMask, GB_STRUCTURES.map((s) => s.value));
  const build = (id: string, s: GbOsmKindDef) => {
    const color = gbOsmKindColor(s, isDark);
    const dash = s.value === "tunnel" ? { "line-dasharray": TUNNEL_DASH } : {};
    const paint = (op: number) => hookLinePaint(key, id,
      { "line-color": color, "line-width": gbMajorRoadsWidthExpr(), "line-opacity": clamp01(op), ...dash },
      { "line-color": color, "line-width": gbMajorRoadsWidthExpr(), "line-opacity": def, ...dash }, isDark);
    return {
      id,
      layer: () => ({
        id, type: "line", source: BRIDGES_SOURCE.id, "source-layer": "gb_bridges_tunnels", minzoom: BRIDGES_SOURCE.minzoom,
        filter: ["==", ["get", "structure"], s.value],
        layout: { visibility: "none", "line-cap": s.value === "tunnel" ? "butt" : "round", "line-join": "round", "line-sort-key": ROAD_SORT },
        paint: paint(opacity),
      } as unknown as AnyLayer),
      update: (map: MapboxMap) => setPaint(map, id, paint(opacity)),
    };
  };
  useGbPmtilesLayers(mapRef, BRIDGES_SOURCE, visible, () => gbWithFilter([
    build(GB_TUNNELS_LINE_ID, GB_STRUCTURES[1]!),
    build(GB_BRIDGES_LINE_ID, GB_STRUCTURES[0]!),
  ], filter), [opacity, structureMask, isDark]);
}

// ─────────────────────────── 道路設施（gb_road_facilities.pmtiles） ───────────────────────────

const ROAD_FACILITIES_SOURCE: SourceSpec = {
  id: "gb-road-facilities", file: "gb_road_facilities.pmtiles", ...GB_ROAD_FACILITIES_TILE_ZOOM,
  attribution: `${GB_OSM13_ATTRIBUTION} · ${GB_NH_ATTRIBUTION}`, loading: "英國道路設施載入中",
};

export function useGbRoadFacilitiesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  const key = "gbRoadFacilities";
  const paint = () => pointPaint(key, kindColor("kind", GB_ROAD_FACILITY_KINDS, isDark), isDark, opacity, scale);
  const filter = gbMaskFilter("kind", kindMask, GB_ROAD_FACILITY_KINDS.map((k) => k.value));
  useGbPmtilesLayers(mapRef, ROAD_FACILITIES_SOURCE, visible, () => gbWithFilter([{
    id: GB_ROAD_FACILITIES_CIRCLE_ID,
    layer: () => ({
      id: GB_ROAD_FACILITIES_CIRCLE_ID, type: "circle", source: ROAD_FACILITIES_SOURCE.id, "source-layer": "gb_road_facilities",
      minzoom: ROAD_FACILITIES_SOURCE.minzoom, layout: { visibility: "none" }, paint: paint(),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_ROAD_FACILITIES_CIRCLE_ID, paint()),
  }], filter), [opacity, scale, kindMask, isDark]);
}

// ─────────────────────────── 公共設施、宗教場所（≥1 萬點：熱區＋z10 起畫點） ───────────────────────────

interface DensePointSpec {
  key: "gbPublicFacilities" | "gbPlacesOfWorship";
  source: SourceSpec; sourceLayer: string; circleId: string; heatId: string;
  kinds: readonly GbOsmKindDef[]; pointsFrom: number; intensity: number;
}

function useGbDenseKindLayer(mapRef: MapRef, spec: DensePointSpec, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  const paint = () => pointPaint(spec.key, kindColor("kind", spec.kinds, isDark), isDark, opacity, scale);
  const heatStyle = useHeatmapStyleSignature([spec.key]);
  const filter = gbMaskFilter("kind", kindMask, spec.kinds.map((k) => k.value));
  useGbPmtilesLayers(mapRef, spec.source, visible, () => gbWithFilter([
    gbHeatmapBuild({
      id: spec.heatId, key: spec.key, sourceId: spec.source.id, sourceLayer: spec.sourceLayer,
      maxzoom: heatmapMaxzoom(spec.pointsFrom), isDark, opacityScale: clamp01(opacity) / opacityDefault(spec.key, 0.75), intensity: spec.intensity,
    }),
    {
      id: spec.circleId,
      layer: () => ({
        id: spec.circleId, type: "circle", source: spec.source.id, "source-layer": spec.sourceLayer, minzoom: spec.pointsFrom,
        layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, spec.circleId, paint()),
    },
  ], filter), [opacity, scale, kindMask, isDark, heatStyle]);
}

const PUBLIC_FACILITIES: DensePointSpec = {
  key: "gbPublicFacilities",
  source: {
    id: "gb-public-facilities", file: "gb_public_facilities.pmtiles", ...GB_PUBLIC_FACILITIES_TILE_ZOOM,
    attribution: GB_OSM13_ATTRIBUTION, loading: "英國公共設施載入中",
  },
  sourceLayer: "gb_public_facilities", circleId: GB_PUBLIC_FACILITIES_CIRCLE_ID, heatId: GB_PUBLIC_FACILITIES_HEATMAP_ID,
  kinds: GB_PUBLIC_FACILITY_KINDS, pointsFrom: densePointsFromZoom(GB_PUBLIC_FACILITIES_COUNT, 9), intensity: 2,
};
const PLACES_OF_WORSHIP: DensePointSpec = {
  key: "gbPlacesOfWorship",
  source: {
    id: "gb-places-of-worship", file: "gb_places_of_worship.pmtiles", ...GB_PLACES_OF_WORSHIP_TILE_ZOOM,
    attribution: GB_OSM13_ATTRIBUTION, loading: "英國宗教場所載入中",
  },
  sourceLayer: "gb_places_of_worship", circleId: GB_PLACES_OF_WORSHIP_CIRCLE_ID, heatId: GB_PLACES_OF_WORSHIP_HEATMAP_ID,
  kinds: GB_WORSHIP_KINDS, pointsFrom: densePointsFromZoom(GB_PLACES_OF_WORSHIP_COUNT, 9), intensity: 2,
};

export function useGbPublicFacilitiesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  useGbDenseKindLayer(mapRef, PUBLIC_FACILITIES, visible, opacity, scale, kindMask, isDark);
}
export function useGbPlacesOfWorshipLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  useGbDenseKindLayer(mapRef, PLACES_OF_WORSHIP, visible, opacity, scale, kindMask, isDark);
}
