import { describe, expect, it, vi } from "vitest";
import { enrichJpHeightFeature } from "../jpHeightFeatureMetadata";

vi.mock("../jpHeightCatalog", () => ({
  getLoadedJpHeightCatalog: () => ({ status: "ready", catalog: { regions: [
    { id: "a--b", label: "Double separator", buildings: { attribution: "kept" } },
    { id: "osaka", label: "大阪", buildings: { sourceYear: 2025, geometryMethod: "bldg:lod0FootPrint", license: "CC BY 4.0", attribution: "PLATEAU／大阪市" }, grid: { sourceYear: 2025, license: "CC BY 4.0", attribution: "PLATEAU／大阪市" } },
    { id: "sapporo", label: "札幌", buildings: { sourceYear: 2020, geometryMethod: "bldg:lod0RoofEdge", license: "CC BY 4.0", attribution: "PLATEAU／札幌市" } },
  ] } }),
}));

describe("JP shared shard metadata", () => {
  it("joins merged overview by region_id while preserving the original statistics", () => {
    expect(enrichJpHeightFeature("jp-building-height-grid--overview", { region_id: "osaka", cell_size_m: 250, missing_height_count: 600 }))
      .toMatchObject({ jp_region_label: "大阪", source_year: 2025, attribution: "PLATEAU／大阪市", missing_height_count: 600 });
  });
  it("keeps per-feature geometry and missing height instead of replacing with a city default", () => {
    expect(enrichJpHeightFeature("jp-building-height--sapporo", { height: null, geometry_method: "bldg:lod0FootPrint" }))
      .toMatchObject({ source_year: 2020, height: null, geometry_method: "bldg:lod0FootPrint" });
  });
  it("preserves double separators inside a catalog region id", () => {
    expect(enrichJpHeightFeature("jp-building-height--a--b", { height: 12 })).toMatchObject({ attribution: "kept" });
  });
  it("does not attribute an unknown region to Tokyo", () => {
    expect(enrichJpHeightFeature("jp-building-height--unknown", { height: 12 })).toEqual({ height: 12 });
  });
});
