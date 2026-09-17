import { describe, expect, it } from "vitest";
import { panelForExplorationLayers } from "../explorationNavigation";

describe("panelForExplorationLayers", () => {
  it("uses the shared statistics membership plus world and Japan theme slices", () => {
    expect(panelForExplorationLayers(["statsBusOperatingRouteLengthKm"])).toBe("statistics");
    expect(panelForExplorationLayers(["crimeAreaMonthly"])).toBe("statistics");
    expect(panelForExplorationLayers(["jpReligionGsi"])).toBe("japan");
  });

  it("keeps references, ordinary, and unknown layer keys in the main Layers panel", () => {
    expect(panelForExplorationLayers(["countyBoundary"])).toBe("layers");
    expect(panelForExplorationLayers(["schools"])).toBe("layers");
    expect(panelForExplorationLayers(["not-a-layer"])).toBe("layers");
  });
});
