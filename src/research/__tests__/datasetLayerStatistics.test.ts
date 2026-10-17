import { afterEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { describeDatasetLayerStatistics, releaseParameters, summarizeDatasetLayer } from "../datasetLayerStatistics";
import type { DatasetDescriptor } from "../dataContracts";

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
  // playgrounds is a manifest layer with no bespoke owner-only/research-public reader registered
  // in researchDatasets.ts, so datasetForLayer falls back to the generic registered-layer-geojson-v1
  // reader this test exercises. religionChurches used to serve as that example, but it gained its own
  // SHA-pinned owner-only reader (see src/research/religionPointsOwnerDatasets.ts), which made this
  // test always hit RELIGION_RELIGIONCHURCHES_SOURCE_SHA_MISMATCH against the small synthetic body below.
  const body = JSON.stringify({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { denomination: "A", county: "台北市" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [121.6, 25.1] }, properties: { denomination: null, county: "新北市" } },
    { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { denomination: "B" } },
  ] });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "content-length": String(body.length) } })));
  const description = await describeDatasetLayerStatistics("playgrounds", new Set());
  const result = await summarizeDatasetLayer({ layerKey: "playgrounds", groupBy: ["denomination"] }, new Set());
  expect(description).toMatchObject({ datasetId: "layer:playgrounds", geometry: { role: "proxy", spatialAnalysisEligible: false }, scope: expect.stringContaining("非 Point 與無效 geometry 另列排除"), capabilities: { bounds: false } });
  expect(result).toMatchObject({ totalMatched: 2, bounds: null, excludedByReason: { non_point_geometry: 1 } });
  expect(result.groups).toEqual(expect.arrayContaining([{ denomination: "A", count: 1 }, { denomination: null, count: 1 }]));
});

it("keeps PMTiles without a sidecar fail-closed", async () => {
  // medClinic used to be an unclaimed PMTiles layer, but it later gained a bespoke owner-only
  // reader (see src/research/nhiMedicalOwnerDatasets.ts), so datasetForLayer now resolves it via
  // that registered descriptor instead of rejecting. contour25k has no such reader and stays PMTiles-only.
  await expect(describeDatasetLayerStatistics("contour25k", new Set())).rejects.toThrow("REGISTERED_LAYER_NOT_READABLE");
});

it("supplies a releaseId for release-scoped statistics datasets (explicit, else latest observed)", () => {
  const descriptor = {
    parameters: [{ name: "releaseId", type: "string", required: true, options: ["r-2023", "r-2025", "r-2024"] }],
    versions: [
      { versionId: "r-2023", observedAt: "2023-12-31" }, { versionId: "r-2025", observedAt: "2025-12-31" }, { versionId: "r-2024", observedAt: "2024-12-31" },
    ],
  } as unknown as DatasetDescriptor;
  expect(releaseParameters(descriptor, undefined)).toEqual({ releaseId: "r-2025" });
  expect(releaseParameters(descriptor, "r-2023")).toEqual({ releaseId: "r-2023" });
  expect(() => releaseParameters(descriptor, "r-1999")).toThrow("RELEASE_NOT_ALLOWED");
  expect(releaseParameters({ versions: [] } as unknown as DatasetDescriptor, undefined)).toBeUndefined();
});
