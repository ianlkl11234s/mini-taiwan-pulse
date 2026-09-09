import { describe, expect, it } from "vitest";
import { LAYER_SEARCH_INDEX, searchLayers } from "../layerSearch";

describe("layerSearch", () => {
  it("does not expose orphan registrations as selectable layers", () => {
    expect(LAYER_SEARCH_INDEX.some((layer) => layer.key === "facOffshore")).toBe(false);
    expect(searchLayers("facOffshore")).toEqual([]);
  });
  it("derives searchable metadata from the manifest", () => {
    const hospital = LAYER_SEARCH_INDEX.find((layer) => layer.key === "medHospital");
    expect(hospital?.description).toBeTruthy();
    expect(hospital?.topics.length).toBeGreaterThan(0);
    expect(hospital?.source).toBeTruthy();
  });

  it("ranks exact key and label matches before descriptive matches", () => {
    expect(searchLayers("medHospital")[0]?.key).toBe("medHospital");
    expect(searchLayers("醫院")[0]?.key).toBe("medHospital");
  });

  it("matches aliases and exposes World and Japan layers from the same index", () => {
    expect(searchLayers("急診").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("japan airport").some((layer) => layer.key === "jpAirports")).toBe(true);
    expect(searchLayers("global events").some((layer) => layer.theme === "世界 World")).toBe(true);
  });

  it("requires every query term and returns no unrelated result", () => {
    expect(searchLayers("醫院 台灣").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("definitely-not-a-layer")).toEqual([]);
  });

  it("keeps source implementation text searchable without exposing it in results", () => {
    const results = searchLayers("usesatelliteslayer");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((layer) => layer.source === "來源詳情")).toBe(true);
    expect(results.flatMap((layer) => [layer.source, layer.description]).join(" ")).not.toMatch(/OVERLAY_REGISTRY|useSatellitesLayer|\.pmtiles/i);
  });

  it("scopes results to one sidebar and searches its local taxonomy", () => {
    const scopeKeys = new Set(["statsBusOperatingRouteLengthKm", "jpAirports"]);
    const contextByKey = new Map([
      ["statsBusOperatingRouteLengthKm", "交通與運輸 Transport 大眾運輸"],
      ["jpAirports", "日本 Japan 交通"],
    ]);

    expect(searchLayers("大眾運輸", { scopeKeys, contextByKey }).map((result) => result.key))
      .toEqual(["statsBusOperatingRouteLengthKm"]);
    expect(searchLayers("日本", {
      scopeKeys: new Set(["statsBusOperatingRouteLengthKm"]),
      contextByKey,
    })).toEqual([]);
  });
});
