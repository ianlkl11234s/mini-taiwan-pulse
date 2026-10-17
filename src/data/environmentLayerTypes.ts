// 環境氣候：水質／污水、空品、污染與輻射圖層的色票、標籤與 filter SSOT（§3.16 資料語意色）。
// 供 manifest、overlay、legend 與 popup 共用，避免語意漂移。第二波新增的色一律取自既有色票
// （Statistics 序列色、PM2.5 五級、本檔 RPI／水質測站色），不另造色號；只 import 純資料常數檔，無循環。
// 飲用水水源水質保護區（環境部，飲用水管理條例）≠ 既有 waterProtectionZones（水利署，自來水法），
// 色系刻意避開其 emerald 綠，命名也明示主管機關。

import { STATISTICS_SEQUENTIAL_SCHEMES as SEQ } from "./statisticsVisuals";
import { MICRO_SENSOR_PM25_BANDS } from "./microSensorTypes";

export const ENVIRONMENT_LAYER_COLORS = {
  riverRpiStations: "#0ea5e9",
  waterQualityStations: "#6366f1",
  sewageTreatmentPlants: "#14b8a6",
  drinkingWaterProtectionZones: "#2563eb",
  // 第二波（2026-10-02）
  seaWaterQualityStations: SEQ.utilities.colors[4],
  riverRpiSegments: "#38bdf8",
  pm25ManualStations: MICRO_SENSOR_PM25_BANDS[0]!.color,
  dioxinStations: SEQ.environment.colors[4],
  incineratorEmissions: SEQ.livestock.colors[3],
  nuscGammaRadiation: SEQ.education.colors[3],
  waterEffluentLive: "#14b8a6",
  cemsStackLive: SEQ.environment.colors[3],
  cwaUvDaily: MICRO_SENSOR_PM25_BANDS[2]!.color,
} as const;

/** 環境部 RPI 四級（官方分級，S≤2／≤3／≤6／>6）；顏色只表官方等級，不另做分數。 */
export const RIVER_RPI_CLASSES = [
  { value: "未(稍)受污染", label: "未（稍）受污染", color: "#38bdf8" },
  { value: "輕度污染", label: "輕度污染", color: "#facc15" },
  { value: "中度污染", label: "中度污染", color: "#f97316" },
  { value: "嚴重污染", label: "嚴重污染", color: "#dc2626" },
] as const;
/** latest_rpi 為 null：無資料，不是乾淨；中空點。 */
export const RIVER_RPI_NO_DATA_COLOR = "#94a3b8";

export const RIVER_RPI_FILTER_OPTIONS = [
  { label: "全部測站", value: "all" },
  ...RIVER_RPI_CLASSES.map((row) => ({ label: row.label, value: row.value })),
] as const;

export const RIVER_RPI_COLOR_EXPR: unknown[] = [
  "match", ["get", "latest_class"],
  ...RIVER_RPI_CLASSES.flatMap((row) => [row.value, row.color]),
  RIVER_RPI_NO_DATA_COLOR,
];

/** 「全部」仍保留無資料測站；選定等級時只顯示該級。 */
export function riverRpiClassFilter(index: number): unknown[] {
  const selected = RIVER_RPI_FILTER_OPTIONS[index]?.value ?? "all";
  return selected === "all" ? ["all"] : ["==", ["get", "latest_class"], selected];
}

export const WATER_QUALITY_STATION_TYPES = [
  { value: "river", label: "河川", color: "#0ea5e9" },
  { value: "groundwater", label: "地下水", color: "#b45309" },
  { value: "reservoir", label: "水庫", color: "#7c3aed" },
] as const;

export const WATER_QUALITY_STATION_FILTER_OPTIONS = [
  { label: "全部類型", value: "all" },
  ...WATER_QUALITY_STATION_TYPES.map((row) => ({ label: row.label, value: row.value })),
] as const;

export const WATER_QUALITY_STATION_COLOR_EXPR: unknown[] = [
  "match", ["get", "station_type"],
  ...WATER_QUALITY_STATION_TYPES.flatMap((row) => [row.value, row.color]),
  "#94a3b8",
];

export function waterQualityStationTypeFilter(index: number): unknown[] {
  const selected = WATER_QUALITY_STATION_FILTER_OPTIONS[index]?.value ?? "all";
  return selected === "all" ? ["all"] : ["==", ["get", "station_type"], selected];
}

export const WATER_QUALITY_STATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WATER_QUALITY_STATION_TYPES.map((row) => [row.value, row.label]),
);

