import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../../../data/layerManifest";
import { STATISTICS_TAB_THEMES } from "../layerCatalog";
import { getThemeLayerKeys } from "../../IconRailSidebar";

describe("STATISTICS_TAB_THEMES", () => {
  const layers = STATISTICS_TAB_THEMES.flatMap((theme) => theme.groups.flatMap((group) => group.layers));

  it("只聚合目前已接線的行政區統計與邊界圖層", () => {
    expect(layers.map((layer) => layer.key)).toEqual([
      "statsPigWaterCounty",
      "statsWaterSupplyHistorical",
      "statsWasteCounty",
      "statsWasteRecyclingRate",
      "statsRecyclingCounty",
      "statsResidentialElectricity",
      "statsRiceHarvest",
      "statsBirthsTownship",
      "crimeAreaMonthly",
      "countyBoundary",
      "townshipBoundary",
    ]);
  });

  it("顯示文字仍由既有 manifest 派生", () => {
    for (const layer of layers) {
      const manifest = LAYER_MANIFEST[layer.key];
      expect(manifest.section).not.toBeNull();
      if (manifest.section !== null) expect(layer.label).toBe(manifest.label);
    }
  });

  it("All Off scope 只包含統計入口的圖層", () => {
    expect(getThemeLayerKeys(STATISTICS_TAB_THEMES)).toEqual([
      "statsPigWaterCounty",
      "statsWaterSupplyHistorical",
      "statsWasteCounty",
      "statsWasteRecyclingRate",
      "statsRecyclingCounty",
      "statsResidentialElectricity",
      "statsRiceHarvest",
      "statsBirthsTownship",
      "crimeAreaMonthly",
      "countyBoundary",
      "townshipBoundary",
    ]);
  });
});
