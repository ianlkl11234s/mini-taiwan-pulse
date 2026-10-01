// 環境部水質／污水四個靜態圖層的色票、標籤與 filter SSOT（§3.16 資料語意色）。
// 刻意零 import，供 manifest、overlay、legend 與 popup 共用，避免語意漂移。
// 飲用水水源水質保護區（環境部，飲用水管理條例）≠ 既有 waterProtectionZones（水利署，自來水法），
// 色系刻意避開其 emerald 綠，命名也明示主管機關。

export const ENVIRONMENT_LAYER_COLORS = {
  riverRpiStations: "#0ea5e9",
  waterQualityStations: "#6366f1",
  sewageTreatmentPlants: "#14b8a6",
  drinkingWaterProtectionZones: "#2563eb",
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

export const DRINKING_WATER_ZONE_COLOR_EXPR: unknown[] = [
  "match", ["get", "zone_type"],
  ...DRINKING_WATER_ZONE_TYPES.flatMap((row) => [row.value, row.color]),
  "#64748b",
];
