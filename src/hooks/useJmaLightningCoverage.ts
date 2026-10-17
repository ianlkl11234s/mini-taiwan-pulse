import { useEffect } from "react";
import { timeStore } from "../state/timeStore";
import { fetchJmaTimeCoverage, jmaCoverageGate, JMA_LIVE_THRESHOLD_SEC, setJmaLiveStatus } from "../data/jmaLiveLoaders";

/**
 * 日本落雷（jmaLightning）的涵蓋狀態：資料本身沿用台灣落雷 hook（useLightningLayer source='jma'）。
 * DB 熱層只留 7 天：時間軸早於最早一筆 → 圖例「未涵蓋」（地圖本來就會是空的，不能讓人讀成「沒打雷」）。
 * 涵蓋期內 0 筆＝真的沒有落雷。last_record_at 給圖例看 collector 是否還活著。
 */
export function useJmaLightningCoverage(visible: boolean) {
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let last = "";
    const run = (tSec: number) => {
      fetchJmaTimeCoverage()
        .catch(() => new Map())
        .then((cov) => {
          if (cancelled) return;
          const c = cov.get("lightning");
          const nowSec = Date.now() / 1000;
          const gate = jmaCoverageGate(c, tSec, nowSec);
          const mode = Math.abs(nowSec - tSec) > JMA_LIVE_THRESHOLD_SEC ? "history" : "live";
          const sig = `${gate}|${mode}|${c?.lastRecordAt ?? ""}`;
          if (sig === last) return;
          last = sig;
          setJmaLiveStatus("jmaLightning", gate === "ok"
            ? { state: "ok", mode, loadedAt: Date.now(), latestAt: c?.lastRecordAt ?? null, coverageFrom: c?.fromIso ?? null, rows: 1 }
            : { state: "uncovered", uncovered: gate, mode, loadedAt: Date.now(), coverageFrom: c?.fromIso ?? null, rows: 0 });
        });
    };
    run(timeStore.getTime());
    const unsub = timeStore.subscribeThrottled(1000, run);
    return () => { cancelled = true; unsub(); };
  }, [visible]);
}
