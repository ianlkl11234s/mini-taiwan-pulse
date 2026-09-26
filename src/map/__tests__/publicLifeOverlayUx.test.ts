import { describe, expect, it } from "vitest";
import { GIS_LAYERS } from "../gisClickRegistry";
import { OVERLAY_REGISTRY } from "../overlayRegistry";

const LABEL_MINZOOM: Record<string, number> = {
  publicWasteBaskets: 15,
  materialRecyclingPoints: 14,
  playgrounds: 14,
  visitorCentres: 10,
  publicToilets: 16,
};

describe("public life overlay UX", () => {
  it("有名稱的公共生活點層都有縮放門檻標籤，popup 維持由 circle/glow 命中", () => {
    for (const [id, minzoom] of Object.entries(LABEL_MINZOOM)) {
      const overlay = OVERLAY_REGISTRY.find((config) => config.id === id);
      expect(overlay, `${id} overlay`).toBeDefined();
      const label = overlay!.layers.find((layer) => layer.suffix === "label");
      expect(label?.type, `${id} label type`).toBe("symbol");
      expect(label?.minzoom, `${id} label minzoom`).toBe(minzoom);
      expect(overlay!.rebuildOnParamChange, `${id} rebuild label`).toContain("label");

      const clickType = id === "publicToilets" ? "publicToilet" : id;
      const click = GIS_LAYERS.find((entry) => entry.type === clickType);
      expect(click?.layers.some((layerId) => layerId.endsWith("-circle")), `${id} clickable circle`).toBe(true);
      expect(click?.layers.some((layerId) => layerId.endsWith("-label")), `${id} symbol 不進 queryRenderedFeatures`).toBe(false);
    }
  });

  it("有分類控制的點、光暈與標籤共用動態 filter", () => {
    for (const id of ["publicToilets", "materialRecyclingPoints"]) {
      const overlay = OVERLAY_REGISTRY.find((config) => config.id === id)!;
      for (const suffix of ["glow", "circle", "label"]) {
        expect(typeof overlay.layers.find((layer) => layer.suffix === suffix)?.filter, `${id}/${suffix}`).toBe("function");
      }
    }

    for (const id of ["disasterShelters", "accessibleParkFacilities", "bicycleSupport"]) {
      const overlay = OVERLAY_REGISTRY.find((config) => config.id === id)!;
      for (const suffix of ["glow", "circle"]) {
        expect(typeof overlay.layers.find((layer) => layer.suffix === suffix)?.filter, `${id}/${suffix}`).toBe("function");
      }
    }
  });

  it("PMTiles 點層不建立 symbol label，避開 production Mapbox placement crash", () => {
    const pmtilesLabels = [
      "drinkingWaterPoints", "disasterShelters", "accessibleParkFacilities", "bicycleSupport",
    ];
    for (const id of pmtilesLabels) {
      const overlay = OVERLAY_REGISTRY.find((config) => config.id === id)!;
      expect(overlay.layers.find((layer) => layer.suffix === "label"), id).toBeUndefined();
      expect(overlay.rebuildOnParamChange, id).not.toContain("label");
    }

    const geojsonLabel = OVERLAY_REGISTRY.find((config) => config.id === "publicWasteBaskets")!
      .layers.find((layer) => layer.suffix === "label")!;
    const geojsonLayout = geojsonLabel.layout as Record<string, unknown>;
    expect(geojsonLayout["text-variable-anchor"]).toEqual(["top", "bottom", "left", "right"]);
  });
});
