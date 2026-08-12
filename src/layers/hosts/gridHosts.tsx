// H3 / 人口 / 社經 / YouBike 網格 + 軌道靜態線的 Layer Host（AR-22 P4）
// —— 這些原本是 App.tsx 裡的 inline `useEffect`（ensure*Layers + update*Layer）。
//
// 搬出來的理由與 P2 那 67 支相同，只是晚了一步：它們吃 `transportParams.<xxx>Params`，
// 只要留在 App，**拖任何一根 slider 都會讓整個 App 樹 reconcile**。
// 搬進 Host 之後，一個 Host 只訂自己那一個 key。
//
// ⚠️ 每個子物件的欄位對應逐字照抄已退役的 `useLayerParamsRuntime`
//    （`h3Params` / `popCountParams` / `indicatorsParams` / `socioParams` /
//     `spatialParams` / `youbikeParams` 六個 useMemo），identity 同樣用
//    per-key 快照當 deps —— store 保證「只有這個 key 真的變動時才換 identity」。

import { useEffect, useMemo } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../../state/timeStore";
import { updateH3Layer, ensureH3Layers } from "../../map/h3LayerFactory";
import { ensureYoubikeLayers, updateYoubikeLayer } from "../../map/youbikeLayerFactory";
import {
  ensurePopCountLayers, ensureIndicatorsLayers, updatePopCountLayer, updateIndicatorsLayer,
  ensureSocioLayers, updateSocioLayer, ensureSpatialLayers, updateSpatialLayer,
} from "../../map/demographicsLayerFactory";
import { updateRailTracks, removeRailTracks, setRailTracksVisible } from "../../map/railTracks";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import {
  oneOfParam, paramBool, paramNum, paramStr, useLayerParams,
} from "../layerParamsAccess";

const H3_METRICS = ["day", "night"] as const;
const YB_HEIGHT_MODES = ["mixed", "fullness", "capacity"] as const;
const RAIL_TRACK_MODES = ["2d", "3d"] as const;

/**
 * setStyle 進行中時 `getStyle()` 會 throw "Style is not done loading"
 * —— 換底圖期間的 re-render 不能再裸呼 `map.getStyle()`（同 App.tsx 的 `styleReady`）。
 */
function styleReady(map: MapboxMap | null): map is MapboxMap {
  if (!map) return false;
  try {
    return !!map.getStyle();
  } catch {
    return false;
  }
}

/** 軌道靜態線（2D Mapbox）—— `railTrackMode` 是 select（2d / 3d） */
export const RailTracksHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("railTracks");
  const values = useLayerParams("rail");
  const railTrackMode = oneOfParam(
    paramStr(values, "rail", "railTrackMode"), RAIL_TRACK_MODES, "3d",
  );
  const { mapRef, railData, isDarkTheme } = deps;
  const railVisible = deps.layerVisibility.rail;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (railData && railVisible) {
      updateRailTracks(map, railData.allTracks, isDarkTheme);
      setRailTracksVisible(map, railTrackMode === "2d");
    } else {
      removeRailTracks(map);
    }
  }, [mapRef, railData, isDarkTheme, railVisible, railTrackMode]);
  return null;
};

/**
 * H3 人口網格。
 * Guard: `getStyle()` returns truthy after style parse (unaffected by tile loading),
 * undefined before style loads. 這避開 isStyleLoaded() false-during-tiles
 * 與 addSource-before-style-ready 兩種 crash。
 */
export const H3PopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("h3Population");
  const values = useLayerParams("h3Population");
  const h3Params = useMemo(() => ({
    opacity: paramNum(values, "h3Population", "h3Opacity"),
    extruded: paramBool(values, "h3Population", "h3Extruded"),
    elevationScale: paramNum(values, "h3Population", "h3ElevationScale"),
    metric: oneOfParam(paramStr(values, "h3Population", "h3Metric"), H3_METRICS, "day"),
    contrast: paramNum(values, "h3Population", "h3Contrast"),
  }), [values]);

  const { mapRef, h3DataMap, h3Resolution } = deps;
  const visible = deps.layerVisibility.h3Population;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureH3Layers(map);
    const cells = h3DataMap.get(h3Resolution) ?? [];
    updateH3Layer(map, cells, h3Params, visible);
  }, [mapRef, h3DataMap, h3Resolution, visible, h3Params]);
  return null;
};

/** 人口數網格（historical mode 用 yearly RPC cells；realtime 用本機 JSON snapshot） */
export const PopCountHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("popCount");
  const values = useLayerParams("popCount");
  const popCountParams = useMemo(() => ({
    opacity: paramNum(values, "popCount", "pcOpacity"),
    contrast: paramNum(values, "popCount", "pcContrast"),
    extruded: paramBool(values, "popCount", "pcExtruded"),
    elevationScale: paramNum(values, "popCount", "pcElevationScale"),
  }), [values]);

  const { mapRef, appMode, historicalYear, demographicsDataMap, demoResolution, getYearlyCells } = deps;
  const visible = deps.layerVisibility.popCount;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensurePopCountLayers(map);
    const cells =
      appMode === "historical"
        ? (getYearlyCells(historicalYear, demoResolution) ?? [])
        : (demographicsDataMap.get(demoResolution) ?? []);
    updatePopCountLayer(map, cells, popCountParams, visible);
  }, [mapRef, appMode, historicalYear, demographicsDataMap, demoResolution, visible, popCountParams, getYearlyCells]);
  return null;
};

