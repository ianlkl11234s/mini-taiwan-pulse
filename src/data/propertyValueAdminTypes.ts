import type { PropertyValueAdminRow } from "./propertyValueAdminLoader";

export type PropertyValueAdminLevel = "county" | "township";

export const PROPERTY_VALUE_ADMIN_MISSING_COLOR = "#374151";
export const PROPERTY_VALUE_ADMIN_COLORS = ["#fff7bc", "#fec44f", "#fe9929", "#ec7014", "#cc4c02"] as const;

export interface PropertyValueAdminLevelConfig {
  key: PropertyValueAdminLevel;
  label: string;
  sourceId: string;
  sourceLayer: string;
  sourceUrl: string;
  codeProperty: string;
  nameProperty: string;
  fillLayerId: string;
  lineLayerId: string;
  minzoom: number;
  expectedCount: number;
  breaks: readonly number[];
}
export const PROPERTY_VALUE_ADMIN_LEVELS: Record<PropertyValueAdminLevel, PropertyValueAdminLevelConfig> = {
  county: {
    key: "county",
    label: "縣市",
    sourceId: "property-value-admin-county",
    sourceLayer: "county_boundary",
    sourceUrl: "./base_map/county_boundary.pmtiles",
    codeProperty: "行政區域代碼",
    nameProperty: "名稱",
    fillLayerId: "property-value-admin-county-fill",
    lineLayerId: "property-value-admin-county-line",
    minzoom: 0,
    expectedCount: 22,
    breaks: [2e12, 4e12, 8e12, 20e12],
  },
  township: {
    key: "township",
    label: "鄉鎮市區",
    sourceId: "property-value-admin-township",
    sourceLayer: "township_boundary",
    sourceUrl: "./base_map/township_boundary.pmtiles",
    codeProperty: "TOWNCODE",
    nameProperty: "TOWNNAME",
    fillLayerId: "property-value-admin-township-fill",
    lineLayerId: "property-value-admin-township-line",
    minzoom: 6,
    expectedCount: 368,
    breaks: [50e9, 150e9, 500e9, 1e12],
  },
};

export const PROPERTY_VALUE_ADMIN_LEVEL_OPTIONS = [
  { label: "縣市（19 / 22）", value: "county" },
  { label: "鄉鎮市區（352 / 368，z6+）", value: "township" },
] as const;

export function resolvePropertyValueAdminLevel(levelIdx: number): PropertyValueAdminLevel {
  return levelIdx === 1 ? "township" : "county";
}

export function propertyValueAdminColorExpression(level: PropertyValueAdminLevel): unknown[] {
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  return [
    "case",
    ["==", ["feature-state", "value_market_corrected"], null], PROPERTY_VALUE_ADMIN_MISSING_COLOR,
    [
      "step", ["feature-state", "value_market_corrected"], PROPERTY_VALUE_ADMIN_COLORS[0],
      config.breaks[0], PROPERTY_VALUE_ADMIN_COLORS[1],
      config.breaks[1], PROPERTY_VALUE_ADMIN_COLORS[2],
      config.breaks[2], PROPERTY_VALUE_ADMIN_COLORS[3],
      config.breaks[3], PROPERTY_VALUE_ADMIN_COLORS[4],
    ],
  ];
}

/** Mapbox feature-state 只放 primitive；缺值略過，不得寫成 0。 */
export function propertyValueAdminFeatureState(row: PropertyValueAdminRow, level: PropertyValueAdminLevel) {
  return {
    admin_level: level,
    admin_name: row.name,
    admin_code: row.code,
    county_name: row.county ?? (level === "county" ? row.name : ""),
    value_market_corrected: row.value_market_corrected,
    n_buildings: row.n_buildings,
    gfa_m2: row.gfa_m2,
    gfa_factor_used: row.gfa_factor_used,
  };
}

export function formatPropertyValueTwd(value: number): string {
  if (!Number.isFinite(value)) return "無資料";
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(value >= 10e12 ? 1 : 2)} 兆元`;
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(value >= 10e8 ? 1 : 2)} 億元`;
  return `${Math.round(value).toLocaleString("zh-TW")} 元`;
}
