import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import {
  religionAncestralHallsOwnerAdapter, religionAncestralHallsOwnerDescriptor, religionChurchesOwnerAdapter, religionChurchesOwnerDescriptor,
  religionFoundationsOwnerAdapter, religionFoundationsOwnerDescriptor, religionOtherWorshipOwnerAdapter, religionOtherWorshipOwnerDescriptor,
  religionTop100OwnerAdapter, religionTop100OwnerDescriptor,
} from "../religionPointsOwnerDatasets";

const root = "../runtime/owner-only/religion-points";
const assets: Record<string, string> = Object.fromEntries(["ancestral-halls", "churches", "other-worship", "foundations", "top100"].map(name => [`${name}-owner-${name === "top100" ? "20260122" : "20260801"}.geojson`, `${root}/${name}-owner-${name === "top100" ? "20260122" : "20260801"}.geojson`]));
const descriptors = [religionAncestralHallsOwnerDescriptor, religionChurchesOwnerDescriptor, religionOtherWorshipOwnerDescriptor, religionFoundationsOwnerDescriptor, religionTop100OwnerDescriptor];
const adapters = [religionAncestralHallsOwnerAdapter, religionChurchesOwnerAdapter, religionOtherWorshipOwnerAdapter, religionFoundationsOwnerAdapter, religionTop100OwnerAdapter];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => { const asset = assets[String(url).split("/").pop()!]; return asset ? new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } }) : new Response("missing", { status: 404 }); })); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads five bounded owner-only religion snapshots while retaining their source licenses", async () => {
  const results = await Promise.all(descriptors.map(descriptor => new QueryExecutor(adapters).execute({ datasetId: descriptor.datasetId, limit: 1 })));
  expect(results.map(result => result.totalMatched)).toEqual([173, 2116, 1319, 165, 100]);
  for (const descriptor of descriptors) expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(religionChurchesOwnerDescriptor.license).toContain("ODbL-1.0");
  expect(religionOtherWorshipOwnerDescriptor.license).toContain("© OpenStreetMap contributors");
  expect(religionTop100OwnerDescriptor.coverage).toContain("非全國宗教場所普查");
});

it("preserves original missing foundation coordinates instead of using backfills as points", async () => {
  const result = await new QueryExecutor([religionFoundationsOwnerAdapter]).execute({ datasetId: religionFoundationsOwnerDescriptor.datasetId, select: ["coordinate_status", "geometry"], limit: 100 });
  expect(result.totalMatched).toBe(165);
  expect(result.excludedByReason.missing_geometry).toBe(41);
});

it("fails closed when an immutable sidecar changes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([religionOtherWorshipOwnerAdapter]).execute({ datasetId: religionOtherWorshipOwnerDescriptor.datasetId })).rejects.toThrow("RELIGION_RELIGIONOTHERWORSHIP_SOURCE_SHA_MISMATCH");
});
