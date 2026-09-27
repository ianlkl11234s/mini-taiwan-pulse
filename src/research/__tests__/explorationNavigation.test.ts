import { describe, expect, it } from "vitest";
import { explorationLayerKeys, panelForExplorationLayers } from "../explorationNavigation";

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

describe("explorationLayerKeys", () => {
  it("never opens the rail for a results-only patch, even when scene.layers differs from the previous snapshot", () => {
    expect(explorationLayerKeys({ buses: true, trains: true }, { buses: false }, undefined)).toEqual([]);
    expect(explorationLayerKeys({ buses: true }, null as unknown as undefined, undefined)).toEqual([]);
  });

  it("never opens the rail for a resync/report replay that carries no patch at all", () => {
    expect(explorationLayerKeys({ buses: true }, undefined, undefined)).toEqual([]);
  });

  it("returns the newly-enabled keys only when this command's own patch explicitly set layers", () => {
    expect(explorationLayerKeys({ buses: true, trains: true }, { buses: false, trains: true }, { buses: true })).toEqual(["buses"]);
  });

  it("returns an empty list when the patch set layers but none of them are newly enabled", () => {
    expect(explorationLayerKeys({ buses: true }, { buses: true }, { buses: true })).toEqual([]);
  });
});
