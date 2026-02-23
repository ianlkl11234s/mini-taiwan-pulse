import { useEffect, useState } from "react";
import type { RailData } from "../types";
import { loadAllRail } from "../data/railLoader";

interface UseRailDataReturn {
  railData: RailData | null;
  loading: boolean;
}

export function useRailData(): UseRailDataReturn {
  const [railData, setRailData] = useState<RailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllRail()
      .then((data) => {
        setRailData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Rail data not available:", err);
        setLoading(false);
      });
  }, []);

  return { railData, loading };
}
