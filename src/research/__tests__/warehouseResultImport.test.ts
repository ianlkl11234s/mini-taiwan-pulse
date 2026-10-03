import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { EXPLORATION_OPERATIONS } from "../MainMapConnection";
import { ResearchAnalysisSession } from "../researchAnalysisSession";
import { loadWarehouseResult, validateWarehouseImportArgs, warehouseGeometryFor } from "../warehouseResultImport";
import type { WarehouseResultStyle } from "../warehouseResultStyle";

const collection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "Polygon", coordinates: [[[121.50, 25.03], [121.52, 25.03], [121.52, 25.05], [121.50, 25.05], [121.50, 25.03]]] }, properties: { name: "671 路 200m 環域", _wh_label: "671" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [121.51, 25.04] }, properties: { name: "樣品國小", _wh_dataset: "schools" } },
    { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[121.505, 25.035], [121.515, 25.045]] }, properties: { school_name: "分校" } },
  ],
};
const body = JSON.stringify(collection);
const sha = createHash("sha256").update(body).digest("hex");
/** Injected gateway reader: resolves the raw text, or rejects like BridgeClient.fetchResult on 404. */
const okFetch = (text = body, status = 200) => vi.fn(async (_resultId: string) => { if (status !== 200) throw new Error("RESULT_NOT_FOUND"); return text; });

describe("warehouse result import", () => {
  it("validates relay args", () => {
    expect(validateWarehouseImportArgs({ resultId: "wh-8", sha256: sha, label: " 671 ", featureCount: 3 }).label).toBe("671");
    for (const bad of [{ resultId: "x-8", sha256: sha, label: "a", featureCount: 1 }, { resultId: "wh-8", sha256: "ABC", label: "a", featureCount: 1 }, { resultId: "wh-8", sha256: sha, label: "", featureCount: 1 }, { resultId: "wh-8", sha256: sha, label: "a", featureCount: 5001 }, { resultId: "wh-8", sha256: sha, label: "a", featureCount: 1, extra: 1 }]) {
      expect(() => validateWarehouseImportArgs(bad)).toThrow("WAREHOUSE_RESULT_INVALID");
    }
  });

  it("splits a verified mixed result into one session result per geometry type", async () => {
    const fetchText = okFetch();
    const results = await loadWarehouseResult({ resultId: "wh-8", sha256: sha, label: "671 環域", featureCount: 3 }, fetchText);
    expect(fetchText).toHaveBeenCalledWith("wh-8");
    expect(results.map(r => r.resultId).sort()).toEqual(["wh-8:point", "wh-8:polygon"]);
    const points = results.find(r => r.geometry.type === "Point")!;
    expect(points.rows).toHaveLength(3); // MultiPoint split into two Points
    expect(points.rows.map(row => row.label)).toEqual(["樣品國小", "分校", "分校"]);
    expect(points.lineage).toMatchObject({ origin: "warehouse", sha256: sha, warehouseDatasets: ["schools"] });
  });

  it("keeps only all-actual points/lines spatial-analysis eligible; absent/other precision is drawn but not eligible", async () => {
    const actual = { properties: { _wh_location_precision: "actual" } };
    expect(warehouseGeometryFor("Point", [actual, actual])).toEqual({ type: "Point", role: "actual", spatialAnalysisEligible: true });
    expect(warehouseGeometryFor("LineString", [actual])).toEqual({ type: "LineString", role: "actual", spatialAnalysisEligible: true });
    for (const precision of ["approximate", "derived", "unknown", undefined, null, "ACTUAL"]) {
      const other = { properties: precision === undefined ? {} : { _wh_location_precision: precision } };
      expect(warehouseGeometryFor("Point", [actual, other])).toEqual({ type: "Point", role: "generalized", spatialAnalysisEligible: false });
      expect(warehouseGeometryFor("MultiLineString", [other])).toEqual({ type: "MultiLineString", role: "proxy", spatialAnalysisEligible: false });
    }
    expect(warehouseGeometryFor("Polygon", [actual])).toEqual({ type: "Polygon", role: "derived", spatialAnalysisEligible: false });

    // End to end: the fixture's points carry no precision (older MCP) -> not eligible, but still presentable on the map.
    const session = new ResearchAnalysisSession();
    const receipt = await session.importWarehouseResult({ resultId: "wh-8", sha256: sha, label: "671 環域", featureCount: 3 }, okFetch());
    const points = (await loadWarehouseResult({ resultId: "wh-8", sha256: sha, label: "671 環域", featureCount: 3 }, okFetch())).find(r => r.geometry.type === "Point")!;
    expect(points.geometry).toEqual({ type: "Point", role: "generalized", spatialAnalysisEligible: false });
    expect(session.mapEligible("wh-8:point")).toBe(true);
    expect(receipt.resultIds).toContain("wh-8:point");

    const precise = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [121.51, 25.04] }, properties: { name: "官方點", _wh_dataset: "schools", _wh_location_precision: "actual" } }] });
    const preciseSha = createHash("sha256").update(precise).digest("hex");
    const [actualPoints] = await loadWarehouseResult({ resultId: "wh-9", sha256: preciseSha, label: "官方點", featureCount: 1 }, okFetch(precise));
    expect(actualPoints!.geometry).toEqual({ type: "Point", role: "actual", spatialAnalysisEligible: true });
  });

  it("rejects unavailable, tampered, miscounted or invalid files", async () => {
    const args = { resultId: "wh-8", sha256: sha, label: "x", featureCount: 3 };
    await expect(loadWarehouseResult(args, okFetch(body, 404))).rejects.toThrow("WAREHOUSE_RESULT_UNAVAILABLE");
    await expect(loadWarehouseResult(args, async () => { throw new Error("net"); })).rejects.toThrow("WAREHOUSE_RESULT_UNAVAILABLE");
    await expect(loadWarehouseResult(args, okFetch(body.replace("樣品", "樣本")))).rejects.toThrow("WAREHOUSE_RESULT_SHA_MISMATCH");
    await expect(loadWarehouseResult({ ...args, featureCount: 2 }, okFetch())).rejects.toThrow("WAREHOUSE_RESULT_INVALID");
    const projected = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [302166, 2771171] }, properties: {} }] });
    const projectedSha = createHash("sha256").update(projected).digest("hex");
    await expect(loadWarehouseResult({ ...args, sha256: projectedSha, featureCount: 1 }, okFetch(projected))).rejects.toThrow("WAREHOUSE_RESULT_INVALID");
  });

  it("registers presentable results in the analysis session and replaces a re-import", async () => {
    const session = new ResearchAnalysisSession();
    const receipt = await session.importWarehouseResult({ resultId: "wh-8", sha256: sha, label: "671 環域", featureCount: 3 }, okFetch());
    expect(receipt.resultIds).toEqual(expect.arrayContaining(["wh-8:point", "wh-8:polygon"]));
    const presentable = session.presentable(receipt.resultIds as string[]);
    expect(presentable.map(item => item.displayLabel)).toEqual(["671 環域", "671 環域"]);
    const bounds = session.bounds(receipt.resultIds as string[]);
    expect(bounds.bounds).toEqual([121.5, 25.03, 121.52, 25.05]);
    // Re-import with a single geometry type drops the stale split ids.
    const single = JSON.stringify({ type: "FeatureCollection", features: [collection.features[1]] });
    const singleSha = createHash("sha256").update(single).digest("hex");
    const second = await session.importWarehouseResult({ resultId: "wh-8", sha256: singleSha, label: "只剩學校", featureCount: 1 }, okFetch(single));
    expect(second.resultIds).toEqual(["wh-8"]);
    expect(session.hasResult("wh-8:polygon")).toBe(false);
  });

  it("is accepted by the paired map's operation gate, not only by the session", () => {
    // Regression: the session handled the import but the map-level allowlist rejected it
    // (MAP_EXPLORATION_OPERATION_UNSUPPORTED) in the first real MCP → Gateway → browser run.
    expect(EXPLORATION_OPERATIONS.has("import_warehouse_result")).toBe(true);
  });
});

