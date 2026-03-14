import { useCallback, useRef, useState } from "react";
import type { SpatialEconomyH3CellData } from "../data/h3Loader";
import { loadH3SpatialEconomy } from "../data/h3Loader";

export function useH3SpatialEconomy() {
  const [dataMap, setDataMap] = useState<Map<number, SpatialEconomyH3CellData[]>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());

  const loadResolution = useCallback(async (resolution: number) => {
    if (dataMap.has(resolution) || loadingRef.current.has(resolution)) return;

    loadingRef.current.add(resolution);
    const data = await loadH3SpatialEconomy(resolution);
    loadingRef.current.delete(resolution);

    if (data.cells.length > 0) {
      setDataMap((prev) => {
        const next = new Map(prev);
        next.set(resolution, data.cells);
        return next;
      });
    }
  }, [dataMap]);

  return { spatialDataMap: dataMap, loadSpatialResolution: loadResolution };
}
