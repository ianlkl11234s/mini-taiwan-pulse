import { useEffect, useMemo } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BUILT_UP_COLOR, GB_GREENSPACE_CATEGORIES, GB_OS_ATTRIBUTION, gbGreenspaceColorExpr, type GbGreenspaceKey,
} from "../data/gbOpenSpaceTypes";
import { useMapReadyTick } from "./useMapReadyTick";
import { gbAllOf, gbMaskFilter, useGbRepPointLayers, type GbDisplayMode, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國建成區（C023 OS Open Built Up Areas）與綠地四層（C044 公園／C043 運動場、高爾夫球場／C052 墓園，OS Open Greenspace）。
 * 綠地共用一個 PMTiles source（tile layer `gb_greenspace`），每個 key 各自一個 fill，以 `category`／`function` filter，可獨立開關。
 *
 * §3.8（2026-10-31）：綠地四層都有點／面切換（V-5）與類型多選（V-4），代表點檔 `gb_greenspace_points.pmtiles`
 * （每塊面一個 representative_point，z5–10，高縮放 overzoom）：
 * - 「面」：≥ 1 萬點的層先畫密度熱區（P-4），到面出現的縮放（z9／z10）交給面；高爾夫球場（2,980 處，< 1 萬）以代表點代替熱區；
 * - 「點」：熱區到出點縮放（`densePointsFromZoom`），之後畫代表點 circle，面不畫。
 * 高爾夫球場從運動場地拆出（舊分享網址的 gbSportsFacilities 只剩運動場地，不再含高爾夫）。
 */
type GbOpenSpaceKey = "gbBuiltUpAreas" | GbGreenspaceKey;

export const GB_GREENSPACE_HEATMAP_IDS: Readonly<Record<GbGreenspaceKey, string>> = {
  gbGreenspace: "gb-greenspace-park-heatmap",
  gbSportsFacilities: "gb-greenspace-sports-heatmap",
  gbGolfCourses: "gb-greenspace-golf-heatmap", // < 1 萬點，實際不建熱區（useGbRepPointLayers 依點數判斷）
  gbCemeteries: "gb-greenspace-burial-heatmap",
};
export const GB_GREENSPACE_POINT_CIRCLE_IDS: Readonly<Record<GbGreenspaceKey, string>> = {
  gbGreenspace: "gb-greenspace-park-point-circle",
  gbSportsFacilities: "gb-greenspace-sports-point-circle",
  gbGolfCourses: "gb-greenspace-golf-circle",
  gbCemeteries: "gb-greenspace-burial-point-circle",
};
const GOLF_FUNCTION = "Golf Course";

export const GB_BUILT_UP_FILL_LAYER_ID = "gb-built-up-areas-fill";
export const GB_GREENSPACE_FILL_LAYER_IDS: Readonly<Record<GbGreenspaceKey, string>> = {
  gbGreenspace: "gb-greenspace-park-fill",
  gbSportsFacilities: "gb-greenspace-sports-fill",
  gbGolfCourses: "gb-greenspace-golf-fill",
  gbCemeteries: "gb-greenspace-burial-fill",
};

interface SourceConfig { id: string; file: string; sourceLayer: string; minzoom: number; maxzoom: number; loading: string }
const BUILT_UP_SOURCE: SourceConfig = {
  // §3.8 V-1：重切 z3 起的新檔（`_v2`，舊檔 z5 起已在 S3、不覆寫）
  id: "gb-built-up-areas", file: "gb_built_up_areas_v2.pmtiles", sourceLayer: "gb_built_up_areas", minzoom: 3, maxzoom: 13, loading: "英國建成區載入中",
};
const GREENSPACE_SOURCE: SourceConfig = {
  id: "gb-greenspace", file: "gb_greenspace.pmtiles", sourceLayer: "gb_greenspace", minzoom: 8, maxzoom: 14, loading: "英國綠地載入中",
};

const GREENSPACE_POINTS_SOURCE: SourceSpec = {
  id: "gb-greenspace-points", file: "gb_greenspace_points.pmtiles", minzoom: 5, maxzoom: 10,
  attribution: GB_OS_ATTRIBUTION, loading: "英國綠地代表點載入中",
};
const GREENSPACE_POINTS_LAYER = "gb_greenspace_points";

// §3.8 V-5：建成區代表點（8,716 面，z4–10；< 1 萬點不建熱區）
export const GB_BUILT_UP_HEATMAP_ID = "gb-built-up-areas-points-heatmap";
export const GB_BUILT_UP_POINT_CIRCLE_ID = "gb-built-up-areas-points-circle";
const BUILT_UP_POINTS_SOURCE: SourceSpec = {
  id: "gb-built-up-areas-points", file: "gb_built_up_areas_points.pmtiles", minzoom: 4, maxzoom: 10,
  attribution: GB_OS_ATTRIBUTION, loading: "英國建成區代表點載入中",
};

interface FillConfig { key: GbOpenSpaceKey; layerId: string; source: SourceConfig; minzoom: number; color: unknown; filter?: unknown[] | null }

/** 熱區強度（全英 z5.5 目視校正）：點數愈多愈容易飽和，故愈密的層強度愈低。 */
const HEAT_INTENSITY: Readonly<Record<GbGreenspaceKey, number>> = { gbGreenspace: 0.8, gbSportsFacilities: 2.5, gbGolfCourses: 1, gbCemeteries: 3 };
const categoryFilter = (key: GbGreenspaceKey): unknown[] => ["==", ["get", "category"], GB_GREENSPACE_CATEGORIES[key].category];
/** 每層的固定範圍：運動場地排除高爾夫球場、高爾夫球場只取高爾夫球場。 */
const baseFilter = (key: GbGreenspaceKey): unknown[] => key === "gbSportsFacilities"
  ? ["all", categoryFilter(key), ["!=", ["get", "function"], GOLF_FUNCTION]]
  : key === "gbGolfCourses" ? ["==", ["get", "function"], GOLF_FUNCTION] : categoryFilter(key);
const greenspaceCount = (key: GbGreenspaceKey) => GB_GREENSPACE_CATEGORIES[key].functions.reduce((n, f) => n + f.count, 0);

const BUILT_UP_FILL: FillConfig = { key: "gbBuiltUpAreas", layerId: GB_BUILT_UP_FILL_LAYER_ID, source: BUILT_UP_SOURCE, minzoom: 3, color: GB_BUILT_UP_COLOR };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

const opacityDefault = (key: GbOpenSpaceKey) => Number(paramDefault(key, `${key}Opacity`) ?? 0.75);

function useGbOpenSpaceFill(
  mapRef: React.RefObject<MapboxMap | null>, cfg: FillConfig, visible: boolean, opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(cfg.layerId)) map.setLayoutProperty(cfg.layerId, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(cfg.source.id)) {
        sourceAdded = true;
        map.addSource(cfg.source.id, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl(cfg.source.file), attribution: GB_OS_ATTRIBUTION,
          minzoom: cfg.source.minzoom, maxzoom: cfg.source.maxzoom,
        } as any);
      }
      const def = opacityDefault(cfg.key);
      if (!map.getLayer(cfg.layerId)) {
        map.addLayer({
          id: cfg.layerId, type: "fill", source: cfg.source.id, "source-layer": cfg.source.sourceLayer, minzoom: cfg.minzoom,
          ...(cfg.filter ? { filter: cfg.filter } : {}),
          layout: { visibility: "none" },
          paint: hookFillPaint(cfg.key, cfg.layerId,
            { "fill-color": cfg.color, "fill-opacity": clamp01(opacity) },
            { "fill-color": cfg.color, "fill-opacity": def }),
        } as FillLayer);
      }
      map.setFilter(cfg.layerId, (cfg.filter ?? null) as any);
      map.setLayoutProperty(cfg.layerId, "visibility", "visible");
      map.setPaintProperty(cfg.layerId, "fill-opacity", hookFillOpacity(cfg.key, cfg.layerId, clamp01(opacity), def));
      if (sourceAdded) keepLoadingUntilMapIdle(map, `${cfg.source.id}:render`, cfg.source.loading, cfg.source.id);
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, cfg, visible, opacity, mapTick]);
}

