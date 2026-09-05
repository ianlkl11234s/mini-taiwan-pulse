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

const loader = vi.hoisted(() => ({ current: vi.fn(), window: vi.fn(), candidates: vi.fn() }));
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
  fetchGlobalEventCandidatesWindow: loader.candidates,
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
import { parseGlobalEventCandidate } from "../../data/globalEventsLoader";
import { globalEventsViewStore } from "../../state/globalEventsViewStore";
import {
  GLOBAL_EVENTS_LAYER_ID,
  GLOBAL_EVENTS_PULSE_LAYER_ID,
  globalEventPointImage,
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
  const handlers = new Map<string, (event?: unknown) => void>();
  const images = new Set<string>();
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string) => images.add(id)),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn((event: string, handler: (event?: unknown) => void) => handlers.set(event, handler)),
    off: vi.fn((event: string) => handlers.delete(event)),
    project: vi.fn(([x, y]: [number, number]) => ({ x, y })),
    unproject: vi.fn(([lng, lat]: [number, number]) => ({ lng, lat })),
    queryRenderedFeatures: vi.fn(() => []),
    easeTo: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources, layers, handlers, images };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// 跨日 scrub 現在走 250ms trailing debounce（Bug 4）。真實等待（非 fake timers，
// recent7d 測試需要 spy Date.now，跟 vi.useFakeTimers 連 Date 一起假掉會衝突）
// 讓 debounce 真的到期，再补 flush() 讓後續的 fetch microtask 跑完。
async function flushDebounce(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 260));
  await flush();
}

