/**
 * 領海界線 Maritime Boundary（PMTiles source-layer `maritime_boundary`，38 feature）
 * ══════════════════════════════════════════════════════════════════
 *
 * 上游：內政部「中華民國第一批領海基線、領海及鄰接區外界線」98 年修正公告
 * （taipei-gis-analytics/pipelines/environment/maritime_boundary/）。
 * 一份切片裡混了 4 種 feature，靠 `properties.layer` 區分：
 *
 *   baseline             領海基線     LineString/MultiLineString ×4
 *   basepoint            領海基點     Point ×26
 *   territorial_sea_12nm 12 浬領海外界線 LineString/MultiLineString ×4
 *   contiguous_zone_24nm 24 浬鄰接區外界線 LineString ×4
 *
 * 本檔是那 4 類的**色票 / 標籤 / 法律意義**單一真實來源，供三邊共用：
 *   1. `map/overlayRegistry.ts` 的 `["match", ["get","layer"], …]` paint 表達式
 *   2. `components/LegendPanel.tsx` 的 MaritimeBoundaryLegend
 *   3. `components/featureInfo/baseMapPanels.tsx` 的 MaritimeBoundaryPanel
 * 三處各自 inline hex 是本專案反覆踩過的漂移點（development-rules §4a 規則 2）。
 *
 * ⚠️ 線型（實線 / 虛線）也在這裡宣告，但它**不是**由表達式派生的：
 * `line-dasharray` 不支援 data-driven，24 浬那類必須拆成獨立的 layer
 * （見 overlayRegistry 的 `line-24nm` suffix）。`dashed` 欄位存在的意義是
 * 讓圖例畫得出跟地圖一致的線型，而不是讓 paint 去讀它。
 */

/** `properties.layer` 的四個值（切片內實際出現的全集） */
export type MaritimeBoundaryKind =
  | "baseline"
  | "basepoint"
  | "territorial_sea_12nm"
  | "contiguous_zone_24nm";

export interface MaritimeBoundaryType {
  /** properties.layer 原始值 */
  value: MaritimeBoundaryKind;
  /** 中文標籤（與切片內的 properties.layer_zh 相同） */
  label: string;
  color: string;
  /** 圖例線型；true = 虛線（法律地位較弱的鄰接區） */
  dashed: boolean;
  /** popup 用的一句話法律意義 */
  meaning: string;
}

/** 4 類的宣告順序 = 圖例顯示順序（由內而外：基線 → 12 浬 → 24 浬 → 基點） */
export const MARITIME_BOUNDARY_TYPES: MaritimeBoundaryType[] = [
  {
    value: "baseline",
    label: "領海基線",
    color: "#f59e0b",
    dashed: false,
    meaning: "量測領海與各海域範圍的起算線，基線向陸側為內水。",
  },
  {
    value: "territorial_sea_12nm",
    label: "12 浬領海外界線",
    color: "#ef4444",
    dashed: false,
    meaning: "自基線起算 12 浬，界內為我國領海，享有主權（他國船舶僅有無害通過權）。",
  },
  {
    value: "contiguous_zone_24nm",
    label: "24 浬鄰接區外界線",
    color: "#a78bfa",
    dashed: true,
    meaning: "自基線起算 24 浬，界內我國得對海關、財政、移民、衛生事項行使必要管制。",
  },
  {
    value: "basepoint",
    label: "領海基點",
    color: "#fbbf24",
    dashed: false,
    meaning: "劃定領海基線所依據的實體控制點（共 26 點）。",
  },
];

const BY_VALUE = new Map(MARITIME_BOUNDARY_TYPES.map((t) => [t.value as string, t]));

/** 查表；查無回 undefined（popup 端自行 fallback，不編造分類） */
export function maritimeBoundaryType(value: unknown): MaritimeBoundaryType | undefined {
  return typeof value === "string" ? BY_VALUE.get(value) : undefined;
}

/** 分色 fallback（切片若出現未登記的 layer 值會落到這個中性灰，圖例上看不到 = 需回查上游） */
export const MARITIME_BOUNDARY_FALLBACK_COLOR = "#94a3b8";

/**
 * `["match", ["get","layer"], …]` 分色表達式（overlayRegistry paint 用）。
 * 只列 `only` 指定的類別可縮小 match 分支；省略即四類全列。
 */
export function maritimeBoundaryColorExpr(only?: MaritimeBoundaryKind[]): unknown[] {
  const types = only
    ? MARITIME_BOUNDARY_TYPES.filter((t) => only.includes(t.value))
    : MARITIME_BOUNDARY_TYPES;
  const expr: unknown[] = ["match", ["get", "layer"]];
  for (const t of types) expr.push(t.value, t.color);
  expr.push(MARITIME_BOUNDARY_FALLBACK_COLOR);
  return expr;
}

/** 實線線層涵蓋的類別（虛線的 24 浬與點狀的基點各自成層） */
export const MARITIME_SOLID_LINE_KINDS: MaritimeBoundaryKind[] = [
  "baseline",
  "territorial_sea_12nm",
];

/** 資料版本註記（圖例與 popup 共用，避免兩處各寫一份年份） */
export const MARITIME_BOUNDARY_SOURCE_NOTE = "內政部 98 年公告（第一批領海基線）";
