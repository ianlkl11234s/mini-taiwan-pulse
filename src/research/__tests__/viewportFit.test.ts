import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { offsetCameraToSafeRect, resolveViewportCameraFromContext, viewportContextFromRects, type ResearchFraming } from "../viewportFit";

const framing: ResearchFraming = { bounds: [118, 21.5, 123, 26.5], padding: 24, maxZoom: 9 };

function mapStub() {
  const cameraForBounds = vi.fn((_bounds, options) => ({ center: { lng: 120.5, lat: 23.5 }, zoom: 7.25, options }));
  return { map: { cameraForBounds } as unknown as MapboxMap, cameraForBounds };
}

describe("research viewport fit", () => {
  it("uses the live wide container and shifts the bounds fit away from left, right, and bottom UI", () => {
    const state = mapStub();
    const context = viewportContextFromRects(1200, 800, [
      // CUA measurement: the flyout content starts at x=64; its parent rail occupies x=0..352.
      { left: 0, top: 203, right: 352, bottom: 596 },
      { left: 782, top: 88, right: 1200, bottom: 400 },
      { left: 72, top: 610, right: 452, bottom: 800 },
    ]);
    expect(context.safe).toEqual({ left: 368, top: 16, right: 766, bottom: 594 });
    const resolved = resolveViewportCameraFromContext(state.map, context, framing);
    expect(resolved).toMatchObject({ zoom: 7.25, bearing: 0, pitch: 0, padding: 0 });
    // Safe center (567, 305) is above-left of viewport center (600, 400): compensate east/south.
    expect(resolved.center[0]).toBeGreaterThan(120.5);
    expect(resolved.center[1]).toBeLessThan(23.5);
    expect(state.cameraForBounds).toHaveBeenCalledWith([[118, 21.5], [123, 26.5]], {
      padding: { left: 392, top: 40, right: 458, bottom: 230 }, maxZoom: 9, bearing: 0, pitch: 0,
    });
  });

  it("keeps nonzero safe edges in a narrow live viewport instead of assuming a 1024px canvas", () => {
    const context = viewportContextFromRects(390, 844, [
      { left: 120, top: 92, right: 390, bottom: 324 },
      { left: 10, top: 686, right: 390, bottom: 844 },
    ]);
    expect(context.viewport).toEqual({ left: 0, top: 0, right: 390, bottom: 844 });
    expect(context.safe).toEqual({ left: 16, top: 16, right: 104, bottom: 670 });
    expect(context.safe.left).toBeGreaterThan(0);
    expect(context.safe.top).toBeGreaterThan(0);
    const shifted = offsetCameraToSafeRect({ center: [120.5, 23.5], zoom: 7.25 }, context);
    // Safe center is above-left here as well; it must not remain the geometric midpoint.
    expect(shifted[0]).toBeGreaterThan(120.5);
    expect(shifted[1]).toBeLessThan(23.5);
  });

  it("fails closed while opposing panels leave no usable map content", () => {
    const context = viewportContextFromRects(390, 844, [
      { left: 0, top: 0, right: 220, bottom: 844 },
      { left: 250, top: 0, right: 390, bottom: 844 },
    ]);
    expect(context.fitAvailable).toBe(false);
    expect(context.fitError).toBe("VIEWPORT_OCCLUDED");
    expect(context.viewport.right).toBe(390);
    expect(() => resolveViewportCameraFromContext(mapStub().map, context, framing)).toThrow("VIEWPORT_OCCLUDED");
  });
});

it("uses space below corner panels when edge strips overlap", () => {
  const context = viewportContextFromRects(800, 800, [
    { left: 0, top: 100, right: 420, bottom: 350 },
    { left: 400, top: 100, right: 800, bottom: 350 },
  ]);
  expect(context.fitAvailable).toBe(true);
  expect(context.safe.top).toBeGreaterThanOrEqual(366);
  expect(context.safe.right - context.safe.left).toBeGreaterThan(700);
});
