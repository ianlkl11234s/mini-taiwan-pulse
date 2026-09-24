import { describe, expect, it } from "vitest";
import { lineIntersectsSurface, parseLineGeometry, parseLinePolygonSurface } from "../linePolygonAnalysis";

const surface = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
} as const;

describe("linePolygonAnalysis", () => {
  it("uses complete lines instead of endpoints or a center", () => {
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[-1, 5], [11, 5]] }, surface)).toBe(true);
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[-1, 5], [11, 5], [-1, 5]] }, surface)).toBe(true);
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[-2, -2], [-1, -1]] }, surface)).toBe(false);
  });

  it("preserves holes and reports boundary contact as intersection", () => {
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[4.5, 4.5], [5.5, 5.5]] }, surface)).toBe(false);
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[3, 5], [5, 5]] }, surface)).toBe(true);
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[0, 2], [0, 8]] }, surface)).toBe(true);
  });

  it("checks every MultiLineString and MultiPolygon part", () => {
    const multiSurface = { type: "MultiPolygon", coordinates: [surface.coordinates, [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]]] } as const;
    expect(lineIntersectsSurface({ type: "MultiLineString", coordinates: [[[12, 12], [13, 13]], [[19, 21], [23, 21]]] }, multiSurface)).toBe(true);
    expect(lineIntersectsSurface({ type: "MultiLineString", coordinates: [[[12, 12], [13, 13]], [[17, 17], [18, 18]]] }, multiSurface)).toBe(false);
  });

  it("fails closed for malformed lines and invalid surface topology", () => {
    expect(() => parseLineGeometry({ type: "LineString", coordinates: [[0, 0], [0, 0]] })).toThrow("INVALID_LINE_GEOMETRY");
    expect(() => parseLinePolygonSurface({ type: "Polygon", coordinates: [[[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]] })).toThrow("INVALID_SURFACE_GEOMETRY");
    expect(() => lineIntersectsSurface({ type: "LineString", coordinates: [[0, 0], [1, 1]] }, { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] })).toThrow("INVALID_SURFACE_GEOMETRY");
    expect(() => parseLineGeometry({ type: "LineString", coordinates: [[179, 0], [-179, 0]] })).toThrow("UNSUPPORTED_ANTIMERIDIAN_GEOMETRY");
    expect(() => parseLinePolygonSurface({ type: "Polygon", coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 1], [179, 0]]] })).toThrow("UNSUPPORTED_ANTIMERIDIAN_GEOMETRY");
    expect(() => parseLinePolygonSurface({ type: "Polygon", coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
      [[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]],
    ] })).toThrow("INVALID_SURFACE_GEOMETRY");
  });

  it("treats a zero-length ring edge as boundary-neutral without repairing the ring", () => {
    const repeatedVertexSurface = { type: "Polygon", coordinates: [[[0, 0], [3, 0], [3, 0], [3, 3], [0, 3], [0, 0]]] } as const;
    const repeatedClosureSurface = { type: "Polygon", coordinates: [[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0], [0, 0]]] } as const;
    expect(parseLinePolygonSurface(repeatedVertexSurface)).toBe(repeatedVertexSurface);
    expect(parseLinePolygonSurface(repeatedClosureSurface)).toBe(repeatedClosureSurface);
    expect(lineIntersectsSurface({ type: "LineString", coordinates: [[-1, 1], [4, 1]] }, repeatedVertexSurface)).toBe(true);
    expect(() => parseLinePolygonSurface({ type: "Polygon", coordinates: [[[0, 0], [2, 2], [2, 2], [0, 2], [2, 0], [0, 0]]] })).toThrow("INVALID_SURFACE_GEOMETRY");
    expect(() => parseLinePolygonSurface({ type: "Polygon", coordinates: [
      [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      [[1, 1], [0, 2], [1, 3], [2, 2], [1, 1]],
    ] })).toThrow("INVALID_SURFACE_GEOMETRY");
  });

  it("bounds segment-pair work instead of relying on a vertex total", () => {
    expect(() => lineIntersectsSurface(
      { type: "LineString", coordinates: [[-1, 1], [11, 1], [-1, 2]] },
      surface,
      { maxSegmentComparisons: 7, maxTopologyComparisons: 100 },
    )).toThrow("SPATIAL_SEGMENT_COMPARISON_BUDGET_EXCEEDED");
  });
});
