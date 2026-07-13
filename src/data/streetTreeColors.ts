/**
 * 行道樹變化圖層「染色模式」的顏色 / 分級單一真實來源。
 * 給 overlayRegistry 配色（circle-color 表達式）與 LegendPanel 圖例兩處共用。
 *
 * 四種染色模式：
 * - status   ：維持現行三狀態色（存續/消失/新增），色票留在 overlayRegistry / Legend 既有處，本檔不管
 * - species  ：資料量前 10 大樹種各一色 + 其他灰（colorblind-friendly 亮色 categorical）
 * - diameter ：Diameter(cm) 分位數 5 級 sequential 亮暖色（淺→深＝細→粗）；缺值/<=0 給灰
 * - height   ：TreeHeight(m) 分位數 5 級，沿用同一暖色帶（同 diameter 做法）
 *
 * 前 10 大樹種與分級 break 由全量 geojson（99,527 點）統計決定，見 docs changelog：
 *   Diameter 分位 p20/p40/p60/p80 ≈ 10/20/28/38 → 取整 10/20/30/40
 *   Height   分位 p20/p40/p60/p80 ≈ 5.8/8/10/12.5 → 取整 6/8/10/13
 */

// 缺值 / <=0（Diameter / TreeHeight）與非前 10 大樹種共用的中性灰
export const STREET_TREE_MISSING_COLOR = "#8c929b";
export const STREET_TREE_OTHER_COLOR = "#8c929b";

// 前 10 大樹種（count desc）→ 亮色 categorical palette
// （深色底圖可辨、彼此好區分；Tableau10 調亮版 / Okabe-Ito 混搭）
export const STREET_TREE_SPECIES: { name: string; color: string }[] = [
  { name: "榕樹",     color: "#4c9be0" }, // blue
  { name: "茄苳",     color: "#f28e2b" }, // orange
  { name: "樟樹",     color: "#59b359" }, // green
  { name: "楓香",     color: "#f2d64b" }, // yellow
  { name: "臺灣欒樹", color: "#b07ad9" }, // purple
  { name: "白千層",   color: "#2fc2d4" }, // cyan
  { name: "黑板樹",   color: "#e15759" }, // red
  { name: "小葉欖仁", color: "#f58ebc" }, // pink
  { name: "大花紫薇", color: "#9ed45a" }, // lime
  { name: "水黃皮",   color: "#c69c6d" }, // tan
];

// sequential 亮暖色帶（淺黃→橘→紅）；由淺到深＝由小到大。
// 選暖色帶而非 YlGn，因為深色底圖上「深綠」端對比不足，暖色帶末端（紅）仍夠亮。
const SEQ_RAMP: [string, string, string, string, string] = ["#fff2a8", "#fecc5c", "#fd9843", "#f4611f", "#d7191c"];

export interface StreetTreeBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

// 胸徑 cm 5 級（break 10/20/30/40）
export const STREET_TREE_DIAMETER_BANDS: StreetTreeBand[] = [
  { max: 10,   color: SEQ_RAMP[0], label: "< 10 cm" },
  { max: 20,   color: SEQ_RAMP[1], label: "10–20 cm" },
  { max: 30,   color: SEQ_RAMP[2], label: "20–30 cm" },
  { max: 40,   color: SEQ_RAMP[3], label: "30–40 cm" },
  { max: null, color: SEQ_RAMP[4], label: "≥ 40 cm" },
];

// 樹高 m 5 級（break 6/8/10/13）
export const STREET_TREE_HEIGHT_BANDS: StreetTreeBand[] = [
  { max: 6,    color: SEQ_RAMP[0], label: "< 6 m" },
  { max: 8,    color: SEQ_RAMP[1], label: "6–8 m" },
  { max: 10,   color: SEQ_RAMP[2], label: "8–10 m" },
  { max: 13,   color: SEQ_RAMP[3], label: "10–13 m" },
  { max: null, color: SEQ_RAMP[4], label: "≥ 13 m" },
];

// 染色模式 select 選項；index 對齊 overlayRegistry 讀的 streetTreesTaipeiDiffColorModeIdx
export const STREET_TREE_COLOR_MODES = ["status", "species", "diameter", "height"] as const;
export type StreetTreeColorMode = (typeof STREET_TREE_COLOR_MODES)[number];

// ── MapLibre circle-color 表達式 builder ──
// ⚠️ 這些表達式不得含 ["zoom"]：MapLibre 規定 zoom 只能在最外層 interpolate/step，
//    circle-color 走 match/step（無 zoom）才不會踩到 circle-radius 曾踩過的雷。

/** 樹種：match TreeType → 前 10 色，其餘灰 */
export function streetTreeSpeciesColorExpr(): unknown[] {
  return [
    "match", ["get", "TreeType"],
    ...STREET_TREE_SPECIES.flatMap((s) => [s.name, s.color]),
    STREET_TREE_OTHER_COLOR,
  ];
}

/** 分級 step：缺值/<=0 → 灰；否則依 band break 上色 */
function bandStepColorExpr(field: string, bands: StreetTreeBand[]): unknown[] {
  const val: unknown[] = ["to-number", ["get", field], 0]; // null → 0 → 判為缺值
  const step: unknown[] = ["step", val, bands[0]!.color];
  for (let i = 1; i < bands.length; i++) {
    step.push(bands[i - 1]!.max as number, bands[i]!.color);
  }
  return ["case", ["<=", val, 0], STREET_TREE_MISSING_COLOR, step];
}

export function streetTreeDiameterColorExpr(): unknown[] {
  return bandStepColorExpr("Diameter", STREET_TREE_DIAMETER_BANDS);
}

export function streetTreeHeightColorExpr(): unknown[] {
  return bandStepColorExpr("TreeHeight", STREET_TREE_HEIGHT_BANDS);
}
