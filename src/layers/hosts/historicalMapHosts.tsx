// 古地圖系列（臺灣百年歷史地圖，外部 XYZ raster）Layer Host：六個圖層共用一支 hook。
import { useHistoricalMapLayer } from "../../hooks/useHistoricalMapSinicaLayer";
import { HISTORICAL_MAP_GROUPS, type HistoricalMapGroupKey } from "../../data/historicalMapSinica";
import { bumpHostRender, type LayerHostComponent, type LayerHostDeps } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";
import { shownOnLeft, useCompareState, type CompareState } from "../../state/compareStore";

function useHistoricalGroup(deps: LayerHostDeps, key: HistoricalMapGroupKey, compare: CompareState) {
  const group = HISTORICAL_MAP_GROUPS.find((g) => g.key === key)!;
  const p = useKeyOverlayParams(key) as Record<string, number | undefined>;
  // 比較模式：側別＝只在右側時主地圖（左）不畫；右圖由 CompareMapView 用同一支 hook 另外畫
  useHistoricalMapLayer(deps.mapRef, key, shownOnLeft(key, deps.layerVisibility[key], compare),
    p[`${key}Opacity`] ?? group.defaultOpacity, p[`${key}EraIdx`]);
}

export const HistoricalMapSinicaHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useHistoricalMapSinicaLayer");
  const compare = useCompareState();
  // 固定順序呼叫（每個 key 一次），不在迴圈裡以免違反 hooks 規則
  useHistoricalGroup(deps, "historicalMapSinica", compare);
  useHistoricalGroup(deps, "historicalMapPostwar", compare);
  useHistoricalGroup(deps, "historicalImagery", compare);
  useHistoricalGroup(deps, "historicalBoundaries", compare);
  useHistoricalGroup(deps, "historicalLandUse", compare);
  useHistoricalGroup(deps, "historicalThematic", compare);
  return null;
};
