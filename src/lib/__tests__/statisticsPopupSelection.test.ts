import { describe, expect, it } from "vitest";
import { shouldClearFeatureInfoForLayerClick } from "../statisticsPopupSelection";

describe("statistics popup selection", () => {
  it("keeps the popup while a statistics group only expands or collapses", () => {
    expect(shouldClearFeatureInfoForLayerClick("statsHealthHospitalBedTotal")).toBe(false);
  });

  it("clears the popup after switching to another statistics variant", () => {
    expect(shouldClearFeatureInfoForLayerClick("statsHealthAcuteBedTotal", "statistics-variant-switch")).toBe(true);
  });

  it("does not treat a non-statistics click as a variant switch", () => {
    expect(shouldClearFeatureInfoForLayerClick("jpAccommodationCanonical", "statistics-variant-switch")).toBe(false);
  });
});