export interface GbOpenSpaceLayerState { visible: boolean; opacity: number }
export interface GbBuiltUpLayerState extends GbOpenSpaceLayerState { mode: GbDisplayMode; scale: number }
export interface GbGreenspaceLayerState extends GbOpenSpaceLayerState {
  mode: GbDisplayMode;
  scale: number;
  /** 類型多選 mask（layerParamsSpec `<key>CategoryMask`）；undefined＝不篩（高爾夫球場只有一類，不設） */
  categoryMask?: number;
}

function useGbGreenspaceLayer(
  mapRef: React.RefObject<MapboxMap | null>, key: GbGreenspaceKey, s: GbGreenspaceLayerState, isDark: boolean,
) {
  const cfg = GB_GREENSPACE_CATEGORIES[key];
  const filterJson = JSON.stringify(gbAllOf(
    baseFilter(key), gbMaskFilter("function", s.categoryMask, cfg.functions.map((f) => f.value)),
  ));
  const filter = useMemo(() => JSON.parse(filterJson) as unknown[], [filterJson]);
  const fill = useMemo<FillConfig>(() => ({
    key, layerId: GB_GREENSPACE_FILL_LAYER_IDS[key], source: GREENSPACE_SOURCE, minzoom: cfg.minzoom,
    color: gbGreenspaceColorExpr(key), filter,
  }), [key, cfg.minzoom, filter]);
  const heatStyle = useHeatmapStyleSignature([key]);
  useGbRepPointLayers(mapRef, {
    key, source: GREENSPACE_POINTS_SOURCE, sourceLayer: GREENSPACE_POINTS_LAYER,
    heatId: GB_GREENSPACE_HEATMAP_IDS[key], circleId: GB_GREENSPACE_POINT_CIRCLE_IDS[key],
    count: greenspaceCount(key), polygonMinzoom: cfg.minzoom, heatIntensity: HEAT_INTENSITY[key], opacityDefault: opacityDefault(key),
  }, { visible: s.visible, mode: s.mode, opacity: s.opacity, scale: s.scale, isDark, color: gbGreenspaceColorExpr(key), filter }, heatStyle);
  useGbOpenSpaceFill(mapRef, fill, s.visible && s.mode === "polygon", s.opacity);
}

