// 衛星圖層共用類型/顏色/標籤（loader/hook/legend/popup 共用）

export type SatelliteCategory =
  // 中國 6 群
  | "china_yaogan"   // S — 軍方光學/SAR 偵察
  | "china_jilin"    // S — 商業高解析光學
  | "china_gaofen"   // S — 國家級光學/SAR
  | "china_tjs"      // A — GEO SIGINT/通訊
  | "china_beidou"   // B — PNT 導航
  | "china_shiyan"   // C — 實踐/試驗/餘
  // 台灣
  | "taiwan"
  // 9 國 LEO 遙測偵察（依國家）
  | "usa"
  | "japan"
  | "russia"
  | "india"
  | "korea"
  | "france"
  | "germany"
  | "italy"
  | "israel";

export const SATELLITE_COLORS: Record<SatelliteCategory, string> = {
  china_yaogan: "#ef5350",   // 紅
  china_jilin: "#ff7043",    // 橘紅
  china_gaofen: "#ec407a",   // 紫紅
  china_tjs: "#ba68c8",      // 紫
  china_beidou: "#5e7ce2",   // 北斗藍（深）
  china_shiyan: "#9e9e9e",   // 灰
  taiwan: "#4fc3f7",         // 台灣藍
  // 9 國（國旗 inspired）
  usa: "#93c5fd",            // 美國淺藍
  japan: "#fb7185",          // 日本玫紅
  russia: "#a8a29e",         // 俄羅斯橄欖灰
  india: "#f59e0b",          // 印度橙黃（藏紅）
  korea: "#2dd4bf",          // 韓國青綠
  france: "#3b82f6",         // 法國深藍
  germany: "#fde047",        // 德國金黃
  italy: "#34d399",          // 義大利翠綠
  israel: "#c4b5fd",         // 以色列淺紫
};

export const SATELLITE_LABELS: Record<SatelliteCategory, string> = {
  china_yaogan: "中國 Yaogan 遙感",
  china_jilin: "中國 Jilin 吉林",
  china_gaofen: "中國 Gaofen 高分",
  china_tjs: "TJS / TJSW GEO 情報",
  china_beidou: "Beidou 北斗",
  china_shiyan: "Shiyan 實踐 / 其他",
  taiwan: "台灣 (FORMOSAT/TRITON)",
  usa: "🇺🇸 美國偵察",
  japan: "🇯🇵 日本 IGS",
  russia: "🇷🇺 俄羅斯偵察",
  india: "🇮🇳 印度遙測",
  korea: "🇰🇷 韓國 KOMPSAT",
  france: "🇫🇷 法國 CSO/PLEIADES",
  germany: "🇩🇪 德國 SAR-Lupe",
  italy: "🇮🇹 義大利 COSMO-SkyMed",
  israel: "🇮🇱 以色列 Ofeq",
};

/** 國旗 emoji — UI chip 用 */
export const SATELLITE_FLAG: Partial<Record<SatelliteCategory, string>> = {
  china_yaogan: "🇨🇳", china_jilin: "🇨🇳", china_gaofen: "🇨🇳",
  china_tjs: "🇨🇳", china_beidou: "🇨🇳", china_shiyan: "🇨🇳",
  taiwan: "🇹🇼",
  usa: "🇺🇸", japan: "🇯🇵", russia: "🇷🇺", india: "🇮🇳", korea: "🇰🇷",
  france: "🇫🇷", germany: "🇩🇪", italy: "🇮🇹", israel: "🇮🇱",
};

/** 6 群分層 tier — UI 用來排序與標 tier chip */
export type SatelliteTier = "S" | "A" | "B" | "C";
export const SATELLITE_TIER: Record<SatelliteCategory, SatelliteTier> = {
  china_yaogan: "S", china_jilin: "S", china_gaofen: "S",
  china_tjs: "A", china_beidou: "B", china_shiyan: "C",
  taiwan: "S",
  // 9 國默認 A（友邦 / 對立國）
  usa: "S", japan: "S", russia: "S", korea: "A",
  france: "A", germany: "A", italy: "A", israel: "A", india: "B",
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
  usa: "satellitesUSA",
  japan: "satellitesJapan",
  russia: "satellitesRussia",
  india: "satellitesIndia",
  korea: "satellitesKorea",
  france: "satellitesFrance",
  germany: "satellitesGermany",
  italy: "satellitesItaly",
  israel: "satellitesIsrael",
};

