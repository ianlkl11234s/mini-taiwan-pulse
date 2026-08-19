import { describe, expect, it } from "vitest";
import {
  COMPANY_GRID_SCALES,
  COMPANY_INDUSTRY_MID_OPTIONS,
  companyGridColorExpr,
  companyPointFilter,
  INDUSTRIAL_PARK_COMPARISON_MODES,
  industrialParkComparisonColorExpr,
} from "../businessRegistryTypes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { isOverlayVisible } from "../../map/overlayManager";
import { LAYER_MANIFEST } from "../layerManifest";
import type { LayerVisibility } from "../../types";

describe("工商登記 B1/B2/B3/A4 契約", () => {
  it("89 個行業中類保留前導零", () => {
    expect(COMPANY_INDUSTRY_MID_OPTIONS).toHaveLength(89);
    expect(COMPANY_INDUSTRY_MID_OPTIONS[0]).toMatchObject({ value: "01" });
  });

  it("B3 多條件 filter 使用原始 string code 與 0/1 flags", () => {
    const filter = companyPointFilter({
      companyIndustryMidIdx: 1,
      companyCountyIdx: 1,
      companyCapitalQIdx: 6,
      companySetupYearMin: 2000,
      companySetupYearMax: 2020,
      companyManufacturingIdx: 1,
      companyListedIdx: 1,
      companyTrademarkIdx: 2,
      companyAddressMismatchIdx: 1,
    });
    expect(JSON.stringify(filter)).toContain('"01"');
    expect(JSON.stringify(filter)).toContain('"臺北市"');
    expect(filter[0]).toBe("all");
  });

  it("A4 與 B1 共用 source，且只用 is_manufacturing=1", () => {
    const b1 = OVERLAY_REGISTRY.find((c) => c.id === "companyPoints" && c.pmtiles?.sourceLayer === "company_points")!;
    const a4 = OVERLAY_REGISTRY.find((c) => c.id === "manufacturingCompanyPoints" && c.pmtiles?.sourceLayer === "company_points")!;
    expect(a4.sourceId).toBe(b1.sourceId);
    expect(a4.sourceUrl).toBe(b1.sourceUrl);
    expect(a4.pmtiles?.sourceLayer).toBe("company_points");
    expect(a4.filter).toEqual(["==", ["get", "is_manufacturing"], 1]);
    const overview = OVERLAY_REGISTRY.filter((c) =>
      (c.id === "companyPoints" || c.id === "manufacturingCompanyPoints") &&
      c.pmtiles?.sourceLayer === "company_points_overview"
    );
    expect(overview).toHaveLength(2);
    expect(overview.every((c) => c.layers[0]?.minzoom === 4 && c.layers[0]?.maxzoom === 12)).toBe(true);
  });

  it("B2 capital_median 缺值明確落 neutral case", () => {
    const expr = companyGridColorExpr(2);
    expect(expr[0]).toBe("case");
    expect(JSON.stringify(expr)).toContain("#64748b");
  });

  it("B2 三尺度各用獨立 immutable PMTiles", () => {
    const grids = OVERLAY_REGISTRY.filter((c) => c.id === "companyCapitalGrid");
    expect(grids.map((c) => c.sourceUrl)).toEqual(COMPANY_GRID_SCALES.map((scale) => scale.sourceUrl));
    expect(grids.map((c) => c.pmtiles?.sourceLayer)).toEqual([
      "company_capital_grid",
      "company_capital_grid_450m",
      "company_capital_grid_1500m",
    ]);
    const visibility = { companyCapitalGrid: true } as LayerVisibility;
    expect(grids.map((grid) => isOverlayVisible(grid, visibility, { companyGridScaleIdx: 1 })))
      .toEqual([false, true, false]);
  });

  it("B4 共同登記門檻會重建 circle filter", () => {
    const b4 = OVERLAY_REGISTRY.find((c) => c.id === "commonRegistrationAddresses")!;
    expect(b4.rebuildOnParamChange).toContain("circle");
    const filter = b4.layers[0]?.filter;
    expect(typeof filter).toBe("function");
    if (typeof filter !== "function") throw new Error("B4 filter 應為 params callback");
    expect(filter({ commonRegistrationAddressesMinCompanies: 20 }))
      .toEqual([">=", ["to-number", ["get", "n_companies"], 0], 20]);
    expect(LAYER_MANIFEST.commonRegistrationAddresses.params).toEqual({
      count: 3,
      kinds: ["slider", "slider", "slider"],
    });
  });

  it("A1 低倍率概覽 + z11 個別點；A5 保持 z11 gate；A2 不含科學園區", () => {
    const a1Overview = OVERLAY_REGISTRY.find((c) => c.id === "factoryLocations" && c.pmtiles?.sourceLayer === "factory_locations_overview")!;
    const a1 = OVERLAY_REGISTRY.find((c) => c.id === "factoryLocations" && c.pmtiles?.sourceLayer === "factory_locations")!;
    const a5 = OVERLAY_REGISTRY.find((c) => c.id === "regulatedFacilities")!;
    const a2 = OVERLAY_REGISTRY.find((c) => c.id === "industrialParkBoundaries")!;
    expect(a1Overview.layers[0]?.minzoom).toBe(4);
    expect(a1Overview.layers[0]?.maxzoom).toBe(11);
    expect(a1.layers[0]?.minzoom).toBe(11);
    expect(a5.layers[0]?.minzoom).toBe(11);
    expect(a2.sourceUrl).toBe("./industrial_zone/industrial_park_boundaries_20260818.pmtiles");
    expect(LAYER_MANIFEST.industrialParkBoundaries.description).toContain("不含科學園區");
    expect(LAYER_MANIFEST.regulatedFacilities.label).toBe("列管設施 Regulated Facilities");
    expect("parkMemberships" in LAYER_MANIFEST).toBe(false);
  });

  it("A6 只提供實際存在的三種指標，且零觀測值落 neutral", () => {
    expect(INDUSTRIAL_PARK_COMPARISON_MODES.map((mode) => mode.value)).toEqual([
      "factory_count",
      "company_count",
      "company_capital_total_sum",
    ]);
    const capitalExpr = industrialParkComparisonColorExpr(2);
    expect(JSON.stringify(capitalExpr)).toContain("company_capital_total_sum");
    expect(JSON.stringify(capitalExpr)).toContain("#64748b");
  });

  it("A6 使用正式 PMTiles，並明示 coverage bias 與科學園區邊界", () => {
    const a6 = OVERLAY_REGISTRY.find((c) => c.id === "industrialParkComparison")!;
    expect(a6.sourceUrl).toBe("./business_registry/industrial_park_comparison_20260818.pmtiles");
    expect(a6.pmtiles?.sourceLayer).toBe("industrial_park_comparison");
    expect(LAYER_MANIFEST.industrialParkComparison.description).toContain("geocode coverage");
    expect(LAYER_MANIFEST.industrialParkComparison.description).toContain("不含科學園區");
  });
});
