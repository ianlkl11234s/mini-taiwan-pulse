/**
 * dayPrefetch — 對 loader 預載 timeline 視窗內的日期清單。
 *
 * 設計原則（2026-06-26 修正）：
 *  - **嚴格只動視窗內**：清單由 timeStore.getWindowDateKeys() 給定，不外推 ±N，
 *    避免畫面看不到的日期也打 RPC 把 LOADING panel 灌爆。
 *  - **背景靜默**：fetcher 必須是「不走 withLoading」的 prefetch 版本
 *    （如 prefetchLightningDay，與正常 fetchLightningDay 共用 cachedByKey 但跳過 loading panel）。
 *  - **錯誤吞掉**：prefetch 失敗只警告，不影響主流程。
 *
 * 用法：
 *   const unsub = subscribePrefetchWindow(prefetchLightningDay, "[HAZARD/lightning]");
 *   // 初次 + 視窗變動時都會自動 fire
 *   return () => unsub();
 */

import { timeStore } from "../state/timeStore";

/**
 * 對視窗內的 dateKeys 全部呼叫 fetcher（背景、不 await）。
 * 中心日由呼叫端自己 foreground 載入；prefetch 只負責「其他日塞 cache」。
 */
export function prefetchWindow(
  fetcher: (key: string) => Promise<unknown>,
  consoleTag = "",
  skipKey?: string,
): void {
  const keys = timeStore.getWindowDateKeys();
  for (const k of keys) {
    if (k === skipKey) continue;
    fetcher(k).catch((err) => {
      console.warn(`${consoleTag}[prefetch] ${k} failed:`, err);
    });
  }
}

/**
 * 訂閱視窗變動：subscribeDate / subscribeWindowDateKeys 任一觸發都會 fire 一次。
 * 用 setTimeout(0) 把呼叫延後到 microtask 之後，避免和 center 日的 foreground load
 * 同時打 RPC 卡頻寬。回傳 unsubscribe。
 */
export function subscribePrefetchWindow(
  fetcher: (key: string) => Promise<unknown>,
  consoleTag = "",
): () => void {
  const fire = () => {
    setTimeout(() => prefetchWindow(fetcher, consoleTag, timeStore.getDateKey()), 0);
  };
  fire(); // 初始一次
  const unsubWindow = timeStore.subscribeWindowDateKeys(fire);
  const unsubDate = timeStore.subscribeDate(fire);
  return () => { unsubWindow(); unsubDate(); };
}
