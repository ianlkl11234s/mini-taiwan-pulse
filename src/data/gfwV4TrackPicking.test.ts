import { describe, expect, it } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { beginGfwV4TrackPick, nearestGfwV4TrackPoint, registerGfwV4TrackPicker } from "./gfwV4TrackPicking";

const projectMap = {
  project: ([lon, lat]: [number, number]) => ({ x: lon * 10, y: lat * 10 }),
} as unknown as Pick<MapboxMap, "project">;

describe("GFW v4 current-frame picking", () => {
  it("returns the nearest applied point inside the screen-pixel radius", () => {
    const points = new Float32Array([1, 1, 2, 2, 5, 5]);
    expect(nearestGfwV4TrackPoint(projectMap, points, { x: 19, y: 21 }, 5)).toEqual({ pointIndex: 1, coords: [2, 2] });
    expect(nearestGfwV4TrackPoint(projectMap, points, { x: 30, y: 30 }, 5)).toBeNull();
  });

  it("does not pick a lifecycle marker that is still effectively invisible", () => {
    const points = new Float32Array([1, 1, 2, 2]);
    const alphas = new Uint8Array([0, 255]);
    expect(nearestGfwV4TrackPoint(projectMap, points, { x: 10, y: 10 }, 5, alphas)).toBeNull();
    expect(nearestGfwV4TrackPoint(projectMap, points, { x: 20, y: 20 }, 5, alphas)).toEqual({ pointIndex: 1, coords: [2, 2] });
  });

  it("uses the mounted formal picker and clears it only by its own disposer", () => {
    const first = registerGfwV4TrackPicker(() => null);
    const expected = {
      generation: 2, frameEpoch: 123, pointIndex: 0, coords: [1, 1] as [number, number],
      result: Promise.resolve(null),
    };
    const second = registerGfwV4TrackPicker(() => expected);
    first();
    expect(beginGfwV4TrackPick(projectMap as MapboxMap, { x: 1, y: 1 })).toBe(expected);
    second();
    expect(beginGfwV4TrackPick(projectMap as MapboxMap, { x: 1, y: 1 })).toBeNull();
  });
});
