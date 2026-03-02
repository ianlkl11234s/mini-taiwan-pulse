import { useCallback, useRef, useState } from "react";
import type { H3CellData } from "../data/h3Loader";
import { loadH3Population } from "../data/h3Loader";

export function useH3Data() {
  const [h3DataMap, setH3DataMap] = useState<Map<number, H3CellData[]>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());

  const loadResolution = useCallback(async (resolution: number) => {
    // Skip if already loaded or loading
    if (h3DataMap.has(resolution) || loadingRef.current.has(resolution)) return;

    loadingRef.current.add(resolution);
    const data = await loadH3Population(resolution);
    loadingRef.current.delete(resolution);

    if (data.cells.length > 0) {
      setH3DataMap((prev) => {
        const next = new Map(prev);
        next.set(resolution, data.cells);
        return next;
      });
    }
  }, [h3DataMap]);

  return { h3DataMap, loadResolution };
}
