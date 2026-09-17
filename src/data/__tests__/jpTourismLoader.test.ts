import { describe, expect, it } from "vitest";
import { JP_TOURISM_DATASETS } from "../jpTourismLoader";
import {
  JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION,
  JP_ACCOMMODATION_DENSITY_SCALES,
} from "../jpTourismTypes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { isOverlayVisible } from "../../map/overlayManager";
import type { LayerVisibility } from "../../types";

describe("Japan tourism delivery policy", () => {
  it("ships only licence-cleared datasets to production", () => {
    const production = Object.entries(JP_TOURISM_DATASETS)
      .filter(([, config]) => config.production)
      .map(([dataset]) => dataset)
      .sort();
    expect(production).toEqual([
      "accommodation-canonical",
      "accommodation-jta",
      "accommodation-local",
      "accommodation-osm",
      "marine-ebsa",
      "world-heritage-unesco",
    ]);
  });

  it("uses PMTiles for every production artifact above the GeoJSON budget", () => {
    expect(JP_TOURISM_DATASETS["accommodation-canonical"].kind).toBe("pmtiles");
    expect(JP_TOURISM_DATASETS["accommodation-osm"].kind).toBe("pmtiles");
    expect(JP_TOURISM_DATASETS["marine-ebsa"].kind).toBe("pmtiles");
  });

  it("uses immutable all-zoom accommodation artifacts from z0", () => {
    expect(JP_TOURISM_DATASETS["accommodation-canonical"]).toMatchObject({
      file: "jp_accommodation_canonical_allzoom_20260910.pmtiles",
      minzoom: 0,
    });
    expect(JP_TOURISM_DATASETS["accommodation-osm"]).toMatchObject({
      file: "jp_accommodation_osm_allzoom_20260910.pmtiles",
      minzoom: 0,
    });
  });

  it("colors accommodation points by facility_category with an explicit fallback", () => {
    expect(JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION.slice(0, 2)).toEqual([
      "match", ["get", "facility_category"],
    ]);
    expect(JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION[
      JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION.length - 1
    ]).toBe("#94a3b8");
  });

  it("registers both immutable density scales with a z0 source contract", () => {
    expect(JP_ACCOMMODATION_DENSITY_SCALES).toHaveLength(2);
    expect(JP_ACCOMMODATION_DENSITY_SCALES.map((scale) => scale.sourceUrl)).toEqual([
      "./world/jp_accommodation_density_450m_20260910.pmtiles",
      "./world/jp_accommodation_density_1500m_20260910.pmtiles",
    ]);
    expect(JP_ACCOMMODATION_DENSITY_SCALES.every((scale) => scale.minzoom === 0)).toBe(true);
  });

  it("only displays the selected density source", () => {
    const grids = OVERLAY_REGISTRY.filter((config) => config.id === "jpAccommodationDensity");
    const visibility = { jpAccommodationDensity: true } as LayerVisibility;
    expect(grids.map((grid) => isOverlayVisible(grid, visibility, {
      jpAccommodationDensityScaleIdx: 0,
    }))).toEqual([true, false]);
    expect(grids.map((grid) => isOverlayVisible(grid, visibility, {
      jpAccommodationDensityScaleIdx: 1,
    }))).toEqual([false, true]);
  });

  it("keeps HOLD and non-commercial datasets local-only", () => {
    for (const dataset of [
      "natural-parks",
      "nature-conservation",
      "wildlife-protection",
      "world-natural-heritage-historical",
      "ramsar",
    ] as const) {
      expect(JP_TOURISM_DATASETS[dataset].production, dataset).toBe(false);
    }
  });
});
