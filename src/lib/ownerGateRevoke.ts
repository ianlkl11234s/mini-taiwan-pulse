/**
 * 站主限定／私人圖層的「撤權清除」集中機制（review F088，見 docs/features/owner-gated-layers/README.md）。
 *
 * App 以 `lockedKeys`（tier＋get_layer_gates＋私人 Range API 探測＋RELEASE_HOLD）為唯一訊號：
 *  1. 關層：凡在 lockedKeys 內而仍開著的 key 一律關掉（`lockedVisibleKeys`；URL／場景都由 visibility 派生）。
 *  2. 清快取：只對「這次新上鎖」的 key（`newlyLockedKeys`）呼叫各模組註冊的清除函式
 *     （module cache、hook 內暫存的資料、自建的 Mapbox source）。
 *  3. 清 Mapbox：registry dynamicData overlay 的 source 由 addAllOverlays 建在 style 上、feed 都靠
 *     getSource 找它，直接 removeSource 會讓重新授權後開層一片空白（或破壞 z-order），
 *     所以改把資料清成空 FeatureCollection（`clearOverlaySourcesForKeys`），layer 由 visible=false 隱藏。
 *
 * 不依賴 React，方便單元測試。
 */
type Key = string;
/** 收到這次新上鎖的完整集合（同一處理器可依 key 決定清哪些） */
type Reset = (revoked: ReadonlySet<Key>) => void;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const handlers = new Set<{ keys: ReadonlySet<Key>; reset: Reset }>();

/** 註冊：這些 key 撤權時要執行的清除。回傳 unregister（hook 在 effect cleanup 呼叫）。 */
export function registerOwnerGateReset(keys: Iterable<Key>, reset: Reset): () => void {
  const entry = { keys: new Set(keys), reset };
  handlers.add(entry);
  return () => { handlers.delete(entry); };
}

/** 對與 `revoked` 有交集的註冊項各呼叫一次清除；單一清除丟錯不影響其他。 */
export function runOwnerGateResets(revoked: ReadonlySet<Key>): void {
  if (revoked.size === 0) return;
  for (const entry of [...handlers]) {
    let hit = false;
    for (const key of entry.keys) if (revoked.has(key)) { hit = true; break; }
    if (!hit) continue;
    try { entry.reset(revoked); } catch (err) { console.warn("[owner-gate] revoke reset failed", err); }
  }
}

/** prev → next 新上鎖的 key（初次 render 以當下集合為 prev → 空集合） */
export function newlyLockedKeys<K extends Key>(prev: ReadonlySet<K>, next: ReadonlySet<K>): Set<K> {
  const out = new Set<K>();
  for (const key of next) if (!prev.has(key)) out.add(key);
  return out;
}

/** 已上鎖但仍開著、需要關掉的 key（fail-closed：不論何時上鎖） */
export function lockedVisibleKeys<K extends Key>(visibility: Readonly<Record<K, boolean>>, locked: ReadonlySet<K>): K[] {
  return [...locked].filter((key) => visibility[key]);
}

interface SourceMap {
  getSource(id: string): unknown;
}

/** registry overlay（GeoJSON source）中屬於 `keys` 者，資料清成空 FC。回傳清掉的 sourceId。 */
export function clearOverlaySourcesForKeys(
  map: SourceMap,
  registry: readonly { id: string; sourceId: string; pmtiles?: unknown }[],
  keys: ReadonlySet<Key>,
): string[] {
  const cleared = new Set<string>();
  for (const config of registry) {
    if (config.pmtiles || !keys.has(config.id as string) || cleared.has(config.sourceId)) continue;
    const src = map.getSource(config.sourceId) as { setData?: (fc: GeoJSON.FeatureCollection) => void } | undefined;
    if (!src || typeof src.setData !== "function") continue;
    src.setData(EMPTY_FC);
    cleared.add(config.sourceId);
  }
  return [...cleared];
}

/** 測試用 */
export function resetOwnerGateHandlersForTest(): void {
  handlers.clear();
}
