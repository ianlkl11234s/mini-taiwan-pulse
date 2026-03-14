import { useEffect, useState } from "react";
import type { Ship } from "../types";
import { loadShipsFromApi, loadShipsLegacy } from "../data/shipLoader";

interface UseShipDataReturn {
  ships: Ship[];
  timeRange: { start: number; end: number };
  loading: boolean;
}

export function useShipData(): UseShipDataReturn {
  const [ships, setShips] = useState<Ship[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 嘗試 Pulse API（取最新一天的資料）
        const data = await loadShipsFromApi();
        if (cancelled) return;
        setShips(data.ships);
        setTimeRange({
          start: data.metadata.time_range[0],
          end: data.metadata.time_range[1],
        });
      } catch {
        if (cancelled) return;
        // Fallback: 本地 JSON / S3
        console.warn("[Ship] Pulse API unavailable, falling back to legacy");
        try {
          const data = await loadShipsLegacy();
          if (cancelled) return;
          setShips(data.ships);
          setTimeRange({
            start: data.metadata.time_range[0],
            end: data.metadata.time_range[1],
          });
        } catch (err) {
          console.warn("[Ship] Legacy also failed:", err);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { ships, timeRange, loading };
}