describe("useGlobalEventsLayer timeline", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    loader.candidates.mockResolvedValue({ rows: [], totalCandidates: 0 });
  });

  afterEach(() => {
    harness.reset();
    loader.current.mockReset();
    loader.window.mockReset();
    loader.candidates.mockReset();
    loading.idle.mockReset();
    clock.current = Date.parse("2026-09-03T10:30:00Z") / 1000;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    await flushDebounce();
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
    await flushDebounce();

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

  it("recent7d loads backward overview, retains low-importance and unlocated entries, and restores paint after style reload", async () => {
    const now = Date.parse("2026-09-03T10:30:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    loader.window.mockResolvedValue([point()]);
    const unknown = parseGlobalEventCandidate({ candidate_id: "unknown", observation_sha256: "v1", available_at: "2026-09-02T00:00:00Z", geometry: null,
      assessment_status: "pending", decision: "drop_noise", taiwan_relationship: "unrelated" });
    loader.candidates.mockResolvedValue({ rows: [unknown], totalCandidates: 1 });
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.4, "replay", "recent7d", false, "event-1");
    await flush();
    expect(loader.window).toHaveBeenCalledWith("2026-08-27T10:30:00.000Z", "2026-09-03T10:30:00.000Z");
    expect(loader.current).not.toHaveBeenCalled();
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(2);
    expect(harness.getThrottleMs()).toBeNull();
    state.layers.clear();
    state.images.clear();
    state.handlers.get("style.load")?.();
    expect(state.images.has("global-events-point-sdf")).toBe(true);
    expect(state.map.setPaintProperty).toHaveBeenCalledWith(GLOBAL_EVENTS_LAYER_ID, "icon-opacity", 0.4);
    expect(state.map.setLayoutProperty).toHaveBeenCalledWith("global-events-relations-line", "visibility", "none");
  });

  it("pan/rotation/zoom never rewrite coordinates; native offset symbols preserve all colocated events and cleanup", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => point({ eventId: `event-${i}`, versionId: `v-${i}`, eventPlaceId: `place-${i}`, displayPlaceId: `place-${i}` }));
    loader.current.mockResolvedValue(rows);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6, "live");
    await flush();
    const cluster = state.sources.get("global-events-clusters")!.setData.mock.lastCall![0].features[0];
    vi.mocked(state.map.queryRenderedFeatures).mockReturnValue([{ properties: cluster.properties }] as never);
    state.handlers.get("click")?.({ point: { x: 100, y: 100 } });
    const source = state.sources.get("global-events-current")!.setData;
    const expanded = source.mock.lastCall![0] as GeoJSON.FeatureCollection<GeoJSON.Point>;
    expect(expanded.features).toHaveLength(8);
    expect(new Set(expanded.features.map((f) => f.properties?.event_id)).size).toBe(8);
    expect(new Set(expanded.features.map((f) => JSON.stringify(f.properties?.icon_offset))).size).toBe(8);
    expect(expanded.features.every((f) => JSON.stringify(f.geometry.coordinates) === "[10,20]")).toBe(true);
    expect(state.layers.get(GLOBAL_EVENTS_LAYER_ID)).toMatchObject({ type: "symbol", layout: {
      "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport",
      "icon-offset": ["get", "icon_offset"], "icon-allow-overlap": true, "icon-ignore-placement": true,
    } });
    const callCount = source.mock.calls.length;
    for (const [scale, bearing] of [[1, 0], [4, 90], [0.1, 180]]) {
      vi.mocked(state.map.project).mockImplementation(() => ({ x: scale, y: bearing }) as never);
      vi.mocked(state.map.unproject).mockImplementation(() => ({ lng: bearing, lat: scale }) as never);
      for (const event of ["move", "rotate", "zoom", "moveend", "render"]) state.handlers.get(event)?.();
    }
    expect(source).toHaveBeenCalledTimes(callCount);
    expect(state.map.project).not.toHaveBeenCalled();
    expect(state.map.unproject).not.toHaveBeenCalled();
    expect(source.mock.lastCall![0]).toEqual(expanded);
    state.images.clear();
    state.handlers.get("styleimagemissing")?.({ id: "global-events-point-sdf" });
    expect(state.images.has("global-events-point-sdf")).toBe(true);
    harness.reset(); // Mirrors effect cleanup when layer turns off/unmounts.
    for (const id of state.layers.keys()) expect(state.map.setLayoutProperty).toHaveBeenCalledWith(id, "visibility", "none");
    expect(state.handlers.size).toBe(0);
    expect(state.map.setPaintProperty).toHaveBeenCalledWith(GLOBAL_EVENTS_PULSE_LAYER_ID, "circle-stroke-opacity", 0);
  });

  it("unchanged cursor slices do not publish sidebar snapshots every200ms", async () => {
    loader.window.mockResolvedValue([point()]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "replay");
    await flush();
    const listener = vi.fn();
    const unsubscribe = globalEventsViewStore.subscribe(listener);
    harness.tick(clock.current + 1);
    harness.tick(clock.current + 2);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("September2 sources imported September3 become visible on September3 without backdating availability or changing formal window", async () => {
    loader.window.mockResolvedValue([]);
    const delayed = parseGlobalEventCandidate({ candidate_id: "delayed", observation_sha256: "v1", observed_at: "2026-09-02T01:00:00Z",
      available_at: "2026-09-03T10:00:00Z", display_from: "2026-09-03T10:00:00Z", geometry: null,
      assessment_status: "assessed", decision: "drop_noise", taiwan_relationship: "unrelated" });
    loader.candidates.mockResolvedValue({ rows: [delayed], totalCandidates: 1 });
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "replay");
    await flush();
    expect(loader.window).toHaveBeenCalledWith("2026-09-02T16:00:00.000Z", "2026-09-03T16:00:00.000Z");
    expect(loader.candidates).toHaveBeenCalledWith("2026-08-26T16:00:00.000Z", "2026-09-03T16:00:00.000Z");
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1);
    harness.tick(Date.parse("2026-09-03T09:59:59Z") / 1000);
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(0);
    harness.tick(Date.parse("2026-09-03T10:00:00Z") / 1000);
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1);
  });

  it("candidate failure remains partial, not a successful empty candidate result", async () => {
    loader.window.mockResolvedValue([point()]);
    loader.candidates.mockRejectedValue(new Error("RPC unavailable"));
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "replay");
    await flush();
    expect(globalEventsViewStore.getSnapshot().status).toBe("partial");
    expect(globalEventsViewStore.getSnapshot().message).toContain("載入失敗");
  });

  it("recent7d 週期刷新期間 entries 不清空，背景重抓保留舊資料", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-03T10:30:00Z"));
    loader.window.mockResolvedValueOnce([point()]);
    let refresh: (() => void) | undefined;
    vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      refresh = fn;
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "replay", "recent7d");
    await flush();
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1);

    loader.window.mockReturnValueOnce(new Promise<never>(() => {})); // 刷新中，故意不 resolve
    refresh?.();
    await flush();

    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1); // 舊資料仍保留，沒被清空
    expect(globalEventsViewStore.getSnapshot().status).toBe("loading");
  });

  it("recent7d 週期刷新失敗時保留舊 entries，只更新錯誤訊息", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-03T10:30:00Z"));
    loader.window.mockResolvedValueOnce([point()]);
    let refresh: (() => void) | undefined;
    vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      refresh = fn;
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.9, "replay", "recent7d");
    await flush();
    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1);

    loader.window.mockRejectedValueOnce(new Error("RPC unavailable"));
    refresh?.();
    await flush();

    expect(globalEventsViewStore.getSnapshot().entries).toHaveLength(1); // 沒被空陣列蓋掉
    expect(globalEventsViewStore.getSnapshot().status).toBe("partial");
    expect(globalEventsViewStore.getSnapshot().message).toContain("載入失敗");
  });

  it("圖層關閉／unmount 後 globalEventsViewStore 歸零，不留前一輪的殘影", async () => {
    loader.window.mockResolvedValue([point()]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.8, "replay");
    await flush();
    expect(globalEventsViewStore.getSnapshot().entries.length).toBeGreaterThan(0);

    harness.reset(); // 模擬 effect cleanup（圖層關閉或元件 unmount）

    expect(globalEventsViewStore.getSnapshot()).toEqual({ entries: [], status: "idle", message: null, windowLabel: "最近七天" });
  });

  it("跨日 scrub 連續三次 window 變化只發一次 load（250ms trailing debounce）", async () => {
    loader.window.mockResolvedValue([point()]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.8, "replay");
    await flush();
    expect(loader.window).toHaveBeenCalledTimes(1); // 掛載時的初次載入，不受 debounce 影響

    harness.changeWindow(["2026-09-04"]);
    harness.changeWindow(["2026-09-05"]);
    harness.changeWindow(["2026-09-06"]);
    await flushDebounce();

    expect(loader.window).toHaveBeenCalledTimes(2); // 三次連續變化只多打一次 RPC
    expect(loader.window).toHaveBeenLastCalledWith("2026-09-05T16:00:00.000Z", "2026-09-06T16:00:00.000Z");
  });

  it("clamps pulse phase when RAF frame time precedes performance.now at animation start", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.spyOn(performance, "now").mockReturnValue(1000);
    clock.current = Date.parse("2026-09-03T09:59:00Z") / 1000;
    loader.window.mockResolvedValue([point()]);
    const state = createMap();
    useGlobalEventsLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.8, "replay");
    await flush();
    harness.tick(Date.parse("2026-09-03T10:01:00Z") / 1000);
    expect(frames).toHaveLength(1);
    frames.shift()!(990); // The browser's current frame began before this animation was started.
    frames.shift()!(1900);
    frames.shift()!(4000); // Late frame must also remain within the end bound.
    const calls = vi.mocked(state.map.setPaintProperty).mock.calls;
    const opacities = calls.filter(([id, property]) => id === GLOBAL_EVENTS_PULSE_LAYER_ID && property === "circle-stroke-opacity").map((call) => Number(call[2]));
    const radii = calls.filter(([id, property]) => id === GLOBAL_EVENTS_PULSE_LAYER_ID && property === "circle-radius").map((call) => Number(call[2]));
    expect(opacities.every((value) => Number.isFinite(value) && value >= 0 && value <= 0.8)).toBe(true);
    expect(radii).toEqual([8, 19, 30]);
    expect(opacities[opacities.length - 1]).toBe(0);
    expect(frames).toHaveLength(0);
  });
});

describe("Global Events pulse and location semantics", () => {
  it("registers an opaque-centered SDF circle with transparent edge and no async image dependency", () => {
    const image = globalEventPointImage();
    expect(image.data).toBeInstanceOf(Uint8Array);
    expect(image.data.length).toBe(image.width * image.height * 4);
    expect(image.data[3]).toBe(0);
    expect(image.data[(32 * image.width + 32) * 4 + 3]).toBe(255);
  });
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
    expect(globalEventLocationLabel({ research_status: "ai_assessed", location_kind: "country_center", source_kind: "metadata_representative" })).toBe("新聞相關國家／城市概略位置，未確認精確發生地");
    expect(globalEventLocationLabel({ research_status: "ai_assessed", location_kind: "city_center", source_kind: "gdelt_metadata_mention" })).toBe("新聞地理提及的概略位置，未核實精確發生地");
    expect(globalEventLocationLabel({ research_status: "ai_assessed", location_kind: "country_center", source_kind: "headline_gazetteer" })).toBe("標題提及國家／城市的概略位置，未核實精確發生地");
  });
});
