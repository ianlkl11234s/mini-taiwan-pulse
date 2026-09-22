import { describe, expect, it } from "vitest";
import {
  countGeometryVertices,
  geometriesIntersect,
  geometryContains,
  geometryWithin,
  locatePointInSurface,
  parseSpatialGeometry,
  type MultiPolygonGeometry,
  type PointGeometry,
  type PolygonGeometry,
} from "../spatialKernel";

const point = (lng: number, lat: number): PointGeometry => ({ type: "Point", coordinates: [lng, lat] });
const polygon: PolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};

describe("spatialKernel", () => {
  it("preserves polygon holes and boundary semantics", () => {
    expect(locatePointInSurface(point(2, 2), polygon)).toBe("inside");
    expect(locatePointInSurface(point(5, 5), polygon)).toBe("outside");
    expect(locatePointInSurface(point(4, 5), polygon)).toBe("boundary");
    expect(locatePointInSurface(point(0, 5), polygon)).toBe("boundary");
    expect(geometryWithin(point(2, 2), polygon)).toBe(true);
    expect(geometryWithin(point(0, 5), polygon)).toBe(false);
    expect(geometryContains(polygon, point(2, 2))).toBe(true);
    expect(geometriesIntersect(point(0, 5), polygon)).toBe(true);
  });

  it("checks every MultiPolygon part without filling gaps", () => {
    const multi: MultiPolygonGeometry = { type: "MultiPolygon", coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      [[[8, 8], [10, 8], [10, 10], [8, 10], [8, 8]]],
    ] };
    expect(locatePointInSurface(point(1, 1), multi)).toBe("inside");
    expect(locatePointInSurface(point(5, 5), multi)).toBe("outside");
    expect(locatePointInSurface(point(9, 9), multi)).toBe("inside");
    expect(countGeometryVertices(multi)).toBe(10);
  });

  it("detects surface intersection and containment around holes", () => {
    const inShell: PolygonGeometry = { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] };
    const inHole: PolygonGeometry = { type: "Polygon", coordinates: [[[4.5, 4.5], [5.5, 4.5], [5.5, 5.5], [4.5, 5.5], [4.5, 4.5]]] };
    const crossing: PolygonGeometry = { type: "Polygon", coordinates: [[[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]] };
    expect(geometriesIntersect(polygon, inShell)).toBe(true);
    expect(geometriesIntersect(polygon, inHole)).toBe(false);
    expect(geometriesIntersect(polygon, crossing)).toBe(true);
  });

  it("fails closed for open rings, unsupported geometry and vertex overflow", () => {
    expect(() => parseSpatialGeometry({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 1], [1, 1]]] })).toThrow("UNSUPPORTED_OR_INVALID_SPATIAL_GEOMETRY");
    expect(() => parseSpatialGeometry({ type: "LineString", coordinates: [[0, 0], [1, 1]] })).toThrow("UNSUPPORTED_OR_INVALID_SPATIAL_GEOMETRY");
    expect(() => parseSpatialGeometry(polygon, { maxVertices: 5 })).toThrow("SPATIAL_VERTEX_BUDGET_EXCEEDED");
    expect(() => geometryWithin(polygon, polygon)).toThrow("SPATIAL_PREDICATE_GEOMETRY_PAIR_UNSUPPORTED");
  });
});
