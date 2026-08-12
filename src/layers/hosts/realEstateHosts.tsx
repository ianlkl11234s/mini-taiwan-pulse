// 房地產 + 點選光暈的 Layer Host（AR-22 P2）
//
// ⚠️ 每個 Host 的參數都是**逐位照抄** App.tsx 原本那段呼叫，包含 `?? default`
// 與 `!!` 的寫法。store 的值來自 spec 預設，理論上 `??` 已冗餘，但保留等價寫法 ——
// 有疑義寧可保守（見 layerParamsAccess.ts 檔頭）。

import { useRealEstateTimeline } from "../../hooks/useRealEstateTimeline";
import { useRealEstatePointsLayer } from "../../hooks/useRealEstatePointsLayer";
import { useSelectedFeatureHalo } from "../../hooks/useSelectedFeatureHalo";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/**
 * 房地產的 `realEstateOpacity` / `realEstateExcludeTaipei` 是 **6 個 key 共用一個
 * slot**（`sharedGroup`）—— 讀哪個成員都一樣，store 的 `setParam` 保證同群恆等，
 * 且任一面板拖動都會通知每個成員的訂閱者。取第一個成員當代表（同 runtime 對
 * 裁處事件三兄弟取 `PENALTY_KEY` 的作法）。
 */
const RE_SHARED_KEY = "realEstateRentalGrid";

/** 房地產時間軸：realtime→ALL 全期 / historical→游標所在季(grid)+點漸入漸出(月/週) */
export const RealEstateTimelineHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRealEstateTimeline");
  const p = useKeyOverlayParams(RE_SHARED_KEY);
  useRealEstateTimeline(deps.mapRef, {
    appMode: deps.appMode,
    active: deps.realEstateActive,
    gran: deps.reGran,
    cursorTs: deps.reCursorTs,
    excludeTaipei: !!p.realEstateExcludeTaipei,
    baseOpacity: p.realEstateOpacity ?? 0.85,
    playing: deps.historicalPlaying,
    speed: deps.historicalSpeed,
    onCursorChange: deps.onReCursorChange,
    onStop: deps.onHistoricalStop,
  });
  return null;
};

/** 房地產「點」WebGL CustomLayer（GPU fade，取代 3 個 PMTiles circle） */
export const RealEstatePointsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useRealEstatePointsLayer");
  const p = useKeyOverlayParams(RE_SHARED_KEY);
  useRealEstatePointsLayer(deps.mapRef, {
    showRental: deps.layerVisibility.realEstateRentalPoint,
    showSale: deps.layerVisibility.realEstateSalePoint,
    showPresale: deps.layerVisibility.realEstatePresalePoint,
    excludeTaipei: !!p.realEstateExcludeTaipei,
    baseOpacity: p.realEstateOpacity ?? 0.85,
  });
  return null;
};

/** 點選的圖層點 → 淡黃色脈動光暈（跨圖層裝飾，沒有自己的 layer key） */
export const SelectedFeatureHaloHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSelectedFeatureHalo");
  useSelectedFeatureHalo(deps.mapRef, deps.featureInfo);
  return null;
};
