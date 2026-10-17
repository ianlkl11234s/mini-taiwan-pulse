// 颱風兩層（typhoonTracks／typhoonAgencyForecasts）的來源、出典與色彩 SSOT。
// loader／hook／popup／圖例共用，避免三邊各自 inline（development-rules §4 #4）。

/** typhoonTracks 的觀測來源（public.typhoon_positions.source） */
export type TyphoonTrackSource = "jma" | "jtwc" | "cwa";

/** 出典（機關原名）；popup「出典」列與圖例共用 */
export const TYPHOON_SOURCE_ORG: Readonly<Record<TyphoonTrackSource, string>> = {
  cwa: "交通部中央氣象署",
  jma: "気象庁",
  jtwc: "JTWC",
};

/** 最大風速平均口徑：CWA／JMA 10 分鐘平均、JTWC 1 分鐘平均（偏高 12–15%） */
export const TYPHOON_WIND_AVERAGING: Readonly<Record<TyphoonTrackSource, "10min" | "1min">> = {
  cwa: "10min",
  jma: "10min",
  jtwc: "1min",
};

/** 7 級風圈（15 m/s）黃、10 級風圈（25 m/s）紅 —— 與氣象署颱風警報圖同語意；地圖、圖例、popup 共用 */
export const TYPHOON_GALE_COLOR = "#facc15";
export const TYPHOON_STORM_COLOR = "#ef4444";

// ── NCDR 各國颱風預報（public.typhoon_agency_forecasts，mig 476） ──────────

export type TyphoonAgency = "jtwc" | "jma" | "nmc" | "cwa" | "kma";

/** 圖例與地圖的固定順序 */
export const TYPHOON_AGENCIES: readonly TyphoonAgency[] = ["cwa", "jma", "jtwc", "nmc", "kma"];

/**
 * 五家各一色。避開 typhoonTracks 的觀測紫 #a855f7／預報藍 #38bdf8 與風圈黃紅，
 * 兩層同開時不混淆。
 */
export const TYPHOON_AGENCY_COLORS: Readonly<Record<TyphoonAgency, string>> = {
  cwa: "#22c55e",
  jma: "#f97316",
  jtwc: "#e11d48",
  nmc: "#eab308",
  kma: "#3b82f6",
};

/** 機構短名（中文介面）；英日文走 i18n enum `typhoonAgency` */
export const TYPHOON_AGENCY_LABELS: Readonly<Record<TyphoonAgency, string>> = {
  cwa: "台灣 CWA",
  jma: "日本 JMA",
  jtwc: "美軍 JTWC",
  nmc: "中國 NMC",
  kma: "韓國 KMA",
};

export const TYPHOON_AGENCY_ORG = "國家災害防救科技中心（NCDR）";

export function isTyphoonAgency(v: unknown): v is TyphoonAgency {
  return typeof v === "string" && (TYPHOON_AGENCIES as readonly string[]).includes(v);
}
