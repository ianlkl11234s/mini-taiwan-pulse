/**
 * 對一組變軌計算「是否影響台灣」（async）
 *
 * 對每筆變軌：
 *   1. 從 satellite_tle_history 撈 prev/curr TLE pair
 *   2. 兩條 TLE 各跑 7 天 SGP4 數過台次數
 *   3. 兩者差異 != 0 → 影響台灣
 *
 * 結果 cache by `${norad}:${prev_epoch}:${curr_epoch}`，
 * 同一筆變軌不會重算；新筆會 incremental fetch。
 *
 * Map 裡沒有的 norad = 計算中；unavailable = 算不出來（TLE 讀取失敗／缺漏／無法解析），
 * 不進 cache，下次 rows 變動會重試。
 */
import { useEffect, useState } from "react";
import { fetchTlePair } from "../data/satelliteHistoryLoader";
import { countTwPasses, type ManeuverImpact } from "../utils/maneuverImpact";
import type { ManeuverRow } from "../data/satelliteManeuversLoader";

export type ManeuverImpactState =
  | { kind: "ready"; impact: ManeuverImpact }
  | { kind: "unavailable" };

const cache = new Map<string, ManeuverImpact>();

function keyOf(row: ManeuverRow): string {
  return `${row.norad_id}:${row.prev_epoch}:${row.curr_epoch}`;
}

export function useManeuverImpacts(rows: ManeuverRow[]): Map<number, ManeuverImpactState> {
  const [result, setResult] = useState<Map<number, ManeuverImpactState>>(() => {
    const m = new Map<number, ManeuverImpactState>();
    for (const r of rows) {
      const cached = cache.get(keyOf(r));
      if (cached) m.set(r.norad_id, { kind: "ready", impact: cached });
    }
    return m;
  });

  useEffect(() => {
    let alive = true;
    const missing = rows.filter((r) => !cache.has(keyOf(r)));
    if (missing.length === 0) {
      // 全 hit cache — 直接組
      const m = new Map<number, ManeuverImpactState>();
      for (const r of rows) {
        const c = cache.get(keyOf(r));
        if (c) m.set(r.norad_id, { kind: "ready", impact: c });
      }
      setResult(m);
      return;
    }
    // 平行抓 + 算
    Promise.all(
      missing.map(async (r) => {
        const pair = await fetchTlePair(r.norad_id, r.prev_epoch, r.curr_epoch);
        if (pair.error || !pair.prev || !pair.curr) return { row: r, impact: null };
        const anchorMs = new Date(r.curr_fetched_at).getTime();
        const before = countTwPasses(pair.prev, anchorMs);
        const after = countTwPasses(pair.curr, anchorMs);
        if (before == null || after == null) return { row: r, impact: null };
        const impact: ManeuverImpact = {
          passBefore: before,
          passAfter: after,
          passDiff: after - before,
          affectsTw: after - before !== 0,
        };
        cache.set(keyOf(r), impact);
        return { row: r, impact };
      }),
    ).then((results) => {
      if (!alive) return;
      const m = new Map<number, ManeuverImpactState>();
      // 先把 cache 既有的塞進來
      for (const r of rows) {
        const c = cache.get(keyOf(r));
        if (c) m.set(r.norad_id, { kind: "ready", impact: c });
      }
      // 新算的也塞（cache 已 set 過）
      for (const r of results) {
        m.set(r.row.norad_id, r.impact ? { kind: "ready", impact: r.impact } : { kind: "unavailable" });
      }
      setResult(m);
    });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(keyOf).join("|")]);

  return result;
}
