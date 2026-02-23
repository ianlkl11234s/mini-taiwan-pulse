import { useEffect, useState } from "react";
import type { Ship } from "../types";
import { loadShips } from "../data/shipLoader";

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
    loadShips()
      .then((data) => {
        setShips(data.ships);
        setTimeRange({
          start: data.metadata.time_range[0],
          end: data.metadata.time_range[1],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Ship data not available:", err);
        setLoading(false);
      });
  }, []);

  return { ships, timeRange, loading };
}
