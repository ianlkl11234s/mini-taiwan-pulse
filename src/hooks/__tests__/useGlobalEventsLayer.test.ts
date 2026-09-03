import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";
import type { GlobalEventPoint } from "../../data/globalEventsLoader";

const harness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cleanups: (() => void)[] = [];
  let cursor = 0;
  let timeCallback: ((time: number) => void) | null = null;
  let windowCallback: ((keys: string[]) => void) | null = null;
  let throttleMs: number | null = null;
  return {
    reset: () => {
      for (const cleanup of cleanups) cleanup();
      refs.length = 0;
      cleanups = [];
      cursor = 0;
      timeCallback = null;
      windowCallback = null;
      throttleMs = null;
    },
    useRef: <T,>(initial: T) => (refs[cursor++] ??= { current: initial }) as { current: T },
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
    timeSubscribe: (ms: number, callback: (time: number) => void) => {
      throttleMs = ms;
      timeCallback = callback;
      return vi.fn();
    },
    windowSubscribe: (callback: (keys: string[]) => void) => {
      windowCallback = callback;
      return vi.fn();
    },
    tick: (time: number) => timeCallback?.(time),
    changeWindow: (keys: string[]) => windowCallback?.(keys),
    getThrottleMs: () => throttleMs,
  };
});

const loader = vi.hoisted(() => ({ current: vi.fn(), window: vi.fn() }));
const loading = vi.hoisted(() => ({ idle: vi.fn() }));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-09-03T10:30:00Z") / 1000 }));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: harness.useRef,
  useEffect: harness.useEffect,
  useCallback: <T,>(fn: T) => fn,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/globalEventsLoader", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../data/globalEventsLoader")>(),
  fetchGlobalEventsCurrent: loader.current,
  fetchGlobalEventsWindow: loader.window,
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: loading.idle }));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    getWindowDateKeys: () => ["2026-09-03"],
    subscribeWindowDateKeys: harness.windowSubscribe,
    subscribeThrottled: harness.timeSubscribe,
  },
}));

import { globalEventLocationLabel } from "../../components/featureInfo/globalClimatePanels";
import {
  GLOBAL_EVENTS_LAYER_ID,
  GLOBAL_EVENTS_PULSE_LAYER_ID,
  globalEventTransitions,
  globalEventWindowBounds,
  useGlobalEventsLayer,
} from "../useGlobalEventsLayer";