/** RPC cn_group 字串 → category mapping（給 §A 變軌警報用） */
export const GROUP_KEY_TO_CATEGORY: Record<string, SatelliteCategory | "other"> = {
  YAOGAN: "china_yaogan",
  JILIN: "china_jilin",
  GAOFEN: "china_gaofen",
  TJS: "china_tjs",
  BEIDOU: "china_beidou",
  SHIYAN: "china_shiyan",
  TAIWAN: "taiwan",
  USA: "usa",
  JAPAN: "japan",
  RUSSIA: "russia",
  INDIA: "india",
  KOREA: "korea",
  FRANCE: "france",
  GERMANY: "germany",
  ITALY: "italy",
  ISRAEL: "israel",
  OTHER: "other",
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

/** 9 國 LEO 遙測偵察 — 名稱 regex 保底 */
export const JP_NAME_RE = /^(IGS-OPTICAL|IGS-RADAR|IGS\b|ALOS)/i;
export const RU_NAME_RE = /^(PERSONA|RESURS|KANOPUS|LOTOS|RAZBEG|BARS-)/i;
export const IN_NAME_RE = /^(CARTOSAT|RISAT|EOS-|EMISAT|HYSIS|RESOURCESAT|INS-)/i;
export const FR_NAME_RE = /^(CSO|PLEIADES|PLÉIADES|ELISA|CERES|HELIOS|BRO-)/i;
export const DE_NAME_RE = /^(SAR-LUPE|SARAH|TERRASAR|TANDEM|BIROS|BIRD|ENMAP)/i;
export const IL_NAME_RE = /^(OFEQ|EROS)/i;
export const KR_NAME_RE = /^KOMPSAT/i;
export const IT_NAME_RE = /^COSMO-SKYMED/i;

/** 依 (country, name) 判分群 — 用 country 為主、名稱保底 */
export function classifyByCountryName(country: string | null, name: string): SatelliteCategory | null {
  // 中國：先依名稱再依 country
  if (CN_YAOGAN_RE.test(name)) return "china_yaogan";
  if (CN_JILIN_RE.test(name)) return "china_jilin";
  if (CN_GAOFEN_RE.test(name)) return "china_gaofen";
  if (CN_TJS_RE.test(name)) return "china_tjs";
  if (CN_BEIDOU_RE.test(name)) return "china_beidou";
  if (CN_SHIYAN_RE.test(name)) return "china_shiyan";
  if (country === "China") return "china_shiyan";
  // 台灣
  if (country === "Taiwan" || TW_NAME_RE.test(name)) return "taiwan";
  // 9 國（依 country）
  if (country === "USA" || /^(USA-|KH-|LACROSSE|ONYX|WORLDVIEW|SKYSAT|BLACKSKY|PLANET\b)/i.test(name)) return "usa";
  if (country === "Japan" || JP_NAME_RE.test(name)) return "japan";
  if (country === "Russia" || RU_NAME_RE.test(name)) return "russia";
  if (country === "India" || IN_NAME_RE.test(name)) return "india";
  if (country === "South Korea" || KR_NAME_RE.test(name)) return "korea";
  if (country === "France" || FR_NAME_RE.test(name)) return "france";
  if (country === "Germany" || DE_NAME_RE.test(name)) return "germany";
  if (country === "Italy" || IT_NAME_RE.test(name)) return "italy";
  if (country === "Israel" || IL_NAME_RE.test(name)) return "israel";
  return null;
}

/** 用名稱判分群（cn_other 全部走這支重新分流到 6 群） */
export function classifyChinaSatByName(name: string): SatelliteCategory {
  if (CN_YAOGAN_RE.test(name)) return "china_yaogan";
  if (CN_JILIN_RE.test(name)) return "china_jilin";
  if (CN_GAOFEN_RE.test(name)) return "china_gaofen";
  if (CN_TJS_RE.test(name)) return "china_tjs";
  if (CN_BEIDOU_RE.test(name)) return "china_beidou";
  return "china_shiyan"; // C 級 catch-all（含 Shiyan/Shijian/Lingque/餘）
}
