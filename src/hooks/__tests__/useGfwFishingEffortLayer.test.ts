import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cleanups: (() => void)[] = [];
  let cursor = 0;
  let timeCallback: ((time: number) => void) | null = null;
  const unsubscribe = vi.fn();
  return {
    reset: () => {
      for (const cleanup of cleanups) cleanup();
      refs.length = 0;
      cleanups = [];
      cursor = 0;
      timeCallback = null;
      unsubscribe.mockReset();
    },
    rerender: () => {
      for (const cleanup of cleanups) cleanup();
      cleanups = [];
      cursor = 0;
    },
    useRef: <T,>(initial: T) => (refs[cursor++] ??= { current: initial }) as { current: T },
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
    subscribe: (callback: (time: number) => void) => {
      timeCallback = callback;
      return unsubscribe;
    },
    tick: (time: number) => timeCallback?.(time),
    unsubscribe,
  };
});

const loader = vi.hoisted(() => ({ manifest: vi.fn(), day: vi.fn(), gate: vi.fn(() => true) }));
const notice = vi.hoisted(() => ({ show: vi.fn() }));
const loading = vi.hoisted(() => ({ idle: vi.fn() }));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-08-21T12:00:00Z") / 1000 }));

vi.mock("react", () => ({ useRef: harness.useRef, useEffect: harness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/gfwFishingEffortLoader", () => ({
  loadGfwFishingEffortManifest: loader.manifest,
  loadGfwFishingEffortDay: loader.day,
  isGfwFishingEffortShadowEnabled: loader.gate,
}));
vi.mock("../../components/TransientNotice", () => ({ showTransientNotice: notice.show }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: loading.idle }));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    subscribeThrottled: (_ms: number, callback: (time: number) => void) => harness.subscribe(callback),
  },
}));

import {
  GFW_FISHING_EFFORT_COLOR_EXPRESSION,
  GFW_FISHING_EFFORT_FILL_LAYER_ID,
  GFW_FISHING_EFFORT_OUTLINE_LAYER_ID,
  GFW_FISHING_EFFORT_SOURCE_ID,
  useGfwFishingEffortLayer,
} from "../useGfwFishingEffortLayer";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const DATA: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "effort-1",
    geometry: {
      type: "Polygon",
      coordinates: [[[120, 23], [120.1, 23], [120.1, 23.1], [120, 23.1], [120, 23]]],
    },
    properties: { apparent_fishing_hours: 3, component_count: 1 },
  }],
};

function manifest() {
  return {
    releaseId: "2026-08-21",
    selectedUtcDate: "2026-08-21",
    latestObservedActiveDate: "2026-08-23",
    metric: "apparent_fishing_hours",
    unit: "hours",
    latestAvailableDate: null,
    latestAvailableDateStatus: "not_provided_by_gfw",
    finalizationStatus: "not_provided_by_gfw",
    revisionSemantics: "dynamic_api_data_may_be_revised",
    attribution: "Powered by Global Fishing Watch. https://globalfishingwatch.org/",
    attributionHref: "https://globalfishingwatch.org/",
    caveat: "Apparent/model-derived and non-realtime; not vessel presence",
  };
}

function createMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const handlers = new Map<string, () => void>();
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
    off: vi.fn((event: string) => handlers.delete(event)),
    once: vi.fn(),
  } as unknown as MapboxMap;
  return {
    map,
    sources,
    layers,
    clearStyle: () => { sources.clear(); layers.clear(); },
    emitStyleLoad: () => handlers.get("style.load")?.(),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useGfwFishingEffortLayer", () => {
  afterEach(() => {
    harness.reset();
    clock.current = Date.parse("2026-08-21T12:00:00Z") / 1000;
    loader.manifest.mockReset();
    loader.day.mockReset();
    loader.gate.mockReset();
    loader.gate.mockReturnValue(true);
    notice.show.mockReset();
    loading.idle.mockReset();
  });

  it("只在 timeline UTC date exact match 載入，離開 sample date 立即清空", async () => {
    loader.manifest.mockResolvedValue(manifest());
    loader.day.mockResolvedValue(DATA);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwFishingEffortLayer(mapRef, true, 0.6);
    await flush();
    expect(loader.day).toHaveBeenCalledTimes(1);
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(DATA);
    expect(state.map.setLayoutProperty).toHaveBeenCalledWith(
      GFW_FISHING_EFFORT_FILL_LAYER_ID,
      "visibility",
      "visible",
    );
    expect(state.map.setPaintProperty).toHaveBeenCalledWith(
      GFW_FISHING_EFFORT_FILL_LAYER_ID,
      "fill-opacity",
      0.6,
    );
    expect((state.layers.get(GFW_FISHING_EFFORT_FILL_LAYER_ID) as { paint?: { "fill-color"?: unknown } })?.paint?.["fill-color"])
      .toBe(GFW_FISHING_EFFORT_COLOR_EXPRESSION);

    harness.tick(Date.parse("2026-08-22T00:00:00Z") / 1000);
    await flush();
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(EMPTY);
    expect(state.map.setLayoutProperty).toHaveBeenCalledWith(
      GFW_FISHING_EFFORT_OUTLINE_LAYER_ID,
      "visibility",
      "none",
    );
  });

  it("使用安全的 log1p apparent-hours 色階，null/負值不會產生 NaN", () => {
    const expression = JSON.stringify(GFW_FISHING_EFFORT_COLOR_EXPRESSION);
    expect(expression).toContain('"ln"');
    expect(expression).toContain('"max"');
    expect(expression).toContain('"coalesce"');
    expect(expression).toContain('"apparent_fishing_hours"');
    expect(GFW_FISHING_EFFORT_COLOR_EXPRESSION).toContain(Math.log1p(48));
  });

  it("manifest sample date 不符時 fail closed，不載其他日或 fallback", async () => {
    clock.current = Date.parse("2026-08-20T23:59:59Z") / 1000;
    loader.manifest.mockResolvedValue(manifest());
    loader.day.mockResolvedValue(DATA);
    const state = createMap();
    useGfwFishingEffortLayer({ current: state.map } as RefObject<MapboxMap | null>, true);
    await flush();
    expect(loader.day).not.toHaveBeenCalled();
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(EMPTY);

    harness.tick(Date.parse("2026-08-21T00:00:00Z") / 1000);
    await flush();
    expect(loader.day).toHaveBeenCalledTimes(1);
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(DATA);
  });

  it("離開 sample date 後，較慢的舊 response 不會重新顯示", async () => {
    let resolveDay!: (value: GeoJSON.FeatureCollection<GeoJSON.Polygon>) => void;
    loader.manifest.mockResolvedValue(manifest());
    loader.day.mockReturnValue(new Promise((resolve) => { resolveDay = resolve; }));
    const state = createMap();
    useGfwFishingEffortLayer({ current: state.map } as RefObject<MapboxMap | null>, true);
    await flush();
    harness.tick(Date.parse("2026-08-22T00:00:00Z") / 1000);
    resolveDay(DATA);
    await flush();
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(EMPTY);
  });

  it("style reload 重建 source/layers、回填資料，cleanup 解除訂閱與 listener", async () => {
    loader.manifest.mockResolvedValue(manifest());
    loader.day.mockResolvedValue(DATA);
    const state = createMap();
    useGfwFishingEffortLayer({ current: state.map } as RefObject<MapboxMap | null>, true);
    await flush();

    state.clearStyle();
    state.emitStyleLoad();
    expect(state.layers.has(GFW_FISHING_EFFORT_FILL_LAYER_ID)).toBe(true);
    expect(state.layers.has(GFW_FISHING_EFFORT_OUTLINE_LAYER_ID)).toBe(true);
    expect(state.sources.get(GFW_FISHING_EFFORT_SOURCE_ID)?.setData).toHaveBeenLastCalledWith(DATA);

    harness.rerender();
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
    expect(state.map.off).toHaveBeenCalledWith("style.load", expect.any(Function));
  });

  it("每次 false→true 顯示一次 sample/revision notice，關層後 resolve 不通知", async () => {
    loader.manifest.mockResolvedValue(manifest());
    loader.day.mockResolvedValue(DATA);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwFishingEffortLayer(mapRef, true);
    await flush();
    expect(notice.show).toHaveBeenCalledWith(
      "GFW 漁撈活動 sample：2026-08-21 UTC；最新觀測 active date 2026-08-23，未提供 finalized 狀態且 API 資料可能修訂",
    );

    harness.rerender();
    useGfwFishingEffortLayer(mapRef, true, 0.7);
    expect(notice.show).toHaveBeenCalledTimes(1);

    harness.rerender();
    useGfwFishingEffortLayer(mapRef, false);
    harness.rerender();
    useGfwFishingEffortLayer(mapRef, true);
    await flush();
    expect(notice.show).toHaveBeenCalledTimes(2);
  });
});
