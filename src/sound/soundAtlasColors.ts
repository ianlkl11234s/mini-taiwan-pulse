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

/**
 * W6-1 雨網格五級（資料色，§3.16）：0 無雨＝淡中性色（看得出「已判斷、沒雨」，和範圍外的透明區分），
 * 1–4 由淺藍到洋紅，越強越深越飽和；暗底、亮底都要辨識得出（洋紅在兩種底圖都不會和底色混）。
 * 無法判斷（255）不在這裡：渲染器畫斜線（SOUND_UNKNOWN_COLOR），不畫淺色。
 */
export const SOUND_RAIN_GRID_COLORS = ["#94a3b8", "#7dd3fc", "#3b82f6", "#6d28d9", "#d946ef"] as const;
/** 各級不透明度（乘上圖層透明度滑桿）：無雨很淡，雨越大越實 */
export const SOUND_RAIN_GRID_ALPHA = [0.14, 0.5, 0.62, 0.74, 0.85] as const;

/**
 * W6-2 道路車流網格五級（資料色，§3.16）：琥珀 → 橘 → 紅，和雨網格的藍紫系明顯不同（之後會疊看）。
 * 0＝很低或離道路遠（淡暖灰）。三級證據用同一組級色、不同透明度與彩度區分：
 * 國道當日實測最實、臺北典型稍淡、新北等級推估改用低彩度的土色（一眼看出「只是推估」）。
 * 無法判斷（255）不在這裡：渲染器畫斜線。
 */
export const SOUND_ROAD_GRID_COLORS = {
  observed: ["#a8a29e", "#fcd34d", "#f59e0b", "#ea580c", "#dc2626"],
  estimated: ["#a8a29e", "#fcd34d", "#f59e0b", "#ea580c", "#dc2626"],
  inferred: ["#a8a29e", "#d6c48f", "#c6a165", "#a9784a", "#8c5a3c"],
} as const;
export const SOUND_ROAD_GRID_ALPHA = {
  observed: [0.12, 0.55, 0.66, 0.76, 0.86],
  estimated: [0.12, 0.42, 0.52, 0.62, 0.72],
  inferred: [0.12, 0.4, 0.48, 0.56, 0.64],
} as const;

/**
 * W6-3 連續潛勢網格五級（資料色，§3.16）：0＝已判斷、沒有（或低於飛機顯示門檻）＝淡中性色；1–4＝低→很高。
 * 每族一個色相，避開雨（藍紫洋紅）與道路（琥珀紅）：飛機粉紅、鐵道檸檬黃→橄欖、風吹樹葉萊姆→深綠、
 * 海浪青→深青、河川翠綠→深綠青。末級都夠深，亮底圖也看得出。無法判斷（255）由渲染器畫斜線。
 */
export const SOUND_POTENTIAL_GRID_COLORS = {
  aviation: ["#94a3b8", "#fbcfe8", "#f472b6", "#db2777", "#9d174d"],
  rail: ["#94a3b8", "#fef08a", "#facc15", "#ca8a04", "#854d0e"],
  wind_vegetation: ["#94a3b8", "#d9f99d", "#a3e635", "#65a30d", "#3f6212"],
  coastal_wave: ["#94a3b8", "#a5f3fc", "#22d3ee", "#0891b2", "#155e75"],
  river_water: ["#94a3b8", "#a7f3d0", "#34d399", "#059669", "#065f46"],
} as const;
export const SOUND_POTENTIAL_GRID_ALPHA = [0.1, 0.48, 0.6, 0.72, 0.84] as const;
