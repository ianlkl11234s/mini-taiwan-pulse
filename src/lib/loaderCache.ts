// Loader 層共用快取 helper。
//
// 背景：30 個 loader 中只有 7 個有快取，其餘每次 toggle 圖層 / 切日期都重打
// Supabase。靜態或慢變資料（地震列表、各類 *Latest、per-day 時序）重複抓
// 既浪費 DB 也讓 toggle 體感變慢。
//
// 兩個工具：
// - cachedOnce(fn, ttl)：無參數 fetcher。in-flight 去重（並發呼叫共享同一個
//   promise，也順便擋 React StrictMode 雙跑）+ TTL 過期重抓 + 失敗自動清除。
// - cachedByKey(fn, ttl, max)：單一 string key 的 fetcher（如 dateKey）。
//   LRU 上限避免長 session 滾 timeline 把記憶體吃滿。
//
// TTL 選擇慣例：歷史/靜態 15min、*Latest 即時值 5min、per-day 時序 10min。

interface CacheEntry<T> {
  promise: Promise<T>;
  /** resolve 完成的時間；in-flight 期間為 null（不計 TTL） */
  resolvedAt: number | null;
}

export interface CachedOnce<T> {
  (): Promise<T>;
  /** 強制清除（測試或手動 refresh 用） */
  invalidate(): void;
}

export function cachedOnce<T>(
  fetcher: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): CachedOnce<T> {
  let entry: CacheEntry<T> | null = null;

  const wrapped = (() => {
    if (entry) {
      const fresh = entry.resolvedAt === null || now() - entry.resolvedAt < ttlMs;
      if (fresh) return entry.promise;
    }
    const e: CacheEntry<T> = { promise: fetcher(), resolvedAt: null };
    entry = e;
    e.promise
      .then(() => { e.resolvedAt = now(); })
      .catch(() => { if (entry === e) entry = null; });
    return e.promise;
  }) as CachedOnce<T>;

  wrapped.invalidate = () => { entry = null; };
  return wrapped;
}

export interface CachedByKey<T> {
  (key: string): Promise<T>;
  invalidate(key?: string): void;
}

export interface KeyedThunkCache<T> {
  (key: string, fetcher: () => Promise<T>): Promise<T>;
  invalidate(key?: string): void;
}

/**
 * 與 cachedByKey 相同的 TTL + LRU 行為，但 fetcher 由呼叫端逐次提供
 * （適用「key 是多參數序列化、fetcher 需要 closure 住原始參數」的 loader，
 * 如 fetchWasteDisposalPoints(cities, types)）。
 */
export function keyedThunkCache<T>(
  ttlMs: number,
  maxEntries = 16,
  now: () => number = Date.now,
): KeyedThunkCache<T> {
  const pendingThunks = new Map<string, () => Promise<T>>();
  const inner = cachedByKey<T>(
    (key) => {
      const thunk = pendingThunks.get(key);
      if (!thunk) throw new Error(`keyedThunkCache: no thunk for key ${key}`);
      return thunk();
    },
    ttlMs,
    maxEntries,
    now,
  );

  const wrapped = ((key: string, fetcher: () => Promise<T>) => {
    pendingThunks.set(key, fetcher);
    try {
      return inner(key);
    } finally {
      pendingThunks.delete(key);
    }
  }) as KeyedThunkCache<T>;

  wrapped.invalidate = (key?: string) => inner.invalidate(key);
  return wrapped;
}

export function cachedByKey<T>(
  fetcher: (key: string) => Promise<T>,
  ttlMs: number,
  maxEntries = 16,
  now: () => number = Date.now,
): CachedByKey<T> {
  const entries = new Map<string, CacheEntry<T>>();

  const wrapped = ((key: string) => {
    const hit = entries.get(key);
    if (hit) {
      const fresh = hit.resolvedAt === null || now() - hit.resolvedAt < ttlMs;
      if (fresh) {
        // LRU touch：移到 Map 尾端
        entries.delete(key);
        entries.set(key, hit);
        return hit.promise;
      }
      entries.delete(key);
    }
    const e: CacheEntry<T> = { promise: fetcher(key), resolvedAt: null };
    entries.set(key, e);
    e.promise
      .then(() => { e.resolvedAt = now(); })
      .catch(() => { if (entries.get(key) === e) entries.delete(key); });
    // LRU evict（Map 迭代順序 = 插入順序，最舊在前）
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    return e.promise;
  }) as CachedByKey<T>;

  wrapped.invalidate = (key?: string) => {
    if (key === undefined) entries.clear();
    else entries.delete(key);
  };
  return wrapped;
}
