import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  const cleanups: Array<(() => void) | undefined> = [];
  return {
    useEffect(effect: () => void | (() => void)) { cleanups.push(effect() ?? undefined); },
    cleanup() {
      cleanups.splice(0).forEach((cleanup) => cleanup?.());
    },
  };
});
const mocked = vi.hoisted(() => ({ createLayer: vi.fn() }));

vi.mock("react", () => ({ useEffect: reactHarness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../map/realEstatePointsCustomLayer", () => ({
  RE_POINTS_LAYER_ID: "re-points-three",
  createRealEstatePointsLayer: mocked.createLayer,
}));

import { useRealEstatePointsLayer } from "../useRealEstatePointsLayer";

function mapWithFailedAdd() {
  const events = new Map<string, Set<() => void>>();
  let idleCallback: (() => void) | undefined;
  const map = {
    getLayer: vi.fn(() => undefined),
    addLayer: vi.fn(() => { throw new Error("style rebuilding"); }),
    removeLayer: vi.fn(),
    triggerRepaint: vi.fn(),
    on(event: string, handler: () => void) { (events.get(event) ?? events.set(event, new Set()).get(event)!).add(handler); },
    once(event: string, handler: () => void) {
      if (event === "idle") idleCallback = handler;
      (events.get(event) ?? events.set(event, new Set()).get(event)!).add(handler);
    },
    off(event: string, handler: () => void) { events.get(event)?.delete(handler); },
  };
  return {
    map: map as unknown as MapboxMap,
    count: (event: string) => events.get(event)?.size ?? 0,
    runCapturedIdle: () => idleCallback?.(),
  };
}

afterEach(() => { reactHarness.cleanup(); vi.restoreAllMocks(); });

describe("useRealEstatePointsLayer retry lifecycle", () => {
  it("卸載時解除尚未執行的 idle retry", () => {
    const state = mapWithFailedAdd();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useRealEstatePointsLayer(mapRef, {
      showRental: true, showSale: false, showPresale: false, excludeTaipei: false, baseOpacity: 0.85,
    });

    expect(state.count("idle")).toBe(1);
    reactHarness.cleanup();
    expect(state.count("idle")).toBe(0);
    expect(state.count("style.load")).toBe(0);
    state.runCapturedIdle();
    expect(state.map.addLayer).toHaveBeenCalledOnce();
  });
});
