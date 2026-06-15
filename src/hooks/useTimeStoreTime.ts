/**
 * 訂閱 timeStore（節流版）給 React UI 用。
 *
 * 符合專案規則 §6：UI 用 useSyncExternalStore + subscribeThrottled，
 * 計算 / SGP4 直接呼叫 timeStore.getTime()。
 *
 * 不要把回傳值放進 useEffect deps。
 */
import { useSyncExternalStore } from "react";
import { timeStore } from "../state/timeStore";

/** 回傳 timeStore 當下時間（秒），節流 250ms 預設給 UI 顯示用 */
export function useTimeStoreTime(throttleMs = 250): number {
  return useSyncExternalStore(
    (cb) => timeStore.subscribeThrottled(throttleMs, cb),
    () => timeStore.getTime(),
    () => Math.floor(Date.now() / 1000),
  );
}

/** 判斷時間軸是否與現實時間有顯著偏離（> 60s）— 給歷史模式 UI 警示用 */
export function isHistoryMode(timelineSec: number): boolean {
  const nowSec = Date.now() / 1000;
  return Math.abs(nowSec - timelineSec) > 60;
}

/** 把時間軸偏移格式化成「+1:30」「-2:15」 */
export function formatTimelineOffset(timelineSec: number): string {
  const diff = timelineSec - Date.now() / 1000;
  const abs = Math.abs(diff);
  const sign = diff < 0 ? "-" : "+";
  if (abs < 3600) {
    const m = Math.floor(abs / 60);
    return `${sign}${m} 分`;
  }
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}
