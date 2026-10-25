// 公車擁擠模擬（模擬面板，站主限定、研究中）Layer Host：資料只走站主私人 Range API（未授權時 App 已鎖住 key，hook 也不抓資料）。

import { useEffect } from "react";
import { useBusCrowdingSimLayer } from "../../hooks/useBusCrowdingSimLayer";
import { useBusCrowdingReplayVehicles } from "../../hooks/useBusCrowdingReplayVehicles";
import { useBusCrowdingSimPrivateAccess } from "../../hooks/useBusCrowdingSimPrivateAccess";
import { BUS_CROWDING_SCENARIOS, BUS_CROWDING_SIM_KEY, BUS_CROWDING_DEFAULT_VERSION, BUS_CROWDING_VERSIONS, BUS_CROWDING_VIEWS } from "../../data/busCrowdingSimTypes";
import { busCrowdingSimClock } from "../../state/busCrowdingSimClock";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

/** 版本、方案、檢視都是圖層參數；切換時把數值寫進 properties 後 setData（幾何不重抓）。回放的時刻在 scoped 時鐘。 */
export const BusCrowdingSimHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useBusCrowdingSimLayer");
  const values = useLayerParams(BUS_CROWDING_SIM_KEY);
  const access = useBusCrowdingSimPrivateAccess();
  const userId = access.allowed ? access.userId : null;
  const visible = deps.layerVisibility.busCrowdingSim && !!userId;
  const opacity = paramNum(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimOpacity");
  const version = oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimVersion"), BUS_CROWDING_VERSIONS, BUS_CROWDING_DEFAULT_VERSION);
  const scenario = oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimScenario"), BUS_CROWDING_SCENARIOS, "base");
  const view = oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimView"), BUS_CROWDING_VIEWS, "static");
  const replay = visible && view === "replay";
  useBusCrowdingSimLayer(deps.mapRef, visible, opacity, { version, scenario, view }, deps.isDarkTheme, userId);
  useBusCrowdingReplayVehicles(deps.mapRef, replay, opacity, version, scenario, deps.isDarkTheme, userId);
  // S-1：關掉圖層即暫停並回到初始時刻；切回全時段只暫停
  useEffect(() => { if (!visible) busCrowdingSimClock.reset(); else if (!replay) busCrowdingSimClock.pause(); }, [visible, replay]);
  return null;
};
