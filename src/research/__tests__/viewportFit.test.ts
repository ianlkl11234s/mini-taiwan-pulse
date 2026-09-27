import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { framingFitsViewportFromContext, offsetCameraToSafeRect, refineViewportCameraFromContext, resolveViewportCameraFromContext, viewportContextFromRects, type ResearchFraming } from "../viewportFit";

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
    // A readable edge-strip inset (between the left rail and the top-right activity card, above
    // the bottom timeline) is preferred over the corner-maximizing search: users expect a result
    // framed in the open middle, not shoved into whichever corner measures a larger raw area.
    expect(context.safe).toEqual({ left: 368, top: 16, right: 766, bottom: 594 });
    const resolved = resolveViewportCameraFromContext(state.map, context, framing);
    expect(resolved).toMatchObject({ zoom: 7.25, bearing: 0, pitch: 0, padding: 0 });
    // The safe strip's centroid sits left/above the full-viewport centre: compensate east/south.
    expect(resolved.center[0]).toBeGreaterThan(120.5);
    expect(resolved.center[1]).toBeLessThan(23.5);
    expect(state.cameraForBounds).toHaveBeenCalledWith([[118, 21.5], [123, 26.5]], {
      padding: { left: 392, top: 40, right: 458, bottom: 230 }, maxZoom: 9, bearing: 0, pitch: 0,
    });
  });

  it("reserves nothing beyond the baseline margin when no panel is open (closed panels never appear in overlays)", () => {
    const context = viewportContextFromRects(1200, 800, []);
    expect(context.safe).toEqual({ left: 16, top: 16, right: 1184, bottom: 784 });
  });

  it("reserves exactly the live-measured panel width, not a fixed guess, and drops it once that panel closes", () => {
    const openLeft = viewportContextFromRects(1200, 800, [{ left: 0, top: 0, right: 300, bottom: 800 }]);
    expect(openLeft.safe.left).toBe(316); // 300 + OVERLAY_GAP_PX
    const widerLeft = viewportContextFromRects(1200, 800, [{ left: 0, top: 0, right: 420, bottom: 800 }]);
    expect(widerLeft.safe.left).toBe(436);
    const closedLeft = viewportContextFromRects(1200, 800, []);
    expect(closedLeft.safe.left).toBe(16);
  });

  it("clamps a generous Agent-supplied maxZoom to a browser-side neighborhood-scale ceiling", () => {
    const state = mapStub();
    const context = viewportContextFromRects(1200, 800, []);
    resolveViewportCameraFromContext(state.map, context, { ...framing, maxZoom: 22 });
    expect(state.cameraForBounds).toHaveBeenCalledWith([[118, 21.5], [123, 26.5]], expect.objectContaining({ maxZoom: 16 }));
    resolveViewportCameraFromContext(state.map, context, { ...framing, maxZoom: 10 });
    expect(state.cameraForBounds).toHaveBeenLastCalledWith([[118, 21.5], [123, 26.5]], expect.objectContaining({ maxZoom: 10 }));
  });

  it("keeps nonzero safe edges in a narrow live viewport instead of assuming a 1024px canvas", () => {
    const context = viewportContextFromRects(390, 844, [
      { left: 120, top: 92, right: 390, bottom: 324 },
      { left: 10, top: 686, right: 390, bottom: 844 },
    ]);
    expect(context.viewport).toEqual({ left: 0, top: 0, right: 390, bottom: 844 });
    expect(context.safe).toEqual({ left: 16, top: 340, right: 374, bottom: 670 });
    expect(context.safe.left).toBeGreaterThan(0);
    expect(context.safe.top).toBeGreaterThan(0);
    const shifted = offsetCameraToSafeRect({ center: [120.5, 23.5], zoom: 7.25 }, context);
    // Use the full-width space below the corner panel, not the 88px side strip.
    expect(shifted[0]).toBeCloseTo(120.5);
    expect(shifted[1]).toBeGreaterThan(23.5);
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

  it("reads fit_bounds back from projected corners inside the padded safe viewport", () => {
    const context = viewportContextFromRects(1000, 800, [{ left: 0, top: 0, right: 300, bottom: 800 }]);
    const fit: ResearchFraming = { bounds: [121.54, 25.02, 121.6, 25.06], padding: 60, maxZoom: 14 };
    const project = vi.fn(([lng, lat]: [number, number]) => ({ x: 376 + (lng - 121.54) / 0.06 * 548, y: 76 + (25.06 - lat) / 0.04 * 648 }));
    expect(framingFitsViewportFromContext({ project } as unknown as MapboxMap, context, fit)).toBe(true);
    project.mockImplementation(([lng, lat]: [number, number]) => ({ x: 360 + (lng - 121.54) / 0.06 * 548, y: 76 + (25.06 - lat) / 0.04 * 648 }));
    expect(framingFitsViewportFromContext({ project } as unknown as MapboxMap, context, fit)).toBe(false);
  });

  it("clamps framing padding consistently for a 117px narrow safe viewport", () => {
    const context = {
      viewport: { left: 0, top: 0, right: 800, bottom: 1000 }, overlays: [], fitAvailable: true,
      safe: { left: 367.9965, top: 16, right: 485.4649, bottom: 971.3047 },
    } as const;
    const fit: ResearchFraming = { bounds: [121.517065, 25.028962, 121.551561, 25.063451], padding: 60, maxZoom: 13 };
    const state = mapStub();
    resolveViewportCameraFromContext(state.map, context, fit);
    const padding = state.cameraForBounds.mock.calls[0]![1].padding;
    // (117.4684 - 80) / 2 leaves the shared 80px minimum content width.
    expect(padding.left).toBeCloseTo(386.7307, 4);
    expect(padding.right).toBeCloseTo(333.2693, 4);
    const project = vi.fn(([lng, lat]: [number, number]) => ({
      x: lng < 121.54 ? 390 : 460,
      y: lat < 25.04 ? 900 : 60,
    }));
    expect(framingFitsViewportFromContext({ project } as unknown as MapboxMap, context, fit)).toBe(true);
  });

  it("refines a live projected fit that is offset beyond the padded safe edge", () => {
    const context = viewportContextFromRects(1000, 800, []);
    const fit: ResearchFraming = { bounds: [120, 23, 121, 24], padding: 24, maxZoom: 12 };
    const project = vi.fn(([lng, lat]: [number, number]) => ({ x: lng === 120 ? 451 : 980, y: lat === 23 ? 700 : 100 }));
    const unproject = vi.fn(([x, y]: [number, number]) => ({ lng: x / 10, lat: y / 10 }));
    const refined = refineViewportCameraFromContext({ project, unproject, getZoom: () => 8 } as unknown as MapboxMap, context, fit);
    expect(refined).toMatchObject({ center: [71.55, 40], zoom: 8, bearing: 0, pitch: 0, padding: 0 });
    expect(unproject).toHaveBeenCalledTimes(1);
  });

  it("zooms out from live measured bounds when centering alone cannot fit them", () => {
    const context = viewportContextFromRects(1000, 800, []);
    const fit: ResearchFraming = { bounds: [120, 23, 121, 24], padding: 20, maxZoom: 12 };
    const project = vi.fn(([lng, lat]: [number, number]) => ({ x: lng === 120 ? 0 : 1200, y: lat === 23 ? 800 : 0 }));
    const refined = refineViewportCameraFromContext({ project, unproject: ([x, y]: [number, number]) => ({ lng: x / 10, lat: y / 10 }), getZoom: () => 9 } as unknown as MapboxMap, context, fit);
    expect(refined?.zoom).toBeLessThan(9);
    expect(refined?.zoom).toBeCloseTo(9 + Math.log2(924 / 1200), 6);
  });

  it("does not move an already fitted live framing", () => {
    const context = viewportContextFromRects(1000, 800, []);
    const fit: ResearchFraming = { bounds: [120, 23, 121, 24], padding: 24, maxZoom: 12 };
    const project = vi.fn(([lng, lat]: [number, number]) => ({ x: lng === 120 ? 100 : 900, y: lat === 23 ? 700 : 100 }));
    const unproject = vi.fn();
    expect(refineViewportCameraFromContext({ project, unproject, getZoom: () => 8 } as unknown as MapboxMap, context, fit)).toBeNull();
    expect(unproject).not.toHaveBeenCalled();
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
