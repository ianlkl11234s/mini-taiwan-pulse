/**
 * 共享 hook — 載入近 24h 變軌資料（單一來源）
 *
 * App 持有這份狀態並傳給 SatelliteConsole；面板不再自己輪詢。
 * 30s polling，loader 內部有 2 分 cache。回傳含 loading／error 狀態，
 * 讀取失敗不再偽裝成「無變軌」。
 */
import { useEffect, useState } from "react";
import { fetchRecentManeuvers } from "../data/satelliteManeuversLoader";
import { MANEUVERS_INITIAL, reduceManeuversResult, type ManeuversState } from "../data/satelliteDataState";

export function useSatelliteManeuvers(enabled: boolean): ManeuversState {
  const [state, setState] = useState<ManeuversState>(MANEUVERS_INITIAL);

  useEffect(() => {
    if (!enabled) {
      setState(MANEUVERS_INITIAL);
      return;
    }
    let alive = true;
    const tick = () => {
      fetchRecentManeuvers(24).then((res) => {
        if (alive) setState((prev) => reduceManeuversResult(prev, res));
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled]);

  return state;
}
