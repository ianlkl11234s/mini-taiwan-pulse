// 衛星圖層共用類型/顏色/標籤（loader/hook/legend/popup 共用）

export type SatelliteCategory =
  | "china_yaogan"   // S — 軍方光學/SAR 偵察
  | "china_jilin"    // S — 商業高解析光學
  | "china_gaofen"   // S — 國家級光學/SAR
  | "china_tjs"      // A — GEO SIGINT/通訊
  | "china_beidou"   // B — PNT 導航
  | "china_shiyan"   // C — 實踐/試驗/餘
  | "taiwan";

export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  china_yaogan: "#ef5350",   // 紅
  china_jilin: "#ff7043",    // 橘紅
  china_gaofen: "#ec407a",   // 紫紅
  china_tjs: "#ba68c8",      // 紫
  china_beidou: "#4fc3f7",   // 北斗藍
  china_shiyan: "#9e9e9e",   // 灰
  taiwan: "#4fc3f7",         // 台灣藍（與 beidou 同色但靠 group 分流不衝突）
};

export const SATELLITE_LABELS: Record<SatelliteCategory, string> = {
  china_yaogan: "中國 Yaogan 遙感",
  china_jilin: "中國 Jilin 吉林",
  china_gaofen: "中國 Gaofen 高分",
  china_tjs: "TJS / TJSW GEO 情報",
  china_beidou: "Beidou 北斗",
  china_shiyan: "Shiyan 實踐 / 其他",
  taiwan: "台灣 (FORMOSAT/TRITON)",
};

/** 6 群分層 tier — UI 用來排序與標 tier chip */
export type SatelliteTier = "S" | "A" | "B" | "C";
export const SATELLITE_TIER: Record<SatelliteCategory, SatelliteTier> = {
  china_yaogan: "S",
  china_jilin: "S",
  china_gaofen: "S",
  china_tjs: "A",
  china_beidou: "B",
  china_shiyan: "C",
  taiwan: "S",
};

/** 對應 LayerVisibility key — UI toggle 用 */
export const SATELLITE_LAYER_KEY: Record<SatelliteCategory, string> = {
  china_yaogan: "satellitesYaogan",
  china_jilin: "satellitesJilin",
  china_gaofen: "satellitesGaofen",
  china_tjs: "satellitesTJS",
  china_beidou: "satellitesBeidou",
  china_shiyan: "satellitesShiyan",
  taiwan: "satellitesTaiwan",
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
export const CN_TJS_RE = /^TJS/i;
export const CN_BEIDOU_RE = /^(BEIDOU|BD-)/i;
export const CN_SHIYAN_RE = /^(SHIYAN|SHIJIAN|TIANTUO|TANSUO|LING\b)/i;

/** 台灣衛星名稱保底（UCS country=null 的新衛星） */
export const TW_NAME_RE = /^(FORMOSAT|TRITON\b|YUSHAN\b|IRIS-)/i;

/** 用名稱判分群（cn_other 全部走這支重新分流到 6 群） */
export function classifyChinaSatByName(name: string): SatelliteCategory {
  if (CN_YAOGAN_RE.test(name)) return "china_yaogan";
  if (CN_JILIN_RE.test(name)) return "china_jilin";
  if (CN_GAOFEN_RE.test(name)) return "china_gaofen";
  if (CN_TJS_RE.test(name)) return "china_tjs";
  if (CN_BEIDOU_RE.test(name)) return "china_beidou";
  return "china_shiyan"; // C 級 catch-all（含 Shiyan/Shijian/Lingque/餘）
}
