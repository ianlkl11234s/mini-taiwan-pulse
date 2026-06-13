// 衛星圖層共用類型/顏色/標籤（loader/hook/legend/popup 共用）

export type SatelliteCategory = "china_military" | "china_earth_obs" | "taiwan";

export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  china_military: "#ef5350",
  china_earth_obs: "#ff9800",
  taiwan: "#4fc3f7",
};

export const SATELLITE_LABELS: Record<SatelliteCategory, string> = {
  china_military: "中國軍事/偵察",
  china_earth_obs: "中國遙測/地球觀測",
  taiwan: "台灣衛星",
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

/** 中國衛星名稱白名單（CelesTrak active.txt 名稱開頭 regex） */
export const CN_MILITARY_RE = /^(YAOGAN|TJS|TJSW|SHIYAN|SJ-|SHIJIAN|YH-)/i;
export const CN_EARTH_OBS_RE = /^(JILIN|GAOFEN|LUDI TANCE|CSES|HAIYANG|HJ-|HUANJING|ZIYUAN|ZY-|YUNHAI)/i;

/** 台灣衛星 NORAD ID 白名單 */
export const TAIWAN_NORAD_IDS = [
  42920, // FORMOSAT-5
  44349, 44350, 44351, 44352, 44353, 44354, // FORMOSAT-7 ×6
  58191, // TRITON 獵風者
];
