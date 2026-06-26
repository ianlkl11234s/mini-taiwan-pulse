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
 * 全域 prefetch 序列：所有 layer 的 prefetch 共用此 queue，
 * 上限 MAX_CONCURRENT 個同時打 Supabase（避免 pooler 連線爆掉）。
 *
 * 經驗值：rangeDays=7 + cwa cloud/radar + lightning + nuclear 同時開
 * = 7×2 + 7 + 7 = 28 個 RPC，未限速時直接打掛 Supabase。
 */
const MAX_CONCURRENT_PREFETCH = 2;
const PREFETCH_DEBOUNCE_MS = 500;

let inflight = 0;
const queue: Array<() => Promise<unknown>> = [];

function pump() {
  while (inflight < MAX_CONCURRENT_PREFETCH && queue.length > 0) {
    const task = queue.shift()!;
    inflight++;
    task().finally(() => { inflight--; pump(); });
  }
}

/**
 * 對視窗內的 dateKeys 全部排入 prefetch queue（共用 concurrency cap）。
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
    queue.push(() => fetcher(k).catch((err) => {
      console.warn(`${consoleTag}[prefetch] ${k} failed:`, err);
    }));
  }
  pump();
}

/**
 * 訂閱視窗變動：subscribeDate / subscribeWindowDateKeys 任一觸發都 debounce 後 fire。
 * Debounce 防止快速 scrub 一秒內排入幾十個 RPC；最終以「停下來那個視窗」為準。
 */
export function subscribePrefetchWindow(
  fetcher: (key: string) => Promise<unknown>,
  consoleTag = "",
): () => void {
  let timer: number | null = null;
  const fire = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      // 排隊前先把舊的同 tag 任務丟掉？簡化做法：仰賴 fetcher 自身的 cache + inflight 去重
      prefetchWindow(fetcher, consoleTag, timeStore.getDateKey());
    }, PREFETCH_DEBOUNCE_MS);
  };
  fire(); // 初始 debounce 後 fire
  const unsubWindow = timeStore.subscribeWindowDateKeys(fire);
  const unsubDate = timeStore.subscribeDate(fire);
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    unsubWindow();
    unsubDate();
  };
}
