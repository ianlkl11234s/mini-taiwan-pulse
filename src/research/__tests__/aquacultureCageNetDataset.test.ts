import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { aquacultureCageNetAdapter, aquacultureCageNetDescriptor } from "../aquacultureCageNetDataset";

const fetchSnapshot = async () => new Response(await readFile("public/fishery/aquaculture_cage_net.geojson"));
it("reads two independent place/name variants from the 42 Polygon snapshot", async () => {
  const original = globalThis.fetch; globalThis.fetch = fetchSnapshot;
  try {
    const executor = new QueryExecutor([aquacultureCageNetAdapter]);
    const magong = await executor.execute({ datasetId: aquacultureCageNetDescriptor.datasetId, bbox: [119.57818, 23.52825, 119.57821, 23.52829], filters: [{ field: "township", op: "eq", value: "馬公市" }], select: ["public_no", "township", "geometry"], limit: 42 });
    const xiyu = await executor.execute({ datasetId: aquacultureCageNetDescriptor.datasetId, bbox: [119.52712, 23.61479, 119.52715, 23.61483], filters: [{ field: "township", op: "eq", value: "西嶼鄉" }], select: ["public_no", "township", "location"], limit: 42 });
    expect(magong).toMatchObject({ totalMatched: 1, rows: [expect.objectContaining({ public_no: "澎漁權字第0087號", township: "馬公市", geometry: expect.objectContaining({ type: "Polygon" }) })] });
    expect(xiyu).toMatchObject({ totalMatched: 1, rows: [expect.objectContaining({ public_no: "澎漁權字第0119號", township: "西嶼鄉" })] });
  } finally { globalThis.fetch = original; }
});
it("fails closed on an incorrect fixed SHA", async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => new Response("{}", { status: 200 });
  try { await expect(new QueryExecutor([aquacultureCageNetAdapter]).execute({ datasetId: aquacultureCageNetDescriptor.datasetId, limit: 1 })).rejects.toThrow("AQUACULTURE_CAGE_NET_SOURCE_MISMATCH"); } finally { globalThis.fetch = original; }
});
