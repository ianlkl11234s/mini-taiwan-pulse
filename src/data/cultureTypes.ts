/**
 * 文化 Culture 四層（文化設施 / 地方文化館 / 藝文活動 / 表演場館）的
 * 顏色與分類單一真實來源。
 * 給 overlayRegistry 配色（circle-color 表達式）、LegendPanel 圖例、
 * useLayerParamsRuntime select options 三處共用（同 urbanOpenSpaceTypes.ts 慣例）。
 *
 * 分類由 public/culture/*.geojson 全量統計決定（2026-07）：
 * - 文化設施 787 點（facility_type 6 類 count desc）
 * - 地方文化館 252 點（type 5 類 count desc）
 * - 藝文活動 6,121 點（進行中 2,258 / 未開始 3,863，by start_date ≤ 今日）
 * - 表演場館 857 點（單色，半徑 ∝ √event_count 1~101）
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（同 urbanOpenSpaceTypes.ts 註）。
 */

// 缺值 / 非前 N 類共用中性灰
export const CULTURE_MISSING_COLOR = "#9e9e9e";

// ── 🏛️ 文化設施 Cultural Facilities（全國 787 點）──
// facility_type 6 類 categorical（count desc）；暖色系為主，彼此不同色相，深底可辨。
export const CULTURAL_FACILITY_TYPES: { name: string; color: string }[] = [
  { name: "實體書店",     color: "#ef8a3c" }, // 393 orange
  { name: "工藝之家",     color: "#d9534f" }, // 162 red
  { name: "博物館",       color: "#9b6bd4" }, // 131 purple
  { name: "特色圖書館",   color: "#3aa5c9" }, // 74 cyan
  { name: "文化行政據點", color: "#c9a227" }, // 23 gold
  { name: "文創商店",     color: "#e06fae" }, // 4 magenta
];

/** 設施類型：match facility_type → 6 色，其餘灰 */
export function culturalFacilityColorExpr(): unknown[] {
  return [
    "match", ["get", "facility_type"],
    ...CULTURAL_FACILITY_TYPES.flatMap((c) => [c.name, c.color]),
    CULTURE_MISSING_COLOR,
  ];
}

// ── 🏘️ 地方文化館 Local Cultural Museums（全國 252 點）──
// type 5 類 categorical（count desc）；語意配色（歷史土色 / 其他中性 / 藝術洋紅 / 休閒綠 / 科學藍）。
export const CULTURAL_MUSEUM_TYPES: { name: string; color: string }[] = [
  { name: "歷史與人文", color: "#c1783a" }, // 109 terracotta
  { name: "綜合與其他", color: "#8a94a6" }, // 69 slate
  { name: "藝術與工藝", color: "#d1477f" }, // 59 rose-magenta
  { name: "生活與休閒", color: "#4aa86e" }, // 13 green
  { name: "自然與科學", color: "#3f8fd1" }, // 2 blue
];

/** 文化館類型：match type → 5 色，其餘灰 */
export function culturalMuseumColorExpr(): unknown[] {
  return [
    "match", ["get", "type"],
    ...CULTURAL_MUSEUM_TYPES.flatMap((c) => [c.name, c.color]),
    CULTURE_MISSING_COLOR,
  ];
}

// ── 🎪 藝文活動 Arts Events（全國 6,121 點）──
// 進行中（start_date ≤ 今日）= 暖橙；未開始（start_date > 今日）= 冷藍。
export const ARTS_EVENT_ONGOING_COLOR = "#ff8c42";  // 進行中（warm = 正在發生）
export const ARTS_EVENT_UPCOMING_COLOR = "#4d9de0"; // 未開始（cool = 尚未開始）

// ── 🎭 表演場館 Performing Venues（全國 857 點）──
// 單色；半徑 ∝ √event_count（1~101）。
export const PERFORMING_VENUE_COLOR = "#7c4dff"; // vivid violet（表演 / 舞台）

// ── 📚 北市圖即時座位 Library Seats（realtime，6 分館）──
// 空位率漸層（0=滿→1=全空）+ 休館灰；overlayRegistry paint inline 同色，
// panel header dot 與 LegendPanel 引用此處（單一真實來源）。
export const LIBRARY_SEATS_COLORS = {
  empty: "#ef4444",   // 空位率 0（滿）
  half: "#f59e0b",    // 空位率 0.5
  full: "#22c55e",    // 空位率 1（空位多）
  closed: "#6b7280",  // 休館中（is_closed）
} as const;
