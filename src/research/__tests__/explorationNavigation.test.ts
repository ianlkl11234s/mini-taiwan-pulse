import { describe, expect, it } from "vitest";
import { panelForExplorationLayers } from "../explorationNavigation";

describe("panelForExplorationLayers", () => {
  it("uses the sidebar statistics, world, and Japan theme slices", () => {
    expect(panelForExplorationLayers(["statsBusOperatingRouteLengthKm"])).toBe("statistics");
    expect(panelForExplorationLayers(["jpReligionGsi"])).toBe("japan");
  });

  it("keeps ordinary or unknown layer keys in the main Layers panel", () => {
    expect(panelForExplorationLayers(["schools"])).toBe("layers");
    expect(panelForExplorationLayers(["not-a-layer"])).toBe("layers");
  });
});
