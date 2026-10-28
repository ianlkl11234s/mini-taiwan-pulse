import { describe, expect, it } from "vitest";
import { countryForLayerKeys, explorationLayerKeys, panelForExplorationLayers } from "../explorationNavigation";

describe("panelForExplorationLayers", () => {
  it("uses the shared statistics membership plus world theme slices", () => {
    expect(panelForExplorationLayers(["statsBusOperatingRouteLengthKm"])).toEqual({ panel: "statistics", country: "TW" });
    expect(panelForExplorationLayers(["statsCrimeDrugCasesTownship"])).toEqual({ panel: "statistics", country: "TW" });
    expect(panelForExplorationLayers(["submarineCables"])).toEqual({ panel: "world" });
  });

  it("opens the Layers panel in the layer's country (Japan, France, Taiwan)", () => {
    expect(panelForExplorationLayers(["jpReligionGsi"])).toEqual({ panel: "layers", country: "JP" });
    expect(panelForExplorationLayers(["jpStations"])).toEqual({ panel: "layers", country: "JP" });
    expect(panelForExplorationLayers(["anfrWirelessSites"])).toEqual({ panel: "layers", country: "FR" });
    expect(panelForExplorationLayers(["ooklaMobileTaiwan"])).toEqual({ panel: "layers", country: "TW" });
  });

  it("keeps references, ordinary, and unknown layer keys in the main Layers panel", () => {
    expect(panelForExplorationLayers(["countyBoundary"])).toEqual({ panel: "layers", country: "TW" });
    expect(panelForExplorationLayers(["schools"])).toEqual({ panel: "layers", country: "TW" });
    expect(panelForExplorationLayers(["not-a-layer"])).toEqual({ panel: "layers" });
  });
});

describe("countryForLayerKeys", () => {
  it("回傳第一個國家主題樹圖層的國家，世界圖層與未知 key 略過", () => {
    expect(countryForLayerKeys(["submarineCables", "jpStations"])).toBe("JP");
    expect(countryForLayerKeys(["anfrWirelessSites"])).toBe("FR");
    expect(countryForLayerKeys(["schools", "jpStations"])).toBe("TW");
    expect(countryForLayerKeys(["submarineCables", "not-a-layer"])).toBeUndefined();
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
