// 各長期圖層的時間條資料接線（STANDARD.md §1）。類別的畫法在 LongTermBar 依 kind 分派；
// 這裡只放「這層的件數從哪來、讀取失敗怎麼重試」。新增一層：在這裡加一筆，
// 並把 key 加進 data/longTermLayers.ts 的 LONG_TERM_BAR_ADAPTERS。
import { retryFireEventSeries, useFireEventSeries, type EventSeries } from "../../data/fireEventSeries";

export interface EventSeriesAdapter {
  kind: "event";
  useSeries: (enabled: boolean) => EventSeries;
  retry: () => void;
}

export type LongTermAdapter = EventSeriesAdapter;

export const LONG_TERM_ADAPTERS: Readonly<Record<string, LongTermAdapter>> = {
  fireEvents: { kind: "event", useSeries: useFireEventSeries, retry: retryFireEventSeries },
};
