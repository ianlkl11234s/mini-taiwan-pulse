// 衛星 / 路況 / 火災 / 清潔隊 / 殯葬密度 / 溫度網格的 Layer Host（AR-22 P2）
// —— App.tsx 原 L1204-1332（分佈在多個主題段，本檔只是收納，順序以 registry 為準）

import { useSatellitesLayer } from "../../hooks/useSatellitesLayer";
import { useRoadEventsLayer } from "../../hooks/useRoadEventsLayer";
import { useFireEventsLayer } from "../../hooks/useFireEventsLayer";
import { useFireLatestLayer } from "../../hooks/useFireLatestLayer";
import { useWasteCleaningSquadLayer } from "../../hooks/useWasteCleaningSquadLayer";
import { useFreewayLayer } from "../../hooks/useFreewayLayer";
import { useRoadCongestionLayer } from "../../hooks/useRoadCongestionLayer";
import { useFuneralDensityLayer } from "../../hooks/useFuneralDensityLayer";
import { useTemperatureGridLayer } from "../../hooks/useTemperatureGridLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramNum, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

/**
 * 衛星圖層（Supabase satellite_classified + SGP4 即時計算）。
 * ⚠️ `satOpacity` 掛在 **`satellitesYaogan`** 這個 key 下（16 個國家/星系共用一份）——
 * 逐字照抄 `useLayerParamsRuntime` 的第二通道來源。
 */
export const SatellitesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSatellitesLayer");
  const values = useLayerParams("satellitesYaogan");
  const v = deps.layerVisibility;
  useSatellitesLayer(deps.mapRef, {
    visibility: {
      china_yaogan: v.satellitesYaogan,
      china_jilin: v.satellitesJilin,
      china_gaofen: v.satellitesGaofen,
      china_tjs: v.satellitesTJS,
      china_beidou: v.satellitesBeidou,
      china_shiyan: v.satellitesShiyan,
      taiwan: v.satellitesTaiwan,
      usa: v.satellitesUSA,
      japan: v.satellitesJapan,
      russia: v.satellitesRussia,
      india: v.satellitesIndia,
      korea: v.satellitesKorea,
      france: v.satellitesFrance,
      germany: v.satellitesGermany,
      italy: v.satellitesItaly,
      israel: v.satellitesIsrael,
    },
    opacity: paramNum(values, "satellitesYaogan", "satOpacity"),
    consoleFilter: deps.satConsoleOpen
      ? { featuredNorads: deps.maneuverNorads, showAllOrbits: deps.satShowAllOrbits }
      : null,
  });
  return null;
};

/** TDX 即時路況事件 timeline */
export const RoadEventsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRoadEventsLayer");
  const values = useLayerParams("roadEvents");
  useRoadEventsLayer(
    deps.mapRef,
    deps.layerVisibility.roadEvents,
    paramNum(values, "roadEvents", "reOpacity"),
  );
  return null;
};

/** 火災歷史事件（僅在 historical mode + toggle 開啟時實際 fetch） */
export const FireEventsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFireEventsLayer");
  const p = useKeyOverlayParams("fireEvents");
  useFireEventsLayer(
    deps.mapRef,
    deps.appMode === "historical" && deps.layerVisibility.fireEvents,
    deps.historicalYear,
    deps.historicalMonth,
    deps.historicalDay,
    deps.historicalGranularity,
    deps.isDarkTheme,
    p.fireEventsOpacity ?? 1,
  );
  return null;
};

/** 火災最新年度（任何模式可見，不需歷史時間軸） */
export const FireLatestHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFireLatestLayer");
  const p = useKeyOverlayParams("fireLatest");
  useFireLatestLayer(
    deps.mapRef,
    deps.layerVisibility.fireLatest,
    deps.isDarkTheme,
    p.fireLatestOpacity ?? 1,
  );
  return null;
};

/** 全國清潔隊辦公點 359 / 23 縣市（spatial.waste_cleaning_squads） */
export const WasteCleaningSquadHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useWasteCleaningSquadLayer");
  useWasteCleaningSquadLayer(
    deps.mapRef,
    deps.layerVisibility.wasteCleaningSquads,
    deps.isDarkTheme,
  );
  return null;
};

/** Freeway congestion（動態 timeline 回放） */
export const FreewayHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFreewayLayer");
  const p = useKeyOverlayParams("freewayCongestion");
  useFreewayLayer(
    deps.mapRef,
    deps.layerVisibility.freewayCongestion,
    p.freewayWidth ?? 1,
    deps.isDarkTheme,
  );
  return null;
};

/** 省道路況 v1（PMTiles + feature-state 染色） */
export const RoadCongestionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRoadCongestionLayer");
  const p = useKeyOverlayParams("roadCongestion");
  useRoadCongestionLayer(
    deps.mapRef,
    deps.layerVisibility.roadCongestion,
    p.roadCongestionWidth ?? 1,
    p.roadCongestionOpacity ?? 0.85,
  );
  return null;
};

/** 殯葬業者區級密度（無幾何 → join 鄉鎮界 PMTiles + feature-state 染色） */
export const FuneralDensityHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFuneralDensityLayer");
  const p = useKeyOverlayParams("funeralOperatorDensity");
  useFuneralDensityLayer(
    deps.mapRef,
    deps.layerVisibility.funeralOperatorDensity,
    p.funeralOperatorDensityOpacity ?? 0.6,
  );
  return null;
};

/** 溫度網格 2D（Mapbox fill + feature-state 染色，與 3D 溫度波共用資料） */
export const TemperatureGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTemperatureGridLayer");
  const values = useLayerParams("temperatureGrid");
  useTemperatureGridLayer(
    deps.mapRef,
    deps.temperatureData,
    deps.layerVisibility.temperatureGrid,
    paramNum(values, "temperatureGrid", "tempGridOpacity"),
  );
  return null;
};
