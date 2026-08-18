import { describe, expect, it } from "vitest";
import {
  COMPANY_INDUSTRY_MID_OPTIONS,
  companyGridColorExpr,
  companyPointFilter,
  INDUSTRIAL_PARK_COMPARISON_MODES,
  industrialParkComparisonColorExpr,
} from "../businessRegistryTypes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { LAYER_MANIFEST } from "../layerManifest";

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
    const b1 = OVERLAY_REGISTRY.find((c) => c.id === "companyPoints")!;
    const a4 = OVERLAY_REGISTRY.find((c) => c.id === "manufacturingCompanyPoints")!;
    expect(a4.sourceId).toBe(b1.sourceId);
    expect(a4.sourceUrl).toBe(b1.sourceUrl);
    expect(a4.pmtiles?.sourceLayer).toBe("company_points");
    expect(a4.filter).toEqual(["==", ["get", "is_manufacturing"], 1]);
  });

  it("B2 capital_median 缺值明確落 neutral case", () => {
    const expr = companyGridColorExpr(2);
    expect(expr[0]).toBe("case");
    expect(JSON.stringify(expr)).toContain("#64748b");
  });

  it("A1/A5 點層 z11 gate；A2 明示不含科學園區", () => {
    const a1 = OVERLAY_REGISTRY.find((c) => c.id === "factoryLocations")!;
    const a5 = OVERLAY_REGISTRY.find((c) => c.id === "regulatedFacilities")!;
    const a2 = OVERLAY_REGISTRY.find((c) => c.id === "industrialParkBoundaries")!;
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
