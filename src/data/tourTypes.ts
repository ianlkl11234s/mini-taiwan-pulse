/**
 * 觀光 Tourism — 三組配色表 SSOT（景點分類 / 旅宿等級 / 文化資產類別）
 *
 * 原本 inline 在 map/overlayRegistry.ts（Mapbox paint expression）、
 * components/LegendPanel.tsx（圖例 UI）、
 * components/featureInfo/tourismPanels.tsx（popup 面板）三處各自維護一份 hex，容易漂移。
 * 搬進本檔後三邊 import 同一份，色碼與原順序逐字節不變。
 */

// tourAttractions 分類著色（category 五類；fallback=Other 灰）
export const TOUR_ATTRACTIONS_CATEGORY_COLOR: unknown[] = [
  "match", ["get", "category"],
  "Nature", "#2e7d32",
  "Culture", "#6d4c41",
  "Leisure_Arts", "#ab47bc",
  "Urban_Comm", "#0288d1",
  "#9e9e9e",
];

/** 圖例列（與上方 match 表同順序：四類 + fallback） */
export const TOUR_ATTRACTION_CATS: { color: string; label: string }[] = [
  { color: "#2e7d32", label: "自然 Nature" },
  { color: "#6d4c41", label: "文化 Culture" },
  { color: "#ab47bc", label: "休閒藝術 Leisure & Arts" },
  { color: "#0288d1", label: "都會社區 Urban Community" },
  { color: "#9e9e9e", label: "其他 Other" },
];

/**
 * popup 端查表（AttractionsPanel）：key = geojson `category` 原始值，短中文標籤。
 * 色碼與上方 match 表 / 圖例列同一組。未知 category（不在此表的 key）由呼叫端另給
 * fallback（現行 `#e65100`，代表「連 Other 都不是」的異常值，非本表管轄範圍）。
 */
export const TOUR_ATTRACTION_CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  Nature: { label: "自然", color: "#2e7d32" },
  Culture: { label: "文化", color: "#6d4c41" },
  Leisure_Arts: { label: "休閒藝術", color: "#ab47bc" },
  Urban_Comm: { label: "都會社區", color: "#0288d1" },
  Other: { label: "其他", color: "#9e9e9e" },
};

// tourHotels hotel_classes 四類分色（fallback 灰）
export const TOUR_HOTELS_CLASS_COLOR: unknown[] = [
  "match", ["get", "hotel_classes"],
  "1", "#d32f2f",
  "2", "#f57c00",
  "3", "#1976d2",
  "4", "#43a047",
  "#9e9e9e",
];

/** 圖例列（fallback 灰未列入，沿用搬移前既有行為） */
export const TOUR_HOTEL_CATS: { color: string; label: string }[] = [
  { color: "#d32f2f", label: "國際觀光旅館 Intl. Tourist Hotel" },
  { color: "#f57c00", label: "一般觀光旅館 Std. Tourist Hotel" },
  { color: "#1976d2", label: "旅館 Hotel" },
  { color: "#43a047", label: "民宿 B&B" },
];

/**
 * popup 端查表（HotelsPanel）：key = geojson `hotel_classes` 原始值（"1"~"4"），短中文標籤。
 * 色碼與上方 match 表 / 圖例列同一組。未知代碼由呼叫端另給灰色 fallback（`#9e9e9e`）。
 */
export const TOUR_HOTEL_CLASS_INFO: Record<string, { label: string; color: string }> = {
  "1": { label: "國際觀光旅館", color: "#d32f2f" },
  "2": { label: "一般觀光旅館", color: "#f57c00" },
  "3": { label: "旅館", color: "#1976d2" },
  "4": { label: "民宿", color: "#43a047" },
};

// tourHeritage category 三類同色系分色（fallback 基底 #6d4c41）
export const TOUR_HERITAGE_CATEGORY_COLOR: unknown[] = [
  "match", ["get", "category"],
  "古蹟", "#5d4037",
  "歷史建築", "#8d6e63",
  "文化景觀", "#a1887f",
  "#6d4c41",
];

/** 圖例列（fallback 未列入，沿用搬移前既有行為） */
export const TOUR_HERITAGE_CATS: { color: string; label: string }[] = [
  { color: "#5d4037", label: "古蹟 Monument" },
  { color: "#8d6e63", label: "歷史建築 Historic Building" },
  { color: "#a1887f", label: "文化景觀 Cultural Landscape" },
];

/**
 * popup 端查表（HeritagePanel）：key = geojson `category` 原始值（中文）。
 * 色碼與上方 match 表 / 圖例列同一組。未知類別由呼叫端另給 fallback（同 match 表基底色 `#6d4c41`）。
 */
export const TOUR_HERITAGE_CATEGORY_COLOR_MAP: Record<string, string> = {
  古蹟: "#5d4037",
  歷史建築: "#8d6e63",
  文化景觀: "#a1887f",
};
