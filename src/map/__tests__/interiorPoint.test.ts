import { describe, expect, it } from "vitest";
import { geometryInteriorPoint, polygonFeaturesToInteriorPoints } from "../interiorPoint";

const inside = (pt: [number, number], ring: number[][]) => {
  let r = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!; const [xj, yj] = ring[j]!;
    if ((yi! > pt[1]) !== (yj! > pt[1]) && pt[0] < ((xj! - xi!) * (pt[1] - yi!)) / (yj! - yi!) + xi!) r = !r;
  }
  return r;
};

describe("面的代表點", () => {
  it("凸多邊形＝面心", () => {
    const p = geometryInteriorPoint({ type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]]] })!;
    expect(p[0]).toBeCloseTo(2); expect(p[1]).toBeCloseTo(1);
  });
  it("C 形：面心落在缺口外時，代表點仍在面內", () => {
    const ring = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10], [0, 0]];
    const p = geometryInteriorPoint({ type: "Polygon", coordinates: [ring] })!;
    expect(inside(p, ring)).toBe(true);
  });
  it("有洞：代表點不在洞裡", () => {
    const outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
    const p = geometryInteriorPoint({ type: "Polygon", coordinates: [outer, hole] })!;
    expect(inside(p, outer) && !inside(p, hole)).toBe(true);
  });
  it("MultiPolygon 取最大部件；點／線回 null；保留 properties", () => {
    const fc = polygonFeaturesToInteriorPoints({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { a: 1 }, geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]]] } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
      ],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry.coordinates[0]).toBeCloseTo(15);
    expect(fc.features[0]!.properties).toEqual({ a: 1 });
  });
});
