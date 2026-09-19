import { describe, expect, it } from "vitest";
import { COMPARISON_STATISTICS_KEYS } from "../comparisonStatisticsKeys";
import { STATISTICS_RENDER_KEYS } from "../regionalStatisticsRecipes";
import { getStatisticsDataSourceDefinition, isDataSourceBrowserVisible } from "../statisticsDataSources";
import { EDUCATION_PRESENTATION_VIEW_KEYS } from "../statisticsPresentationViews";

describe("statistics data-source definitions", () => {
  it("covers every rendered statistics key with a local, inspectable source contract", () => {
    const missing = STATISTICS_RENDER_KEYS.filter((key) => !getStatisticsDataSourceDefinition(key));
    expect(missing).toEqual([]);
  });

  it("keeps each fixed-stage education view tied to its canonical dataset instead of inventing a catalog entry", () => {
    for (const key of EDUCATION_PRESENTATION_VIEW_KEYS) {
      const definition = getStatisticsDataSourceDefinition(key)!;
      expect(definition.kind).toBe("presentation");
      expect(definition.datasetIds).toEqual(["education_county_statistics"]);
      expect(definition.period).toBe("11 個既有公開期別");
      expect(definition.contract).toContain("入口預設指標來源");
    }
  });

  it("labels comparison recipes as derived and applies the shared release gate", () => {
    const key = COMPARISON_STATISTICS_KEYS[0]!;
    expect(getStatisticsDataSourceDefinition(key)?.kind).toBe("derived");
    expect(isDataSourceBrowserVisible(key)).toBe(import.meta.env.DEV || import.meta.env.VITE_STATISTICS_COMPARISONS_ENABLED === "true");
  });
});


it("keeps the same indicator name matched to its geographic level", async () => {
  const { statisticsIndicatorLabel } = await import("../statisticsDataSources");
  expect(statisticsIndicatorLabel("housing_unoccupied", "township")).toBe("無人經常居住住宅（鄉鎮市區）");
  expect(statisticsIndicatorLabel("bus_accessible_vehicle_count", "county")).toBe("期末無障礙車輛");
});