/** Google geocode 只到幾何中心或約略位置者（14 處）以淡色中空表示位置不確定。 */
export const SEWAGE_UNCERTAIN_QUALITIES = ["APPROXIMATE", "GEOMETRIC_CENTER"] as const;
export const SEWAGE_GEOCODE_QUALITY_LABELS: Record<string, string> = {
  ROOFTOP: "門牌精確定位",
  RANGE_INTERPOLATED: "路段內插定位",
  GEOMETRIC_CENTER: "區域幾何中心（位置不確定）",
  APPROXIMATE: "約略位置（位置不確定）",
};
export const SEWAGE_UNCERTAIN_EXPR: unknown[] = ["in", ["get", "geocode_quality"], ["literal", [...SEWAGE_UNCERTAIN_QUALITIES]]];

export const DRINKING_WATER_ZONE_TYPES = [
  { value: "保護區", label: "水源水質保護區", color: "#2563eb" },
  { value: "一定距離", label: "取水口一定距離", color: "#06b6d4" },
] as const;

/** 未知 zone_type 的中性 slate；CEMS「暫停／停工」沿用同一色。 */
export const ENV_NEUTRAL_SLATE = "#64748b";
export const DRINKING_WATER_ZONE_COLOR_EXPR: unknown[] = [
  "match", ["get", "zone_type"],
  ...DRINKING_WATER_ZONE_TYPES.flatMap((row) => [row.value, row.color]),
  ENV_NEUTRAL_SLATE,
];

// ══════════════════════════════════════════════════════════════════
//  第二波（2026-10-02）：海域水質、PM2.5 手動站、戴奧辛、焚化廠、RPI 河段試作、4 個即時 RPC 層
// ══════════════════════════════════════════════════════════════════

/** 過期／停測／缺值一律中空灰點：保留位置，但不用顏色暗示數值（null 不當 0）。 */
export const ENV_STALE_COLOR = RIVER_RPI_NO_DATA_COLOR;

/** 線性漸層 stops → Mapbox interpolate 與 CSS linear-gradient 共用同一組。 */
export interface EnvGradientStop { value: number; color: string }
export function envInterpolate(field: string, stops: readonly EnvGradientStop[]): unknown[] {
  return ["interpolate", ["linear"], ["to-number", ["get", field]], ...stops.flatMap((stop) => [stop.value, stop.color])];
}
export function envCssGradient(stops: readonly EnvGradientStop[]): string {
  return `linear-gradient(90deg, ${stops.map((stop) => stop.color).join(", ")})`;
}

// ── 海域水質測站（海洋委員會；甲乙丙＝海域環境分類，法定用途分級，不是單次採樣好壞）──
export const SEA_WATER_CLASSES = [
  { value: "甲", label: "甲類海域", color: SEQ.utilities.colors[4] },
  { value: "乙", label: "乙類海域", color: SEQ.utilities.colors[3] },
  { value: "丙", label: "丙類海域", color: SEQ.utilities.colors[2] },
] as const;
export const SEA_WATER_CLASS_COLOR_EXPR: unknown[] = [
  "match", ["get", "water_quality_class"],
  ...SEA_WATER_CLASSES.flatMap((row) => [row.value, row.color]),
  ENV_STALE_COLOR,
];
/** is_stale=true 或從未採樣（latest_sample_date null）→ 中空灰。 */
export const SEA_WATER_STALE_EXPR: unknown[] = ["any", ["==", ["get", "is_stale"], true], ["==", ["get", "latest_sample_date"], null]];

/** 測值旗標（上游 export_wave2_layers 的 *_flag）→ 人話；lt_dl 時數值是偵測極限值。 */
export const ENV_VALUE_FLAG_LABELS: Record<string, string> = {
  lt_dl: "低於偵測極限",
  ND: "未檢出",
  dash_not_measured: "未測（原檔「－」）",
  empty: "原檔空白",
  no_measurements: "無測值",
  unparsed: "原值無法解析",
  not_reported: "未申報",
  "invalid_-1": "原檔 -1（缺值）",
  negative_invalid: "負值（無效）",
  no_test: "無檢測",
  older_than_24m: "最近檢測已逾 24 個月",
  zero_reported: "申報 0（不合物理，視為缺值）",
  no_valid_in_window: "近 12 個月無有效樣本",
  same_siteid_air_station: "同編號空品站座標",
};

// ── PM2.5 手動採樣站（環境部；色與 LASS 微型感測 PM2.5 五級同源，改成連續漸層）──
export const PM25_MANUAL_STOPS: readonly EnvGradientStop[] = [
  { value: 0, color: MICRO_SENSOR_PM25_BANDS[0]!.color },
  { value: 15, color: MICRO_SENSOR_PM25_BANDS[1]!.color },
  { value: 35, color: MICRO_SENSOR_PM25_BANDS[2]!.color },
  { value: 54, color: MICRO_SENSOR_PM25_BANDS[3]!.color },
];
/** 停測（is_active=false）或近 12 月無有效樣本 → 中空灰。 */
export const PM25_MANUAL_INACTIVE_EXPR: unknown[] = ["any", ["!=", ["get", "is_active"], true], ["==", ["get", "mean_12m_ugm3"], null]];

