import { type SocialRecipe } from "../data/socialStatisticsRecipes";
import { loadRegionalStatistics } from "../data/regionalStatisticsLoader";
import { createSocialStatisticsAdapters, socialStatisticsDatasetId } from "./statisticsDatasetAdapters";

const DATASET_ID = "segis_bus_operation_county_315fh_1d3";
const BOUNDARY_VERSION = "COUNTY_MOI_1140318";
const PERIOD_START = "2025-01-01";
const PERIOD_END = "2025-12-31";
const COMPLETE_COVERAGE = { expected: { county_count: 22 }, observed: { county_count: 22, missing_county_count: 0, status: "COMPLETE" } };
const COLUMN6_COVERAGE = { expected: { county_count: 22 }, observed: { county_count: 15, missing_county_count: 7, status: "PARTIAL" } };

type BusOperationRecipeInput = {
  layer_key: string;
  indicator_id: string;
  label: string;
  unit: string;
  release_id: string;
  source_field: string;
  coverage?: Record<string, unknown>;
  disclosure?: string;
};

function recipe(input: BusOperationRecipeInput): SocialRecipe {
  return {
    layer_key: input.layer_key,
    enabled: true,
    label: input.label,
    group: "交通統計",
    subgroup: "市區客運營運概況",
    dataset_id: DATASET_ID,
    indicator_id: input.indicator_id,
    level: "county",
    boundary_version: BOUNDARY_VERSION,
    unit: input.unit,
    release_options: [{
      release_id: input.release_id,
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      dimensions: { roc_year: "114", source_field: input.source_field, geographic_coverage: "national_county" },
      bundle_path: `data/processed/transportation/${DATASET_ID}/releases/${input.release_id}.json`,
      coverage: input.coverage ?? COMPLETE_COVERAGE,
      health: input.source_field === "COLUMN6" ? "PARTIAL" : "UNKNOWN",
    }],
    legend: { method: "source_defined", breaks: [], colors: [], missing_color: "#9ca3af", suppressed_pattern: "none", not_reported_label: "未提供", zero_uses_numeric_scale: true, comparison_rule: "不得跨指標或路線加總。" },
    format: { locale: "zh-TW", maximumFractionDigits: 2, null: "缺資料", zero: "0" },
    filters: [],
    related_layer_keys: [],
    boundary_semantics: "COUNTY_ID 與 COUNTY_MOI_1140318 的縣市 identity 已驗證 matched。",
    disclosure: input.disclosure ?? "官方縣市市區客運供給統計；跨路線可能重複，不能推論全國唯一線路、事件或乘客，也不得跨指標加總。",
    source_family: "SEGIS 315FH_1D3",
    publisher: "交通部統計處（SEGIS 315FH_1D3）",
    license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  };
}

/** Eight catalog-whitelisted 114Y county supply indicators, one source field per immutable release. */
export const BUS_OPERATION_STATISTICS_RECIPES: readonly SocialRecipe[] = [
  recipe({ layer_key: "statsBusOperatingRouteLengthKm", indicator_id: "bus_operating_route_length_km", label: "期末營業里程", unit: "公里", release_id: "2025-114-column1-fcb90c6e6b05", source_field: "COLUMN1" }),
  recipe({ layer_key: "statsBusApprovedRouteCount", indicator_id: "bus_approved_route_count", label: "核定路線數", unit: "條", release_id: "2025-114-column2-2cfcc51bbaeb", source_field: "COLUMN2" }),
  recipe({ layer_key: "statsUrbanBusOperatorCount", indicator_id: "urban_bus_operator_count", label: "市區客運業家數", unit: "家", release_id: "2025-114-column3-d29188c54350", source_field: "COLUMN3" }),
  recipe({ layer_key: "statsBusOperatingVehicleCount", indicator_id: "bus_operating_vehicle_count", label: "期末營業車輛", unit: "輛", release_id: "2025-114-column4-9e012e606e3a", source_field: "COLUMN4" }),
  recipe({ layer_key: "statsBusAccessibleVehicleCount", indicator_id: "bus_accessible_vehicle_count", label: "期末無障礙車輛", unit: "輛", release_id: "2025-114-column5-f4969fae6a17", source_field: "COLUMN5" }),
  recipe({ layer_key: "statsBusElectricVehicleCount", indicator_id: "bus_electric_vehicle_count", label: "期末電動車輛", unit: "輛", release_id: "2025-114-column6-5a90492f645a", source_field: "COLUMN6", coverage: COLUMN6_COVERAGE, disclosure: "官方縣市市區客運供給統計；七個縣市 source null 為 missing，不是零；不得跨指標或路線加總。" }),
  recipe({ layer_key: "statsBusOperatingTripCount", indicator_id: "bus_operating_trip_count", label: "營業行車次數", unit: "班次", release_id: "2025-114-column7-27ac5f545458", source_field: "COLUMN7" }),
  recipe({ layer_key: "statsBusOperatingVehicleKm", indicator_id: "bus_operating_vehicle_km", label: "營業行車里程", unit: "車公里", release_id: "2025-114-column8-be577682e7b9", source_field: "COLUMN8" }),
];

// The upstream catalog explicitly holds COLUMN6's business label pending source
// correction. Keep its immutable receipt in this inventory, but do not expose
// the disputed "electric vehicle" interpretation to the query registry.
export const BUS_OPERATION_QUERY_RECIPES = BUS_OPERATION_STATISTICS_RECIPES.filter(recipe => recipe.layer_key !== "statsBusElectricVehicleCount");

export function busOperationStatisticsDatasetId(recipe: Pick<SocialRecipe, "layer_key">): string {
  return socialStatisticsDatasetId(recipe);
}

/** Reuses the common exact-release, status-aware administrative statistics adapter. */
export function createBusOperationStatisticsAdapters(
  loader: typeof loadRegionalStatistics = loadRegionalStatistics,
) {
  return createSocialStatisticsAdapters(BUS_OPERATION_QUERY_RECIPES, loader);
}
