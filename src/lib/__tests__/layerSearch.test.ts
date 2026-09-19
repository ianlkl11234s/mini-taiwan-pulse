import { describe, expect, it } from "vitest";
import { LAYER_SEARCH_INDEX, searchLayers } from "../layerSearch";
import { COMPARISON_STATISTICS_KEYS } from "../../data/comparisonStatisticsRecipes";
import { isDataSourceBrowserVisible } from "../../data/statisticsDataSources";

describe("layerSearch", () => {
  it("does not expose orphan registrations as selectable layers", () => {
    expect(LAYER_SEARCH_INDEX.some((layer) => layer.key === "facOffshore")).toBe(false);
    expect(searchLayers("facOffshore")).toEqual([]);
  });
  it("fails closed for guest searches but lets an authorized caller search gated production layers", () => {
    expect(searchLayers("facPrimary")).toEqual([]);
    expect(searchLayers("facPrimary", { lockedKeys: new Set() }).map((layer) => layer.key)).toContain("facPrimary");
    expect(searchLayers("facPrimary", { lockedKeys: new Set(["facPrimary"]) }).map((layer) => layer.key)).not.toContain("facPrimary");
  });
  it("derives searchable metadata from the manifest", () => {
    const hospital = LAYER_SEARCH_INDEX.find((layer) => layer.key === "medHospital");
    expect(hospital?.description).toBeTruthy();
    expect(hospital?.topics.length).toBeGreaterThan(0);
    expect(hospital?.source).toContain("上游：");
    expect(hospital?.source).toContain("資料集：");
    expect(hospital?.source).toContain("載入：");
    expect(hospital?.upstream.datasetIds).toContain("medical");
    expect(hospital?.sourceKinds).toContain("geojson");
    expect(hospital?.sourceIds).toContain("medical-hospitals");
  });

  it("ranks exact key and label matches before descriptive matches", () => {
    expect(searchLayers("medHospital")[0]?.key).toBe("medHospital");
    expect(searchLayers("醫院").slice(0, 2).map(result => result.key)).toEqual(["jpMedicalHospitals", "medHospital"]);
  });

  it("matches aliases and exposes World and Japan layers from the same index", () => {
    expect(searchLayers("急診").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("japan airport").some((layer) => layer.key === "jpAirports")).toBe(true);
    expect(searchLayers("global events").some((layer) => layer.theme === "全球情勢 Global Situation")).toBe(true);
  });

  it("requires every query term and returns no unrelated result", () => {
    expect(searchLayers("醫院 台灣").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("definitely-not-a-layer")).toEqual([]);
  });

  it("searches upstream dataset IDs and source-kind labels without exposing implementation text", () => {
    const results = searchLayers("usesatelliteslayer");
    expect(results.length).toBeGreaterThan(0);
    expect(searchLayers("medical").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("medical-hospitals").some((layer) => layer.key === "medHospital")).toBe(true);
    expect(searchLayers("GeoJSON 靜態檔").some((layer) => layer.sourceKinds.includes("geojson"))).toBe(true);
    expect(results.flatMap((layer) => [layer.source, layer.description]).join(" ")).not.toMatch(/OVERLAY_REGISTRY|useSatellitesLayer|\.pmtiles/i);
  });

  it("only indexes comparison recipes when their release gate allows the current environment", () => {
    const key = COMPARISON_STATISTICS_KEYS[0]!;
    expect(LAYER_SEARCH_INDEX.some((layer) => layer.key === key)).toBe(isDataSourceBrowserVisible(key));
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