// ── 環境空氣戴奧辛測站（環境部；pg I-TEQ/m3，序列色只表相對高低）──
export const DIOXIN_STATION_STOPS: readonly EnvGradientStop[] = [
  { value: 0.003, color: SEQ.environment.colors[1] },
  { value: 0.01, color: SEQ.environment.colors[2] },
  { value: 0.025, color: SEQ.environment.colors[3] },
  { value: 0.05, color: SEQ.environment.colors[4] },
];

// ── 焚化廠空污（環境部 fac_s_04；以 NOx 著色：25 廠皆有值且分布 26–86 ppm；
//    戴奧辛最大值被單廠 0.592 拉開，其餘 24 廠會擠在同一色，故只放 popup 照實顯示）──
export const INCINERATOR_NOX_STOPS: readonly EnvGradientStop[] = [
  { value: 30, color: SEQ.livestock.colors[1] },
  { value: 45, color: SEQ.livestock.colors[2] },
  { value: 60, color: SEQ.livestock.colors[3] },
  { value: 80, color: SEQ.livestock.colors[4] },
];

// ── RPI 河段推估（全台；與 riverRpiStations 同一組官方四級色）──
export const RIVER_RPI_SEGMENT_MODES = [
  { label: "最新一次", value: "latest", field: "class_latest" },
  { label: "近 12 月平均", value: "mean12m", field: "class_12m_mean" },
] as const;
export function riverRpiSegmentColorExpr(modeIdx: number): unknown[] {
  const field = RIVER_RPI_SEGMENT_MODES[modeIdx]?.field ?? RIVER_RPI_SEGMENT_MODES[0].field;
  return ["match", ["get", field], ...RIVER_RPI_CLASSES.flatMap((row) => [row.value, row.color]), RIVER_RPI_NO_DATA_COLOR];
}
/** 已確認感潮段（tidal=yes，4 段）RPI 代表性較差 → 虛線；部分感潮未驗證（32 段）只在 popup 揭露，免得整個水系都變虛線。
 *  感潮只在淡水河／高屏溪判定，其餘流域一律 unknown（不代表不感潮）。 */
export const RIVER_RPI_TIDAL_VALUES = ["yes"] as const;
export const RIVER_RPI_TIDAL_LABELS: Record<string, string> = {
  yes: "感潮段",
  partial_unverified: "部分感潮（未驗證）",
  unknown: "未判定",
};
/** 測站河名 → 河段的指派方式（popup 白話；不顯示內部代碼）。 */
export const RIVER_RPI_ASSIGN_METHOD_LABELS: Record<string, string> = {
  same_name: "測站登記河名與河道同名",
  nearest_in_basin_200m: "依測站位置對應同流域 200 公尺內最近河道",
};
/** 改派：環境部測站河名常填流域主流名，實際在支流上 → 依位置對應（只有這種方式才顯示「登記為 X，對應至 Y」）。 */
export const RIVER_RPI_REASSIGN_METHOD = "nearest_in_basin_200m";
/** 流向判定（direction）。推斷／未驗證在 popup 主區顯示，不再於待複核重複。 */
export const RIVER_RPI_DIRECTION_LABELS: Record<string, string> = {
  verified: "已依水利署河系驗證",
  inferred_osm_confluence: "推斷（依河川匯流形狀，無官方河系可驗）",
  unverified: "未驗證",
};
/** review_flags（分號分隔）→ 白話。direction_* 由流向列表達，這裡略過；未列出的旗標顯示通用文字，絕不顯示原字串。 */
export const RIVER_RPI_REVIEW_FLAG_LABELS: Record<string, string | null> = {
  code_basin_conflict: "河道代碼與流域不一致，待複核",
  direction_inferred: null,
  direction_unverified: null,
  low_coverage: "測站只涵蓋整條河的一小段（多為僅一站且位於下游）",
  station_basin_label_mismatch: "測站登記的流域名稱與官方流域範圍不一致（命名差異，不代表配錯）",
  station_offline_gt200m: "測站距河道中心線超過 200 公尺，依官方河道範圍採用",
  short_segment_lt100m: "河段短於 100 公尺",
  same_name_outside_basin: "同名河道位於其他流域，待複核",
  shared_river_across_groups: "同一河道被兩個流域重複切段，待複核",
  group_error: "流域分組處理異常，待複核",
};
export const RIVER_RPI_REVIEW_FLAG_FALLBACK = "其他待複核事項";
export function riverRpiReviewNotes(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  const notes = raw.split(";").map((flag) => flag.trim()).filter(Boolean)
    .map((flag) => (flag in RIVER_RPI_REVIEW_FLAG_LABELS ? RIVER_RPI_REVIEW_FLAG_LABELS[flag] : RIVER_RPI_REVIEW_FLAG_FALLBACK))
    .filter((note): note is string => note != null);
  return [...new Set(notes)];
}
export const OSM_ODBL_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

