import { describe, expect, it, vi } from "vitest";
import { createLocalPopulationPreviewAdapter, localPopulationPreviewAdapters } from "../localPopulationPreview";

const parameters = { releaseId: "2025-12-total_population-county-local-preview" };

describe("fixed local population preview transport", () => {
  it("rejects missing or HTML assets instead of accepting the SPA fallback", async () => {
    for (const status of [200, 404]) {
      const fetcher = vi.fn(async () => new Response("<html>fallback</html>", { status, headers: { "content-type": "text/html" } }));
      await expect(createLocalPopulationPreviewAdapter(fetcher).read(parameters)).rejects.toThrow("ASSET_MISSING");
    }
  });

  it("rejects an oversized artifact before accepting snapshot data", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(4734), { headers: { "content-length": "4734", "content-type": "application/json" } }));
    await expect(createLocalPopulationPreviewAdapter(fetcher).read(parameters)).rejects.toThrow("POPULATION_PREVIEW_ARTIFACT_BYTES_MISMATCH");
  });

  it("does not fetch when its caller already cancelled", async () => {
    const fetcher = vi.fn(async () => new Response("{}"));
    const controller = new AbortController(); controller.abort();
    await expect(createLocalPopulationPreviewAdapter(fetcher).read(parameters, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps three fixed group profiles and never lets a caller provide their artifact URL", async () => {
    expect(localPopulationPreviewAdapters.map(adapter => ({ datasetId: adapter.descriptor.datasetId, releaseId: adapter.descriptor.versions[0]?.versionId, checksum: adapter.descriptor.versions[0]?.checksumSha256, label: adapter.descriptor.label }))).toEqual([
      { datasetId: "population_statistics", releaseId: "2025-12-total_population-county-local-preview", checksum: "dceed8b079fb7949c63b368b52b062fdf622bcfbadca7265bc41a2bba72973f5", label: "2025-12 行政區人口數（本機 preview）" },
      { datasetId: "population_statistics:male", releaseId: "2025-12-male_population-county-local-preview", checksum: "92cf23066a18a71ec1b80e863ffaee53d6e24186a59a5d77fe7923ed6d86d2db", label: "2025-12 男性人口數（本機 preview）" },
      { datasetId: "population_statistics:female", releaseId: "2025-12-female_population-county-local-preview", checksum: "8d1ff350007932ac57fa5a70fbec60238ca6b2b70f4459e616d387dd99100165", label: "2025-12 女性人口數（本機 preview）" },
    ]);
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } }));
    await expect(createLocalPopulationPreviewAdapter(fetcher, "male").read({ releaseId: "2025-12-male_population-county-local-preview" })).rejects.toThrow("POPULATION_PREVIEW_ASSET_MISSING");
    expect(fetcher.mock.calls.some(([url]) => url === "/__local-research-population-preview/92cf23066a18a71ec1b80e863ffaee53d6e24186a59a5d77fe7923ed6d86d2db.json")).toBe(true);
  });

});
