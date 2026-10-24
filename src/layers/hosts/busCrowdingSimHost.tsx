// 公車擁擠模擬（模擬面板，站主限定 UI 鎖、研究中）Layer Host：公開 TDX 衍生的本機靜態檔，不走私人 Range API。

import { useBusCrowdingSimLayer } from "../../hooks/useBusCrowdingSimLayer";
import { BUS_CROWDING_SCENARIOS, BUS_CROWDING_SIM_KEY, BUS_CROWDING_VERSIONS } from "../../data/busCrowdingSimTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

/** 版本、方案都是圖層參數；切換只換 feature-state。 */
export const BusCrowdingSimHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useBusCrowdingSimLayer");
  const values = useLayerParams(BUS_CROWDING_SIM_KEY);
  useBusCrowdingSimLayer(deps.mapRef, deps.layerVisibility.busCrowdingSim, paramNum(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimOpacity"), {
    version: oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimVersion"), BUS_CROWDING_VERSIONS, "v137"),
    scenario: oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimScenario"), BUS_CROWDING_SCENARIOS, "base"),
  });
  return null;
};
