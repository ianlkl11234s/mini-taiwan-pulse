// 噪音／聲響六層的色票、標籤與 filter SSOT。
// 此檔刻意零 import，供 manifest、overlay、legend 與 popup 共用，避免語意漂移。

export const NOISE_LAYER_COLORS = {
  officialNoiseMonitoring: "#38bdf8",
  noiseCaptureGrid: "#f59e0b",
  noiseControlZones: "#8b5cf6",
  aviationNoiseZones: "#ef4444",
  noiseEnforcementEvents: "#f97316",
  soundCameraLocations: "#22c55e",
} as const;

export const OFFICIAL_NOISE_PERIODS = [
  { label: "日間 Day", value: "day" },
  { label: "晚間 Evening", value: "evening" },
  { label: "夜間 Night", value: "night" },
] as const;

export const OFFICIAL_NOISE_FRESHNESS = {
  fresh: { label: "近期樣本", color: "#38bdf8" },
  historical: { label: "歷史樣本", color: "#64748b" },
  unavailable: { label: "無已驗 dB", color: "#94a3b8" },
} as const;

export const SOUND_CAMERA_PRECISIONS = [
  { label: "全部可畫位置", value: "all" },
  { label: "地址定位", value: "geocoded_address" },
  { label: "路段定位", value: "road_segment" },
  { label: "模糊定位", value: "fuzzy" },
] as const;

export const SOUND_CAMERA_PRECISION_META = {
  geocoded_address: { label: "地址定位", color: "#22c55e" },
  road_segment: { label: "路段定位", color: "#eab308" },
  fuzzy: { label: "模糊定位", color: "#94a3b8" },
} as const;

export const NOISE_CONTROL_ZONE_META = {
  1: { label: "第一類", color: "#c4b5fd" },
  2: { label: "第二類", color: "#a78bfa" },
  3: { label: "第三類", color: "#7c3aed" },
  4: { label: "第四類", color: "#4c1d95" },
} as const;

export const AVIATION_NOISE_ZONE_META = {
  1: { label: "第一級", color: "#facc15" },
  2: { label: "第二級", color: "#f97316" },
  3: { label: "第三級", color: "#dc2626" },
} as const;

export const NOISE_CAPTURE_ATTRIBUTION =
  "NoiseCapture / Noise-Planet contributors (ODbL-1.0 / DbCL-1.0)";

/** 噪音裁處的分色與既有污染裁處 severity legend 共用同一語意。 */
export const NOISE_ENFORCEMENT_COLOR_EXPR: unknown[] = [
  "match", ["get", "severity_event"],
  "critical", "#ef4444",
  "high", "#f59e0b",
  "mobile", "#22c55e",
  "normal", "#94a3b8",
  "#94a3b8",
];

export const NOISE_CONTROL_ZONE_COLOR_EXPR: unknown[] = [
  "match", ["to-number", ["get", "zone_class"]],
  1, NOISE_CONTROL_ZONE_META[1].color,
  2, NOISE_CONTROL_ZONE_META[2].color,
  3, NOISE_CONTROL_ZONE_META[3].color,
  4, NOISE_CONTROL_ZONE_META[4].color,
  "#64748b",
];

export const AVIATION_NOISE_ZONE_COLOR_EXPR: unknown[] = [
  "match", ["to-number", ["get", "display_zone_level"]],
  1, AVIATION_NOISE_ZONE_META[1].color,
  2, AVIATION_NOISE_ZONE_META[2].color,
  3, AVIATION_NOISE_ZONE_META[3].color,
  "#64748b",
];

export const NOISE_CAPTURE_COLOR_EXPR: unknown[] = [
  "interpolate", ["linear"],
  ["to-number", ["get", "laeq_energy_db"]],
  45, "#2563eb",
  55, "#22c55e",
  65, "#facc15",
  75, "#f97316",
  85, "#dc2626",
];

export const OFFICIAL_NOISE_COLOR_EXPR: unknown[] = [
  "interpolate", ["linear"],
  ["coalesce", ["to-number", ["get", "laeq_window_db"]], 40],
  40, "#2563eb",
  50, "#06b6d4",
  60, "#22c55e",
  70, "#facc15",
  80, "#f97316",
  90, "#dc2626",
];

/** 單選日／晚／夜時，無已驗 dB 的測站仍保留為中空點。 */
export function officialNoisePeriodFilter(periodIdx: number): unknown[] {
  const selected = OFFICIAL_NOISE_PERIODS[periodIdx]?.value ?? "day";
  return [
    "any",
    ["==", ["get", "period_type"], selected],
    ["==", ["get", "freshness_status"], "unavailable"],
  ];
}

/** 只畫 upstream 明確標記可畫的 267 筆；精度選項不可讓 66 筆 pending 混入。 */
export function soundCameraFilter(precisionIdx: number): unknown[] {
  const selected = SOUND_CAMERA_PRECISIONS[precisionIdx]?.value ?? "all";
  const renderable: unknown[] = ["==", ["get", "is_renderable"], true];
  return selected === "all"
    ? renderable
    : ["all", renderable, ["==", ["get", "spatial_precision"], selected]];
}

export const NOISE_ENFORCEMENT_FILTER: unknown[] = [
  "==", ["get", "event_medium"], "noise",
];
