// 古地圖系列（臺灣百年歷史地圖，外部 XYZ raster）Layer Host：六個圖層共用一支 hook。
import { useHistoricalMapLayer } from "../../hooks/useHistoricalMapSinicaLayer";
import { HISTORICAL_MAP_GROUPS, type HistoricalMapGroupKey } from "../../data/historicalMapSinica";
import { bumpHostRender, type LayerHostComponent, type LayerHostDeps } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

function useHistoricalGroup(deps: LayerHostDeps, key: HistoricalMapGroupKey) {
  const group = HISTORICAL_MAP_GROUPS.find((g) => g.key === key)!;
  const p = useKeyOverlayParams(key) as Record<string, number | undefined>;
  useHistoricalMapLayer(deps.mapRef, key, deps.layerVisibility[key],
    p[`${key}Opacity`] ?? group.defaultOpacity, p[`${key}EraIdx`]);
}

export const HistoricalMapSinicaHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useHistoricalMapSinicaLayer");
  // 固定順序呼叫（每個 key 一次），不在迴圈裡以免違反 hooks 規則
  useHistoricalGroup(deps, "historicalMapSinica");
  useHistoricalGroup(deps, "historicalMapPostwar");
  useHistoricalGroup(deps, "historicalImagery");
  useHistoricalGroup(deps, "historicalBoundaries");
  useHistoricalGroup(deps, "historicalLandUse");
  useHistoricalGroup(deps, "historicalThematic");
  return null;
};
