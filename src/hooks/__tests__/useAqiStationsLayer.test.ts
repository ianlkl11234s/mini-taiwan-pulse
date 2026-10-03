import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  type Slot = { deps?: readonly unknown[]; cleanup?: void | (() => void) };
  const refs: { current: unknown }[] = [];
  const effects: Slot[] = [];
  let r = 0, e = 0;
  return {
    begin() { r = 0; e = 0; },
    useRef<T>(initial: T) { return (refs[r++] ??= { current: initial }) as { current: T }; },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const i = e++;
      const prev = effects[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && prev.deps.every((v, k) => Object.is(v, deps[k]))) return;
      prev?.cleanup?.();
      effects[i] = { deps, cleanup: effect() };
    },
    cleanup() { for (const s of effects) s.cleanup?.(); refs.length = 0; effects.length = 0; },
  };
});

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), start: vi.fn(), end: vi.fn() }));
vi.mock("react", () => ({ useRef: reactHarness.useRef, useEffect: reactHarness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/aqiStationsLoader", () => ({ fetchAqiStationsAt: mocks.fetch, buildStationsGeoJSON: () => ({ type: "FeatureCollection", features: [] }) }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn(), loadingRegistry: { start: mocks.start, end: mocks.end } }));
vi.mock("../../research/layerDataSummary", () => ({ registerLayerDataProvider: () => () => {}, summarizeAqiStations: vi.fn() }));
vi.mock("../../state/timeStore", () => ({ timeStore: { getTime: () => 1_790_000_000, subscribeThrottled: () => () => {} } }));

import { useAqiStationsLayer } from "../useAqiStationsLayer";

function createMap() {
  const source = { setData: vi.fn() };
  const sources = new Map<string, unknown>();
  const layers = new Set<string>();
  const map = {
    // Heavy layers keep isStyleLoaded() false forever; getStyle() works once the style is parsed.
    isStyleLoaded: () => false,
    getStyle: () => ({ layers: [] }),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, source),
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    addLayer: (l: { id: string }) => layers.add(l.id),
    on: vi.fn(), once: vi.fn(), off: vi.fn(),
  } as unknown as MapboxMap;
  return map;
}

describe("useAqiStationsLayer style readiness", () => {
  beforeEach(() => { vi.useFakeTimers(); mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue([]); mocks.start.mockClear(); mocks.end.mockClear(); });
  afterEach(() => { reactHarness.cleanup(); vi.useRealTimers(); });

  it("loads when isStyleReady is true even though isStyleLoaded stays false, and registers loading", async () => {
    const map = createMap();
    const ref = { current: map } as RefObject<MapboxMap | null>;
    reactHarness.begin();
    useAqiStationsLayer(ref, true, false);
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledWith("aqi-stations-fetch", expect.any(String));
    expect(mocks.end).toHaveBeenCalledWith("aqi-stations-fetch");
  });

  it("registers a wait task while the style is not parsed, and clears it on cleanup", async () => {
    const map = createMap();
    (map as unknown as { getStyle: () => never }).getStyle = () => { throw new Error("Style is not done loading"); };
    const ref = { current: map } as RefObject<MapboxMap | null>;
    reactHarness.begin();
    useAqiStationsLayer(ref, true, false);
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledWith("aqi-stations-wait", expect.any(String));
    reactHarness.cleanup();
    expect(mocks.end).toHaveBeenCalledWith("aqi-stations-wait");
  });
});
