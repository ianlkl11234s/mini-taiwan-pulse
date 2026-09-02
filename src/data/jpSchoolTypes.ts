import type { ExpressionSpecification } from "mapbox-gl";

// ── 学校分類（school_class，13 類，scalar 屬性，非陣列）──
// 排列＝學制階梯（幼兒 → 初等 → 中等 → 高等 → 特殊/その他），同階梯用相近色階，
// 讓 13 列圖例掃過去能一眼分群；括號內為 56,807 筆的實際分佈。
// 上色語意：幼兒＝粉黃／初等＝暖橘／中等＝藍／高等＝紫／特殊與其他＝綠灰。
export interface JpSchoolType { value: string; label: string; color: string; }
export const JP_SCHOOL_TYPES: JpSchoolType[] = [
  // 幼兒（粉黃系）
  { value: "幼稚園",                 label: "幼稚園",                 color: "#f472b6" }, //  8,837
  { value: "幼保連携型認定こども園", label: "幼保連携型認定こども園", color: "#fbbf24" }, //  6,985
  // 初等教育（暖橘系）
  { value: "小学校",                 label: "小学校",                 color: "#f97316" }, // 18,980
  { value: "義務教育学校",           label: "義務教育学校",           color: "#c2410c" }, //    209
  // 中等教育（藍色系）
  { value: "中学校",                 label: "中学校",                 color: "#3b82f6" }, //  9,946
  { value: "高等学校",               label: "高等学校",               color: "#1d4ed8" }, //  4,943
  { value: "中等教育学校",           label: "中等教育学校",           color: "#38bdf8" }, //     57
  // 高等教育（紫色系）
  { value: "大学",                   label: "大学",                   color: "#a855f7" }, //  1,214
  { value: "短期大学",               label: "短期大学",               color: "#d8b4fe" }, //    311
  { value: "高等専門学校",           label: "高等専門学校",           color: "#6d28d9" }, //     61
  // 特殊與其他（綠灰系）
  { value: "特別支援学校",           label: "特別支援学校",           color: "#22c55e" }, //  1,229
  { value: "専修学校",               label: "専修学校",               color: "#14b8a6" }, //  3,020
  { value: "各種学校",               label: "各種学校",               color: "#475569" }, //  1,015
];

/** 13 類已窮盡本資料集，fallback 只在上游新增分類時才會出現（刻意用中性灰，與各種学校的深灰可分辨）。 */
export const JP_SCHOOL_TYPE_OTHER = { value: "その他", label: "その他", color: "#9ca3af" };

/**
 * sidebar 圓點／popup 標題色 —— 取最大宗類別 小学校（18,980 筆，全體 33.4%）。
 * 由 JP_SCHOOL_TYPES 衍生而非複製 hex 字面（見 layerManifest.ts 檔頭「色票規約」）。
 */
export const JP_SCHOOL_LAYER_COLOR: string =
  JP_SCHOOL_TYPES.find((t) => t.value === "小学校")?.color ?? JP_SCHOOL_TYPE_OTHER.color;

// school_class 在 PMTiles 屬性裡已是純量字串（非車站 operator_types 那種陣列），
// 可直接 ["get","school_class"] 進 match，不需要 loader 先算 classify。
export const JP_SCHOOL_TYPE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "school_class"],
  ...JP_SCHOOL_TYPES.flatMap((t) => [t.value, t.color]),
  JP_SCHOOL_TYPE_OTHER.color,
] as unknown as ExpressionSpecification;
