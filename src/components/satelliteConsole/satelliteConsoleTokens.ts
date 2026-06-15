/**
 * Satellite Console — token / 樣式常數
 *
 * 大部分沿用 IntelPanel 的 token（一致性鐵則），衛星專屬色號額外定義。
 */
export {
  FONT_CJK,
  FONT_DATA,
  COLORS,
  clockTime,
  fmtCountdown,
} from "../intel/intelTokens";

import { COLORS } from "../intel/intelTokens";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";

/** 變軌 4 類型對應的視覺 token */
export const MANEUVER_TOKEN = {
  PLANE_CHANGE: {
    icon: "↻",
    label: "PLANE_CHANGE",
    zh: "軌道面變化",
    color: COLORS.statusErr,
    soft: "rgba(239,68,68,0.16)",
    pulse: true,
  },
  ALTITUDE_CHANGE: {
    icon: "⬆",
    label: "ALTITUDE_CHANGE",
    zh: "高度變化",
    color: COLORS.statusWarn,
    soft: "rgba(255,152,0,0.16)",
    pulse: false,
  },
  SHAPE_CHANGE: {
    icon: "◓",
    label: "SHAPE_CHANGE",
    zh: "離心率變化",
    color: "#facc15",
    soft: "rgba(250,204,21,0.16)",
    pulse: false,
  },
} as const;

/** §B 中國 6 群 metadata */
export const CN_GROUPS_META = [
  { key: "china_yaogan", label: "Yaogan 遙感",       layerKey: "satellitesYaogan",  tier: "S", color: SATELLITE_COLORS.china_yaogan,  defaultOn: true },
  { key: "china_jilin",  label: "Jilin-1 吉林",      layerKey: "satellitesJilin",   tier: "S", color: SATELLITE_COLORS.china_jilin,   defaultOn: true },
  { key: "china_gaofen", label: "Gaofen 高分",        layerKey: "satellitesGaofen",  tier: "S", color: SATELLITE_COLORS.china_gaofen,  defaultOn: true },
  { key: "china_tjs",    label: "TJS / TJSW GEO 情報", layerKey: "satellitesTJS",     tier: "A", color: SATELLITE_COLORS.china_tjs,     defaultOn: true },
  { key: "china_beidou", label: "Beidou 北斗",        layerKey: "satellitesBeidou",  tier: "B", color: SATELLITE_COLORS.china_beidou,  defaultOn: false },
  { key: "china_shiyan", label: "Shiyan 實踐 / 其他", layerKey: "satellitesShiyan",  tier: "C", color: SATELLITE_COLORS.china_shiyan,  defaultOn: false },
] as const;

/** §B2 9 國 LEO 遙測 metadata（依 tier 排序） */
export const INTL_GROUPS_META = [
  { key: "usa",     label: "🇺🇸 USA",          layerKey: "satellitesUSA",     tier: "S", color: SATELLITE_COLORS.usa,     defaultOn: false },
  { key: "japan",   label: "🇯🇵 Japan IGS",    layerKey: "satellitesJapan",   tier: "S", color: SATELLITE_COLORS.japan,   defaultOn: false },
  { key: "russia",  label: "🇷🇺 Russia",       layerKey: "satellitesRussia",  tier: "S", color: SATELLITE_COLORS.russia,  defaultOn: false },
  { key: "korea",   label: "🇰🇷 Korea KOMPSAT",layerKey: "satellitesKorea",   tier: "A", color: SATELLITE_COLORS.korea,   defaultOn: false },
  { key: "france",  label: "🇫🇷 France CSO/PLEIADES", layerKey: "satellitesFrance",  tier: "A", color: SATELLITE_COLORS.france,  defaultOn: false },
  { key: "germany", label: "🇩🇪 Germany SAR-Lupe",    layerKey: "satellitesGermany", tier: "A", color: SATELLITE_COLORS.germany, defaultOn: false },
  { key: "italy",   label: "🇮🇹 Italy COSMO-SkyMed",  layerKey: "satellitesItaly",   tier: "A", color: SATELLITE_COLORS.italy,   defaultOn: false },
  { key: "israel",  label: "🇮🇱 Israel Ofeq",         layerKey: "satellitesIsrael",  tier: "A", color: SATELLITE_COLORS.israel,  defaultOn: false },
  { key: "india",   label: "🇮🇳 India CARTOSAT/RISAT",layerKey: "satellitesIndia",   tier: "B", color: SATELLITE_COLORS.india,   defaultOn: false },
] as const;

/** RPC cn_group 字串 → category（給 ManeuverRow.cn_group 用） */
export const CN_GROUP_TO_CATEGORY: Record<string, string> = {
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
  OTHER: "china_shiyan", // catch-all 進 C 群
};

/** group key → 國旗 emoji（給 ManeuverAlert chip 用） */
export const GROUP_FLAG: Record<string, string> = {
  YAOGAN: "🇨🇳", JILIN: "🇨🇳", GAOFEN: "🇨🇳",
  TJS: "🇨🇳", BEIDOU: "🇨🇳", SHIYAN: "🇨🇳",
  TAIWAN: "🇹🇼",
  USA: "🇺🇸", JAPAN: "🇯🇵", RUSSIA: "🇷🇺",
  INDIA: "🇮🇳", KOREA: "🇰🇷",
  FRANCE: "🇫🇷", GERMANY: "🇩🇪", ITALY: "🇮🇹", ISRAEL: "🇮🇱",
  OTHER: "🌐",
};

/** Panel 寬度（左 docked，與 IntelPanel 412 對齊） */
export const PANEL_WIDTH = 412;
