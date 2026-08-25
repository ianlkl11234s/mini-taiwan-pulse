import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cleanups: (() => void)[] = [];
  let cursor = 0;
  let timeCallback: ((time: number) => void) | null = null;
  return {
    reset: () => {
      for (const cleanup of cleanups) cleanup();
      refs.length = 0; cleanups = []; cursor = 0; timeCallback = null;
    },
    rerender: () => {
      for (const cleanup of cleanups) cleanup();
      cleanups = []; cursor = 0;
    },
    useRef: <T,>(initial: T) => (refs[cursor++] ??= { current: initial }) as { current: T },
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
    setTimeCallback: (cb: (time: number) => void) => { timeCallback = cb; },
    tick: (time: number) => timeCallback?.(time),
  };
});

const loader = vi.hoisted(() => ({
  loadManifest: vi.fn(),
  loadHour: vi.fn(),
}));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-08-15T00:20:00Z") / 1000 }));

vi.mock("react", () => ({ useRef: harness.useRef, useEffect: harness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/gfwHourlyGridLoader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/gfwHourlyGridLoader")>();
  return {
    ...actual,
    loadGfwHourlyGridManifest: loader.loadManifest,
    loadGfwHourlyGridHour: loader.loadHour,
  };
});
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    subscribeThrottled: (_ms: number, cb: (time: number) => void) => {
      harness.setTimeCallback(cb);
      return vi.fn();
    },
  },
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useGfwHourlyGridLayer } from "../useGfwHourlyGridLayer";

const FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function createMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const map = {
    isStyleLoaded: () => true,
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => { sources.set(id, { setData: vi.fn() }); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => { layers.set(layer.id, layer); },
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources, layers };
}

describe("useGfwHourlyGridLayer timeline", () => {
  afterEach(() => {
    harness.reset();
    clock.current = Date.parse("2026-08-15T00:20:00Z") / 1000;
    loader.loadManifest.mockReset();
    loader.loadHour.mockReset();
  });

  it("同一 activation rerender 不重抓 manifest，close→open 會 refresh", async () => {
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await Promise.resolve(); await Promise.resolve();
    expect(loader.loadManifest).toHaveBeenCalledTimes(1);

    harness.rerender(); useGfwHourlyGridLayer(mapRef, true, 0.8);
    expect(loader.loadManifest).toHaveBeenCalledTimes(1);

    harness.rerender(); useGfwHourlyGridLayer(mapRef, false, 0.8);
    harness.rerender(); useGfwHourlyGridLayer(mapRef, true, 0.8);
    await Promise.resolve(); await Promise.resolve();
    expect(loader.loadManifest).toHaveBeenCalledTimes(2);
  });

  it("快速跨小時時舊 response 不覆蓋新 exact-hour 資料", async () => {
    const data1: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [123, 24] }, properties: { vessel_count: 1 } }],
    };
    const data2: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [124, 25] }, properties: { vessel_count: 2 } }],
    };
    let resolveHour1!: (value: GeoJSON.FeatureCollection) => void;
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockImplementation((_manifest: unknown, hour: string) => {
      if (hour === "2026-08-15T01:00:00Z") return new Promise((resolve) => { resolveHour1 = resolve; });
      return Promise.resolve(hour === "2026-08-15T02:00:00Z" ? data2 : FC);
    });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    harness.tick(Date.parse("2026-08-15T02:00:00Z") / 1000);
    await Promise.resolve(); await Promise.resolve();
    const source = state.sources.get("gfw-hourly-grid-source");
    expect(source?.setData).toHaveBeenLastCalledWith(data2);

    resolveHour1(data1);
    await Promise.resolve(); await Promise.resolve();
    expect(source?.setData).toHaveBeenLastCalledWith(data2);
  });

  it("同一 UTC 小時不重抓，跨整點才載下一個 hour file", async () => {
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await Promise.resolve();
    await Promise.resolve();

    expect(state.layers.has("gfw-hourly-grid-circle")).toBe(true);
    expect(state.layers.has("gfw-hourly-grid-count")).toBe(true);
    expect(loader.loadHour).toHaveBeenCalledTimes(1);
    expect(loader.loadHour.mock.calls[0]?.[1]).toBe("2026-08-15T00:00:00Z");

    harness.tick(Date.parse("2026-08-15T00:59:59Z") / 1000);
    await Promise.resolve();
    expect(loader.loadHour).toHaveBeenCalledTimes(1);

    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.loadHour).toHaveBeenCalledTimes(2);
    expect(loader.loadHour.mock.calls[1]?.[1]).toBe("2026-08-15T01:00:00Z");
  });
});
