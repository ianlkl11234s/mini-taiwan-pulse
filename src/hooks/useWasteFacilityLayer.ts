/**
 * 垃圾處理設施 hook — 一次抓全量 4,609 筆，依 facility_type 分群快取。
 *
 * 為什麼一次抓全量：
 *   - 純靜態資料（變動緩慢），全量 ~800KB JSON pooler 內 OK
 *   - sub-toggle 切換時不需要重打 RPC，省 round-trip
 *   - App 端只渲染 visibility 為 true 的類型，無多餘成本
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWasteFacilities,
  type WasteFacilityRow,
} from "../data/wasteLoader";

export interface UseWasteFacilityLayerResult {
  /** 全部 rows */
  rows: WasteFacilityRow[];
  /** 依 facility_type 分群（key 為原始 facility_type） */
  byType: Map<string, WasteFacilityRow[]>;
  count: number;
  loading: boolean;
  error: string | null;
}

export function useWasteFacilityLayer(enabled: boolean): UseWasteFacilityLayerResult {
  const [rows, setRows] = useState<WasteFacilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    let cancelled = false;
    setLoading(true);
    fetchedRef.current = true;
    fetchWasteFacilities()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[WasteFacility] fetch failed:", err);
          setError(err instanceof Error ? err.message : String(err));
          fetchedRef.current = false; // 允許重試
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled]);

  const byType = useMemo(() => {
    const map = new Map<string, WasteFacilityRow[]>();
    for (const r of rows) {
      const arr = map.get(r.facility_type) ?? [];
      arr.push(r);
      map.set(r.facility_type, arr);
    }
    return map;
  }, [rows]);

  return { rows, byType, count: rows.length, loading, error };
}
