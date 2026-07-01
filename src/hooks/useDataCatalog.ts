/**
 * useDataCatalog — React hook 讀 layer 的上游資料來源。
 *
 * 兩種用法：
 *  useDataCatalogForLayer(layerKey) — 給 popup / info button 用
 *  useDataCatalogByTheme(theme)     — 給總覽面板用
 *
 * 內建：
 *  - 記憶體 cache（跨 hook 呼叫共用，避免重複 RPC）
 *  - graceful degradation：RPC 失敗返回空陣列，UI 顯示 fallback
 *  - loading + error state
 */
import { useEffect, useState } from "react";
import {
  fetchDataCatalogForLayer,
  fetchDataCatalogByTheme,
  type DataCatalogEntry,
  type DataCatalogSummary,
} from "../data/dataCatalogLoader";
import type { LayerVisibility } from "../types";

// Simple module-level cache (per session — reset on reload)
const layerCache = new Map<string, DataCatalogEntry[]>();
const themeCache = new Map<string, DataCatalogSummary[]>();

export interface UseDataCatalogResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useDataCatalogForLayer(
  layerKey: keyof LayerVisibility | null
): UseDataCatalogResult<DataCatalogEntry[]> {
  const [data, setData] = useState<DataCatalogEntry[]>(layerKey ? (layerCache.get(layerKey) ?? []) : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!layerKey) {
      setData([]);
      return;
    }
    if (layerCache.has(layerKey)) {
      setData(layerCache.get(layerKey)!);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDataCatalogForLayer(layerKey)
      .then((rows) => {
        if (!alive) return;
        layerCache.set(layerKey, rows);
        setData(rows);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [layerKey]);

  return { data, loading, error };
}

export function useDataCatalogByTheme(
  theme: string | null
): UseDataCatalogResult<DataCatalogSummary[]> {
  const cacheKey = theme ?? "__all__";
  const [data, setData] = useState<DataCatalogSummary[]>(themeCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (themeCache.has(cacheKey)) {
      setData(themeCache.get(cacheKey)!);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDataCatalogByTheme(theme ?? undefined)
      .then((rows) => {
        if (!alive) return;
        themeCache.set(cacheKey, rows);
        setData(rows);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cacheKey, theme]);

  return { data, loading, error };
}

/** Clear the in-memory cache. Useful after knowing the catalog was updated. */
export function clearDataCatalogCache() {
  layerCache.clear();
  themeCache.clear();
}
