import { useEffect } from "react";
import type { AnyLayer, FillLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BUILT_UP_COLOR, GB_GREENSPACE_CATEGORIES, GB_OS_ATTRIBUTION, gbGreenspaceColorExpr, type GbGreenspaceKey,
} from "../data/gbOpenSpaceTypes";
import { useMapReadyTick } from "./useMapReadyTick";
import { gbHeatmapBuild } from "./useGbWaterLayers";

/**
 * 英國建成區（C023 OS Open Built Up Areas）與綠地三層（C044 公園／C043 運動場／C052 墓園，OS Open Greenspace）。
 * 綠地三層共用一個 PMTiles source（tile layer `gb_greenspace`），每個 key 各自一個 fill，以 `category` filter，可獨立開關。
 *
 * R5（P-4／G-2，2026-10-30）全英視角：面要 z9／z10 才出現，縮遠看不到。另有代表點檔（`gb_greenspace_points.pmtiles`，
 * 每塊面一個 representative_point，z5–10）：三層各畫一個密度熱區（出面前，filter 同面）；運動場地的熱區排除高爾夫球場
 * （2,980 處，面積大、點少），改單獨畫 circle（z5 到面出現前），之後由面接手。
 */
type GbOpenSpaceKey = "gbBuiltUpAreas" | GbGreenspaceKey;

export const GB_GREENSPACE_HEATMAP_IDS: Readonly<Record<GbGreenspaceKey, string>> = {
  gbGreenspace: "gb-greenspace-park-heatmap",
  gbSportsFacilities: "gb-greenspace-sports-heatmap",
  gbCemeteries: "gb-greenspace-burial-heatmap",
};
export const GB_GOLF_CIRCLE_LAYER_ID = "gb-greenspace-golf-circle";
const GOLF_FUNCTION = "Golf Course";

export const GB_BUILT_UP_FILL_LAYER_ID = "gb-built-up-areas-fill";
export const GB_GREENSPACE_FILL_LAYER_IDS: Readonly<Record<GbGreenspaceKey, string>> = {
  gbGreenspace: "gb-greenspace-park-fill",
  gbSportsFacilities: "gb-greenspace-sports-fill",
  gbCemeteries: "gb-greenspace-burial-fill",
};

interface SourceConfig { id: string; file: string; sourceLayer: string; minzoom: number; maxzoom: number; loading: string }
const BUILT_UP_SOURCE: SourceConfig = {
  id: "gb-built-up-areas", file: "gb_built_up_areas.pmtiles", sourceLayer: "gb_built_up_areas", minzoom: 5, maxzoom: 13, loading: "英國建成區載入中",
};
const GREENSPACE_SOURCE: SourceConfig = {
  id: "gb-greenspace", file: "gb_greenspace.pmtiles", sourceLayer: "gb_greenspace", minzoom: 8, maxzoom: 14, loading: "英國綠地載入中",
};

const GREENSPACE_POINTS_SOURCE: SourceConfig = {
  id: "gb-greenspace-points", file: "gb_greenspace_points.pmtiles", sourceLayer: "gb_greenspace_points", minzoom: 5, maxzoom: 10, loading: "英國綠地代表點載入中",
};

interface HeatConfig { layerId: string; filter: unknown[]; intensity: number }
interface FillConfig { key: GbOpenSpaceKey; layerId: string; source: SourceConfig; minzoom: number; color: unknown; filter?: unknown[]; heat?: HeatConfig }

/** 熱區強度（全英 z5.5 目視校正）：點數愈多愈容易飽和，故愈密的層強度愈低。 */
const HEAT_INTENSITY: Readonly<Record<GbGreenspaceKey, number>> = { gbGreenspace: 0.8, gbSportsFacilities: 2.5, gbCemeteries: 3 };
const categoryFilter = (key: GbGreenspaceKey): unknown[] => ["==", ["get", "category"], GB_GREENSPACE_CATEGORIES[key].category];
const heatFilter = (key: GbGreenspaceKey): unknown[] => key === "gbSportsFacilities"
  ? ["all", categoryFilter(key), ["!=", ["get", "function"], GOLF_FUNCTION]]
  : categoryFilter(key);
const golfColor = GB_GREENSPACE_CATEGORIES.gbSportsFacilities.functions.find((f) => f.value === GOLF_FUNCTION)!.color;

