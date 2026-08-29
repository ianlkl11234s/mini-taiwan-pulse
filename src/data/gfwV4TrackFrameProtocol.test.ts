import { describe, expect, it } from "vitest";
import { GfwV4TrackLatestWinsQueue, decideGfwV4TrackFrame } from "./gfwV4TrackFrameProtocol";

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

describe("GFW v4 Tracks latest-wins queue", () => {
  const render = (generation: number, epoch: number) => ({ type: "render" as const, generation, epoch, trailingSeconds: 1_800, includeHits: false });
  const load = (generation: number, epoch: number) => ({ type: "load" as const, generation, epoch, trailingSeconds: 1_800, assets: [], tiles: [] });

  it("bounds work to one in-flight and one pending latest render", () => {
    const queue = new GfwV4TrackLatestWinsQueue();
    expect(queue.enqueue(render(1, 100))).toMatchObject({ epoch: 100 });
    expect(queue.enqueue(render(1, 110))).toBeNull();
    expect(queue.enqueue(render(1, 120))).toBeNull();
    expect({ inFlight: queue.inFlight, pending: queue.pending }).toEqual({ inFlight: 1, pending: 1 });
    expect(queue.complete()).toMatchObject({ epoch: 120 });
    expect(queue.complete()).toBeNull();
  });

  it("never lets a render replace the pending load required by its generation", () => {
    const queue = new GfwV4TrackLatestWinsQueue();
    queue.enqueue(render(4, 100));
    queue.enqueue(load(5, 200));
    queue.enqueue(render(5, 230));
    expect(queue.complete()).toMatchObject({ type: "load", generation: 5, epoch: 230 });
  });

  it("lets a newer generation load supersede obsolete pending work", () => {
    const queue = new GfwV4TrackLatestWinsQueue();
    queue.enqueue(render(4, 100));
    queue.enqueue(render(4, 110));
    queue.enqueue(load(5, 200));
    expect(queue.complete()).toMatchObject({ type: "load", generation: 5, epoch: 200 });
  });

  it("drops pending work when the frame lifecycle is cleared", () => {
    const queue = new GfwV4TrackLatestWinsQueue();
    queue.enqueue(render(4, 100));
    queue.enqueue(render(4, 110));
    queue.clearPending();
    expect(queue.complete()).toBeNull();
    expect({ inFlight: queue.inFlight, pending: queue.pending }).toEqual({ inFlight: 0, pending: 0 });
  });
});
