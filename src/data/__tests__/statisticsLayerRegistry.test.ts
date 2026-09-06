import { describe, expect, it } from "vitest";
import {
  STATISTICS_CHOROPLETH_KEYS,
  STATISTICS_TAB_LAYER_ROLES,
  isStatisticsChoropleth,
} from "../statisticsLayerRegistry";
import { STATISTICS_RECIPES, maritimeSubsidyReleaseSelector } from "../regionalStatisticsRecipes";

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

  it("以真實 43445 release identity 選擇有效年月與基金別", () => {
    expect(STATISTICS_RECIPES.statsMaritimeSubsidyCounty).toMatchObject({
      dataset_id: "maritime_bureau_subsidy_county", indicator_id: "maritime_bureau_recipient_county_subsidy_twd", level: "county", unit: "TWD",
      releaseId: "2026-07-01-d6c9ce1998ef-37b0932fc00e", dimensions: { roc_year: "115", month: "07", agency_fund: "交通部航港局" },
    });
    expect(maritimeSubsidyReleaseSelector.resolve({ release_id: "2026-07-01-1450d8e18741-de968560c871", period_start: "2026-07-01" })).toEqual({
      releaseId: "2026-07-01-1450d8e18741-de968560c871", dimensions: { roc_year: "115", month: "07", agency_fund: "航港建設基金" },
    });
    expect(maritimeSubsidyReleaseSelector.resolve({ release_id: "2026-07-01-unknown-000", period_start: "2026-07-01" })).toBeNull();
  });
});
