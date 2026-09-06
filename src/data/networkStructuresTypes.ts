import type { ExpressionSpecification } from "mapbox-gl";

export const NETWORK_STRUCTURES_COLORS = {
  carriers: "#f97316",
  footprint: "#38bdf8",
  official: "#38bdf8",
  matched: "#22c55e",
  ambiguous: "#f59e0b",
  geometryMismatch: "#ef4444",
  officialOnly: "#8b5cf6",
  osmOnly: "#64748b",
  notEvaluated: "#94a3b8",
} as const;

export const CARRIER_KINDS = [
  { value: "road", label: "道路", color: "#f97316" },
  { value: "rail", label: "鐵道", color: "#8b5cf6" },
  { value: "foot", label: "步行", color: "#22c55e" },
  { value: "bicycle", label: "自行車", color: "#06b6d4" },
  { value: "aqueduct", label: "輸水", color: "#3b82f6" },
  { value: "pipeline", label: "管線", color: "#ec4899" },
  { value: "other", label: "其他", color: "#94a3b8" },
] as const;

export const MATCH_STATUSES = [
  { value: "MATCHED", label: "候選一致", color: NETWORK_STRUCTURES_COLORS.matched },
  { value: "AMBIGUOUS", label: "多重候選", color: NETWORK_STRUCTURES_COLORS.ambiguous },
  { value: "GEOMETRY_MISMATCH", label: "幾何不符", color: NETWORK_STRUCTURES_COLORS.geometryMismatch },
  { value: "OFFICIAL_ONLY", label: "僅官方", color: NETWORK_STRUCTURES_COLORS.officialOnly },
  { value: "OSM_ONLY", label: "僅 OSM", color: NETWORK_STRUCTURES_COLORS.osmOnly },
  { value: "NOT_EVALUATED", label: "未評估", color: NETWORK_STRUCTURES_COLORS.notEvaluated },
] as const;

export const carrierColorExpression: ExpressionSpecification = [
  "match", ["get", "carrier_kind"], ...CARRIER_KINDS.flatMap((x) => [x.value, x.color]), NETWORK_STRUCTURES_COLORS.carriers,
];
export const comparisonColorExpression: ExpressionSpecification = [
  "match", ["get", "match_status"], ...MATCH_STATUSES.flatMap((x) => [x.value, x.color]), NETWORK_STRUCTURES_COLORS.notEvaluated,
];

const COMPARISON_STATUS_VALUES = ["all", ...MATCH_STATUSES.map((item) => item.value)];

export function comparisonStatusFilter(params?: Record<string, number>): unknown[] {
  const index = params?.bridgeComparisonNewTaipeiStatusIdx ?? 0;
  const value = COMPARISON_STATUS_VALUES[index] ?? "all";
  return value === "all" ? ["has", "feature_id"] : ["==", ["get", "match_status"], value];
}

export function comparisonGeometryFilter(params?: Record<string, number>): unknown[] {
  return ["all", comparisonStatusFilter(params), ["==", ["get", "geometry_role"], "coincident_endpoints"]];
}
