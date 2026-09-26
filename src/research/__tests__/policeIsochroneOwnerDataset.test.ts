import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { clearPoliceIsochroneOwnerCache, policeIsochroneOwnerAdapters, policeIsochroneOwnerDescriptors } from "../policeIsochroneOwnerDataset";

const root = new URL("../../../../../../../taipei-gis-analytics/data/processed/police_justice/isochrone/", import.meta.url);
const paths = ["police_iso_substation_combined.geojson", "police_iso_precinct_combined.geojson", "police_iso_police_dept_combined.geojson"];

function sourceFetch(files: Map<string, Uint8Array>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const parts = String(input).split("/");
    const name = parts[parts.length - 1]!;
    const bytes = files.get(name);
    return bytes ? new Response(bytes, { headers: { "content-type": "application/geo+json", "content-length": String(bytes.byteLength) } }) : new Response(null, { status: 404 });
  });
}

describe.skipIf(!existsSync(root))("fixed police model fragments", () => {
  it("reads three pinned outputs and preserves model-only semantics and two-city variant counts", async () => {
    const files = new Map(await Promise.all(paths.map(async name => [name, new Uint8Array(await readFile(new URL(name, root)))] as const)));
    clearPoliceIsochroneOwnerCache();
    const fetcher = sourceFetch(files);
    vi.stubGlobal("fetch", fetcher);
    try {
      const executor = new QueryExecutor(policeIsochroneOwnerAdapters);
      const ids = policeIsochroneOwnerDescriptors.map(descriptor => descriptor.datasetId);
      for (const descriptor of policeIsochroneOwnerDescriptors) {
        expect(descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
        expect(descriptor.supportedOperations).not.toContain("nearest");
      }
      const substation = await executor.execute({ datasetId: ids[0]!, bbox: [121.53, 25.03, 121.55, 25.05], filters: [{ field: "mode", op: "eq", value: "walk" }], select: ["tier", "mode", "minutes", "overlap_count"], limit: 10 });
      expect(substation.totalMatched).toBe(6);
      const precinct = await executor.execute({ datasetId: ids[1]!, bbox: [121.59, 23.98, 121.63, 24.02], filters: [{ field: "mode", op: "eq", value: "drive" }], select: ["tier", "mode", "minutes", "overlap_count"], limit: 10 });
      expect(precinct.totalMatched).toBe(3);
      const department = await executor.execute({ datasetId: ids[2]!, bbox: [121.59, 23.98, 121.63, 24.02], filters: [{ field: "mode", op: "eq", value: "walk" }], select: ["tier", "mode", "minutes", "overlap_count"], limit: 10 });
      expect(department.totalMatched).toBe(2);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(substation.sourceRefs[0]?.checksumSha256).toBe("d135d84ce395b9762d0ba83d1118e88d54c8e142af75015e7a59bd10fdea3adc");
    } finally { vi.unstubAllGlobals(); clearPoliceIsochroneOwnerCache(); }
  });

  it("rejects a same-size source with changed bytes", async () => {
    const bytes = new Uint8Array(await readFile(new URL(paths[2]!, root)));
    bytes[bytes.length - 2] = bytes[bytes.length - 2]! ^ 1;
    clearPoliceIsochroneOwnerCache(); vi.stubGlobal("fetch", sourceFetch(new Map([[paths[2]!, bytes]])));
    try {
      const executor = new QueryExecutor([policeIsochroneOwnerAdapters[2]!]);
      await expect(executor.execute({ datasetId: policeIsochroneOwnerDescriptors[2]!.datasetId, select: ["tier"], limit: 1 })).rejects.toThrow("POLICE_ISO_SHA_MISMATCH");
    } finally { vi.unstubAllGlobals(); clearPoliceIsochroneOwnerCache(); }
  });
});
