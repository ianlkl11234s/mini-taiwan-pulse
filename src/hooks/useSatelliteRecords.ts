/**
 * 面板用：載入衛星 TLE 並區分 loading／ok／error（loadSatellites 失敗會回 []，無法分辨）
 */
import { useEffect, useState } from "react";
import { loadSatellitesResult } from "../data/satelliteLoader";
import type { SatelliteRecord } from "../data/satelliteTypes";
import type { DataStatus } from "../data/satelliteDataState";

export interface SatelliteRecordsState {
  status: DataStatus;
  records: SatelliteRecord[];
  /** TLE 抓取時間（epoch ms） */
  fetchedAt: number | null;
}

/** enabled=false 時不載入（面板關閉時不要觸發 TLE 抓取） */
export function useSatelliteRecords(enabled = true): SatelliteRecordsState {
  const [state, setState] = useState<SatelliteRecordsState>({ status: "loading", records: [], fetchedAt: null });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadSatellitesResult().then((r) => {
      if (!alive) return;
      setState(r.ok
        ? { status: "ok", records: r.records, fetchedAt: r.fetchedAt }
        : { status: "error", records: [], fetchedAt: null });
    });
    return () => { alive = false; };
  }, [enabled]);
  return state;
}
