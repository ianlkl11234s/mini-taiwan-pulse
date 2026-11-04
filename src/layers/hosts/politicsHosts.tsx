// 政治 Politics 的 Layer Host：2026 選舉活動（owner-only RPC）、2024 投開票所（公開 bbox RPC）。

import { useElectionEventsLayer } from "../../hooks/useElectionEventsLayer";
import { usePollingStationsLayer } from "../../hooks/usePollingStationsLayer";
import { asElectionRange } from "../../data/electionEventsTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramStr, useLayerParams } from "../layerParamsAccess";

/** 依時間軸時間把活動分成已過／未到（樣式在 overlayRegistry），並套「時間範圍」篩選 */
export const ElectionEventsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useElectionEventsLayer");
  const values = useLayerParams("electionEvents2026");
  const range = asElectionRange(paramStr(values, "electionEvents2026", "electionEvents2026Range"));
  useElectionEventsLayer(deps.mapRef, deps.layerVisibility.electionEvents2026, range);
  return null;
};

/** 2024 投開票所（公開）：依視窗 bbox 即時查 RPC；樣式與著色模式在 overlayRegistry */
export const PollingStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePollingStationsLayer");
  usePollingStationsLayer(deps.mapRef, deps.layerVisibility.pollingStations2024);
  return null;
};
