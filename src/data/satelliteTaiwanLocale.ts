/**
 * 台灣 15 顆衛星中文化 / 用途短描 / 中文簡稱
 *
 * 為什麼 hardcode？
 * - UCS catalog 沒有「中文名」「中文用途」欄位
 * - 全 15 顆是固定清單（TASA 名冊穩定）
 * - 與 collector 資料無關，純 i18n / 標籤層
 *
 * 不在 DB 是因為這是 UI label，跨環境共用、改動風險低；
 * 若日後 TASA 多發射，仍是 commit 一次更新一行即可。
 */

export interface TaiwanSatLocale {
  zh: string;          // 福衛 8 號 A
  use: string;         // 光學遙測 / 氣象掩星 / GNSS-R 海風 / 通訊實驗 / AIS 船舶
  tier: "core" | "research" | "legacy"; // 現役主力 / 學研 / 超齡服役
  launch: string;      // YYYY-MM（給 §C 依發射日 DESC 排序用）
}

/** key = NORAD ID */
export const TAIWAN_SAT_LOCALE: Record<number, TaiwanSatLocale> = {
  // FORMOSAT-3 6 顆（2006 發射，~20 yr，已超齡）
  29047: { zh: "福衛 3 號 1", use: "氣象掩星", tier: "legacy", launch: "2006-04" },
  29048: { zh: "福衛 3 號 2", use: "氣象掩星", tier: "legacy", launch: "2006-04" },
  29050: { zh: "福衛 3 號 4", use: "氣象掩星", tier: "legacy", launch: "2006-04" },
  29051: { zh: "福衛 3 號 5", use: "氣象掩星", tier: "legacy", launch: "2006-04" },
  29052: { zh: "福衛 3 號 6", use: "氣象掩星", tier: "legacy", launch: "2006-04" },
  // FORMOSAT-5（2017）
  42920: { zh: "福衛 5 號", use: "光學遙測", tier: "core", launch: "2017-08" },
  // FORMOSAT-7（2019, 6 顆）
  44345: { zh: "福衛 7 號 1", use: "氣象掩星", tier: "core", launch: "2019-06" },
  44346: { zh: "福衛 7 號 2", use: "氣象掩星", tier: "core", launch: "2019-06" },
  44347: { zh: "福衛 7 號 3", use: "氣象掩星", tier: "core", launch: "2019-06" },
  44348: { zh: "福衛 7 號 4", use: "氣象掩星", tier: "core", launch: "2019-06" },
  44349: { zh: "福衛 7 號 5", use: "氣象掩星", tier: "core", launch: "2019-06" },
  44350: { zh: "福衛 7 號 6", use: "氣象掩星", tier: "core", launch: "2019-06" },
  // IRIS-A 飛鼠（2021）
  47963: { zh: "飛鼠", use: "通訊實驗", tier: "research", launch: "2021-01" },
  // TRITON 獵風者（2023-10）
  57803: { zh: "獵風者", use: "GNSS-R 海風", tier: "core", launch: "2023-10" },
  // YUSHAN 玉山（2023-04, NSPO 學研）
  58400: { zh: "玉山", use: "AIS 船舶", tier: "research", launch: "2023-04" },
  // IRIS-C 立方衛星 C（2024）
  59002: { zh: "立方衛星 C", use: "通訊實驗", tier: "research", launch: "2024-04" },
  // FORMOSAT-8A（2025-10）
  61045: { zh: "福衛 8A", use: "光學遙測", tier: "core", launch: "2025-10" },
  61046: { zh: "福衛 8B", use: "光學遙測", tier: "core", launch: "2025-10" },
  // FORMOSAT-8A 用於本專案 prod 環境的實際 NORAD = 66666（catalog fallback）
  66666: { zh: "福衛 8A", use: "光學遙測", tier: "core", launch: "2025-10" },
};

/** 給 §C TWFleetSection 用：拿不到 locale 就 fallback 顯示 UCS name */
export function localeForTaiwanSat(norad: number): TaiwanSatLocale | null {
  return TAIWAN_SAT_LOCALE[norad] ?? null;
}
