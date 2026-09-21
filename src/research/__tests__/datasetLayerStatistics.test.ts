import { afterEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { describeDatasetLayerStatistics, summarizeDatasetLayer } from "../datasetLayerStatistics";

afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });

it("counts an explicit hospital dataset by its manifest layer reference", async () => {
  const body = JSON.stringify({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [120.68, 24.14] }, properties: { facility_id: "H1", facility_name: "甲醫院", county: "台中市" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [120.7, 24.16] }, properties: { facility_id: "H2", facility_name: "乙醫院", county: "台中市" } },
    { type: "Feature", geometry: null, properties: { facility_id: "H3", county: "台中市" } },
  ] });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "content-length": String(body.length) } })));
  const result = await summarizeDatasetLayer({ layerKey: "medHospital", filters: [{ field: "county", value: "台中市" }], groupBy: ["county"] }, new Set());
  expect(result).toMatchObject({ datasetId: "tw-medical-hospitals", totalMatched: 2, countUnit: "place", groups: [{ county: "台中市", count: 2 }], excludedByReason: { missing_geometry: 1 } });
});

it("onboards a bounded manifest-owned Point GeoJSON without claiming analytical geometry", async () => {
  const body = JSON.stringify({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { denomination: "A", county: "台北市" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [121.6, 25.1] }, properties: { denomination: null, county: "新北市" } },
    { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { denomination: "B" } },
  ] });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "content-length": String(body.length) } })));
  const description = await describeDatasetLayerStatistics("religionChurches", new Set());
  const result = await summarizeDatasetLayer({ layerKey: "religionChurches", groupBy: ["denomination"] }, new Set());
  expect(description).toMatchObject({ datasetId: "layer:religionChurches", geometry: { role: "proxy", spatialAnalysisEligible: false } });
  expect(result).toMatchObject({ totalMatched: 2, excludedByReason: { non_point_geometry: 1 } });
  expect(result.groups).toEqual(expect.arrayContaining([{ denomination: "A", count: 1 }, { denomination: null, count: 1 }]));
});

it("keeps PMTiles without a sidecar fail-closed", async () => {
  await expect(describeDatasetLayerStatistics("medClinic", new Set())).rejects.toThrow("REGISTERED_LAYER_NOT_READABLE");
});
