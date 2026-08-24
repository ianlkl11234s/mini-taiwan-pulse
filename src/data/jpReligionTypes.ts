/** 日本宗教設施三源圖層共用分類與配色。 */

export type JpReligionCategory = "shinto" | "buddhist" | "christian";

export const JP_RELIGION_COLORS = {
  shinto: "#ef4444",
  buddhist: "#f59e0b",
  christian: "#3b82f6",
  other: "#94a3b8",
} as const;

/** Legend、popup 與 Mapbox paint 共用同一份分類語意。 */
export const JP_RELIGION_CATEGORIES = [
  { value: "shinto", label: "神道 Shinto", color: JP_RELIGION_COLORS.shinto },
  { value: "buddhist", label: "佛教 Buddhist", color: JP_RELIGION_COLORS.buddhist },
  { value: "christian", label: "基督宗教 Christian", color: JP_RELIGION_COLORS.christian },
] as const satisfies readonly {
  value: JpReligionCategory;
  label: string;
  color: string;
}[];

/** properties.religion → 共用色相；未知值統一落在 other。 */
export const JP_RELIGION_COLOR_EXPRESSION = [
  "match", ["get", "religion"],
  "shinto", JP_RELIGION_COLORS.shinto,
  "buddhist", JP_RELIGION_COLORS.buddhist,
  "christian", JP_RELIGION_COLORS.christian,
  JP_RELIGION_COLORS.other,
] as const;

export function jpReligionLabel(religion: unknown): string {
  return JP_RELIGION_CATEGORIES.find((row) => row.value === religion)?.label ?? "其他 Other";
}

/**
 * name 缺席時的 popup 標題。GSI 96.7% 是無名地圖記號，不能顯示
 * `undefined`，也不應自行推定特定設施名稱。
 */
export function religionNameFallback(religion: unknown, mapSymbol = false): string {
  const suffix = mapSymbol ? "（地図記号）" : "";
  if (religion === "shinto") return `神社${suffix}`;
  if (religion === "buddhist") return `寺院${suffix}`;
  if (religion === "christian") return `基督宗教設施${suffix}`;
  return `宗教設施${suffix}`;
}
