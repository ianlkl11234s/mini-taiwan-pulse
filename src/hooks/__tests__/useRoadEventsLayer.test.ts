import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

const harness = vi.hoisted(() => {
  const refs: Array<{ current: unknown }> = [];
  let cursor = 0;
  let timeCallback: ((time: number) => void) | null = null;
  let throttleMs: number | null = null;
  return {
    reset: () => {
      refs.length = 0;
      cursor = 0;
      timeCallback = null;
      throttleMs = null;
    },
    useRef: <T,>(initial: T) => (refs[cursor++] ??= { current: initial }) as { current: T },
    useEffect: (effect: () => void | (() => void)) => { effect(); },
    useCallback: <T,>(fn: T) => fn,
    subscribeDate: (_cb: (date: string) => void) => {
      return vi.fn();
    },
    subscribeThrottled: (ms: number, cb: (time: number) => void) => {
      throttleMs = ms;
      timeCallback = cb;
      return vi.fn();
    },
    tick: (time: number) => timeCallback?.(time),
    throttleMs: () => throttleMs,
  };
});

const loader = vi.hoisted(() => ({ day: vi.fn() }));
const clock = vi.hoisted(() => ({ current: 1_100 }));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: harness.useRef,
  useEffect: harness.useEffect,
  useCallback: harness.useCallback,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/roadEventsLoader", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../data/roadEventsLoader")>(),
  fetchRoadEventsDay: loader.day,
}));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    getDateKey: () => "2026-09-23",
    subscribeDate: harness.subscribeDate,
    subscribeThrottled: harness.subscribeThrottled,
  },
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useRoadEventsLayer } from "../useRoadEventsLayer";

function createMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useRoadEventsLayer timeStore lifecycle", () => {
  beforeEach(() => {
    harness.reset();
    loader.day.mockReset();
    clock.current = 1_100;
  });

  it("updates active state from timeStore without another day RPC", async () => {
    loader.day.mockResolvedValue([{
      event_id: "short-event",
      source: "live_freeway",
      event_type: 3,
      severity: null,
      road_name: null,
      direction: null,
      start_km: null,
      end_km: null,
      title: null,
      description: null,
      location_other: null,
      blocked_lanes: null,
      geometry: { type: "Point", coordinates: [121.5, 25] },
      matched_section_id: null,
      enrich_status: null,
      start_ts: 1_000,
      end_ts: 1_200,
      last_updated_ts: 1_100,
    }]);
    const state = createMap();

    useRoadEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true);
    await flush();

    expect(loader.day).toHaveBeenCalledTimes(1);
    expect(harness.throttleMs()).toBe(500);
    harness.tick(1_200);

    expect(loader.day).toHaveBeenCalledTimes(1);
    const calls = state.sources.get("road-events")?.setData.mock.calls ?? [];
    const latest = calls[calls.length - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(latest.features[0]?.properties?.active).toBe(0);
  });
});
