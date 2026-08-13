/**
 * 警報「持續性」規則表 —— 按群組分開設規則（owner 2026-08-13 拍板）
 * ══════════════════════════════════════════════════════════════════
 *
 * 問題：`get_active_alerts` 的 active 判準是 `expires > now()`，對**長效期**告警過寬。
 * 2026-08-13 打線上 RPC 實測（78 筆 active）的「距發佈時數」分佈：
 *
 *   | group      | n  | p50    | max     | >48h | >72h |
 *   |------------|----|--------|---------|------|------|
 *   | earthquake |  2 |  13.4h |   13.4h |   0  |   0  |
 *   | weather    |  3 |   6.1h |   16.5h |   0  |   0  |
 *   | flood      |  3 |   1.4h |    2.4h |   0  |   0  |
 *   | transit    |  0 |      – |       – |   0  |   0  |
 *   | lifeline   | 45 |  19.2h |  186.2h |   8  |   5  |
 *   | safety     | 25 | 729.7h | 2073.7h |  24  |  24  |
 *
 * safety 的 25 筆裡 23 筆是「海洋污染」（expires 落在 5～83 天後），另有「國家森林
 * 遊樂區休園」expires 到 2027 —— 它們把列表長期卡在數十筆，也讓 severity 高的舊項
 * 在地圖上會**全年 pulse**。
 *
 * 規則：**單一 `foldAfterH` 門檻，同時管三件事** ——
 *   1. 側邊列表：超過門檻的折進「持續中」區（收合，不再佔主列表）
 *   2. 地圖 B2 pulse：超過門檻的不 pulse（避免常駐噪音）
 *   3. 壓力指數：超過門檻的降權（SQL 提案見 docs/proposal/，未 apply）
 *
 * `foldAfterH: null` = **維持原樣、永不折疊**。這是刻意的語意編碼，不是「門檻很大」：
 * NCDR collector 是 UPSERT by identifier，颱風／海嘯這種同一 identifier 連掛數日的
 * 告警 `sent` 會停在首發時刻，任何 age 門檻都會在事件**進行中**把它藏起來。
 */

import type { AlertGroupShort } from "../components/intel/intelTokens";
import type { AlertGroupKey } from "./disasterAlertTypes";

export interface AlertPersistenceRule {
  /**
   * 超過這個時數（自 sent 起算）視為「長期持續」。
   * null = 維持原樣（短時效群組，永不折疊）。
   */
  foldAfterH: number | null;
  /** 折疊區標頭用字（null 群組不會用到） */
  staleLabel: string;
  /** 為什麼是這個值 —— 寫進 UI tooltip，也是 code review 的依據 */
  rationale: string;
}

export const ALERT_PERSISTENCE_RULES: Record<AlertGroupShort, AlertPersistenceRule> = {
  earthquake: {
    foldAfterH: null,
    staleLabel: "持續中",
    rationale: "RPC 只回 24h 內事件、expires = occurred+12h，來源已自帶時效，不再加門檻",
  },
  weather: {
    foldAfterH: null,
    staleLabel: "持續中",
    rationale: "颱風／海嘯同一 identifier 可連掛數日且 sent 停在首發，折疊會在事件進行中把它藏起來",
  },
  flood: {
    foldAfterH: null,
    staleLabel: "持續中",
    rationale: "水庫放流／河川高水位實測 age 全在 3h 內，本來就短命，不需要門檻",
  },
  transit: {
    foldAfterH: null,
    staleLabel: "持續中",
    rationale: "道路封閉／鐵路事故是事件型，解除即 expire，不需要門檻",
  },
  lifeline: {
    foldAfterH: 72,
    staleLabel: "長期停水／停電",
    rationale: "停水多為預告型工程公告（實測 45 筆 p50 19h、p90 113h）；3 天前發的已是背景資訊，折 5/45",
  },
  safety: {
    foldAfterH: 48,
    staleLabel: "長期環境事件",
    rationale: "海洋污染 expires 常在 2～9 個月後（實測 23 筆 age 全 >200h）；48h 恰好把火災（18.7h）留在主列表、把污染與休園折起來，折 24/25",
  },
};

/** 地圖圖層 group key（disasterAlertTypes）→ 警訊 group 短形（intelTokens） */
export const MAP_GROUP_TO_SHORT: Record<AlertGroupKey, AlertGroupShort> = {
  lifelineAlerts: "lifeline",
  floodAlerts: "flood",
  weatherAlerts: "weather",
  transitAlerts: "transit",
  safetyAlerts: "safety",
};

/**
 * 這筆警報還算「新鮮」嗎（= 不該被折疊／該保留 pulse）
 *
 * @param group    警訊 group 短形
 * @param sentTs   發佈時間（unix 秒）
 * @param nowTs    比較基準（unix 秒；地圖走 timeline 時間，側欄走 wall clock）
 */
export function isAlertFresh(
  group: AlertGroupShort,
  sentTs: number,
  nowTs: number,
): boolean {
  const rule = ALERT_PERSISTENCE_RULES[group];
  if (!rule || rule.foldAfterH == null) return true;
  if (!Number.isFinite(sentTs) || sentTs <= 0) return true; // 無發佈時間 → 不折（寧可多顯示）
  return nowTs - sentTs <= rule.foldAfterH * 3600;
}

/** 同上，但吃地圖圖層的 group key */
export function isMapAlertFresh(
  group: AlertGroupKey,
  sentTs: number,
  nowTs: number,
): boolean {
  return isAlertFresh(MAP_GROUP_TO_SHORT[group], sentTs, nowTs);
}

/** 依規則把清單切成「主列表」與「持續中」兩堆（順序保持原樣） */
export function partitionByPersistence<T extends { group: AlertGroupShort; sent_ts: number }>(
  rows: T[],
  nowTs: number,
): { fresh: T[]; stale: T[] } {
  const fresh: T[] = [];
  const stale: T[] = [];
  for (const r of rows) {
    (isAlertFresh(r.group, r.sent_ts, nowTs) ? fresh : stale).push(r);
  }
  return { fresh, stale };
}
