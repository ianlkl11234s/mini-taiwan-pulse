// 衛星圖層共用類型/顏色/標籤（loader/hook/legend/popup 共用）

export type SatelliteCategory =
  | "china_yaogan"   // S 級 — 軍方光學/SAR 偵察
  | "china_jilin"    // S 級 — 商業高解析光學
  | "china_gaofen"   // S 級 — 國家級光學/SAR
  | "china_other"    // 含 TJS（A）/ Beidou（B）/ Shiyan / 餘
  | "taiwan";

export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  china_yaogan: "#ef5350",   // 紅
  china_jilin: "#ff7043",    // 橘紅
  china_gaofen: "#ec407a",   // 紫紅
  china_other: "#9e9e9e",    // 灰
  taiwan: "#4fc3f7",         // 藍
};

export const SATELLITE_LABELS: Record<SatelliteCategory, string> = {
  china_yaogan: "中國 Yaogan 遙感",
  china_jilin: "中國 Jilin 吉林",
  china_gaofen: "中國 Gaofen 高分",
  china_other: "中國其他 (TJS/北斗/Shiyan)",
  taiwan: "台灣 (FORMOSAT/TRITON)",
};

/** Mapbox source / layer id 常量 */
export const SAT_SRC_FOOTPRINT = "sat-footprint-fc";
export const SAT_SRC_TRACK = "sat-track-fc";
export const SAT_SRC_POINT = "sat-point-fc";

export const SAT_LAYER_FOOTPRINT_INNER = "sat-footprint-inner";
export const SAT_LAYER_FOOTPRINT_OUTER = "sat-footprint-outer";
export const SAT_LAYER_TRACK = "sat-track";
export const SAT_LAYER_POINT = "sat-current-point";

/** 衛星實體（loader 產出） */
export interface SatelliteRecord {
  noradId: number;
  name: string;
  category: SatelliteCategory;
  tleLine1: string;
  tleLine2: string;
}

/** 中國衛星名稱前綴 → category */
export const CN_YAOGAN_RE = /^YAOGAN/i;
export const CN_JILIN_RE = /^JILIN/i;
export const CN_GAOFEN_RE = /^GAOFEN/i;

/** 台灣衛星名稱保底（UCS country=null 的新衛星） */
export const TW_NAME_RE = /^(FORMOSAT|TRITON\b)/i;
