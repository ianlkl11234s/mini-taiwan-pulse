/**
 * 垃圾投放點 hook — 一次抓全量 13,751 筆，依 point_type 分群快取。
 *
 * 量級 ~13k，全量 JSON ~4MB，pooler 內首次抓約 1~2s。
 * 設定為「lazy load」：第一個 sub-toggle 開啟時才抓，之後永久快取。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWasteDisposalPoints,
  type WasteDisposalPointRow,
} from "../data/wasteLoader";

export interface UseWasteDisposalPointLayerResult {
  rows: WasteDisposalPointRow[];
  /** 依 point_type 分群（key 為原始 point_type） */
  byType: Map<string, WasteDisposalPointRow[]>;
  count: number;
  loading: boolean;
  error: string | null;
}

export function useWasteDisposalPointLayer(enabled: boolean): UseWasteDisposalPointLayerResult {
  const [rows, setRows] = useState<WasteDisposalPointRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    let cancelled = false;
    setLoading(true);
    fetchedRef.current = true;
    fetchWasteDisposalPoints()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[WasteDisposalPoint] fetch failed:", err);
          setError(err instanceof Error ? err.message : String(err));
          fetchedRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled]);

  const byType = useMemo(() => {
    const map = new Map<string, WasteDisposalPointRow[]>();
    for (const r of rows) {
      const arr = map.get(r.point_type) ?? [];
      arr.push(r);
      map.set(r.point_type, arr);
    }
    return map;
  }, [rows]);

  return { rows, byType, count: rows.length, loading, error };
}