/** 英國建成區＋綠地四層（公園、運動場、高爾夫球場、墓園）。 */
export function useGbOpenSpaceLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  state: Readonly<{ gbBuiltUpAreas: GbBuiltUpLayerState } & Record<GbGreenspaceKey, GbGreenspaceLayerState>>,
  isDark: boolean,
) {
  const builtUp = state.gbBuiltUpAreas;
  const builtUpHeatStyle = useHeatmapStyleSignature(["gbBuiltUpAreas"]);
  useGbRepPointLayers(mapRef, {
    key: "gbBuiltUpAreas", source: BUILT_UP_POINTS_SOURCE, sourceLayer: "gb_built_up_areas_points",
    heatId: GB_BUILT_UP_HEATMAP_ID, circleId: GB_BUILT_UP_POINT_CIRCLE_ID, count: 8_716,
    polygonMinzoom: BUILT_UP_SOURCE.minzoom, heatIntensity: 1, opacityDefault: opacityDefault("gbBuiltUpAreas"),
  }, { visible: builtUp.visible, mode: builtUp.mode, opacity: builtUp.opacity, scale: builtUp.scale / Number(paramDefault("gbBuiltUpAreas", "gbBuiltUpAreasScale") ?? 1), isDark, color: GB_BUILT_UP_COLOR, filter: null }, builtUpHeatStyle);
  useGbOpenSpaceFill(mapRef, BUILT_UP_FILL, builtUp.visible && builtUp.mode === "polygon", builtUp.opacity);
  useGbGreenspaceLayer(mapRef, "gbGreenspace", state.gbGreenspace, isDark);
  useGbGreenspaceLayer(mapRef, "gbSportsFacilities", state.gbSportsFacilities, isDark);
  useGbGreenspaceLayer(mapRef, "gbGolfCourses", state.gbGolfCourses, isDark);
  useGbGreenspaceLayer(mapRef, "gbCemeteries", state.gbCemeteries, isDark);
}
