/**
 * 監看模式卡片樣式版本（spec §5.35）。
 *
 * - `v2`：2026-10-01 拍板的統一卡片（MonitorPanel 畫框＋標題列，各卡只畫內容）。
 * - `legacy`：改版前各卡自畫的樣式，保留給使用者切回對照／退回。
 *
 * 面板標頭的「新版／舊版」切換寫進 localStorage；讀寫失敗（隱私模式等）一律回預設 v2。
 * Context 預設值是 `legacy`：卡片元件若在 MonitorPanel 以外被掛載，維持原樣不受影響。
 */
import { createContext, useContext } from "react";

export type MonitorStyle = "v2" | "legacy";

export const MONITOR_STYLE_STORAGE_KEY = "mtp-monitor-style";
export const DEFAULT_MONITOR_STYLE: MonitorStyle = "v2";

export function loadMonitorStyle(): MonitorStyle {
  try {
    const v = window.localStorage.getItem(MONITOR_STYLE_STORAGE_KEY);
    return v === "legacy" || v === "v2" ? v : DEFAULT_MONITOR_STYLE;
  } catch {
    return DEFAULT_MONITOR_STYLE;
  }
}

export function saveMonitorStyle(style: MonitorStyle): void {
  try {
    window.localStorage.setItem(MONITOR_STYLE_STORAGE_KEY, style);
  } catch {
    // 儲存失敗只影響下次開啟的預設值
  }
}

export const MonitorStyleContext = createContext<MonitorStyle>("legacy");

/** 卡片元件用：`const v2 = useMonitorV2();` 決定要不要自畫框與標題 */
export function useMonitorV2(): boolean {
  return useContext(MonitorStyleContext) === "v2";
}