/** 人口指標網格 */
export const IndicatorsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("indicators");
  const values = useLayerParams("indicators");
  const indicatorsParams = useMemo(() => ({
    category: paramStr(values, "indicators", "indCategory"),
    metric: paramStr(values, "indicators", "indMetric"),
    opacity: paramNum(values, "indicators", "indOpacity"),
    contrast: paramNum(values, "indicators", "indContrast"),
    extruded: paramBool(values, "indicators", "indExtruded"),
    elevationScale: paramNum(values, "indicators", "indElevationScale"),
  }), [values]);

  const { mapRef, appMode, historicalYear, demographicsDataMap, demoResolution, getYearlyCells } = deps;
  const visible = deps.layerVisibility.indicators;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureIndicatorsLayers(map);
    const cells =
      appMode === "historical"
        ? (getYearlyCells(historicalYear, demoResolution) ?? [])
        : (demographicsDataMap.get(demoResolution) ?? []);
    updateIndicatorsLayer(map, cells, indicatorsParams, visible);
  }, [mapRef, appMode, historicalYear, demographicsDataMap, demoResolution, visible, indicatorsParams, getYearlyCells]);
  return null;
};

/** 社經網格 */
export const SocioeconomicHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("socioeconomic");
  const values = useLayerParams("socioeconomic");
  const socioParams = useMemo(() => ({
    metric: paramStr(values, "socioeconomic", "socioMetric"),
    opacity: paramNum(values, "socioeconomic", "socioOpacity"),
    contrast: paramNum(values, "socioeconomic", "socioContrast"),
    extruded: paramBool(values, "socioeconomic", "socioExtruded"),
    elevationScale: paramNum(values, "socioeconomic", "socioElevation"),
  }), [values]);

  const { mapRef, socioDataMap, demoResolution } = deps;
  const visible = deps.layerVisibility.socioeconomic;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureSocioLayers(map);
    const cells = socioDataMap.get(demoResolution) ?? [];
    updateSocioLayer(map, cells, socioParams, visible);
  }, [mapRef, socioDataMap, demoResolution, visible, socioParams]);
  return null;
};

/** 空間經濟網格 */
export const SpatialEconomyHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("spatialEconomy");
  const values = useLayerParams("spatialEconomy");
  const spatialParams = useMemo(() => ({
    metric: paramStr(values, "spatialEconomy", "spatialMetric"),
    opacity: paramNum(values, "spatialEconomy", "spatialOpacity"),
    contrast: paramNum(values, "spatialEconomy", "spatialContrast"),
    extruded: paramBool(values, "spatialEconomy", "spatialExtruded"),
    elevationScale: paramNum(values, "spatialEconomy", "spatialElevation"),
  }), [values]);

  const { mapRef, spatialDataMap, demoResolution } = deps;
  const visible = deps.layerVisibility.spatialEconomy;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureSpatialLayers(map);
    const cells = spatialDataMap.get(demoResolution) ?? [];
    updateSpatialLayer(map, cells, spatialParams, visible);
  }, [mapRef, spatialDataMap, demoResolution, visible, spatialParams]);
  return null;
};

/** YouBike 飽和度網格（跟著主時間軸的分鐘粒度更新，`youbikeTimeKey` 由 App 訂 timeStore） */
export const YoubikeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("youbikeFullness");
  const values = useLayerParams("youbikeFullness");
  const youbikeParams = useMemo(() => ({
    opacity: paramNum(values, "youbikeFullness", "ybOpacity"),
    contrast: paramNum(values, "youbikeFullness", "ybContrast"),
    extruded: paramBool(values, "youbikeFullness", "ybExtruded"),
    elevationScale: paramNum(values, "youbikeFullness", "ybElevationScale"),
    heightMode: oneOfParam(
      paramStr(values, "youbikeFullness", "ybHeightMode"), YB_HEIGHT_MODES, "mixed",
    ),
  }), [values]);

  const { mapRef, getYoubikeCellsForTime, youbikeTimeKey } = deps;
  const visible = deps.layerVisibility.youbikeFullness;
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureYoubikeLayers(map);
    const cells = getYoubikeCellsForTime(timeStore.getTime());
    updateYoubikeLayer(map, cells, youbikeParams, visible);
  }, [mapRef, getYoubikeCellsForTime, youbikeTimeKey, visible, youbikeParams]);
  return null;
};
