import { describe, expect, it } from "vitest";
import {
  bboxDimensionsKm,
  bboxFromCorners,
  bboxToFeature,
  formatBbox,
} from "./bboxSelection";

describe("bbox selection", () => {
  it("normalizes corners regardless of drag direction", () => {
    const forward = bboxFromCorners({ lng: 124, lat: 24 }, { lng: 129, lat: 27.5 });
    const reverse = bboxFromCorners({ lng: 129, lat: 27.5 }, { lng: 124, lat: 24 });

    expect(forward).toEqual({ west: 124, south: 24, east: 129, north: 27.5 });
    expect(reverse).toEqual(forward);
  });

  it("rejects zero-area and invalid selections", () => {
    expect(bboxFromCorners({ lng: 124, lat: 24 }, { lng: 124, lat: 27 })).toBeNull();
    expect(bboxFromCorners({ lng: Number.NaN, lat: 24 }, { lng: 129, lat: 27 })).toBeNull();
  });

  it("formats canonical west, south, east, north order", () => {
    expect(formatBbox({ west: 124.123456, south: 24, east: 129.9, north: 27.5 }))
      .toBe("124.12346, 24.00000, 129.90000, 27.50000");
  });

  it("creates a closed polygon ring", () => {
    const feature = bboxToFeature({ west: 124, south: 24, east: 129, north: 27.5 });
    const ring = feature.geometry.coordinates[0]!;

    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("calculates useful positive dimensions", () => {
    const dimensions = bboxDimensionsKm({ west: 127.5, south: 25.9, east: 128.1, north: 26.3 });
    expect(dimensions.width).toBeGreaterThan(50);
    expect(dimensions.height).toBeGreaterThan(40);
  });
});
