import { useEffect } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BUILT_UP_COLOR, GB_GREENSPACE_CATEGORIES, GB_OS_ATTRIBUTION, gbGreenspaceColorExpr, type GbGreenspaceKey,
} from "../data/gbOpenSpaceTypes";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 英國建成區（C023 OS Open Built Up Areas）與綠地三層（C044 公園／C043 運動場／C052 墓園，OS Open Greenspace）。
 * 綠地三層共用一個 PMTiles source（tile layer `gb_greenspace`），每個 key 各自一個 fill，以 `category` filter，可獨立開關。
 */
type GbOpenSpaceKey = "gbBuiltUpAreas" | GbGreenspaceKey;

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

interface FillConfig { key: GbOpenSpaceKey; layerId: string; source: SourceConfig; minzoom: number; color: unknown; filter?: unknown[] }

const FILLS: Readonly<Record<GbOpenSpaceKey, FillConfig>> = {
  gbBuiltUpAreas: { key: "gbBuiltUpAreas", layerId: GB_BUILT_UP_FILL_LAYER_ID, source: BUILT_UP_SOURCE, minzoom: 6, color: GB_BUILT_UP_COLOR },
  ...Object.fromEntries((Object.keys(GB_GREENSPACE_CATEGORIES) as GbGreenspaceKey[]).map((key) => [key, {
    key,
    layerId: GB_GREENSPACE_FILL_LAYER_IDS[key],
    source: GREENSPACE_SOURCE,
    minzoom: GB_GREENSPACE_CATEGORIES[key].minzoom,
    color: gbGreenspaceColorExpr(key),
    filter: ["==", ["get", "category"], GB_GREENSPACE_CATEGORIES[key].category],
  } satisfies FillConfig])) as Record<GbGreenspaceKey, FillConfig>,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

const opacityDefault = (key: GbOpenSpaceKey) => Number(paramDefault(key, `${key}Opacity`) ?? 0.7);

function useGbOpenSpaceFill(mapRef: React.RefObject<MapboxMap | null>, cfg: FillConfig, visible: boolean, opacity: number) {
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

/** 英國建成區＋綠地三層（公園、運動場、墓園）。 */
export function useGbOpenSpaceLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  state: Readonly<Record<GbOpenSpaceKey, GbOpenSpaceLayerState>>,
) {
  useGbOpenSpaceFill(mapRef, FILLS.gbBuiltUpAreas, state.gbBuiltUpAreas.visible, state.gbBuiltUpAreas.opacity);
  useGbOpenSpaceFill(mapRef, FILLS.gbGreenspace, state.gbGreenspace.visible, state.gbGreenspace.opacity);
  useGbOpenSpaceFill(mapRef, FILLS.gbSportsFacilities, state.gbSportsFacilities.visible, state.gbSportsFacilities.opacity);
  useGbOpenSpaceFill(mapRef, FILLS.gbCemeteries, state.gbCemeteries.visible, state.gbCemeteries.opacity);
}
