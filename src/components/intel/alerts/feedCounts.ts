import type { FeedTab } from "./FeedTabs";

/**
 * 情報面板三處數字（標頭「共 N 則」、分頁角標、警報摘要「N 則警報」）的共同口徑（IN-1）。
 *
 * - 新聞：RANGE（1h／6h／24h）＋播放時間＋類別＋縣市篩選後的則數。
 * - 警報：「現在仍生效」的警報，套嚴重度與群組篩選（不套 RANGE：警報有效期間由發布單位決定，不是發布時間）；
 *   含折疊的「持續中」長效警報。歷史模式改為該日紀錄套同一組嚴重度與群組篩選。
 * - 全球情勢：decision＋RANGE 過濾後的筆數。
 * - 全部：新聞＋沒被折疊的警報＋已研究／keep_core 的全球事件（長效警報與觀察中事件不進「全部」時間軸）。
 * 標頭數字＝目前分頁的角標，永遠與分頁數字一致。
 */
export interface FeedCountInput {
  news: number;
  /** 警報分頁的則數（含折疊區） */
  alerts: number;
  /** 其中沒被折疊、會出現在「全部」的則數 */
  alertsInAll: number;
  globalEvents: number;
  globalInAll: number;
}

export type FeedCounts = Record<FeedTab, number>;

export function feedCounts(input: FeedCountInput): FeedCounts {
  return {
    all: input.news + input.alertsInAll + input.globalInAll,
    news: input.news,
    alerts: input.alerts,
    globalEvents: input.globalEvents,
  };
}