// T1=L1: a series-styled result has an empty FeatureCollection (featureCount 0, no geometry at all).
const seriesStyle = {
  kind: "series", timeField: "m", valueField: "v", baselineField: null, baselineLabel: null,
  title: "事故件數", unit: "件", valueKind: "count",
  periods: ["2024-01-01", "2024-02-01"], periodUnit: "month", values: [10, 30], baseline: null,
  min: 10, max: 30, latest: { period: "2024-02-01", value: 30 }, nullCount: 0,
} as const satisfies WarehouseResultStyle;
const emptyCollection = JSON.stringify({ type: "FeatureCollection", features: [] });
const emptySha = createHash("sha256").update(emptyCollection).digest("hex");
const emptyFetch = async () => emptyCollection;

describe("warehouse series import (T1=L1, no map geometry)", () => {
  it("registers one non-spatial, series-shaped result instead of zero results", async () => {
    const [result] = await loadWarehouseResult({ resultId: "wh-9", sha256: emptySha, label: "事故件數", featureCount: 0, style: seriesStyle }, emptyFetch);
    expect(result).toBeDefined();
    expect(result!.resultId).toBe("wh-9");
    expect(result!.recordGrain).toBe("series");
    expect(result!.geometry).toEqual({ type: "none", role: "none", spatialAnalysisEligible: false });
    expect(result!.rows).toEqual([]);
    expect(result!.resultStyle).toEqual(seriesStyle);
  });

  it("is picked up by the session's seriesResult() (map-eligibility-free), never by presentable()", async () => {
    const session = new ResearchAnalysisSession();
    const receipt = await session.importWarehouseResult({ resultId: "wh-9", sha256: emptySha, label: "事故件數", featureCount: 0, style: seriesStyle }, emptyFetch);
    expect(receipt.resultIds).toEqual(["wh-9"]);
    expect(receipt).not.toHaveProperty("bounds"); // no map-eligible geometry to bound
    expect(session.mapEligible("wh-9")).toBe(false);
    const series = session.seriesResult("wh-9");
    expect(series?.displayLabel).toBe("事故件數");
    expect(series?.resultStyle).toEqual(seriesStyle);
    expect(() => session.presentable(["wh-9"])).toThrow("RESULT_NOT_MAP_ELIGIBLE");
  });

  it("rejects proportional/bivariate styles on geometry they cannot draw", async () => {
    // `collection` mixes a Polygon with Points: proportional needs Points only, bivariate Polygons only.
    for (const kind of ["proportional", "bivariate"] as const) {
      await expect(loadWarehouseResult({ resultId: "wh-8", sha256: sha, label: "x", featureCount: 3, style: { kind } as unknown as WarehouseResultStyle }, okFetch())).rejects.toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    }
  });

  it("rejects a series style paired with actual features", async () => {
    await expect(loadWarehouseResult({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 3, style: seriesStyle }, okFetch())).rejects.toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });
});