// ── 環境輻射（核安會 63 站；≠ nuclearRadiation 台電核設施周界，色系刻意用紫，不用綠）──
export const NUSC_GAMMA_STOPS: readonly EnvGradientStop[] = [
  { value: 0.03, color: SEQ.education.colors[1] },
  { value: 0.06, color: SEQ.education.colors[2] },
  { value: 0.09, color: SEQ.education.colors[3] },
  { value: 0.14, color: SEQ.education.colors[4] },
];
/** 一般背景約 0.04–0.14 μSv/h；≥0.2 以紅框提示「高於一般背景」，請以核安會公告為準。 */
export const NUSC_GAMMA_HIGH_USVH = 0.2;
export const ENV_ALERT_COLOR = RIVER_RPI_CLASSES[3].color;

// ── 放流水連線監測（環境部；上游 status=超限值 才算超標）──
export const WATER_EFFLUENT_STATUSES = [
  { value: "exceed", label: "有測項超限", color: ENV_ALERT_COLOR },
  { value: "abnormal", label: "有測項異常（故障／無效／維修／暫停）", color: RIVER_RPI_CLASSES[1].color },
  { value: "normal", label: "測項正常", color: ENVIRONMENT_LAYER_COLORS.waterEffluentLive },
] as const;
export const WATER_EFFLUENT_COORD_SOURCE_LABELS: Record<string, string> = {
  feed: "監測資料自帶座標",
  ems_facility: "環境部列管設施座標（EMS）",
};

// ── CEMS 煙道（環境部；code2 首碼＝運轉狀態，逾限依上游「數值逾限」）──
export const CEMS_STATUSES = [
  { value: "exceed", label: "數值逾限", color: ENV_ALERT_COLOR },
  { value: "running", label: "正常運轉（N）", color: SEQ.environment.colors[3] },
  { value: "startStop", label: "起火／停車期間（C／E）", color: SEQ.environment.colors[2] },
  { value: "maintenance", label: "歲（檢）修（G）", color: WATER_QUALITY_STATION_TYPES[1].color },
  { value: "halted", label: "暫停運轉／停工（F／P）", color: ENV_NEUTRAL_SLATE },
] as const;
export type CemsStatus = (typeof CEMS_STATUSES)[number]["value"] | "unknown";
export const CEMS_CODE2_LEAD_LABELS: Record<string, string> = {
  N: "正常運轉", F: "暫停運轉", G: "歲（檢）修", P: "停工", E: "停車期間", C: "起火期間",
};
/**
 * 設施層級狀態：任一測項逾限 → exceed；否則任一煙道正常運轉（N）→ running；
 * 否則 C／E → startStop；否則 G → maintenance；否則 F／P → halted；都沒有 → unknown。
 */
export function cemsFacilityStatus(exceedCount: number, code2Leads: readonly string[]): CemsStatus {
  if (exceedCount > 0) return "exceed";
  const leads = new Set(code2Leads);
  if (leads.has("N")) return "running";
  if (leads.has("C") || leads.has("E")) return "startStop";
  if (leads.has("G")) return "maintenance";
  if (leads.has("F") || leads.has("P")) return "halted";
  return "unknown";
}

// ── 紫外線（氣象署；前一天最大值，色與 PM2.5 五級同序：綠黃橙紅紫）──
export const CWA_UV_LEVELS = [
  { value: "低量級", label: "低量級 0–2", color: MICRO_SENSOR_PM25_BANDS[0]!.color },
  { value: "中量級", label: "中量級 3–5", color: MICRO_SENSOR_PM25_BANDS[1]!.color },
  { value: "高量級", label: "高量級 6–7", color: MICRO_SENSOR_PM25_BANDS[2]!.color },
  { value: "過量級", label: "過量級 8–10", color: MICRO_SENSOR_PM25_BANDS[3]!.color },
  { value: "危險級", label: "危險級 ≥11", color: MICRO_SENSOR_PM25_BANDS[4]!.color },
] as const;

/** 狀態類 match（status 屬性 → 色），未知值落灰。 */
export function envStatusColorExpr(field: string, rows: readonly { value: string; color: string }[]): unknown[] {
  return ["match", ["get", field], ...rows.flatMap((row) => [row.value, row.color]), ENV_STALE_COLOR];
}