const FILLS: Readonly<Record<GbOpenSpaceKey, FillConfig>> = {
  gbBuiltUpAreas: { key: "gbBuiltUpAreas", layerId: GB_BUILT_UP_FILL_LAYER_ID, source: BUILT_UP_SOURCE, minzoom: 5, color: GB_BUILT_UP_COLOR },
  ...Object.fromEntries((Object.keys(GB_GREENSPACE_CATEGORIES) as GbGreenspaceKey[]).map((key) => [key, {
    key,
    layerId: GB_GREENSPACE_FILL_LAYER_IDS[key],
    source: GREENSPACE_SOURCE,
    minzoom: GB_GREENSPACE_CATEGORIES[key].minzoom,
    color: gbGreenspaceColorExpr(key),
    filter: categoryFilter(key),
    heat: { layerId: GB_GREENSPACE_HEATMAP_IDS[key], filter: heatFilter(key), intensity: HEAT_INTENSITY[key] },
  } satisfies FillConfig])) as Record<GbGreenspaceKey, FillConfig>,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

const opacityDefault = (key: GbOpenSpaceKey) => Number(paramDefault(key, `${key}Opacity`) ?? 0.75);

function golfPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("S", scale),
    "circle-color": golfColor,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbSportsFacilities")),
  };
}

function useGbOpenSpaceFill(
  mapRef: React.RefObject<MapboxMap | null>, cfg: FillConfig, visible: boolean, opacity: number, isDark: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(cfg.heat ? [cfg.key] : []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of [cfg.layerId, cfg.heat?.layerId, cfg.key === "gbSportsFacilities" ? GB_GOLF_CIRCLE_LAYER_ID : undefined]) {
        if (id && map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
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
      map.setLayoutProperty(cfg.layerId, "visibility", "visible");
      map.setPaintProperty(cfg.layerId, "fill-opacity", hookFillOpacity(cfg.key, cfg.layerId, clamp01(opacity), def));
      if (sourceAdded) keepLoadingUntilMapIdle(map, `${cfg.source.id}:render`, cfg.source.loading, cfg.source.id);

      // 全英視角：代表點 source 的熱區（畫在面下面）；運動場地另有高爾夫球場 circle
      if (cfg.heat) {
        const pts = GREENSPACE_POINTS_SOURCE;
        let ptsAdded = false;
        if (!map.getSource(pts.id)) {
          ptsAdded = true;
          map.addSource(pts.id, {
            type: PMTILES_SOURCE_TYPE, url: absoluteUrl(pts.file), attribution: GB_OS_ATTRIBUTION, minzoom: pts.minzoom, maxzoom: pts.maxzoom,
          } as any);
        }
        const heat = gbHeatmapBuild({
          id: cfg.heat.layerId, key: cfg.key, sourceId: pts.id, sourceLayer: pts.sourceLayer,
          maxzoom: heatmapMaxzoom(cfg.minzoom), filter: cfg.heat.filter,
          isDark, opacityScale: clamp01(opacity) / def, intensity: cfg.heat.intensity,
        });
        if (!map.getLayer(heat.id)) map.addLayer(heat.layer(), cfg.layerId);
        map.setLayoutProperty(heat.id, "visibility", "visible");
        heat.update(map);
        if (cfg.key === "gbSportsFacilities") {
          if (!map.getLayer(GB_GOLF_CIRCLE_LAYER_ID)) {
            map.addLayer({
              id: GB_GOLF_CIRCLE_LAYER_ID, type: "circle", source: pts.id, "source-layer": pts.sourceLayer,
              minzoom: pts.minzoom, maxzoom: cfg.minzoom, filter: ["==", ["get", "function"], GOLF_FUNCTION],
              layout: { visibility: "none" }, paint: golfPaint(isDark, opacity, 1),
            } as unknown as AnyLayer);
          }
          map.setLayoutProperty(GB_GOLF_CIRCLE_LAYER_ID, "visibility", "visible");
          for (const [k, v] of Object.entries(golfPaint(isDark, opacity, 1))) map.setPaintProperty(GB_GOLF_CIRCLE_LAYER_ID, k as any, v as any);
        }
        if (ptsAdded) keepLoadingUntilMapIdle(map, `${pts.id}:render`, pts.loading, pts.id);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, cfg, visible, opacity, isDark, heatStyle, mapTick]);
}

export interface GbOpenSpaceLayerState { visible: boolean; opacity: number }

/** 英國建成區＋綠地三層（公園、運動場、墓園）。 */
export function useGbOpenSpaceLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  state: Readonly<Record<GbOpenSpaceKey, GbOpenSpaceLayerState>>,
  isDark: boolean,
) {
  useGbOpenSpaceFill(mapRef, FILLS.gbBuiltUpAreas, state.gbBuiltUpAreas.visible, state.gbBuiltUpAreas.opacity, isDark);
  useGbOpenSpaceFill(mapRef, FILLS.gbGreenspace, state.gbGreenspace.visible, state.gbGreenspace.opacity, isDark);
  useGbOpenSpaceFill(mapRef, FILLS.gbSportsFacilities, state.gbSportsFacilities.visible, state.gbSportsFacilities.opacity, isDark);
  useGbOpenSpaceFill(mapRef, FILLS.gbCemeteries, state.gbCemeteries.visible, state.gbCemeteries.opacity, isDark);
}
