import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { culturalMuseumsOwnerAdapter } from "../culturalMuseumsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const asset = "../runtime/owner-only/cultural-museums/cultural-museums-owner-20260716.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps the 266-row list, its 14 unlocated records, and per-row coordinate provenance", async () => {
  const executor = new QueryExecutor([culturalMuseumsOwnerAdapter]);
  const all = await executor.execute({ datasetId: "tw-local-cultural-museums-owner-20260716", limit: 1 });
  const google = await executor.execute({ datasetId: "tw-local-cultural-museums-owner-20260716", filters: [{ field: "source", op: "eq", value: "google" }], select: ["museum_id", "source", "precision", "geometry"], limit: 1 });
  const unlocated = await executor.execute({ datasetId: "tw-local-cultural-museums-owner-20260716", filters: [{ field: "coord_status", op: "eq", value: "no_coord" }], select: ["museum_id", "source", "precision", "geometry"], limit: 20 });
  expect(all).toMatchObject({ totalMatched: 266, excludedByReason: { missing_geometry: 14 } });
  expect(google).toMatchObject({ totalMatched: 80, rows: [{ source: "google", geometry: { type: "Point" } }] });
  expect(unlocated).toMatchObject({ totalMatched: 14, rows: Array(14).fill({ source: "", precision: "", geometry: null }) });
  expect(culturalMuseumsOwnerAdapter.descriptor.access.mode).toBe("owner_only");
  expect(culturalMuseumsOwnerAdapter.descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(culturalMuseumsOwnerAdapter.descriptor.supportedOperations).not.toContain("nearest");
});

it("allows bbox reference-position filtering without claiming nearest analysis", async () => {
  const executor = new QueryExecutor([culturalMuseumsOwnerAdapter]);
  const result = await executor.execute({ datasetId: "tw-local-cultural-museums-owner-20260716", bbox: [121.50, 25.03, 121.54, 25.05], select: ["name", "source", "precision", "geometry"], limit: 50 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
});

it("rejects changed sidecar bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([culturalMuseumsOwnerAdapter]).execute({ datasetId: "tw-local-cultural-museums-owner-20260716" })).rejects.toThrow("CULTURAL_MUSEUMS_OWNER_SOURCE_SHA_MISMATCH");
});
