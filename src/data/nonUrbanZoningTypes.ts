/**
 * 非都市土地使用分區（68,220 面 PMTiles polygon）的顏色與分類單一真實來源。
 * 給 overlayRegistry 配色（fill/line 表達式）、LegendPanel 圖例、featureInfo popup 三處共用
 * （同 urbanZoningTypes.ts 慣例）。
 *
 * 與 `urbanZoningTypes.ts` 的關係：那兩層是「都市計畫區**內**」的使用分區，本層是
 * 「非都市土地」——兩者互補拼成全國土地使用圖。故配色刻意同色系對齊
 * （農業黃綠 / 工業紫 / 保育綠 / 公共設施藍），疊圖時讀得起來像同一套語言。
 *
 * 上色欄用 `zone_code`（11 碼）而非 `zone_category`（10 值）：AA 特定農業區 與
 * AB 一般農業區 同屬 agricultural，但兩者在農地變更難易度上差很大，是這份資料最有價值的區別。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（同 urbanZoningTypes.ts 註）。
 */
import { allMultiSelectBitmask, multiSelectFilter } from "./multiSelectMapbox";


// 缺值 / 非 11 碼共用中性灰
export const NON_URBAN_ZONING_MISSING_COLOR = "#9e9e9e";

/**
 * 區域計畫法 11 種法定分區（count = 2026-08-01 成品實測，供圖例排序與比例感）。
 * 順序對齊分類多選的 bit 位元（最多 30 類的 numeric overlayParams 合約）。
 */
export const NON_URBAN_ZONING_CODES: {
  code: string; label: string; color: string; count: number;
}[] = [
  { code: "AA", label: "特定農業區",   color: "#a2c14e", count: 8452 },
  { code: "AB", label: "一般農業區",   color: "#cfe08a", count: 11395 },
  { code: "AC", label: "鄉村區",       color: "#f2c94c", count: 15025 },
  { code: "AD", label: "工業區",       color: "#9b6dd6", count: 331 },
  { code: "AE", label: "森林區",       color: "#2d8659", count: 2989 },
  { code: "AF", label: "山坡地保育區", color: "#57a773", count: 20246 },
  { code: "AG", label: "風景區",       color: "#2dd4bf", count: 1207 },
  { code: "AH", label: "特定專用區",   color: "#4d9de0", count: 2290 },
  { code: "AJ", label: "國家公園區",   color: "#0f766e", count: 65 },
  { code: "AK", label: "河川區",       color: "#2f80ed", count: 6190 },
  { code: "AL", label: "海域",         color: "#1e5aa8", count: 30 },
];

/** zone_code → 11 色，其餘灰（fill-color / line-color 共用） */
export function nonUrbanZoningColorExpr(): unknown[] {
  return [
    "match", ["get", "zone_code"],
    ...NON_URBAN_ZONING_CODES.flatMap((c) => [c.code, c.color]),
    NON_URBAN_ZONING_MISSING_COLOR,
  ];
}

/** 分區篩選表達式：bitmask 支援任意多類；未選中的面被濾除而非淡化。 */
export function nonUrbanZoningCodeFilter(mask?: number): unknown[] {
  const codeValues = NON_URBAN_ZONING_CODES.map((category) => category.code);
  return multiSelectFilter(
    "zone_code",
    mask ?? allMultiSelectBitmask(codeValues),
    codeValues,
  );
}

/** zone_code → 中文 label（popup / 圖例共用，純 JS 不進 mapbox 表達式） */
export function nonUrbanZoningCodeLabel(code: string | null | undefined): string {
  if (!code) return "未分類";
  return NON_URBAN_ZONING_CODES.find((c) => c.code === code)?.label ?? code;
}

/** zone_code → 代表色（popup Title 上色，純 JS 版；缺值中性灰） */
export function nonUrbanZoningCodeColor(code: string | null | undefined): string {
  if (!code) return NON_URBAN_ZONING_MISSING_COLOR;
  return NON_URBAN_ZONING_CODES.find((c) => c.code === code)?.color ?? NON_URBAN_ZONING_MISSING_COLOR;
}
