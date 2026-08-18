/**
 * 全球通訊圖層共用色票。
 * PCH IXP Directory 的 region 值供 overlay、legend、popup 三處共用。
 */
export const IXP_REGIONS = [
  { value: "Africa", label: "非洲 Africa", color: "#F59E0B" },
  { value: "Asia-Pacific", label: "亞太 Asia-Pacific", color: "#22C55E" },
  { value: "Europe", label: "歐洲 Europe", color: "#60A5FA" },
  { value: "Latin America", label: "拉丁美洲 Latin America", color: "#F472B6" },
  { value: "North America", label: "北美 North America", color: "#A78BFA" },
] as const;

export const IXP_UNKNOWN_COLOR = "#94A3B8";

export const IXP_REGION_COLOR_EXPR = [
  "match", ["get", "region"],
  ...IXP_REGIONS.flatMap((region) => [region.value, region.color]),
  IXP_UNKNOWN_COLOR,
] as unknown as string;

export function ixpRegionColor(region: string): string {
  return IXP_REGIONS.find((entry) => entry.value === region)?.color ?? IXP_UNKNOWN_COLOR;
}

export const ANFR_OPERATORS = [
  { value: "ORANGE", label: "Orange", color: "#F97316" },
  { value: "FREE MOBILE", label: "Free Mobile", color: "#2563EB" },
  { value: "BOUYGUES TELECOM", label: "Bouygues Telecom", color: "#06B6D4" },
  { value: "SFR", label: "SFR", color: "#EF4444" },
  { value: "other", label: "Other", color: "#94A3B8" },
] as const;
export const ANFR_OPERATOR_COLOR_EXPR = [
  "match", ["at", 0, ["get", "operators"]],
  ...ANFR_OPERATORS.slice(0, 4).flatMap((operator) => [operator.value, operator.color]),
  ANFR_OPERATORS[4].color,
] as unknown as string;
export function anfrOperatorColor(operator: string): string {
  return ANFR_OPERATORS.find((entry) => entry.value === operator)?.color ?? ANFR_OPERATORS[4].color;
}

export const OSM_COMMUNICATION_TYPES = [
  { value: "mobile_phone", label: "行動電話 Mobile", color: "#38BDF8" },
  { value: "radio", label: "廣播 Radio", color: "#A78BFA" },
  { value: "television", label: "電視 Television", color: "#F472B6" },
  { value: "microwave", label: "微波 Microwave", color: "#F59E0B" },
  { value: "general", label: "其他通訊 General", color: "#94A3B8" },
] as const;

export const OSM_COMMUNICATION_COLOR_EXPR = [
  "match", ["get", "site_kind"],
  "mobile_phone", "#38BDF8",
  "radio", "#A78BFA",
  "television", "#F472B6",
  "microwave", "#F59E0B",
  "#94A3B8",
] as unknown as string;

export function osmCommunicationColor(siteKind: string): string {
  return OSM_COMMUNICATION_TYPES.find((entry) => entry.value === siteKind)?.color ?? OSM_COMMUNICATION_TYPES[4].color;
}
