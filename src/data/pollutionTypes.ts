// 環境污染主題共用常數（介質 / 嚴重度 / 年份）。
// overlayRegistry / LegendPanel / featureInfo panels / useTransportParams 共用單一真實來源。
//
// 語意紅線（P0）：EMS_S_01 列管對象 ≠ 污染源。前端一律用：
//   - 污染潛勢設施（regulated facility × 介質 × 嚴重度）
//   - 污染裁處事件（P_46 開罰事件，分重大 / 一般 / 移動污染，可歷史時間軸播放）
//   - 污染場址（EMS_S_07 確認污染場址 = S4）

/** 介質 key（設施 5 介質；事件另有 noise / other） */
export type PollutionMedium = "air" | "water" | "waste" | "toxic" | "soil" | "noise" | "other";
export type PollutionPenaltySeverity = "critical" | "high" | "normal" | "mobile";

/** 介質色（對應法規領域，與研究文件 schema-and-layers.md §1a 對齊） */
export const POLLUTION_MEDIUM_COLORS: Record<PollutionMedium, string> = {
  air: "#9ca3af",    // 灰 — 空氣污染防制法
  water: "#3b82f6",  // 藍 — 水污染防治法
  waste: "#a16207",  // 棕 — 廢棄物清理法
  toxic: "#a855f7",  // 紫 — 毒性及關注化學物質管理法
  soil: "#ca8a04",   // 土黃 — 土壤及地下水污染整治法
  noise: "#f97316",  // 橘 — 噪音管制法（事件層專有）
  other: "#64748b",  // 灰藍 — 其他自治條例
};

export const POLLUTION_MEDIUM_LABELS: Record<PollutionMedium, string> = {
  air: "空污 Air",
  water: "水污 Water",
  waste: "廢棄物 Waste",
  toxic: "毒化物 Toxic",
  soil: "土污 Soil",
  noise: "噪音 Noise",
  other: "其他 Other",
};

/** 設施 filter checkbox 用的 5 介質（不含 noise/other，那是事件層的裁處法規類別） */
export const FACILITY_MEDIA: PollutionMedium[] = ["air", "water", "waste", "toxic", "soil"];

/** 裁處事件 medium select 選項（idx 0 = 全部；soil 來自土壤及地下水污染整治法裁處） */
export const PENALTY_MEDIA: PollutionMedium[] = ["air", "water", "waste", "toxic", "soil", "noise", "other"];

/** 嚴重度階梯（S0 潛勢 → S4 確認污染場址） */
export interface SeverityBand {
  sev: number;
  color: string;
  label: string;
}

export const SEVERITY_BANDS: SeverityBand[] = [
  { sev: 0, color: "#fde68a", label: "S0 潛勢（登記未罰）" },
  { sev: 1, color: "#fbbf24", label: "S1 曾違規（罰 ≥1）" },
  { sev: 2, color: "#f97316", label: "S2 慣犯（罰 ≥3）" },
  { sev: 3, color: "#dc2626", label: "S3 重大（連續 / 累計 ≥100 萬）" },
  { sev: 4, color: "#111827", label: "S4 確認污染場址" },
];

/** Mapbox step expression：max_sev → 色（用於 facilities + sites 的 severity styling） */
export const SEVERITY_COLOR_EXPR: unknown[] = [
  "step", ["coalesce", ["to-number", ["get", "max_sev"]], 0],
  SEVERITY_BANDS[0]!.color,
  1, SEVERITY_BANDS[1]!.color,
  2, SEVERITY_BANDS[2]!.color,
  3, SEVERITY_BANDS[3]!.color,
  4, SEVERITY_BANDS[4]!.color,
];

/** 裁處事件 event_medium → 色 */
export const PENALTY_MEDIUM_COLOR_EXPR: unknown[] = [
  "match", ["get", "event_medium"],
  "air", POLLUTION_MEDIUM_COLORS.air,
  "water", POLLUTION_MEDIUM_COLORS.water,
  "waste", POLLUTION_MEDIUM_COLORS.waste,
  "toxic", POLLUTION_MEDIUM_COLORS.toxic,
  "soil", POLLUTION_MEDIUM_COLORS.soil,
  "noise", POLLUTION_MEDIUM_COLORS.noise,
  POLLUTION_MEDIUM_COLORS.other,
];

export const PENALTY_SEVERITY_LABELS: Record<PollutionPenaltySeverity, string> = {
  critical: "重大裁處",
  high: "高額一般裁處",
  normal: "一般裁處",
  mobile: "移動污染",
};

export const PENALTY_SEVERITY_COLORS: Record<PollutionPenaltySeverity, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  normal: "#94a3b8",
  mobile: "#22c55e",
};

export const PENALTY_CRITICAL_FILTER: unknown[] = ["==", ["get", "severity_event"], "critical"];
export const PENALTY_GENERAL_FILTER: unknown[] = [
  "any",
  ["==", ["get", "severity_event"], "high"],
  ["==", ["get", "severity_event"], "normal"],
];
export const PENALTY_MOBILE_FILTER: unknown[] = ["==", ["get", "severity_event"], "mobile"];

/** 裁處事件年份範圍（來源 P_46 penalty_year 2010–2026） */
export const PENALTY_YEAR_MIN = 2010;
export const PENALTY_YEAR_MAX = 2026;

export function pollutionYearOptions(): { label: string; value: string }[] {
  const opts = [{ label: "全部年份 All", value: "0" }];
  for (let y = PENALTY_YEAR_MIN; y <= PENALTY_YEAR_MAX; y++) {
    opts.push({ label: String(y), value: String(y) });
  }
  return opts;
}

/** 播放模式：0 = 累積至該年、1 = 僅該年 */
export const PENALTY_MODE_OPTIONS: { label: string; value: string }[] = [
  { label: "累積 ≤ 該年", value: "0" },
  { label: "僅該年", value: "1" },
];
