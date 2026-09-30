import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  let cursor = 0;
  const slots: unknown[] = [];
  return {
    begin: () => { cursor = 0; },
    reset: () => { slots.length = 0; cursor = 0; },
    useState: <T,>(initial: T | (() => T)) => {
      const index = cursor++;
      slots[index] ??= typeof initial === "function" ? (initial as () => T)() : initial;
      return [slots[index] as T, (next: T | ((previous: T) => T)) => {
        slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next;
      }] as const;
    },
    useRef: <T,>(value: T) => {
      const index = cursor++;
      slots[index] ??= { current: value };
      return slots[index] as { current: T };
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const index = cursor++;
      const previous = slots[index] as { deps?: readonly unknown[] } | undefined;
      if (deps && previous?.deps?.length === deps.length && previous.deps.every((value, i) => Object.is(value, deps[i]))) return;
      slots[index] = { deps };
      effect();
    },
  };
});

const loader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("react", () => harness);
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../map/pmtilesSourceType", () => ({ registerPmtilesSourceTypeOnce: vi.fn() }));
vi.mock("../../data/propertyValueAdminLoader", () => ({ loadPropertyValueAdmin: loader.load }));

import { usePropertyValueAdminLayer } from "../usePropertyValueAdminLayer";

const data = {
  meta: {},
  county: [{ name: "臺北市", code: "63000", n_buildings: 1, n_buildings_non_market: 0, gfa_m2: 1, value_market_corrected: 1, value_all: 1, value_non_market_excluded: 0, gfa_factor_used: 1 }],
  township: [],
} as never;

function createMap() {
  const sources = new Set<string>();
  const layers = new Set<string>();
  const sourceDataHandlers: Array<() => void> = [];
  let loaded = false;
  const map = {
    getStyle: () => ({ layers: [] }),
    getSource: (id: string) => sources.has(id) ? {} : undefined,
    addSource: vi.fn((id: string) => sources.add(id)),
    getLayer: (id: string) => layers.has(id) ? { id } : undefined,
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    setLayoutProperty: vi.fn(), setPaintProperty: vi.fn(), setFeatureState: vi.fn(),
    isSourceLoaded: () => loaded,
    on: vi.fn((event: string, callback: () => void) => { if (event === "sourcedata") sourceDataHandlers.push(callback); }),
    off: vi.fn(),
  } as unknown as MapboxMap;
  return { map, ready: () => { loaded = true; sourceDataHandlers.forEach((callback) => callback()); } };
}

describe("usePropertyValueAdminLayer", () => {
  it("does not resend applied feature-state for opacity/theme paint, while source readiness still flushes", async () => {
    harness.reset();
    loader.load.mockResolvedValue(data);
    const view = createMap();
    const ref = { current: view.map } as RefObject<MapboxMap | null>;
    harness.begin(); usePropertyValueAdminLayer(ref, true, 0, 0.7, true);
    await Promise.resolve();
    harness.begin(); usePropertyValueAdminLayer(ref, true, 0, 0.7, true);
    const stateCalls = view.map.setFeatureState as ReturnType<typeof vi.fn>;
    view.ready();
    expect(stateCalls).toHaveBeenCalledWith(
      { source: "property-value-admin-county", sourceLayer: "county_boundary", id: "63000" },
      expect.objectContaining({ value_market_corrected: 1 }),
    );
    const appliedCount = stateCalls.mock.calls.length;
    const addSourceCalls = (view.map.addSource as ReturnType<typeof vi.fn>).mock.calls.length;
    (view.map.setPaintProperty as ReturnType<typeof vi.fn>).mockClear();

    harness.begin(); usePropertyValueAdminLayer(ref, true, 0, 0.4, false);
    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(view.map.addSource).toHaveBeenCalledTimes(addSourceCalls);
    expect(stateCalls).toHaveBeenCalledTimes(appliedCount);
    expect(view.map.setPaintProperty).toHaveBeenCalledWith("property-value-admin-county-line", "line-color", "#ffffff");
  });
});
