/**
 * dayPrefetch — 以「當前日為中心、共用 prefetch 視窗」預熱 loader 的工具。
 *
 * 背景：time-aware loader（lightning / nuclear / precipRaster / cwa-imagery / ...）
 * 多半已用 cachedByKey/cachedOnce 做 LRU+TTL 快取；缺的是「主動把鄰近日
 * fetch 進 cache」，否則切到鄰近日仍要等 RPC。
 *
 * 用法：在 subscribeDate 的 handler 內呼叫 prefetchAroundDate(...)
 *   prefetchAroundDate(dk, timeStore.getRangeDays(), fetchLightningDay);
 *
 * 規則：
 *  - days <= 1 一律 no-op
 *  - 不 await（背景進行），失敗只警告
 *  - 由 fetcher 自己的 cache 處理 dedup / 重複呼叫（這裡只負責喊一聲）
 */

/** 以 centerKey 為中心算出 ±floor((N-1)/2) ~ ±ceil((N-1)/2) 的日期 keys（含中心） */
export function neighborDateKeys(centerKey: string, totalDays: number): string[] {
  const out = [centerKey];
  if (totalDays <= 1) return out;
  const back = Math.floor((totalDays - 1) / 2);
  const fwd = Math.ceil((totalDays - 1) / 2);
  const centerMs = new Date(`${centerKey}T00:00:00+08:00`).getTime();
  for (let d = 1; d <= back; d++) {
    out.push(new Date(centerMs - d * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }));
  }
  for (let d = 1; d <= fwd; d++) {
    out.push(new Date(centerMs + d * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }));
  }
  return out;
}

/**
 * 對 fetcher 預載 ±days 的鄰近日（含中心；中心由呼叫端自行 await 才能立刻渲染）。
 * 回傳 unsubscribe-style 取消器 — 但因為背景 promise 已 in-flight，取消只能拒收結果，
 * 實際 fetch 仍會完成並進 fetcher 的 cache（這在多數場景是想要的副作用）。
 */
export function prefetchAroundDate(
  centerKey: string,
  rangeDays: number,
  fetcher: (key: string) => Promise<unknown>,
  consoleTag = "",
): void {
  const keys = neighborDateKeys(centerKey, rangeDays);
  for (const k of keys) {
    if (k === centerKey) continue; // 中心日由呼叫端 foreground 載入
    fetcher(k).catch((err) => {
      console.warn(`${consoleTag}[prefetch] ${k} failed:`, err);
    });
  }
}
