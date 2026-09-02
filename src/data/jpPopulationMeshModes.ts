import type { ExpressionSpecification } from "mapbox-gl";

// ══════════════════════════════════════════════════════════════════
//  日本 1km 人口網格（jp_population_mesh_1km）的模式 ＋ 色階 SSOT
//  三邊共用：hook 的 fill-color 表達式 / LegendPanel 的級距列 / layerParamsSpec 的 select
//  （比照 jpStationTypes.ts、jpRailwayTypes.ts 的慣例；本檔只准 import mapbox 型別，
//    否則 layerManifest.ts 引用它會造成 import cycle —— 見 manifest 檔頭「色票規約」）
// ══════════════════════════════════════════════════════════════════

/** 遮罩／無資料灰。ratio65 專用（見 JP_POPULATION_MESH_MODES 的說明）。 */
export const JP_POPULATION_MESH_MASK = { label: "未公開（遮罩）", color: "#6b7280" };

// ── 9 個模式（扁平表：一個 select 就切完，不做「指標 × 年份」兩層相依 select）──
// pop_* 5 個年份（2020/2030/2040/2050/2070，無 2060）＋ ratio65_* 4 個年份（無 2020，
// 官方基準年未釋出年齡細分）。屬性在 PMTiles 內皆為 Number，可直接進 step 表達式。
export interface JpPopulationMeshMode {
  label: string;
  /** PMTiles 屬性名，同時當 select 的 option value（非數值字串 ⇒ 走 encode 不走 encodeNumeric） */
  field: string;
  metric: "pop" | "ratio65";
}
export const JP_POPULATION_MESH_MODES: JpPopulationMeshMode[] = [
  { label: "人口 2020",  field: "pop_2020",     metric: "pop" },
  { label: "人口 2030",  field: "pop_2030",     metric: "pop" },
  { label: "人口 2040",  field: "pop_2040",     metric: "pop" },
  { label: "人口 2050",  field: "pop_2050",     metric: "pop" },
  { label: "人口 2070",  field: "pop_2070",     metric: "pop" },
  { label: "高齡比 2030", field: "ratio65_2030", metric: "ratio65" },
  { label: "高齡比 2040", field: "ratio65_2040", metric: "ratio65" },
  { label: "高齡比 2050", field: "ratio65_2050", metric: "ratio65" },
  { label: "高齡比 2070", field: "ratio65_2070", metric: "ratio65" },
];

export interface JpMeshBucket {
  /** 該級的下界（含）；第一級的 min 只作語意標示，表達式用 base 色不設 stop */
  min: number;
  label: string;
  color: string;
}

/**
 * 人口 7 級（ColorBrewer YlOrRd-7，淺黃 → 深紅）。
 * 斷點 0/50/200/500/1000/2000/5000 **跨年份固定**，不逐年重算分位數 ——
 * 逐年重算會讓顏色語意漂移、無法比較世代間的人口消退（2020 各級佔比
 * 42.8/23.8/12.7/6.7/5.0/5.3/3.7%，同組斷點套 2070 為 61.1/17.0/7.5/4.4/3.7/3.8/2.4%）。
 * pop 的 0 是真的無人居住（非遮罩），落在最低級即可，不需要 case 分流。
 */
export const JP_POPULATION_MESH_POP_BUCKETS: JpMeshBucket[] = [
  { min: 0,    label: "< 50 人",       color: "#ffffb2" },
  { min: 50,   label: "50–200",        color: "#fed976" },
  { min: 200,  label: "200–500",       color: "#feb24c" },
  { min: 500,  label: "500–1,000",     color: "#fd8d3c" },
  { min: 1000, label: "1,000–2,000",   color: "#fc4e2a" },
  { min: 2000, label: "2,000–5,000",   color: "#e31a1c" },
  { min: 5000, label: "≥ 5,000",       color: "#b10026" },
];

/**
 * 65 歲以上比率 6 級（ColorBrewer BuPu-6，淺藍 → 深紫；與人口的黃紅色系刻意可區分）。
 * ⚠️ 屬性是 **0~1 比例不是百分比** —— stop 值用 0.20/0.30/…，圖例才 ×100 顯示成 %。
 */
export const JP_POPULATION_MESH_RATIO65_BUCKETS: JpMeshBucket[] = [
  { min: 0,    label: "< 20%",   color: "#e0ecf4" },
  { min: 0.2,  label: "20–30%",  color: "#bfd3e6" },
  { min: 0.3,  label: "30–40%",  color: "#9ebcda" },
  { min: 0.4,  label: "40–50%",  color: "#8c96c6" },
  { min: 0.5,  label: "50–60%",  color: "#8856a7" },
  { min: 0.6,  label: "≥ 60%",   color: "#810f7c" },
];

/**
 * sidebar 圓點／popup 標題色 —— 取人口色階的中高段（1,000–2,000 人那級）。
 * 由色階陣列衍生而非複製 hex 字面（見 layerManifest.ts 檔頭「色票規約」）。
 */
export const JP_POPULATION_MESH_LAYER_COLOR: string =
  JP_POPULATION_MESH_POP_BUCKETS[4]?.color ?? JP_POPULATION_MESH_MASK.color;

/** modeIdx → 模式（越界回第一個「人口 2020」，noUncheckedIndexedAccess 下的必要 fallback）。 */
export function jpPopulationMeshMode(modeIdx: number): JpPopulationMeshMode {
  return (
    JP_POPULATION_MESH_MODES[modeIdx] ??
    (JP_POPULATION_MESH_MODES[0] as JpPopulationMeshMode)
  );
}

/** 該模式的級距表（圖例與表達式共用同一份，不各寫一次）。 */
export function jpPopulationMeshBuckets(modeIdx: number): JpMeshBucket[] {
  return jpPopulationMeshMode(modeIdx).metric === "ratio65"
    ? JP_POPULATION_MESH_RATIO65_BUCKETS
    : JP_POPULATION_MESH_POP_BUCKETS;
}

/** base 色 = 最低級（輸入不會小於 0，故第一級不設 stop 只當 base）。 */
function stepExpression(field: string, buckets: JpMeshBucket[]): unknown[] {
  return [
    "step", ["get", field],
    buckets[0]?.color ?? JP_POPULATION_MESH_MASK.color,
    ...buckets.slice(1).flatMap((b) => [b.min, b.color]),
  ];
}

/**
 * 依 mode index 產生 fill-color 表達式（hook 與圖例共用同一組斷點／色票）。
 *
 * ⚠️ ratio65 的 **0 是官方隱私遮罩不是真的 0%**：極小人口 mesh 的年齡細分被官方
 * 抹成 0（實測 `pop_2030>0` 但 `ratio65_2030==0` 有 5,224 筆，人口中位數僅 3 人）。
 * 塗成最低比例色 = 把「查無資料」畫成「最年輕」，語意反過來 → 先用 case 攔 0 塗遮罩灰。
 * pop 模式不需要這層 case（pop=0 是真的無人居住）。
 */
export function jpPopulationMeshFillColor(modeIdx: number): ExpressionSpecification {
  const mode = jpPopulationMeshMode(modeIdx);
  const step = stepExpression(mode.field, jpPopulationMeshBuckets(modeIdx));
  if (mode.metric !== "ratio65") return step as unknown as ExpressionSpecification;
  return [
    "case",
    ["==", ["get", mode.field], 0], JP_POPULATION_MESH_MASK.color,
    step,
  ] as unknown as ExpressionSpecification;
}
