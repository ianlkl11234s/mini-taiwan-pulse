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
  // 敏感指標不給點密度（2026-11-12 審查決定）：區內隨機點容易被看成個案或死亡地點。
  // 一般財產／暴力犯罪（竊盜、詐欺、強盜、搶奪等）與組織犯罪保留。
  statsHivCasesTownship: { hide: ['dots'] }, // 傳染病個案：HIV
  statsHealthTbNewCasesTownship: { hide: ['dots'] }, // 傳染病個案：結核病新案
  statsCrimeSexualAssaultCasesTownship: { hide: ['dots'] }, // 性侵害：強制性交
  statsCrimeDrugCasesTownship: { hide: ['dots'] }, // 毒品案件（使用者 2026-11-12 決定）：點易被讀成查獲地點
  statsDemographicsTownshipDeaths: { hide: ['dots'] }, // 死亡數
  statsDemographicsTownshipDeathsYtd: { hide: ['dots'] }, // 死亡數（年累計）
  statsMortalityDeathsTownship: { hide: ['dots'] }, // 死因別死亡人數（逐年）
  statsMortalityDeaths5yrTownship: { hide: ['dots'] }, // 死因別死亡人數（5 年合計）
};
