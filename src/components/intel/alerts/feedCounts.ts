import type { FeedTab } from "./FeedTabs";

/**
 * 情報面板三處數字（標頭「共 N 則」、分頁角標、警報摘要「N 則警報」）的共同口徑（IN-1／IN-1b）。
 *
 * - 新聞：RANGE（1h／6h／24h）＋播放時間＋類別＋縣市篩選後的則數。
 * - 警報：「現在仍生效」的警報，套嚴重度與群組篩選（不套 RANGE：警報有效期間由發布單位決定，不是發布時間）；
 *   含折疊的「持續中」長效警報。歷史模式改為該日紀錄套同一組嚴重度與群組篩選。
 * - 全球情勢：decision＋RANGE 過濾後的筆數（是否含觀察中跟著該分頁的 toggle）。
 * - 全部：上面三個分頁角標相加，所以一定大於等於任一分頁。折疊的持續中警報在「全部」列表尾端
 *   以可展開的一列呈現（不攤開洗版），但仍算進數字。
 * 標頭數字＝目前分頁的角標，永遠與分頁數字一致。
 */
export interface FeedCountInput {
  news: number;
  /** 警報分頁的則數（含折疊區） */
  alerts: number;
  globalEvents: number;
}

export type FeedCounts = Record<FeedTab, number>;

export function feedCounts(input: FeedCountInput): FeedCounts {
  return {
    all: input.news + input.alerts + input.globalEvents,
    news: input.news,
    alerts: input.alerts,
    globalEvents: input.globalEvents,
  };
}