function point(overrides: Partial<GlobalEventPoint> = {}): GlobalEventPoint {
  return {
    eventId: "event-1",
    versionId: "version-1",
    versionNo: 1,
    publicationNo: 1,
    lifecycleState: "published",
    eventPlaceId: "event-place-1",
    titleZhTw: "事件",
    summaryZhTw: "摘要",
    category: "policy",
    severity: 2,
    confidence: 0.9,
    validFrom: "2026-09-03T10:00:00Z",
    publishedAt: "2026-09-03T10:00:00Z",
    explicitValidTo: null,
    displayFrom: "2026-09-03T10:00:00Z",
    displayTo: null,
    placeKey: "place-1",
    placeName: "甲國",
    countryCode: "AAA",
    admin1: null,
    admin2: null,
    precision: "point",
    locationSource: "source",
    displayPlaceId: "display-place-1",
    locationKind: "event_point",
    isProxy: false,
    representativePrecision: null,
    proxyForEventPlaceId: null,
    locationLineage: "events/example.json#/event_places/0",
    coordinates: [10, 20],
    ...overrides,
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
  } as unknown as MapboxMap;
  return { map, sources, layers };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useGlobalEventsLayer timeline", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    harness.reset();
    loader.current.mockReset();
    loader.window.mockReset();
    loading.idle.mockReset();
    clock.current = Date.parse("2026-09-03T10:30:00Z") / 1000;
    vi.unstubAllGlobals();
  });

  it("Replay 每個 window 載一次，200ms 訂閱只做本地 immutable selection", async () => {
    loader.window.mockResolvedValue([point()]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.8, "replay");
    await flush();

    expect(loader.window).toHaveBeenCalledWith("2026-09-02T16:00:00.000Z", "2026-09-03T16:00:00.000Z");
    expect(loader.current).not.toHaveBeenCalled();
    expect(harness.getThrottleMs()).toBe(200);
    expect(state.layers.has(GLOBAL_EVENTS_LAYER_ID)).toBe(true);
    expect(state.layers.has(GLOBAL_EVENTS_PULSE_LAYER_ID)).toBe(true);
    expect(state.sources.get("global-events-current")?.setData).toHaveBeenLastCalledWith(
      expect.objectContaining({ features: [expect.objectContaining({ id: "display-place-1" })] }),
    );

    harness.tick(Date.parse("2026-09-03T10:45:00Z") / 1000);
    expect(loader.window).toHaveBeenCalledTimes(1);
    harness.changeWindow(["2026-09-04"]);
    await flush();
    expect(loader.window).toHaveBeenCalledTimes(2);
  });

  it("跨日換 window 仍保留舊 cursor，9/2→9/3 跨發布時間會 pulse", async () => {
    clock.current = Date.parse("2026-09-02T15:59:59Z") / 1000;
    const published = point({
      displayFrom: "2026-09-03T05:41:00Z",
      publishedAt: "2026-09-03T05:41:00Z",
    });
    loader.window.mockResolvedValueOnce([]).mockResolvedValueOnce([published]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.8, "replay");
    await flush();

    harness.changeWindow(["2026-09-03"]);
    clock.current = Date.parse("2026-09-03T15:59:59.999Z") / 1000;
    harness.tick(clock.current);
    await flush();

    const calls = state.sources.get("global-events-current")?.setData.mock.calls ?? [];
    const fc = calls[calls.length - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(fc.features[0]?.properties).toMatchObject({
      event_id: "event-1",
      transition_kind: "new_event",
    });
  });

  it("Live 只使用 current RPC，仍保留 proxy metadata 給 popup", async () => {
    loader.current.mockResolvedValue([point({
      locationKind: "country_center",
      isProxy: true,
      representativePrecision: "country",
    })]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "live");
    await flush();

    expect(loader.current).toHaveBeenCalledTimes(1);
    expect(loader.window).not.toHaveBeenCalled();
    const calls = state.sources.get("global-events-current")?.setData.mock.calls ?? [];
    const fc = calls[calls.length - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(fc.features[0]?.properties).toMatchObject({ location_kind: "country_center", is_proxy: true });
  });
});

describe("Global Events pulse and location semantics", () => {
  it("只在時間向前跨過 display_from 時 pulse，並以 publication_no 分新事件／版本更新", () => {
    const newEvent = point({ displayFrom: "2026-09-03T10:00:00Z", publicationNo: 1 });
    const update = point({
      eventId: "event-2",
      versionId: "version-2",
      displayFrom: "2026-09-03T10:05:00Z",
      publicationNo: 2,
    });
    const before = Date.parse("2026-09-03T09:59:00Z") / 1000;
    const after = Date.parse("2026-09-03T10:06:00Z") / 1000;

    expect([...globalEventTransitions([newEvent, update], before, after)]).toEqual([
      ["event-1", "new_event"],
      ["event-2", "version_update"],
    ]);
    expect(globalEventTransitions([newEvent, update], after, before).size).toBe(0);
  });

  it("window bounds 使用台北日界，並產生 exclusive end", () => {
    expect(globalEventWindowBounds(["2026-09-03", "2026-09-04"])).toEqual({
      start: "2026-09-02T16:00:00.000Z",
      end: "2026-09-04T16:00:00.000Z",
    });
  });

  it("popup 明確區分 exact event point 與 city/country representative point", () => {
    expect(globalEventLocationLabel({ location_kind: "event_point" })).toContain("精確事件位置");
    expect(globalEventLocationLabel({ location_kind: "city_center" })).toContain("城市代表點");
    expect(globalEventLocationLabel({ location_kind: "country_center" })).toContain("國家代表點");
    expect(globalEventLocationLabel({ location_kind: "country_center" })).toContain("非事件精確座標");
  });
});
