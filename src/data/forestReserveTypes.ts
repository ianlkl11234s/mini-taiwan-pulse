// 保安林種類配色表（依林業及自然保育署 2025/1151 版「種類」欄位）
// 522 features，含 10 個基本類型 + 3 個複合類型

export interface ForestReserveType {
  key: string;
  label: string;
  color: string;
}

export const FOREST_RESERVE_TYPES: ForestReserveType[] = [
  { key: "土砂捍止保安林", label: "土砂捍止", color: "#92400E" },
  { key: "水源涵養保安林", label: "水源涵養", color: "#0EA5E9" },
  { key: "防風保安林", label: "防風", color: "#A3E635" },
  { key: "飛砂防止保安林", label: "飛砂防止", color: "#EAB308" },
  { key: "潮害防備保安林", label: "潮害防備", color: "#06B6D4" },
  { key: "漁業保安林", label: "漁業", color: "#0891B2" },
  { key: "自然保育保安林", label: "自然保育", color: "#16A34A" },
  { key: "風景保安林", label: "風景", color: "#A855F7" },
  { key: "墜石防止保安林", label: "墜石防止", color: "#DC2626" },
  { key: "衛生保建保安林", label: "衛生保建", color: "#EC4899" },
  { key: "土砂捍止保安林,水源涵養保安林", label: "土砂+水源", color: "#7C3AED" },
  { key: "土砂捍止保安林,漁業保安林", label: "土砂+漁業", color: "#0F766E" },
  { key: "土砂捍止保安林,風景保安林", label: "土砂+風景", color: "#B45309" },
];

// 給 Mapbox `["match", ["get", "種類"], ...]` 使用的 flat array
export const FOREST_RESERVE_TYPE_MATCH = FOREST_RESERVE_TYPES.flatMap((t) => [t.key, t.color]);
