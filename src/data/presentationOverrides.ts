/**
 * 統計圖層「呈現方式」站主逐層覆寫（設計提案 Q-B 方案 1）。
 *
 * 可選清單由 `statisticsPresentation.ts` 依 recipe 的單位／aggregation 自動推導、預設一律面量圖；
 * 這裡只寫例外：
 *   - `default`：這一層預設改用哪一種（必須在推導出的可選清單內，否則忽略）。
 *   - `hide`：不給哪幾種（推導規則猜錯、或資料特性不適合時）。
 *
 * 改這份檔要發版才生效；每一列寫理由。
 */
import type { StatisticsPresentationMode } from './statisticsPresentation';

export interface PresentationOverride {
  default?: StatisticsPresentationMode;
  hide?: readonly StatisticsPresentationMode[];
}

export const PRESENTATION_OVERRIDES: Readonly<Record<string, PresentationOverride>> = {
  // 「公告列數（未去重）」是同一地號重複公告的列數，不是可比較的量；圓的大小會被讀成「標的多寡」（去重版仍可切）。
  statsTaisugarAnnouncedListings: { hide: ['circle'] },
};
