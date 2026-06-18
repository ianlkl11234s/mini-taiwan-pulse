import { useEffect, useRef, useState } from "react";
import {
  fetchPowerDashboard,
  invalidatePowerDashboard,
  type PowerDashboard,
} from "../data/energyLoader";

/**
 * 供電儀表板資料源（layer 2 HUD + layer 3 bars 共用）
 *
 * - active=true 時拉一次 + 每 5 min poll（cron 寫入頻率 10 min，5 min poll
 *   保證資料 ≤ 5 min 老舊）
 * - 同時對外提供 `dataRef`（給 CustomLayer 用 getter 拿，每 frame 不會 re-render）
 *   與 `data` state（給 HUD UI 用，re-render 觸發燈號變色）
 */

const POLL_MS = 5 * 60_000;

export function usePowerDashboard(active: boolean) {
  const dataRef = useRef<PowerDashboard | null>(null);
  const [data, setData] = useState<PowerDashboard | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = () => {
      fetchPowerDashboard()
        .then((d) => {
          if (cancelled) return;
          dataRef.current = d;
          setData(d);
        })
        .catch((err) => console.warn("[PowerDashboard] load failed:", err));
    };

    load();
    const t = window.setInterval(() => {
      invalidatePowerDashboard();
      load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [active]);

  return { data, dataRef };
}
