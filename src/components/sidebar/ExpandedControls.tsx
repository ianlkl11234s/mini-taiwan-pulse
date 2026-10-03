import type { DisplayMode, ExpandableLayerKey } from "../../types";
// AR-22 P4：控件不再由 App 經 4 層 props 傳下來（getControls drilling 已拆除）。
// 展開的那一層自己 per-key 訂閱 —— 拖 slider 只喚醒這個元件，App 不 re-render。
import { useEffect, useReducer } from "react";
import { buildParamControls } from "../../state/layerParamsControls";
import { useLayerParams } from "../../state/layerParamsStore";
import { ensureLinkedSelects, subscribeLinkedSelects } from "../../state/linkedSelect";
import { isStatisticsRenderLayer } from "../../data/regionalStatisticsRecipes";
import { HistoricalFlightTrailControls } from "./HistoricalFlightTrailControls";
import { StatisticsDetails } from "./StatisticsDetails";
import { PropertyValueStatisticsDetails } from "./PropertyValueStatisticsDetails";
import { LayerControlArea, ParamControlList } from "./LayerParamControls";
import { useRailTheme } from "./railTheme";
import { LayerInfoLine } from "./LayerInfoLine";

export interface ExpandedControlsProps {
  layerKey: ExpandableLayerKey;
  isTransport: boolean;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
}

/**
 * 連動選單的 provider（統計 store、群組可見性）變動時重繪；展開時觸發載入（選項來源與資料本體，
 * 兩者都走 loadingRegistry）。
 */
function useLinkedSelects(layerKey: string): void {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const off = subscribeLinkedSelects(layerKey, rerender);
    ensureLinkedSelects(layerKey);
    return off;
  }, [layerKey]);
}

/**
 * 圖層展開區（spec §5.11 V2）：桌機四入口與手機共用同一份。
 * 順序：航班模式鈕 → 實價統計 → 歷史航跡 → 共用控制項（`ParamControlList`：資料篩選含統計連動選單 →
 * 顏色 → 透明度 → 大小 → 其他外觀）→ 說明・來源（統計圖層的來源與處理紀錄也在這裡，C 段）。
 */
export function ExpandedControls({
  layerKey, isTransport, displayMode,
  onDisplayModeChange,
}: ExpandedControlsProps) {
  // per-key 訂閱：只有這一層的參數變動才重繪本元件
  const paramValues = useLayerParams(layerKey);
  useLinkedSelects(layerKey);
  const controls = buildParamControls(layerKey, paramValues) ?? [];
  const { TEXT_STRONG, COLOR_SCHEME } = useRailTheme();
  const isDarkTheme = COLOR_SCHEME === "dark";

  return (
    <LayerControlArea isDarkTheme={isDarkTheme} style={{ margin: "2px 12px 8px 22px" }}>
      {isTransport && layerKey === "flights" && (
        <div className="lpc-head">
            <button type="button" className="lpc-btn" aria-pressed={displayMode === "status"} onClick={() => onDisplayModeChange("status")}>
              即時狀態
            </button>
            <button type="button" className="lpc-btn" aria-pressed={displayMode === "trails"} onClick={() => onDisplayModeChange("trails")}>
              航跡
            </button>
        </div>
      )}
      {layerKey === "propertyValueAdmin" && <PropertyValueStatisticsDetails />}
      {(layerKey === "historicalFlightTrails" || layerKey === "jpHistoricalFlightTrails") && <HistoricalFlightTrailControls country={layerKey === "historicalFlightTrails" ? "TW" : "JP"} isDarkTheme={isDarkTheme} />}
      <ParamControlList controls={controls} />
      {isStatisticsRenderLayer(layerKey)
        ? <LayerInfoLine layerKey={layerKey}><StatisticsDetails layerKey={layerKey} textColor={TEXT_STRONG} /></LayerInfoLine>
        : <LayerInfoLine layerKey={layerKey} />}
    </LayerControlArea>
  );
}
