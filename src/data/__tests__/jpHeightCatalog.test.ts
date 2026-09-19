import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJpHeightCatalog } from "../jpHeightCatalog";
const asset = { url: "./jp-heights/x.pmtiles", bbox: [139, 35, 140, 36], minzoom: 4, maxzoom: 12, bytes: 1, sha256: "a".repeat(64) };
const doc = (regions: unknown[] = [{ id: "tokyo", label: "Tokyo", bbox: [139,35,140,36], status: "ready", grid: asset }]) => ({ schema: "jp-height-catalog-v1", version: "v1", regions });
describe("JP height catalog contract", () => {
  it("accepts a bounded local asset", () => expect(parseJpHeightCatalog(doc()).regions).toHaveLength(1));
  it("accepts a bounded canopy overview under the raster budget", () => {
    const parsed = parseJpHeightCatalog({ ...doc(), canopyOverview: { ...asset, url: "./jp-heights/canopy-overview.pmtiles", bytes: 25 * 1024 * 1024 } });
    expect(parsed.canopyOverview?.url).toContain("canopy-overview");
  });
  it("preserves an overview's explicit region coverage and rejects duplicates", () => {
    const parsed = parseJpHeightCatalog({ ...doc(), overview: { ...asset, regionIds: ["tokyo"] } });
    expect(parsed.overview?.regionIds).toEqual(["tokyo"]);
    expect(() => parseJpHeightCatalog({ ...doc(), overview: { ...asset, regionIds: ["tokyo", "tokyo"] } })).toThrow();
  });
  it("rejects traversal/query paths, asset budget, and duplicate ids", () => {
    expect(() => parseJpHeightCatalog(doc([{ id:"x",label:"x",bbox:[139,35,140,36],status:"ready",grid:{...asset,url:"./jp-heights/../../x.pmtiles"} }]))).toThrow();
    expect(() => parseJpHeightCatalog(doc([{ id:"x",label:"x",bbox:[139,35,140,36],status:"ready",grid:{...asset,sourceLayer:"building_grid",bytes:6*1024*1024} }]))).toThrow();
    expect(() => parseJpHeightCatalog(doc([{ id:"x",label:"x",bbox:[139,35,140,36],status:"ready"},{ id:"x",label:"x",bbox:[139,35,140,36],status:"ready"}]))).toThrow();
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("JP height catalog loader", () => {
  it("uses the explicit legacy catalog only for HTTP 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { loadJpHeightCatalog } = await import("../jpHeightCatalog");
    await expect(loadJpHeightCatalog()).resolves.toMatchObject({ status: "legacy" });
  });
  it("records a 503 as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const { loadJpHeightCatalog, getLoadedJpHeightCatalog } = await import("../jpHeightCatalog");
    await expect(loadJpHeightCatalog()).resolves.toMatchObject({ status: "unavailable", error: "catalog HTTP 503" });
    expect(getLoadedJpHeightCatalog()).toMatchObject({ status: "unavailable" });
  });
  it("aborting a request does not write stale catalog state", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))));
    const { loadJpHeightCatalog, getLoadedJpHeightCatalog } = await import("../jpHeightCatalog");
    const controller = new AbortController(); const pending = loadJpHeightCatalog(controller.signal); controller.abort();
    await expect(pending).rejects.toThrow("aborted"); expect(getLoadedJpHeightCatalog()).toBeUndefined();
  });
  it("cancels an oversized streamed body before parsing", async () => {
    const cancel = vi.fn(); const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
    const stream = { getReader: () => ({ read: vi.fn().mockResolvedValueOnce({ done: false, value: bytes }), cancel }) };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), body: stream })));
    const { loadJpHeightCatalog } = await import("../jpHeightCatalog");
    await expect(loadJpHeightCatalog()).resolves.toMatchObject({ status: "unavailable" }); expect(cancel).toHaveBeenCalledOnce();
  });
});
