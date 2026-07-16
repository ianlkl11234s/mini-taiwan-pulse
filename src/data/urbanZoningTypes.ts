/**
 * 都市計畫土地使用分區（北市 15,518 + 新北 34,190）2 層 PMTiles polygon 的
 * 顏色與分類單一真實來源。
 * 給 overlayRegistry 配色（fill-color / line-color 表達式）、LegendPanel 圖例、
 * featureInfo popup Title 三處共用（同 buildingsGbaTypes.ts / urbanFormGridTypes.ts 慣例）。
 *
 * `zone_category`：9 值跨市統一分類（分色 / 篩選硬依賴，上游 handoff urban-zoning.md §2）。
 * 錨定色沿用都計圖慣例（住宅黃 / 商業紅 / 工業紫 / 綠地綠），深色底圖上可辨。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（同 urbanFormGridTypes.ts 註）。
 */

// 缺值 / 非 9 類共用中性灰
export const URBAN_ZONING_MISSING_COLOR = "#9e9e9e";

// zone_category 9 類（value 對齊 PMTiles zone_category 欄位值；index 對齊 overlayRegistry 讀的
// urbanZoning*CategoryIdx：0=全部，1..9 照本陣列順序）
export const URBAN_ZONING_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "residential",     label: "住宅",     color: "#f2c94c" },
  { value: "commercial",      label: "商業",     color: "#eb5757" },
  { value: "industrial",      label: "工業",     color: "#9b6dd6" },
  { value: "agricultural",    label: "農業",     color: "#b5cc6a" },
  { value: "open_space",      label: "公園綠地", color: "#4caf72" },
  { value: "public_facility", label: "公共設施", color: "#4d9de0" },
  { value: "transport",       label: "交通",     color: "#9aa5b1" },
  { value: "conservation",    label: "保護保育", color: "#2d8659" },
  { value: "other",           label: "其他",     color: "#8a8a8a" },
];

/** zone_category → 9 色，其餘灰（fill-color / line-color 共用） */
export function urbanZoningColorExpr(): unknown[] {
  return [
    "match", ["get", "zone_category"],
    ...URBAN_ZONING_CATEGORIES.flatMap((c) => [c.value, c.color]),
    URBAN_ZONING_MISSING_COLOR,
  ];
}

/** zone_category → 中文 label（popup / 圖例共用，純 JS 不進 mapbox 表達式） */
export function urbanZoningCategoryLabel(value: string): string {
  return URBAN_ZONING_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** zone_category → 代表色（popup Title 上色，純 JS 版；缺值中性灰） */
export function urbanZoningCategoryColor(value: string): string {
  return URBAN_ZONING_CATEGORIES.find((c) => c.value === value)?.color ?? URBAN_ZONING_MISSING_COLOR;
}
