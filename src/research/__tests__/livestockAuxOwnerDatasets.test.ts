import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import {
  livestockFeedOwnerAdapter,
  livestockFeedOwnerDescriptor,
  livestockMarketOwnerAdapter,
  livestockMarketOwnerDescriptor,
  livestockSlaughterOwnerAdapter,
  livestockSlaughterOwnerDescriptor,
} from "../livestockAuxOwnerDatasets";

const runtime = "../runtime/owner-only/livestock-aux";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/agriculture/livestock_ranch";
const files = new Map([
  ["feed-factories-owner-20260704.geojson", "feed-factories-owner-20260704.geojson"],
  ["livestock-markets-owner-20260704.geojson", "livestock-markets-owner-20260704.geojson"],
  ["slaughterhouses-owner-20260704.geojson", "slaughterhouses-owner-20260704.geojson"],
]);

type SourceFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string> };
function countInBbox(features: readonly SourceFeature[], bbox: readonly [number, number, number, number]) {
  return features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]).length;
}

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const name = String(input).split("/").pop();
    const file = files.get(name ?? "");
    if (!file) return new Response("missing", { status: 404 });
    return new Response(await readFile(`${runtime}/${file}`), { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(`${runtime}/feed-factories-owner-20260704.geojson`))("keeps three separate owner-only livestock families aligned with new-place processed oracles", async () => {
  const [feed, market, slaughter] = await Promise.all([
    readFile(`${processed}/feed_factory_points.geojson`, "utf8").then(value => JSON.parse(value) as { features: SourceFeature[] }),
    readFile(`${processed}/market_points.geojson`, "utf8").then(value => JSON.parse(value) as { features: SourceFeature[] }),
    readFile(`${processed}/slaughterhouse_points.geojson`, "utf8").then(value => JSON.parse(value) as { features: SourceFeature[] }),
  ]);
  const executor = new QueryExecutor([livestockFeedOwnerAdapter, livestockMarketOwnerAdapter, livestockSlaughterOwnerAdapter]);
  const checks = [
    [livestockFeedOwnerDescriptor.datasetId, feed.features, [120.5, 24.1, 120.6, 24.3], [120.25, 22.55, 120.4, 22.75]] as const,
    [livestockMarketOwnerDescriptor.datasetId, market.features, [121.4, 25.0, 121.46, 25.07], [120.25, 22.55, 120.4, 22.75]] as const,
    [livestockSlaughterOwnerDescriptor.datasetId, slaughter.features, [121.4, 25.0, 121.46, 25.07], [120.15, 23.6, 120.4, 23.9]] as const,
  ];
  for (const [datasetId, source, firstBbox, secondBbox] of checks) {
    for (const bbox of [firstBbox, secondBbox]) {
      const result = await executor.execute({ datasetId, bbox, select: ["facility_name", "geocode_type", "geometry"], limit: Math.min(100, source.length) });
      expect(result.totalMatched).toBe(countInBbox(source, bbox));
    }
  }
  const feedApproximate = await executor.execute({ datasetId: livestockFeedOwnerDescriptor.datasetId, filters: [{ field: "geocode_type", op: "eq", value: "APPROXIMATE" }], select: ["facility_name", "geocode_type"], limit: 100 });
  const marketChicken = await executor.execute({ datasetId: livestockMarketOwnerDescriptor.datasetId, filters: [{ field: "livestock_type", op: "eq", value: "雞" }], select: ["facility_name", "livestock_type"], limit: 21 });
  const slaughterApproximate = await executor.execute({ datasetId: livestockSlaughterOwnerDescriptor.datasetId, filters: [{ field: "geocode_type", op: "eq", value: "APPROXIMATE" }], select: ["facility_name", "geocode_type"], limit: 100 });
  expect(feedApproximate.totalMatched).toBe(25);
  expect(marketChicken.totalMatched).toBe(1);
  expect(slaughterApproximate.totalMatched).toBe(27);
  for (const descriptor of [livestockFeedOwnerDescriptor, livestockMarketOwnerDescriptor, livestockSlaughterOwnerDescriptor]) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["地址", "BAN", "電話", "address", "lat", "lon"]));
    expect(descriptor.license).toContain("RIGHTS_HOLD");
  }
});
