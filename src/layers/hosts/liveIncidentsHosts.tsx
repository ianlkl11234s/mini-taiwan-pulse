// 即時案件 Layer Host：即時 119 案件、警廣即時路況（兩層皆 owner-only RPC，gis-platform mig 555）。

import { useFire119LiveLayer } from "../../hooks/useFire119LiveLayer";
import { usePbsRoadEventsLiveLayer } from "../../hooks/usePbsRoadEventsLiveLayer";
import { asLiveIncidentWindow } from "../../data/liveIncidentsTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

/** 即時 119：每分鐘重抓；點／鄉鎮面量／醫院徽章；點開或滑過路段級案件時高亮整條路 */
export const Fire119LiveHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFire119LiveLayer");
  const values = useLayerParams("fire119Live");
  useFire119LiveLayer(deps.mapRef, deps.layerVisibility.fire119Live, {
    opacity: paramNum(values, "fire119Live", "fire119LiveOpacity"),
    scale: paramNum(values, "fire119Live", "fire119LiveScale"),
    windowMin: Number(asLiveIncidentWindow(paramStr(values, "fire119Live", "fire119LiveWindow"))),
    isDark: deps.isDarkTheme,
    featureInfo: deps.featureInfo,
  });
  return null;
};

/** 警廣即時路況：每分鐘重抓；事故黃、其他灰，已排除變灰 */
export const PbsRoadEventsLiveHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePbsRoadEventsLiveLayer");
  const values = useLayerParams("pbsRoadEventsLive");
  usePbsRoadEventsLiveLayer(deps.mapRef, deps.layerVisibility.pbsRoadEventsLive, {
    opacity: paramNum(values, "pbsRoadEventsLive", "pbsRoadEventsLiveOpacity"),
    scale: paramNum(values, "pbsRoadEventsLive", "pbsRoadEventsLiveScale"),
    windowMin: Number(asLiveIncidentWindow(paramStr(values, "pbsRoadEventsLive", "pbsRoadEventsLiveWindow"))),
    isDark: deps.isDarkTheme,
  });
  return null;
};
