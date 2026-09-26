import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { evChargingOwnerAdapter, evChargingOwnerDescriptor } from "../evChargingOwnerDataset";

const sidecar = "../runtime/owner-only/ev-charging/ev-charging-owner-20260615.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/energy/ev_charging_stations/ev_charging_stations_20260615.geojson";
const bboxes = { taipei: [121.50, 25.02, 121.56, 25.08] as const, kaohsiung: [120.27, 22.58, 120.36, 22.68] as const };

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("matches two independent processed-source bbox oracles and source filter", async () => {
  const raw = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { source: string } }[] };
  const executor = new QueryExecutor([evChargingOwnerAdapter]);
  for (const bbox of Object.values(bboxes)) {
    const expected = raw.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]).length;
    const result = await executor.execute({ datasetId: evChargingOwnerDescriptor.datasetId, bbox, select: ["station_id", "name", "source", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
  const airport = await executor.execute({ datasetId: evChargingOwnerDescriptor.datasetId, filters: [{ field: "source", op: "eq", value: "tdx_aircaa" }], select: ["station_id", "source"], limit: 10 });
  expect(airport.totalMatched).toBe(2);
});

it("keeps owner-only reference semantics and removes sensitive free text", () => {
  expect(evChargingOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(evChargingOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "telephone", "service_time", "parking_rate", "charging_rate", "connectors", "floors", "description", "lat", "lon"]));
  expect(evChargingOwnerDescriptor.license).toContain("TDX_RIGHTS_HOLD");
});
