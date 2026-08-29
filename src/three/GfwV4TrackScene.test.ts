import { describe, expect, it } from "vitest";
import * as THREE from "three";
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

  it("scales an aggregated spatial marker from its complete member count", () => {
    const frame = { points: new Float32Array([121, 24]), buckets: new Uint8Array([1]), memberCounts: new Uint16Array([9]) };
    const scene = new GfwV4TrackScene({ maxHeads: 2, maxTrailVertices: 2 });
    scene.updateSpatialPoints(frame, 5);
    const heads = (scene as unknown as { heads: { getMatrixAt(index: number, target: { elements: number[] }): void } }).heads;
    const matrix = new THREE.Matrix4();
    heads.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeGreaterThan(2.8 / (512 * 2 ** 5));
    scene.dispose();
  });

  it("restores Mapbox shared GL blend state after rendering", () => {
    const calls: string[] = [];
    const gl = {
      BLEND: 1, BLEND_SRC_RGB: 2, BLEND_DST_RGB: 3, BLEND_SRC_ALPHA: 4, BLEND_DST_ALPHA: 5,
      BLEND_EQUATION_RGB: 6, BLEND_EQUATION_ALPHA: 7, BLEND_COLOR: 8,
      isEnabled: () => true, getParameter: (value: number) => value === 8 ? new Float32Array([0.1, 0.2, 0.3, 0.4]) : value + 10,
      enable: () => calls.push("enable"), disable: () => calls.push("disable"),
      blendFuncSeparate: (a: number, b: number, c: number, d: number) => calls.push(`${a}/${b}/${c}/${d}`),
      blendEquationSeparate: (rgb: number, alpha: number) => calls.push(`eq:${rgb}/${alpha}`),
      blendColor: (r: number, g: number, b: number, a: number) => calls.push(`color:${r.toFixed(1)}/${g.toFixed(1)}/${b.toFixed(1)}/${a.toFixed(1)}`),
    };
    const scene = new GfwV4TrackScene({ maxHeads: 1, maxTrailVertices: 1 });
    (scene as unknown as { renderer: unknown }).renderer = { getContext: () => gl, resetState: () => {}, render: () => {}, dispose: () => {} };
    scene.render(new Array<number>(16).fill(0));
    expect(calls).toEqual(["enable", "12/13/14/15", "eq:16/17", "color:0.1/0.2/0.3/0.4"]);
    scene.dispose();
  });
});
