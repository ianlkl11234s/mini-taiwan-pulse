import { describe, expect, it } from "vitest";
import {
  STATISTICS_CHOROPLETH_KEYS,
  STATISTICS_TAB_LAYER_ROLES,
  isStatisticsChoropleth,
} from "../statisticsLayerRegistry";
import { STATISTICS_RECIPES, a1AccidentReleaseSelector, busOperationReleaseSelector, caaAirportActivityReleaseSelector, civilAeronauticsSubsidyReleaseSelector, countyTransportSupplyReleaseSelector, maritimeSubsidyReleaseSelector, taipeiBicycleReleaseSelector, taipeiTrafficViolationCitationReleaseSelector, taichungRoadNoiseMonitoringReleaseSelector, taoyuanAirportReleaseSelector, tmrtStationOutboundReleaseSelector } from "../regionalStatisticsRecipes";

describe("statistics layer role registry", () => {
  it("將 Statistics tab 的 crime choropleth 納入模式，行政邊界明確豁免", () => {
    expect(STATISTICS_TAB_LAYER_ROLES.crimeAreaMonthly).toBe("choropleth");
    expect(STATISTICS_CHOROPLETH_KEYS).toContain("crimeAreaMonthly");
    expect(isStatisticsChoropleth("countyBoundary")).toBe(false);
    expect(isStatisticsChoropleth("townshipBoundary")).toBe(false);
  });

  it("將新航港 county choropleth 納入單一／重疊模式", () => {
    expect(STATISTICS_TAB_LAYER_ROLES.statsMaritimeSubsidyCounty).toBe("choropleth");
    expect(STATISTICS_CHOROPLETH_KEYS).toContain("statsMaritimeSubsidyCounty");
    expect(isStatisticsChoropleth("statsMaritimeSubsidyCounty")).toBe(true);
  });

  it("以真實 43445 的全部五組 release identity 選擇有效年月與基金別", () => {
    expect(STATISTICS_RECIPES.statsMaritimeSubsidyCounty).toMatchObject({
      dataset_id: "maritime_bureau_subsidy_county", indicator_id: "maritime_bureau_recipient_county_subsidy_twd", level: "county", unit: "TWD", dimensions: {},
    });
    expect('releaseId' in STATISTICS_RECIPES.statsMaritimeSubsidyCounty).toBe(false);
    expect([
      { release_id: "2026-07-01-1450d8e18741-b056042f6ff2", period_start: "2026-07-01" },
      { release_id: "2026-07-01-d6c9ce1998ef-d77cafd1bc73", period_start: "2026-07-01" },
      { release_id: "2023-12-01-5f44af09d338-5e944c36cfb9", period_start: "2023-12-01" },
      { release_id: "2024-12-01-469152708767-d4b8475fcb28", period_start: "2024-12-01" },
      { release_id: "2025-12-01-f6a788d31216-b89e229b4a8c", period_start: "2025-12-01" },
    ].map(release => maritimeSubsidyReleaseSelector.resolve(release))).toEqual([
      { releaseId: "2026-07-01-1450d8e18741-b056042f6ff2", dimensions: { roc_year: "115", month: "07", agency_fund: "航港建設基金" } },
      { releaseId: "2026-07-01-d6c9ce1998ef-d77cafd1bc73", dimensions: { roc_year: "115", month: "07", agency_fund: "交通部航港局" } },
      { releaseId: "2023-12-01-5f44af09d338-5e944c36cfb9", dimensions: { roc_year: "112", month: "12", agency_fund: "交通部航港局-前瞻基礎建設計畫第3期特別預算" } },
      { releaseId: "2024-12-01-469152708767-d4b8475fcb28", dimensions: { roc_year: "113", month: "12", agency_fund: "交通部航港局-前瞻基礎建設計畫第4期特別預算" } },
      { releaseId: "2025-12-01-f6a788d31216-b89e229b4a8c", dimensions: { roc_year: "114", month: "12", agency_fund: "交通部航港局-前瞻基礎建設計畫第5期特別預算" } },
    ]);
    expect(maritimeSubsidyReleaseSelector.resolve({ release_id: "2026-07-01-unknown-000", period_start: "2026-07-01" })).toBeNull();
  });

  it("只暴露 analytics 已驗證的民航局 112Q4 immutable release 與完整 dimensions", () => {
    expect(STATISTICS_RECIPES.statsCivilAeronauticsSubsidyCounty).toMatchObject({
      dataset_id: "civil_aeronautics_subsidy_county", indicator_id: "civil_aeronautics_recipient_county_subsidy_twd_ytd", level: "county", unit: "TWD", freshness: "STALE",
      dimensions: { roc_year: "112", quarter: "Q4", budget_type: "civil_aviation_fund", value_basis: "year_to_date_cumulative" },
    });
    expect(civilAeronauticsSubsidyReleaseSelector.resolve({ release_id: "2023-Q4-special_budget-188f815b00fc", period_start: "2023-01-01" })).toEqual({
      releaseId: "2023-Q4-special_budget-188f815b00fc", dimensions: { roc_year: "112", quarter: "Q4", budget_type: "special_budget", value_basis: "year_to_date_cumulative" },
    });
    expect(civilAeronauticsSubsidyReleaseSelector.resolve({ release_id: "2023-Q4-special_budget-000000000000", period_start: "2023-01-01" })).toBeNull();
  });

  it("交通供給只從真實年度 period 導出 112／113，不依 opaque release id 猜測", () => {
    expect(countyTransportSupplyReleaseSelector.resolve({ release_id: "actual-2024", period_start: "2024-01-01", period_end: "2024-12-31" })).toEqual({ releaseId: "actual-2024", dimensions: { roc_year: "113" } });
    expect(countyTransportSupplyReleaseSelector.resolve({ release_id: "looks-like-2024", period_start: "2024-02-01", period_end: "2024-12-31" })).toBeNull();
    expect(STATISTICS_RECIPES.statsMotorcycleLicenseHoldersCount).toMatchObject({ dataset_id: "dgbas_county_transport_supply_10935", indicator_id: "motorcycle_license_holders_count", level: "county", unit: "人", dimensions: { roc_year: "113" }, includeHealth: true });
    expect([
      STATISTICS_RECIPES.statsOffstreetSmallCarParkingSpacesCount,
      STATISTICS_RECIPES.statsOnstreetSmallCarParkingSpacesCount,
      STATISTICS_RECIPES.statsMotorcycleRegisteredCount,
      STATISTICS_RECIPES.statsAutomobileRegisteredCount,
      STATISTICS_RECIPES.statsAutomobileLicenseHoldersCount,
      STATISTICS_RECIPES.statsMotorcycleLicenseHoldersCount,
    ].every(recipe => recipe.includeHealth)).toBe(true);
  });

  it("只將 manifest 驗證的臺北違規法條 release 對應到法條維度", () => {
    expect(STATISTICS_RECIPES.statsTaipeiTrafficViolationCitations).toMatchObject({
      dataset_id: "taipei_traffic_violation_citations_135096", indicator_id: "traffic_violation_citation_count", level: "county", unit: "筆",
      releaseId: "2025-63000-3ae38195a39a-22c825ca2e23", dimensions: { roc_year: "114", law_article: "第12條", geographic_coverage: "taipei_only" }, includeHealth: true,
    });
    expect(taipeiTrafficViolationCitationReleaseSelector.resolve({ release_id: "2025-63000-3ae38195a39a-22c825ca2e23", period_start: "2025-01-01", period_end: "2025-12-31" })).toEqual({
      releaseId: "2025-63000-3ae38195a39a-22c825ca2e23", dimensions: { roc_year: "114", law_article: "第12條", geographic_coverage: "taipei_only" },
    });
    expect(taipeiTrafficViolationCitationReleaseSelector.resolve({ release_id: "2025-63000-3ae38195a39a-unknown", period_start: "2025-01-01", period_end: "2025-12-31" })).toBeNull();
  });

  it("只將 manifest 驗證的臺中道路噪音 release 對應到管制區類別", () => {
    expect(STATISTICS_RECIPES.statsTaichungRoadNoiseMonitoringStations).toMatchObject({
      dataset_id: "taichung_road_noise_monitoring_stations_89477", indicator_id: "road_traffic_noise_monitoring_station_count", level: "county", unit: "站",
      releaseId: "2024-Q3-66000-5d2656bf680f", dimensions: { roc_year: "113", quarter: "Q3", control_zone_class: "第一類管制區", geographic_coverage: "taichung_only" }, includeHealth: true,
    });
    expect(taichungRoadNoiseMonitoringReleaseSelector.resolve({ release_id: "2024-Q3-66000-40789289a250", period_start: "2024-07-01", period_end: "2024-09-30" })).toEqual({
      releaseId: "2024-Q3-66000-40789289a250", dimensions: { roc_year: "113", quarter: "Q3", control_zone_class: "第四類管制區", geographic_coverage: "taichung_only" },
    });
    expect(taichungRoadNoiseMonitoringReleaseSelector.resolve({ release_id: "2024-Q3-66000-unknown", period_start: "2024-07-01", period_end: "2024-09-30" })).toBeNull();
  });

  it("只暴露 manifest 的八個 114Y 市區客運指標與 TMRT 歷史 release", () => {
    expect(busOperationReleaseSelector.resolve({ release_id: "2025-114-column6-5a90492f645a", period_start: "2025-01-01", period_end: "2025-12-31" })).toEqual({ releaseId: "2025-114-column6-5a90492f645a", dimensions: { roc_year: "114", source_field: "COLUMN6", geographic_coverage: "national_county" } });
    expect(busOperationReleaseSelector.resolve({ release_id: "2025-114-column6-unknown", period_start: "2025-01-01", period_end: "2025-12-31" })).toBeNull();
    expect(STATISTICS_RECIPES.statsBusElectricVehicleCount).toMatchObject({ dataset_id: "segis_bus_operation_county_315fh_1d3", indicator_id: "bus_electric_vehicle_count", unit: "輛", includeHealth: true });
    expect(tmrtStationOutboundReleaseSelector.resolve({ release_id: "2025-12-tmrt-station-outbound-2412a544-4ace434cfa54", period_start: "2025-12-01", period_end: "2025-12-31" })).toEqual({ releaseId: "2025-12-tmrt-station-outbound-2412a544-4ace434cfa54", dimensions: { roc_year: "114", month: "12", system_id: "tmrt", geographic_semantics: "station_location" } });
    expect(STATISTICS_RECIPES.statsTmrtStationOutboundCounty).toMatchObject({ dataset_id: "tmrt_station_outbound_county", indicator_id: "station_outbound_count", unit: "人次", freshness: "STALE", includeHealth: true });
  });

  it("只接四份 manifest 白名單的 15 個交通統計 release，並保留層級與語意", () => {
    expect(taipeiBicycleReleaseSelector.resolve({ release_id: "2021-110-column7-789178e51f5b", period_start: "2021-01-01", period_end: "2021-12-31" })).toEqual({ releaseId: "2021-110-column7-789178e51f5b", dimensions: { roc_year: "110", source_field: "COLUMN7", geographic_coverage: "taipei_township_only" } });
    expect(taipeiBicycleReleaseSelector.resolve({ release_id: "2021-110-column2-unknown", period_start: "2021-01-01", period_end: "2021-12-31" })).toBeNull();
    expect(STATISTICS_RECIPES.statsTaipeiUrbanRentalStations).toMatchObject({ dataset_id: "segis_taipei_bicycle_usage_township_110", indicator_id: "taipei_urban_rental_stations", level: "township", freshness: "STALE", includeHealth: true });
    expect(a1AccidentReleaseSelector.resolve({ release_id: "2025-a1_death_count-6c2ddae0632c", period_start: "2025-01-01", period_end: "2025-12-31" })).toEqual({ releaseId: "2025-a1_death_count-6c2ddae0632c", dimensions: { year: "2025", accident_class: "A1", geographic_coverage: "county_location" } });
    expect(STATISTICS_RECIPES.statsA1AccidentCount).toMatchObject({ dataset_id: "npa_a1_accident_county_177136", indicator_id: "a1_accident_count", unit: "件", includeHealth: true });
    expect(caaAirportActivityReleaseSelector.resolve({ release_id: "2026-07-caa-airport-airport_cargo_tonnes-21a7e7f4-b53d2f849a96", period_start: "2026-07-01", period_end: "2026-07-31" })).toEqual({ releaseId: "2026-07-caa-airport-airport_cargo_tonnes-21a7e7f4-b53d2f849a96", dimensions: { roc_year: "115", month: "07", geographic_semantics: "facility_location_activity", health: "CURRENT", coverage: "PARTIAL" } });
    expect(STATISTICS_RECIPES.statsAirportCargoTonnes).toMatchObject({ dataset_id: "caa_airport_activity_county_33238", indicator_id: "airport_cargo_tonnes", unit: "公噸", includeHealth: true });
    expect(taoyuanAirportReleaseSelector.resolve({ release_id: "2022-taoyuan-airport-airport_passenger_movements-d6d399a1-3fea2b07f916", period_start: "2022-01-01", period_end: "2022-12-31" })).toEqual({ releaseId: "2022-taoyuan-airport-airport_passenger_movements-d6d399a1-3fea2b07f916", dimensions: { year: "2022", airport_iata: "TPE", airport_icao: "RCTP", geographic_semantics: "facility_location_activity", health: "STALE", refresh: "manual" } });
    expect(STATISTICS_RECIPES.statsTaoyuanAirportPassengerMovements).toMatchObject({ dataset_id: "taoyuan_airport_passengers_county_32997", indicator_id: "airport_passenger_movements", freshness: "STALE", includeHealth: true });
  });
});
