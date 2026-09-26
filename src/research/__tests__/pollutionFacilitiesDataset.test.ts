import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pollutionFacilitiesAdapter, pollutionFacilitiesDescriptor } from "../pollutionFacilitiesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/research-public/pollution-facilities/";

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice("/research/pollution-facilities/".length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires a bbox and keeps potential-regulation, null severity, and privacy semantics", async () => {
  const executor = new QueryExecutor([pollutionFacilitiesAdapter]);
  expect(pollutionFacilitiesDescriptor.access.query.supportsBbox).toBe(true);
  expect(pollutionFacilitiesDescriptor.fields.map(field => field.name)).not.toContain("facility_address");
  expect(pollutionFacilitiesDescriptor.fields.map(field => field.name)).not.toContain("industry_name");
  expect(pollutionFacilitiesDescriptor.description).toContain("不等於已確認污染");
  await expect(executor.execute({ datasetId: pollutionFacilitiesDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
});

it("reads only immutable bbox shards and keeps per-medium absence separate from zero", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const shard = JSON.parse(gunzipSync(await readFile(`${root}${manifest.shards[0]!.path}`)).toString("utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { emsno: string; mediums: string; sev_air: number | null } }[] };
  const target = shard.features.find(feature => feature.properties.sev_air === null) ?? shard.features[0]!;
  const [lng, lat] = target.geometry.coordinates;
  const result = await new QueryExecutor([pollutionFacilitiesAdapter]).execute({ datasetId: pollutionFacilitiesDescriptor.datasetId, bbox: [lng, lat, lng, lat], filters: [{ field: "emsno", op: "eq", value: target.properties.emsno }] });
  expect(result.totalMatched).toBeGreaterThanOrEqual(1);
  expect(result.rows[0]).toMatchObject({ emsno: target.properties.emsno, geometry: { type: "Point", coordinates: [lng, lat] } });
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: "7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9" });
  expect(result.cost.downloadedBytes).toBeLessThan(8 * 1024 * 1024);
  if (target.properties.sev_air === null) expect(result.rows[0]?.sev_air).toBeNull();
});

it("accepts Vite's transparent gzip response only when decoded bytes match the immutable shard receipt", async () => {
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, "utf8")) as { shards: { path: string }[] };
  const compressed = await readFile(`${root}${manifest.shards[0]!.path}`);
  const shard = JSON.parse(gunzipSync(compressed).toString("utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { emsno: string } }[] };
  const target = shard.features[0]!;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const bytes = await readFile(`${root}${url.slice("/research/pollution-facilities/".length)}`);
    return url.endsWith(".gz")
      ? new Response(gunzipSync(bytes), { headers: { "content-encoding": "gzip", "content-length": String(bytes.length) } })
      : new Response(bytes);
  }));
  const [lng, lat] = target.geometry.coordinates;
  const result = await new QueryExecutor([pollutionFacilitiesAdapter]).execute({ datasetId: pollutionFacilitiesDescriptor.datasetId, bbox: [lng, lat, lng, lat], filters: [{ field: "emsno", op: "eq", value: target.properties.emsno }] });
  expect(result.totalMatched).toBeGreaterThanOrEqual(1);
  expect(result.cost.downloadedBytes).toBeLessThan(8 * 1024 * 1024);
});
