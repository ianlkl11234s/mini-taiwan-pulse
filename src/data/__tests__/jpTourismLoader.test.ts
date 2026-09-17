import { describe, expect, it } from "vitest";
import { JP_TOURISM_DATASETS } from "../jpTourismLoader";

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
