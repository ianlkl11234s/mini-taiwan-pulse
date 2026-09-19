import { afterEach, describe, expect, it, vi } from "vitest";

const createArchive = vi.hoisted(() => vi.fn());
const getCatalog = vi.hoisted(() => vi.fn());
vi.mock("pmtiles", () => ({ PMTiles: createArchive }));
vi.mock("../jpHeightCatalog", () => ({ getLoadedJpHeightCatalog: getCatalog }));
import { sampleJpCanopyHeight } from "../rasterProbeSampler";

const sha = "a".repeat(64);
const asset = (url: string, bbox: [number, number, number, number], minzoom: number) => ({
  url, bbox, minzoom, maxzoom: 12, bytes: 1, sha256: sha, coverage: "partial" as const, pixelSizeProjectedM: 20,
});

afterEach(() => { createArchive.mockClear(); getCatalog.mockReset(); vi.unstubAllGlobals(); });

describe("Japan canopy coverage", () => {
  it("does not instantiate or request an archive outside real coverage", async () => {
    for (const [lng, lat] of [[135.5, 34.7], [141.35, 43.06], [NaN, 35.7], [139.7, Infinity]]) {
      expect(await sampleJpCanopyHeight(lng!, lat!)).toBeNull();
    }
    expect(createArchive).not.toHaveBeenCalled();
  });

  it("prefers detail at the point, then uses overview only where detail is absent", async () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    getCatalog.mockReturnValue({ status: "ready", catalog: {
      regions: [{ id: "detail", label: "Detail", status: "ready", bbox: [139, 35, 140, 36], canopy: asset("./jp-heights/detail.pmtiles", [139, 35, 140, 36], 9) }],
      canopyOverview: asset("./jp-heights/overview.pmtiles", [130, 30, 145, 45], 4),
    } });
    await sampleJpCanopyHeight(139.5, 35.5, 10, new Set(["jp-canopy-height--detail"]));
    expect(createArchive).toHaveBeenLastCalledWith(expect.stringContaining("detail.pmtiles"));
    await sampleJpCanopyHeight(135, 34, 10, new Set(["jp-canopy-height--overview"]));
    expect(createArchive).toHaveBeenLastCalledWith(expect.stringContaining("overview.pmtiles"));
  });
  it("does not sample an overview that the current view left unmounted", async () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    getCatalog.mockReturnValue({ status: "ready", catalog: {
      regions: [{ id: "detail", label: "Detail", status: "ready", bbox: [139, 35, 140, 36], canopy: asset("./jp-heights/detail.pmtiles", [139, 35, 140, 36], 9) }],
      canopyOverview: asset("./jp-heights/overview.pmtiles", [130, 30, 145, 45], 4),
    } });
    expect(await sampleJpCanopyHeight(135, 34, 10, new Set(["jp-canopy-height--detail"]))).toBeNull();
    expect(createArchive).not.toHaveBeenCalled();
  });
});
