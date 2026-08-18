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
