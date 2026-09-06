import { describe, expect, it } from "vitest";
import {
  STATISTICS_CHOROPLETH_KEYS,
  STATISTICS_TAB_LAYER_ROLES,
  isStatisticsChoropleth,
} from "../statisticsLayerRegistry";
import { STATISTICS_RECIPES, civilAeronauticsSubsidyReleaseSelector, countyTransportSupplyReleaseSelector, maritimeSubsidyReleaseSelector } from "../regionalStatisticsRecipes";

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
      dataset_id: "maritime_bureau_subsidy_county", indicator_id: "maritime_bureau_recipient_county_subsidy_twd", level: "county", unit: "TWD",
      releaseId: "2026-07-01-d6c9ce1998ef-37b0932fc00e", dimensions: { roc_year: "115", month: "07", agency_fund: "交通部航港局" },
    });
    expect([
      { release_id: "2026-07-01-1450d8e18741-de968560c871", period_start: "2026-07-01" },
      { release_id: "2026-07-01-d6c9ce1998ef-37b0932fc00e", period_start: "2026-07-01" },
      { release_id: "2023-12-01-5f44af09d338-5e944c36cfb9", period_start: "2023-12-01" },
      { release_id: "2024-12-01-469152708767-d4b8475fcb28", period_start: "2024-12-01" },
      { release_id: "2025-12-01-f6a788d31216-b89e229b4a8c", period_start: "2025-12-01" },
    ].map(release => maritimeSubsidyReleaseSelector.resolve(release))).toEqual([
      { releaseId: "2026-07-01-1450d8e18741-de968560c871", dimensions: { roc_year: "115", month: "07", agency_fund: "航港建設基金" } },
      { releaseId: "2026-07-01-d6c9ce1998ef-37b0932fc00e", dimensions: { roc_year: "115", month: "07", agency_fund: "交通部航港局" } },
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
    expect(civilAeronauticsSubsidyReleaseSelector.resolve({ release_id: "2023-Q4-special_budget-83258b75651f", period_start: "2023-01-01" })).toEqual({
      releaseId: "2023-Q4-special_budget-83258b75651f", dimensions: { roc_year: "112", quarter: "Q4", budget_type: "special_budget", value_basis: "year_to_date_cumulative" },
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
});
