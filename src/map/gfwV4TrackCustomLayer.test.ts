import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { GfwV4TrackScene } from "../three/GfwV4TrackScene";
import { createGfwV4TrackCustomLayer, GFW_V4_TRACK_CUSTOM_LAYER_ID } from "./gfwV4TrackCustomLayer";

describe("gfw v4 shared-context custom layer", () => {
  it("initializes with Mapbox GL, renders the current frame, and disposes", () => {
    const scene = {
      init: vi.fn(), setOpacity: vi.fn(), setTheme: vi.fn(),
      update: vi.fn(() => ({ heads: [], trails: [], trailVertices: 0 })),
      render: vi.fn(), dispose: vi.fn(),
    } as unknown as GfwV4TrackScene;
    const repaint = vi.fn();
    const map = {
      getBounds: () => ({ getWest: () => 115, getSouth: () => 20, getEast: () => 135, getNorth: () => 37 }),
      getZoom: () => 5,
      triggerRepaint: repaint,
    } as unknown as MapboxMap;
    const frame = { heads: [], trails: [], visibleHeadGroups: 0, visibleMembers: 0, visibleTrailVertices: 0,
      renderedHeadGroups: 0, renderedTrailVertices: 0, overBudgetHeads: 0, overBudgetTrailVertices: 0 };
    const getFrame = vi.fn(() => frame);
    const getVisible = vi.fn(() => true);
    const layer = createGfwV4TrackCustomLayer({
      budget: { maxHeads: 25_000, maxTrailVertices: 400_000 }, getFrame,
      getVisible, getOpacity: () => 0.7, getTheme: () => "dark", sceneFactory: () => scene,
    });
    const gl = {} as WebGL2RenderingContext;
    layer.onAdd?.(map, gl);
    const render = layer.render as unknown as (context: WebGL2RenderingContext, matrix: number[]) => void;
    render(gl, new Array(16).fill(0));
    expect(layer.id).toBe(GFW_V4_TRACK_CUSTOM_LAYER_ID);
    expect(scene.init).toHaveBeenCalledWith(gl);
    expect(getVisible).toHaveBeenCalled();
    expect(getFrame).toHaveBeenCalled();
    expect(scene.update).toHaveBeenCalled();
    expect(scene.render).toHaveBeenCalled();
    // A static custom layer must not own a permanent repaint loop. Timeline
    // callbacks request repaint only when a frame actually changes.
    expect(repaint).not.toHaveBeenCalled();
    layer.onRemove?.(map, gl);
    expect(scene.dispose).toHaveBeenCalled();
  });
});
