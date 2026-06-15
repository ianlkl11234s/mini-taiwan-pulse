/**
 * 共享 hook — 載入近 24h 變軌資料
 *
 * App + SatelliteConsole 都需要這份資料；loader 內部已 2 分 cache，
 * 兩處 mount 不會打兩次 RPC。30s polling。
 */
import { useEffect, useState } from "react";
import { fetchRecentManeuvers, type ManeuverRow } from "../data/satelliteManeuversLoader";

export function useSatelliteManeuvers(enabled: boolean): ManeuverRow[] {
  const [rows, setRows] = useState<ManeuverRow[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    let alive = true;
    const tick = () => {
      fetchRecentManeuvers(24).then((r) => { if (alive) setRows(r); });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled]);

  return rows;
}
