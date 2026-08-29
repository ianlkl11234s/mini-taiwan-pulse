import { describe, expect, it } from "vitest";
import { decideGfwV4TrackFrame } from "./gfwV4TrackFrameProtocol";

describe("GFW v4 Tracks readiness protocol", () => {
  it("applies a loaded frame that carries points", () => {
    expect(decideGfwV4TrackFrame({ generation: 7, loaded: true, pointCount: 11_402 }, 7)).toBe("apply");
  });

  it("keeps the stale frame while the requested generation is still loading", () => {
    // hour boundary: the Worker answers the interpolation tick before the new
    // hour's PMTiles are in. An empty frame here must never blank the layer.
    expect(decideGfwV4TrackFrame({ generation: 8, loaded: false, pointCount: 0 }, 8)).toBe("keep-stale");
  });

  it("clears when the generation is loaded and genuinely has no vessels", () => {
    expect(decideGfwV4TrackFrame({ generation: 8, loaded: true, pointCount: 0 }, 8)).toBe("clear");
  });

  it("distinguishes the two empty frames purely by loaded", () => {
    const empty = { generation: 3, pointCount: 0 };
    expect(decideGfwV4TrackFrame({ ...empty, loaded: false }, 3)).toBe("keep-stale");
    expect(decideGfwV4TrackFrame({ ...empty, loaded: true }, 3)).toBe("clear");
  });

  it("drops a late reply from a superseded generation, however complete", () => {
    expect(decideGfwV4TrackFrame({ generation: 4, loaded: true, pointCount: 9_000 }, 5)).toBe("keep-stale");
    expect(decideGfwV4TrackFrame({ generation: 4, loaded: true, pointCount: 0 }, 5)).toBe("keep-stale");
  });

  it("drops out-of-order arrival in both directions and only commits the current one", () => {
    // Replies for 5, 4, 6 arrive while generation 5 is current.
    const arrivals = [4, 5, 6, 4].map((generation) =>
      decideGfwV4TrackFrame({ generation, loaded: true, pointCount: 10 }, 5));
    expect(arrivals).toEqual(["keep-stale", "apply", "keep-stale", "keep-stale"]);
  });

  it("keeps stale on a malformed generation instead of blanking the layer", () => {
    expect(decideGfwV4TrackFrame({ generation: Number.NaN, loaded: true, pointCount: 12 }, 1)).toBe("keep-stale");
  });
});
