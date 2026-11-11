/**
 * City Sound Atlas 色票（零 import 的純常數檔：manifest、地圖 paint、圖例、面板四邊共用）。
 * 資料色（design-system §3.16）：四個來源家族各一色，接收點與連線用中性亮色。
 */
export const SOUND_FAMILY_COLORS = {
  aviation: "#38bdf8",
  rain: "#2dd4bf",
  thunder: "#facc15",
  waste_collection: "#fb923c",
  // MVP-B（W4 建議色，避開黃橙系以免和雷、垃圾車混淆；資料色，design-system §3.16 不進 token）
  // 鐵道原用 #a78bfa，與 COLORS.statusDerived 同值易混淆 → 改 indigo-400（2026-11-11 使用者預設）
  rail: "#818cf8",
  road_traffic: "#f87171",
  roadwork: "#e879f9",
  // W5 自然聲源（ADVANCED_SOURCES §6.2 草案色調亮到 400 階，暗底可辨；資料色，§3.16）
  wind_vegetation: "#a3e635",
  coastal_wave: "#67e8f9",
  river_water: "#3b82f6",
} as const;

/** 接收點標記（白底＋粉紅外框）與「無法判斷」斜線色 */
export const SOUND_RECEIVER_COLOR = "#f472b6";
export const SOUND_UNKNOWN_COLOR = "#94a3b8";

/** 雷閃光、接收點核心底色（中性白） */
export const SOUND_FLASH_COLOR = "#ffffff";
