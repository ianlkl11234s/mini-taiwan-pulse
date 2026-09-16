import { describe, expect, it, vi } from "vitest";
import type { DataCatalogEntry } from "../../data/dataCatalogLoader";
import { describeLayers } from "../layerExploration";

const context = { locked: new Set(["eduSchoolElementary"]), visible: new Set(["schools"]) };
const catalog: DataCatalogEntry = { datasetId: "fixture-catalog", title: "來源標題", summary: "這是 catalog metadata，不是 payload。", providerAgency: "測試機關", sourceUrl: "https://data.example/catalog", sourceDatasetId: null, license: "CC BY", lifecycle: null, updateFrequency: "monthly", lastUpdated: "2026-09-01", catalogMdPath: "docs/catalog.md" };

describe("describeLayers", () => {
  it("keeps display capability separate from reader metadata and returns manifest lineage", async () => {
    const fetchCatalog = vi.fn().mockResolvedValue([catalog]);
    const output = await describeLayers(["eduSchoolElementary"], context, { fetchCatalog });
    expect(output.layers[0]).toMatchObject({ key: "eduSchoolElementary", locked: true, displayCapability: { canOpen: false, basis: "manifest_registration" }, metadataBasis: "manifest_registration_not_live_verification", catalog: { status: "entries", metadataTrust: "untrusted" } });
    expect(output.layers[0]?.upstream.datasets.length).toBeGreaterThan(0);
    expect(output.layers[0]?.catalog.entries[0]).toMatchObject({ sourceUrl: "https://data.example/catalog", externalLinks: [{ label: "來源網站", url: "https://data.example/catalog" }] });
  });

  it("uses injected fallback without calling a live provider and does not call an empty response no data", async () => {
    const fetchCatalog = vi.fn().mockResolvedValue([]);
    const output = await describeLayers(["schools"], context, { fetchCatalog });
    expect(fetchCatalog).toHaveBeenCalledWith("schools");
    expect(output.layers[0]?.catalog).toMatchObject({ status: "no_entries_or_unavailable", entries: [] });
    expect(output.layers[0]?.displayCapability.canOpen).toBe(true);
  });

  it("bounds keys, marks unavailable catalog metadata, filters unsafe links, and relates layers without toggling them", async () => {
    const output = await describeLayers(["schools", "eduSchoolElementary", "eduSchoolJunior"], context, { fetchCatalog: async key => key === "schools" ? [catalog, { ...catalog, sourceUrl: "javascript:alert(1)" }] : new Promise(() => {}) });
    expect(output.layers).toHaveLength(3);
    expect(output.layers[0]?.catalog.status).toBe("entries");
    expect(output.layers[1]?.catalog.status).toBe("no_entries_or_unavailable");
    expect(output.layers[0]?.catalog.entries[1]?.externalLinks).toEqual([]);
    expect(output.layers[0]?.relatedLayers.length).toBeLessThanOrEqual(4);
    await expect(describeLayers(["schools", "eduSchoolElementary", "eduSchoolJunior", "eduSchoolSenior"], context, { fetchCatalog: async () => [] })).rejects.toThrow("INVALID_LAYER_DETAILS_INPUT");
  }, 8_000);
});
