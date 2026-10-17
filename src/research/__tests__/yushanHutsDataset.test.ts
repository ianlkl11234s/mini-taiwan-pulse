import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { yushanHutsAdapter } from "../yushanHutsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { assertDatasetDescriptor } from "../dataContracts";

afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("qualifies the pinned official-coordinate subset without leaking mixed-source attributes", async () => {
  assertDatasetDescriptor(yushanHutsAdapter.descriptor);
  const bytes = await readFile("public/forestry/mountain_huts.geojson");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));
  const result = await yushanHutsAdapter.read({});
  const source = JSON.parse(bytes.toString()) as { features: Array<{ geometry: unknown; properties: Record<string, unknown> }> };
  const official = source.features.filter(feature => feature.properties.coord_source === "yushan_np_shp");
  expect(result.rows).toHaveLength(30);
  expect(result.exclusions).toMatchObject({ excluded_by_selection: 106 });
  expect(result.rows.map(row => row.geometry)).toEqual(official.map(feature => feature.geometry));
  for (const row of result.rows) {
    expect(row).not.toHaveProperty("capacity");
    expect(row).not.toHaveProperty("osm_id");
    const original = official.find(feature => feature.properties.name === row.name)!;
    const provenance = original.properties._provenance as Array<{ source: string; name_raw: string; lon: number; lat: number }>;
    const record = provenance.find(value => value.source === "yushan_np_shp")!;
    expect(row.name).toBe(record.name_raw);
    expect(row.geometry).toEqual({ type: "Point", coordinates: [record.lon, record.lat] });
  }
});
