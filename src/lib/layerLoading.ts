import { useCallback, useSyncExternalStore } from "react";
import { loadingRegistry } from "./loadingRegistry";
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";

/**
 * 圖層列的載入轉圈（layer-panel-unify P1）：把 loadingRegistry 的任務對回圖層。
 *
 * loadingRegistry 的任務 id 是各 loader 自取的字串，沒有登記屬於哪一層，所以這裡是
 * **盡力比對**，只認下列形狀（都以 `:` 或 `-` 為邊界，避免 `aqi` 吃到 `aqiMicro`
 * 以外的字首時誤判）：
 *   - id 本身、`<key>:…`、`…:<key>`、`…:<key>:…`（例 `statistics-render:<key>`、`news-render:<key>`）
 *   - key 的 kebab 寫法開頭（例 `gfwDarkVessels` → `gfw-dark-vessels:render`）
 *   - manifest 登記的 sourceId 開頭（例 `${sourceId}:render`）
 * 接不到的：id 只帶資料集或日期的任務（例 `statistics:<datasetId>:<indicator>`、`h3:<檔名>`），
 * 這些層仍只有右上全站載入條（spec §5.30）。`research:` 開頭是 Agent 分析任務，一律不算。
 */

const kebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function hasBoundaryPrefix(id: string, prefix: string): boolean {
  if (!prefix || !id.startsWith(prefix)) return false;
  const next = id.charAt(prefix.length);
  return next === "" || next === ":" || next === "-";
}

const prefixCache = new Map<string, string[]>();
function layerPrefixes(layerKey: string): string[] {
  let prefixes = prefixCache.get(layerKey);
  if (prefixes) return prefixes;
  const entry = (LAYER_MANIFEST as Record<string, { source?: unknown }>)[layerKey as ManifestKey];
  const sources = entry?.source ? (Array.isArray(entry.source) ? entry.source : [entry.source]) : [];
  const sourceIds = sources.flatMap((source) =>
    source && typeof source === "object" && "sourceId" in source && typeof (source as { sourceId: unknown }).sourceId === "string"
      ? [(source as { sourceId: string }).sourceId]
      : []);
  prefixes = [...new Set([layerKey, kebab(layerKey), ...sourceIds])];
  prefixCache.set(layerKey, prefixes);
  return prefixes;
}

/** 這個載入任務是不是在載入 `layerKey` 這一層。 */
export function isLoadingTaskForLayer(taskId: string, layerKey: string): boolean {
  if (taskId.startsWith("research:")) return false;
  if (taskId.endsWith(`:${layerKey}`) || taskId.includes(`:${layerKey}:`)) return true;
  // 前綴也要能出現在冒號之後（例 `overlay-hydrate:<sourceId>`，sourceId 與 layerKey 不同名）
  const tails = [taskId, ...[...taskId.matchAll(/:/g)].map((m) => taskId.slice(m.index + 1))];
  return layerPrefixes(layerKey).some((prefix) => tails.some((tail) => hasBoundaryPrefix(tail, prefix)));
}

export function isLayerLoading(layerKey: string): boolean {
  return loadingRegistry.snapshot().some((task) => isLoadingTaskForLayer(task.id, layerKey));
}

/**
 * per-key 訂閱：回傳 boolean，只有這一層的載入狀態翻轉才重繪（不讓每列訂整張快照）。
 * 只在圖層開啟時比對，關著的層不會因為 id 撞名而轉圈。
 */
export function useLayerLoading(layerKey: string, active: boolean): boolean {
  const getSnapshot = useCallback(() => active && isLayerLoading(layerKey), [active, layerKey]);
  return useSyncExternalStore(loadingRegistry.subscribe, getSnapshot, getSnapshot);
}
