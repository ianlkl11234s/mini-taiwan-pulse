/**
 * City Sound Atlas 色票（零 import 的純常數檔：manifest、地圖 paint、圖例、面板四邊共用）。
 * 資料色（design-system §3.16）：四個來源家族各一色，接收點與連線用中性亮色。
 */
export const SOUND_FAMILY_COLORS = {
  aviation: "#38bdf8",
  rain: "#2dd4bf",
  thunder: "#facc15",
  waste_collection: "#fb923c",
} as const;

/** 接收點標記（白底＋粉紅外框）與「無法判斷」斜線色 */
export const SOUND_RECEIVER_COLOR = "#f472b6";
export const SOUND_UNKNOWN_COLOR = "#94a3b8";

/** 雷閃光、接收點核心底色（中性白） */
export const SOUND_FLASH_COLOR = "#ffffff";
