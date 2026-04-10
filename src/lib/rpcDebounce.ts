/**
 * RPC 請求去重工具 — 同 key 的 pending 請求直接複用 promise，
 * 已完成的結果在 windowMs 內也直接回傳，避免重複打 Supabase。
 */

interface RpcCacheEntry<T> {
  promise: Promise<T>;
  resolvedAt: number | null;
  result: T | null;
}

const rpcCache = new Map<string, RpcCacheEntry<unknown>>();

/**
 * 包裝任何 async 請求，相同 key 在 windowMs 內只發送一次。
 *
 * @param key        唯一識別 key（例如 "get_bus_current_taipei"）
 * @param fetcher    實際發送請求的 async function
 * @param windowMs   快取有效期（預設 5000ms）
 */
export function dedupRpc<T>(
  key: string,
  fetcher: () => Promise<T>,
  windowMs = 5000,
): Promise<T> {
  const now = performance.now();
  const cached = rpcCache.get(key) as RpcCacheEntry<T> | undefined;

  if (cached) {
    // 請求還在 pending → 直接複用 promise
    if (cached.resolvedAt === null) return cached.promise;
    // 在快取視窗內有結果 → 直接回傳
    if (now - cached.resolvedAt < windowMs) return Promise.resolve(cached.result as T);
  }

  const entry: RpcCacheEntry<T> = {
    promise: null as unknown as Promise<T>,
    resolvedAt: null,
    result: null,
  };

  entry.promise = fetcher().then((result) => {
    entry.resolvedAt = performance.now();
    entry.result = result;
    return result;
  }).catch((err) => {
    rpcCache.delete(key); // 失敗時清除，允許重試
    throw err;
  });

  rpcCache.set(key, entry as RpcCacheEntry<unknown>);
  return entry.promise;
}

/** 手動清除特定 key 的快取 */
export function invalidateRpc(key: string): void {
  rpcCache.delete(key);
}
