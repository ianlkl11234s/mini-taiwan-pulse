import { describe, expect, it } from "vitest";
import type { TrackFrame } from "../gfw-v4-bench/types";
import { cullGfwV4Frame, GfwV4TrackScene } from "./GfwV4TrackScene";

describe("GfwV4TrackScene viewport culling", () => {
  it("keeps complete same-coordinate members and only visible geometry", () => {
    const frame: TrackFrame = {
      heads: [
        { lon: 121, lat: 24, buckets: ["cargo"], members: [
          { vesselId: "a", mmsi: "1", shipName: null, vesselType: "CARGO", flag: null },
          { vesselId: "b", mmsi: "2", shipName: null, vesselType: "CARGO", flag: null },
        ] },
        { lon: 140, lat: 40, buckets: ["other"], members: [] },
      ],
      trails: [
        { trackId: "visible", bucket: "cargo", coordinates: [[120, 24], [121, 24]] },
        { trackId: "outside", bucket: "other", coordinates: [[140, 40], [141, 40]] },
      ],
      visibleHeadGroups: 2, visibleMembers: 2, visibleTrailVertices: 4,
      renderedHeadGroups: 2, renderedTrailVertices: 4, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    const visible = cullGfwV4Frame(frame, { west: 119, south: 22, east: 123, north: 26 });
    expect(visible.heads).toHaveLength(1);
    expect(visible.heads[0]?.members.map((member) => member.vesselId)).toEqual(["a", "b"]);
    expect(visible.trails.map((trail) => trail.trackId)).toEqual(["visible"]);
  });

  it("does not hide geometry through viewport culling before reporting it", () => {
    const frame: TrackFrame = {
      heads: [], trails: [{ trackId: "edge", bucket: "cargo", coordinates: [[120, 24], [121, 24], [122, 24]] }],
      visibleHeadGroups: 0, visibleMembers: 0, visibleTrailVertices: 3,
      renderedHeadGroups: 0, renderedTrailVertices: 3, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    expect(cullGfwV4Frame(frame, { west: 119, south: 22, east: 123, north: 26 }).trailVertices).toBe(3);
  });

  it("throws a diagnostic error before writing beyond the explicit GPU budget", () => {
    const frame: TrackFrame = {
      heads: [
        { lon: 121, lat: 24, buckets: ["cargo"], members: [] },
        { lon: 121.1, lat: 24.1, buckets: ["cargo"], members: [] },
      ],
      trails: [], visibleHeadGroups: 2, visibleMembers: 0, visibleTrailVertices: 0,
      renderedHeadGroups: 2, renderedTrailVertices: 0, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    const scene = new GfwV4TrackScene({ maxHeads: 1, maxTrailVertices: 10 });
    expect(() => scene.update(frame, { west: 119, south: 22, east: 123, north: 26 }, 5)).toThrow(/GPU budget exceeded/);
    scene.dispose();
  });
});
