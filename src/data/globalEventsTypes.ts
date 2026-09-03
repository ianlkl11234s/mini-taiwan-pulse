import type { ExpressionSpecification } from "mapbox-gl";

export const GLOBAL_EVENT_CATEGORIES = [
  { value: "disaster", label: "災害", color: "#ef4444" },
  { value: "accident", label: "事故", color: "#f97316" },
  { value: "health", label: "健康", color: "#eab308" },
  { value: "crime", label: "治安", color: "#a855f7" },
  { value: "traffic", label: "交通", color: "#06b6d4" },
  { value: "policy", label: "政策", color: "#3b82f6" },
  { value: "other", label: "其他", color: "#94a3b8" },
] as const;

export const GLOBAL_EVENT_SEVERITIES = [
  { value: 0, label: "一般", radius: 4 },
  { value: 1, label: "關注", radius: 5.5 },
  { value: 2, label: "重大", radius: 7 },
  { value: 3, label: "嚴重", radius: 9 },
] as const;

export function globalEventCategoryLabel(category: unknown): string {
  const key = typeof category === "string" ? category : "";
  return GLOBAL_EVENT_CATEGORIES.find((item) => item.value === key)?.label ?? "未分類";
}

export function globalEventSeverityLabel(severity: unknown): string {
  return GLOBAL_EVENT_SEVERITIES.find((item) => item.value === severity)?.label ?? "未知";
}

export const GLOBAL_EVENT_CATEGORY_COLOR_EXPR = [
  "match",
  ["get", "category"],
  ...GLOBAL_EVENT_CATEGORIES.flatMap((item) => [item.value, item.color]),
  "#64748b",
] as unknown as ExpressionSpecification;

export const GLOBAL_EVENT_SEVERITY_RADIUS_EXPR = [
  "match",
  ["get", "severity"],
  ...GLOBAL_EVENT_SEVERITIES.flatMap((item) => [item.value, item.radius]),
  4.5,
] as unknown as ExpressionSpecification;
