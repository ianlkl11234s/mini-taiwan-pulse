import { describe, expect, it, vi } from "vitest";
import { createLocalPopulationPreviewAdapter } from "../localPopulationPreview";

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
});
