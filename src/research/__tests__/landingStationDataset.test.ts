import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { landingStationsNodeCoordinatesAdapter, landingStationsOverpassCenterAdapter } from "../landingStationDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetsForLayer } from "../researchDatasets";

afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("queries the pinned OSM landing-station snapshot by a case-normalized place variant", async () => {
  const bytes = await readFile("public/geo/landing_stations.geojson");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));
  const executor = new QueryExecutor([landingStationsNodeCoordinatesAdapter]);

  const tata = await executor.execute({ datasetId: "osm-cable-landing-stations-node-coordinates", filters: [{ field: "name", op: "contains", value: "tata tgn-pacific" }] });

  expect(tata).toMatchObject({ totalMatched: 1, rows: [{ name: "Tata TGN-Pacific CLS", osm_type: "node", coord_qc_status: "node_coordinates" }], sourceRefs: [expect.objectContaining({ checksumSha256: "ec6646f1ab45623c6f5dd0b074582f806572a7223934bed172ff06221da35927" })] });
});

it("splits fixed node coordinates from Overpass center proxies", async () => {
  const bytes = await readFile("public/geo/landing_stations.geojson");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));

  const nodes = await landingStationsNodeCoordinatesAdapter.read({});
  const centers = await landingStationsOverpassCenterAdapter.read({});
  expect(nodes.rows).toHaveLength(11);
  expect(centers.rows).toHaveLength(47);
  expect(landingStationsNodeCoordinatesAdapter.descriptor).toMatchObject({
    layerRefs: ["landingStations"],
    geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
    versions: [{ checksumSha256: "ec6646f1ab45623c6f5dd0b074582f806572a7223934bed172ff06221da35927" }],
  });
  expect(landingStationsOverpassCenterAdapter.descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(landingStationsOverpassCenterAdapter.descriptor.access.query.supportsBbox).toBe(false);
  expect(landingStationsOverpassCenterAdapter.descriptor.supportedOperations).not.toContain("nearest");
  await expect(new QueryExecutor([landingStationsOverpassCenterAdapter]).execute({ datasetId: "osm-cable-landing-stations-overpass-centers", bbox: [-10, 50, 0, 60] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
  expect(landingStationsOverpassCenterAdapter.descriptor.fields.map(field => field.name)).toContain("coord_qc_status");
  expect(registeredDatasetsForLayer("landingStations").map(dataset => dataset.datasetId)).toEqual(["osm-cable-landing-stations-node-coordinates", "osm-cable-landing-stations-overpass-centers"]);
});
