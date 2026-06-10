import { describe, it, expect, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  startTimelineSliceController,
  type TimelineSliceLayerConfig,
  type TimeStoreLike,
} from "../timelineSliceLayer";

function createMockMap(styleLoaded = true) {
  const layers = new Map<string, { visibility: string }>();
  const setDataCalls: unknown[] = [];
  const source = { setData: (d: unknown) => setDataCalls.push(d) };
  let hasSource = false;
  const map = {
    isStyleLoaded: () => styleLoaded,
    getSource: () => (hasSource ? source : undefined),
    addSource: () => { hasSource = true; },
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    addLayer: (spec: { id: string }) => layers.set(spec.id, { visibility: "visible" }),
    setLayoutProperty: (id: string, _k: string, v: string) => {
      const l = layers.get(id);
      if (l) l.visibility = v;
    },
  };
  return { map: map as unknown as MapboxMap, layers, setDataCalls, addSource: () => { hasSource = true; } };
}

function createMockTimeStore(dateKey = "2026-06-09", time = 1000) {
  const dateSubs = new Set<(k: string) => void>();
  const throttledSubs = new Set<(t: number) => void>();
  return {
    store: {
      getTime: () => time,
      getDateKey: () => dateKey,
      subscribeDate: (cb: (k: string) => void) => {
        dateSubs.add(cb);
        return () => dateSubs.delete(cb);
      },
      subscribeThrottled: (_ms: number, cb: (t: number) => void) => {
        throttledSubs.add(cb);
        return () => throttledSubs.delete(cb);
      },
    } satisfies TimeStoreLike,
    emitDate: (k: string) => dateSubs.forEach((cb) => cb(k)),
    emitTick: (t: number) => throttledSubs.forEach((cb) => cb(t)),
    subCounts: () => ({ date: dateSubs.size, throttled: throttledSubs.size }),
  };
}

function makeConfig(overrides: Partial<TimelineSliceLayerConfig<string[]>> = {}) {
  const loadCalls: string[] = [];
  const config: TimelineSliceLayerConfig<string[]> = {
    sourceId: "test-src",
    layerIds: ["test-glow", "test-circle"],
    consoleTag: "[Test]",
    loadingId: "test-render",
    loadingLabel: "test",
    loadDay: async (dateKey) => {
      loadCalls.push(dateKey);
      return [dateKey];
    },
    emptyData: () => [],
    buildFC: (data, t) =>
      ({
        type: "FeatureCollection",
        features: [],
        _marker: { data, t }, // 測試摻入 marker 方便斷言
      }) as GeoJSON.FeatureCollection,
    ensureLayers: (map) => {
      // 模擬真實 ensureLayers：addSource + addLayer
      (map as unknown as { addSource: () => void }).addSource();
      (map as unknown as { addLayer: (s: { id: string }) => void }).addLayer({ id: "test-glow" });
      (map as unknown as { addLayer: (s: { id: string }) => void }).addLayer({ id: "test-circle" });
    },
    updatePaint: () => {},
    ...overrides,
  };
  return { config, loadCalls };
}

const noopKeepLoading = () => {};

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe("startTimelineSliceController", () => {
  it("attaches layers, loads current day, and redraws", async () => {
    const { map, setDataCalls, layers } = createMockMap();
    const ts = createMockTimeStore("2026-06-09", 1234);
    const { config, loadCalls } = makeConfig();

    const dispose = startTimelineSliceController(map, config, true, 1, 1, {
      timeStore: ts.store,
      keepLoading: noopKeepLoading,
    });
    await flush();

    expect(loadCalls).toEqual(["2026-06-09"]);
    expect(layers.get("test-glow")?.visibility).toBe("visible");
    expect(setDataCalls).toHaveLength(1);
    const marker = (setDataCalls[0] as { _marker: { data: string[]; t: number } })._marker;
    expect(marker.data).toEqual(["2026-06-09"]);
    expect(marker.t).toBe(1234);
    dispose();
  });

  it("reloads on date change and clears stale data first", async () => {
    const { map } = createMockMap();
    const ts = createMockTimeStore("2026-06-09");
    const { config, loadCalls } = makeConfig();

    const dispose = startTimelineSliceController(map, config, true, 1, 1, {
      timeStore: ts.store,
      keepLoading: noopKeepLoading,
    });
    await flush();
    ts.emitDate("2026-06-08");
    await flush();
    expect(loadCalls).toEqual(["2026-06-09", "2026-06-08"]);
    dispose();
  });

  it("discards a slow load that resolves after the date changed (race)", async () => {
    const { map, setDataCalls } = createMockMap();
    const ts = createMockTimeStore("2026-06-09");
    const resolvers = new Map<string, (v: string[]) => void>();
    const { config } = makeConfig({
      loadDay: (dateKey) =>
        new Promise<string[]>((resolve) => resolvers.set(dateKey, resolve)),
    });

    const dispose = startTimelineSliceController(map, config, true, 1, 1, {
      timeStore: ts.store,
      keepLoading: noopKeepLoading,
    });
    ts.emitDate("2026-06-08"); // 第一天還沒 resolve 就換日
    resolvers.get("2026-06-09")!(["stale"]);
    await flush();
    expect(setDataCalls).toHaveLength(0); // stale 結果被丟棄

    resolvers.get("2026-06-08")!(["fresh"]);
    await flush();
    expect(setDataCalls).toHaveLength(1);
    const marker = (setDataCalls[0] as { _marker: { data: string[] } })._marker;
    expect(marker.data).toEqual(["fresh"]);
    dispose();
  });

  it("redraws on throttled tick with the latest time", async () => {
    const { map, setDataCalls } = createMockMap();
    const ts = createMockTimeStore();
    const { config } = makeConfig();

    const dispose = startTimelineSliceController(map, config, true, 1, 1, {
      timeStore: ts.store,
      keepLoading: noopKeepLoading,
    });
    await flush();
    setDataCalls.length = 0;
    ts.emitTick(2000);
    expect(setDataCalls).toHaveLength(1);
    dispose();
  });

  it("dispose unsubscribes and hides layers", async () => {
    const { map, layers } = createMockMap();
    const ts = createMockTimeStore();
    const { config } = makeConfig();

    const dispose = startTimelineSliceController(map, config, true, 1, 1, {
      timeStore: ts.store,
      keepLoading: noopKeepLoading,
    });
    await flush();
    dispose();
    expect(ts.subCounts()).toEqual({ date: 0, throttled: 0 });
    expect(layers.get("test-glow")?.visibility).toBe("none");
    expect(layers.get("test-circle")?.visibility).toBe("none");
  });

  it("polls for style readiness before attaching", async () => {
    vi.useFakeTimers();
    try {
      let ready = false;
      const layers = new Map<string, { visibility: string }>();
      let hasSource = false;
      const map = {
        isStyleLoaded: () => ready,
        getSource: () => (hasSource ? { setData: () => {} } : undefined),
        addSource: () => { hasSource = true; },
        getLayer: (id: string) => (layers.has(id) ? {} : undefined),
        addLayer: (spec: { id: string }) => layers.set(spec.id, { visibility: "visible" }),
        setLayoutProperty: () => {},
      } as unknown as MapboxMap;
      const ts = createMockTimeStore();
      const { config } = makeConfig();

      const dispose = startTimelineSliceController(map, config, true, 1, 1, {
        timeStore: ts.store,
        keepLoading: noopKeepLoading,
      });
      expect(layers.size).toBe(0); // 尚未 attach
      ready = true;
      vi.advanceTimersByTime(250);
      expect(layers.size).toBe(2); // 輪詢後 attach
      dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
