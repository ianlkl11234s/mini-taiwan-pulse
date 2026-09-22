import { describe, expect, it } from "vitest";
import { listLayerCapabilities } from "../layerCapabilities";

describe("layer capability registry", () => {
  it("pages every manifest layer without treating rendering as a reader", () => {
    const first = listLayerCapabilities({ limit: 1 });
    expect(first).toMatchObject({ schemaVersion: "pulse-layer-capabilities/1", returned: 1, truncated: true });
    const all = listLayerCapabilities({ limit: 20 });
    expect(all.totalMatched).toBeGreaterThan(50);
    const schools = listLayerCapabilities({ query: "schools", limit: 20 });
    expect((schools.layers as { layerKey: string }[]).some(layer => layer.layerKey === "schools")).toBe(true);
  });

  it("declares complete-source readers, on-demand GeoJSON candidates, and refuses to infer PMTiles records", () => {
    const schools = listLayerCapabilities({ query: "schools" });
    expect(schools.layers).toEqual(expect.arrayContaining([expect.objectContaining({ layerKey: "schools", recordSearch: "ready", aggregate: "complete_source_asset", dataRole: "point", supportedMeasures: ["count"], timeModel: "static_version", freshness: "unknown" })]));
    const pmtiles = listLayerCapabilities({ query: "pmtiles" });
    expect(pmtiles.layers).toEqual(expect.arrayContaining([expect.objectContaining({ sourceKinds: expect.arrayContaining(["pmtiles"]), recordSearch: "not_registered", aggregate: "not_registered", dataRole: "unknown", supportedMeasures: [], timeModel: "unknown", freshness: "unsupported" })]));
    const countReady = listLayerCapabilities({ measure: "count", status: "ready" });
    expect(countReady.totalMatched).toBeGreaterThan(5);
    expect(listLayerCapabilities({ query: "schools" }).layers).toEqual(expect.arrayContaining([expect.objectContaining({ layerKey: "schools", recordSearch: "ready" })]));
    const candidates = listLayerCapabilities({ status: "on_demand_validation", sourceKind: "geojson", limit: 20 });
    expect(candidates.totalMatched).toBeGreaterThan(0);
  });

  it("uses the statistics registry instead of marking an immutable release reader unregistered", () => {
    const result = listLayerCapabilities({ query: "statsEducationCountyStudentTeacherRatio", limit: 20 });
    expect(result.layers).toEqual(expect.arrayContaining([expect.objectContaining({
      layerKey: "statsEducationCountyStudentTeacherRatio", recordSearch: "ready", aggregate: "complete_source_asset", dataRole: "admin_statistic",
      datasetIds: ["regional-statistics:statsEducationCountyStudentTeacherRatio"], access: { mode: "public", queryEnabled: true, requiredParameters: ["releaseId"] },
    })]));
  });

  it("omits locked layers entirely rather than exposing their registered source metadata", () => {
    const locked = new Set(["allenCoralAtlas", "schools"]);
    expect(listLayerCapabilities({ query: "allen", limit: 20 }, locked)).toMatchObject({ totalMatched: 0, layers: [] });
    expect((listLayerCapabilities({ query: "schools", limit: 20 }, locked).layers as { layerKey: string }[]).some(layer => layer.layerKey === "schools")).toBe(false);
  });
});
