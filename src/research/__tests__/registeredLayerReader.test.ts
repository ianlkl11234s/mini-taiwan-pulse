import { afterEach, describe, expect, it, vi } from "vitest";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { describeRegisteredLayer, readRegisteredLayer } from "../registeredLayerReader";

const manifest = LAYER_MANIFEST as unknown as Record<string, unknown>;
const key = "__registered_reader_fixture__";
const aliasKey = "__registered_reader_alias__";
function install(source: unknown): void {
  manifest[key] = { key, label: "讀取測試", description: "registered reader fixture", source };
}
function payload(features: unknown[]): string { return JSON.stringify({ type: "FeatureCollection", features }); }
function response(body: string, headers: Record<string, string> = {}): Response { return new Response(body, { headers: { "content-length": String(body.length), ...headers } }); }

afterEach(() => { delete manifest[key]; delete manifest[aliasKey]; vi.unstubAllGlobals(); });

describe("registered layer reader", () => {
  it("reads a fixed registered Point asset with null-safe inferred fields and a proxy geometry contract", async () => {
    install({ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" });
    const body = payload([
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { name: "甲", capacity: 4, open: true, nullable: null, mixed: "x", "bad-name": "no" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [121.51, 25.01] }, properties: { name: "乙", capacity: null, open: false, nullable: null, mixed: 2 } },
    ]);
    const fetch = vi.fn().mockResolvedValue(response(body)); vi.stubGlobal("fetch", fetch);
    const output = await readRegisteredLayer(key, { locked: new Set() });
    expect(fetch).toHaveBeenCalledWith("./fixtures/points.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(output.descriptor).toMatchObject({ datasetId: `layer:${key}`, label: "讀取測試來源資料", recordGrain: "place", geometry: { role: "proxy", spatialAnalysisEligible: false }, coverage: expect.stringContaining("unknown"), description: expect.stringContaining("已驗證 Point 子集") });
    expect(output.descriptor.fields.map(field => field.name)).toEqual(["record_id", "capacity", "name", "open", "geometry"]);
    expect(output.descriptor.source.lineage).toContain("mixed");
    expect(output.snapshot.rows).toEqual(expect.arrayContaining([expect.objectContaining({ capacity: null, record_id: expect.stringMatching(/^[0-9a-f]{64}-1$/) })]));
    expect(output.snapshot.source).toMatchObject({ sourceId: "fixture", version: expect.stringMatching(/^sha256:/) });
  });

  it("rejects missing HTML assets, locked layers, and byte budgets without inventing an empty snapshot", async () => {
    install({ kind: "geojson", sourceId: "fixture", url: "/fixtures/points.geojson" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("<html>missing</html>", { "content-type": "text/html" })));
    await expect(readRegisteredLayer(key, { locked: new Set() })).rejects.toThrow("DATASET_ASSET_MISSING");
    await expect(readRegisteredLayer(key, { locked: new Set([key]) })).rejects.toThrow("LAYER_DENIED");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("{}", { "content-length": String(8 * 1024 * 1024 + 1) })));
    await expect(readRegisteredLayer(key, { locked: new Set() })).rejects.toThrow("DATASET_TOO_LARGE");
  });

  it("denies an unlocked alias when another manifest key for the same source is locked", async () => {
    install({ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" });
    manifest[aliasKey] = { key: aliasKey, label: "別名", description: "same source", source: { kind: "geojson", sourceId: "fixture-alias", url: "/fixtures/points.geojson" } };
    const mockedFetch = vi.fn(); vi.stubGlobal("fetch", mockedFetch);
    await expect(readRegisteredLayer(key, { locked: new Set([aliasKey]) })).rejects.toThrow("LAYER_DENIED");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("permits an honestly empty FeatureCollection but rejects all-non-Point geometries", async () => {
    install({ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload([]))));
    await expect(readRegisteredLayer(key, { locked: new Set() })).resolves.toMatchObject({ snapshot: { rows: [] } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload([{ type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} }]))));
    await expect(readRegisteredLayer(key, { locked: new Set() })).rejects.toThrow("UNSUPPORTED_LAYER_GEOMETRY");
  });

  it("reports source feature count separately from the validated Point subset and its exclusions", async () => {
    install({ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload([
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { name: "valid" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} },
      { type: "Feature", properties: {} },
      { type: "Feature", geometry: { type: "Point", coordinates: [999, 25] }, properties: {} },
    ]))));
    const output = await readRegisteredLayer(key, { locked: new Set() });
    expect(output.snapshot).toMatchObject({ rowsScanned: 4, exclusions: { missing_geometry: 1, non_point_geometry: 1, invalid_geometry: 1 } });
    expect(output.snapshot.rows).toHaveLength(1);
  });

  it("exposes only singular safe same-origin manifest paths and rejects external, custom, or multiple sources", () => {
    install({ kind: "geojson", sourceId: "fixture", url: "https://example.com/points.geojson" });
    expect(describeRegisteredLayer(key)).toBeNull();
    install({ kind: "custom", note: "no url" }); expect(describeRegisteredLayer(key)).toBeNull();
    install([{ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" }]); expect(describeRegisteredLayer(key)).toBeNull();
    install({ kind: "geojson", sourceId: "fixture", url: "./fixtures/points.geojson" });
    expect(describeRegisteredLayer(key)).toEqual({ sourceId: "fixture", url: "./fixtures/points.geojson" });
  });
});
