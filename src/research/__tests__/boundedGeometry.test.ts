import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { boundedLineBuffer, boundedMeasure, boundedSurfaceIntersection } from "../boundedGeometry";

const routes = JSON.parse(readFileSync("public/bus/chiayi_bus_routes.json", "utf8")) as Record<string, { coords: readonly (readonly [number, number])[] }>;
const square = (west: number, south: number, east: number, north: number) => ({ type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });

describe("boundedGeometry", () => {
  it("buffers real source lines but rejects their combined derived vertex count", () => {
    const left = boundedLineBuffer({ type: "LineString", coordinates: routes["CYI0128_樂活5路_0"]!.coords }, 200);
    const right = boundedLineBuffer({ type: "LineString", coordinates: routes["CYI0139_樂活9路A_0"]!.coords }, 200);
    expect(left).toMatchObject({ method: { engine: "Turf 7.2.0", bufferModel: "local_azimuthal_equidistant", radiusM: 200, steps: 16 }, summary: { outputVertices: 767 } });
    expect(right.summary.outputVertices).toBe(1324);
    expect(() => boundedSurfaceIntersection(left.geometry, right.geometry)).toThrow("SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED");
  });

  it("preserves repeated adjacent route vertices losslessly while reporting their count", () => {
    const result = boundedLineBuffer({ type: "LineString", coordinates: [[120.3, 23.4], [120.3, 23.4], [120.31, 23.41]] }, 20);
    expect(result.geometry).not.toBeNull();
    expect(result.summary).toMatchObject({ inputVertices: 3, duplicateAdjacentVertices: 1 });
  });

  it("accepts a self-crossing line but rejects invalid surface topology", () => {
    expect(boundedLineBuffer({ type: "LineString", coordinates: [[120.1, 23.1], [120.2, 23.2], [120.1, 23.2], [120.2, 23.1]] }, 10).geometry).not.toBeNull();
    expect(() => boundedSurfaceIntersection(
      { type: "Polygon", coordinates: [[[120, 23], [120.1, 23.1], [120, 23.1], [120.1, 23], [120, 23]]] },
      square(120, 23, 120.2, 23.2),
    )).toThrow("INVALID_SURFACE_GEOMETRY");
  });

  it("treats holes, multipart surfaces, and boundary touch as surface-only outcomes", () => {
    const donut = { type: "Polygon", coordinates: [
      [[120, 23], [120.4, 23], [120.4, 23.4], [120, 23.4], [120, 23]],
      [[120.1, 23.1], [120.3, 23.1], [120.3, 23.3], [120.1, 23.3], [120.1, 23.1]],
    ] };
    expect(boundedSurfaceIntersection(donut, square(120.15, 23.15, 120.25, 23.25))).toMatchObject({ geometry: null, summary: { area_only: true, empty: true, areaM2: 0 } });
    expect(boundedSurfaceIntersection(square(120, 23, 120.1, 23.1), square(120.1, 23, 120.2, 23.1))).toMatchObject({ geometry: null, summary: { area_only: true, empty: true, areaM2: 0 } });
    const multipart = { type: "MultiPolygon", coordinates: [square(120, 23, 120.05, 23.05).coordinates, square(120.2, 23, 120.25, 23.05).coordinates] };
    expect(boundedSurfaceIntersection(multipart, square(120.19, 22.99, 120.26, 23.06))).toMatchObject({ geometry: { type: "Polygon" }, method: { clippingModel: "planar EPSG:4326 coordinate clipping", measurementModel: "spherical_geodesic" }, summary: { area_only: true, empty: false, areaM2: expect.any(Number) } });
  });

  it("rejects oversized or out-of-envelope inputs before topology work", () => {
    const tooMany = Array.from({ length: 1601 }, (_, index) => [120 + index / 1_000_000, 23] as const);
    expect(() => boundedLineBuffer({ type: "LineString", coordinates: tooMany }, 10)).toThrow("SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED");
    expect(() => boundedMeasure({ type: "LineString", coordinates: [[119.4, 23], [119.41, 23.01]] })).toThrow("SPATIAL_GEOGRAPHY_OUT_OF_BOUNDS");
    expect(() => boundedMeasure({ type: "LineString", coordinates: [[120, 23], [120.6, 23.01]] })).toThrow("SPATIAL_GEOMETRY_SPAN_EXCEEDED");
  });

  it("returns a null geometry for measures and makes metric units explicit", () => {
    expect(boundedMeasure({ type: "LineString", coordinates: [[120, 23], [120.01, 23]] })).toMatchObject({ geometry: null, summary: { lengthM: expect.any(Number) }, method: { measurementModel: "spherical_geodesic" } });
    expect(boundedMeasure(square(120, 23, 120.01, 23.01))).toMatchObject({ geometry: null, summary: { areaM2: expect.any(Number) } });
  });

  it("keeps the bounded positive source pair selected from the first-30 scan", () => {
    const left = boundedLineBuffer({ type: "LineString", coordinates: routes["CYI0119_樂活3路_0"]!.coords }, 200);
    const right = boundedLineBuffer({ type: "LineString", coordinates: routes["CYI0714_中山快捷(綠B線)B_0"]!.coords }, 200);
    const intersection = boundedSurfaceIntersection(left.geometry, right.geometry);
    expect(left.summary.outputVertices).toBe(1046);
    expect(right.summary.outputVertices).toBe(552);
    expect(intersection).toMatchObject({ geometry: { type: "Polygon" }, summary: { area_only: true, empty: false, inputVertices: [1046, 552], outputVertices: 207 } });
    // Independent EPSG:3826/GEOS oracle: 845,938.627 m²; keep model difference below 1%.
    expect(Math.abs((intersection.summary.areaM2 as number) - 845_938.627) / 845_938.627).toBeLessThan(0.01);
    expect(Math.abs((intersection.summary.boundaryLengthM as number) - 5_051.475) / 5_051.475).toBeLessThan(0.01);
  });
});
