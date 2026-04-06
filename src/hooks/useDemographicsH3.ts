import { useCallback, useRef, useState } from "react";
import type { DemographicH3CellData } from "../data/h3Loader";
import { loadH3Demographics, loadH3DemographicsYearly } from "../data/h3Loader";

/**
 * Hook for loading H3 demographics data.
 * Supports both single-snapshot mode and yearly mode.
 */
export function useDemographicsH3() {
  const [dataMap, setDataMap] = useState<Map<number, DemographicH3CellData[]>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());

  const loadResolution = useCallback(async (resolution: number) => {
    if (dataMap.has(resolution) || loadingRef.current.has(resolution)) return;

    loadingRef.current.add(resolution);
    const data = await loadH3Demographics(resolution);
    loadingRef.current.delete(resolution);

    if (data.cells.length > 0) {
      setDataMap((prev) => {
        const next = new Map(prev);
        next.set(resolution, data.cells);
        return next;
      });
    }
  }, [dataMap]);

  return { demographicsDataMap: dataMap, loadDemographicsResolution: loadResolution };
}

/**
 * Hook for loading H3 demographics by year (民國年 104~113).
 * Data is fetched from Supabase RPC with local JSON fallback.
 */
export function useDemographicsYearlyH3() {
  // key: "resolution-year", value: cells
  const [yearlyDataMap, setYearlyDataMap] = useState<Map<string, DemographicH3CellData[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef<Set<string>>(new Set());

  const loadYear = useCallback(async (year: number, resolution: number = 7) => {
    const key = `${resolution}-${year}`;
    if (yearlyDataMap.has(key) || loadingRef.current.has(key)) return;

    loadingRef.current.add(key);
    setLoading(true);

    const cells = await loadH3DemographicsYearly(year, resolution);
    loadingRef.current.delete(key);

    if (cells.length > 0) {
      setYearlyDataMap((prev) => {
        const next = new Map(prev);
        next.set(key, cells);
        return next;
      });
    }
    setLoading(false);
  }, [yearlyDataMap]);

  /** Get cells for a specific year+resolution (undefined if not loaded) */
  const getCells = useCallback(
    (year: number, resolution: number = 7): DemographicH3CellData[] | undefined => {
      return yearlyDataMap.get(`${resolution}-${year}`);
    },
    [yearlyDataMap],
  );

  return {
    yearlyDataMap,
    loadYear,
    getCells,
    loading,
  };
}
