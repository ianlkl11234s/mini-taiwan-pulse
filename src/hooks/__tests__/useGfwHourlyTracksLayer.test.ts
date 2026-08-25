import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cleanups: (() => void)[] = [];
  let cursor = 0;
  let timeCallback: ((time: number) => void) | null = null;
  let throttleMs: number | null = null;
  return {
    manifestUrl: "/gfw_hourly_tracks_poc/manifest.json",
    reset: () => {
      for (const cleanup of cleanups) cleanup();
      cleanups = [];
      refs.length = 0;
      cursor = 0;
      timeCallback = null;
      throttleMs = null;
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
    setTimeCallback: (ms: number, cb: (time: number) => void) => { throttleMs = ms; timeCallback = cb; },
    tick: (time: number) => timeCallback?.(time),
    getThrottleMs: () => throttleMs,
  };
});

const loader = vi.hoisted(() => ({
  loadManifest: vi.fn(),
  loadDay: vi.fn(),
  frame: vi.fn(),
}));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-08-15T03:20:00Z") / 1000 }));
const notice = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("react", () => ({ useRef: harness.useRef, useEffect: harness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/gfwHourlyTracksLoader", () => ({
  loadGfwHourlyTrackManifest: loader.loadManifest,
  loadGfwHourlyTracksDay: loader.loadDay,
  gfwHourlyTracksFrame: loader.frame,
  gfwHourlyTracksUtcDate: (time: number) => new Date(time * 1000).toISOString().slice(0, 10),
}));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    subscribeThrottled: (ms: number, cb: (time: number) => void) => {
      harness.setTimeCallback(ms, cb);
      return vi.fn();
    },
  },
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../components/TransientNotice", () => ({ showTransientNotice: notice.show }));

import { useGfwHourlyTracksLayer } from "../useGfwHourlyTracksLayer";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function makeManifest(latestCompleteDate = "2026-08-21") {
  return {
    releaseId: latestCompleteDate,
    latestCompleteDate,
    dateStart: "2026-08-15",
    dateEnd: "2026-08-21",
    generatedAt: null,
    days: new Map([
      ["2026-08-15", { displayDate: "2026-08-15", path: `releases/${latestCompleteDate}/days/2026-08-15.geojson`, bytes: 1, features: 1, points: 2 }],
      ["2026-08-16", { displayDate: "2026-08-16", path: `releases/${latestCompleteDate}/days/2026-08-16.geojson`, bytes: 1, features: 1, points: 2 }],
      ["2026-08-17", { displayDate: "2026-08-17", path: `releases/${latestCompleteDate}/days/2026-08-17.geojson`, bytes: 1, features: 1, points: 2 }],
    ]),
  };
}

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

describe("useGfwHourlyTracksLayer timeline", () => {
  afterEach(() => {
    harness.reset();
    clock.current = Date.parse("2026-08-15T03:20:00Z") / 1000;
    loader.loadManifest.mockReset();
    loader.loadDay.mockReset();
    loader.frame.mockReset();
    notice.show.mockReset();
  });

  it("以 100ms 訂閱時間軸，同一小時內的不同 tick 也重算內插 frame", async () => {
    const manifest = makeManifest();
    loader.loadManifest.mockResolvedValue(manifest);
    loader.loadDay.mockResolvedValue({ tracks: [], displayDate: "2026-08-15" });
    loader.frame.mockReturnValue({ lines: EMPTY, endpoints: EMPTY });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.layers.has("gfw-hourly-tracks-line")).toBe(true);
    expect(state.layers.has("gfw-hourly-tracks-endpoint")).toBe(true);
    expect(loader.frame).toHaveBeenCalledTimes(1);
    expect(loader.frame.mock.calls[0]?.[2]).toBe(0.5);
    expect(harness.getThrottleMs()).toBe(100);
    expect(loader.loadManifest).toHaveBeenCalledTimes(1);
    expect(loader.loadDay).toHaveBeenCalledWith(manifest, "2026-08-15");
    expect(notice.show).toHaveBeenCalledWith("GFW 航跡資料最新完整日：2026-08-21（UTC，非即時）");
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-tracks-line", "line-opacity", 0.75 * 0.45);

    // 完全相同時刻的重複 callback 不做無意義重算。
    harness.tick(Date.parse("2026-08-15T03:20:00Z") / 1000);
    expect(loader.frame).toHaveBeenCalledTimes(1);
    // 不再用 hour key 擋掉同小時內的動畫更新。
    harness.tick(Date.parse("2026-08-15T03:59:59Z") / 1000);
    expect(loader.frame).toHaveBeenCalledTimes(2);
    harness.tick(Date.parse("2026-08-15T04:00:00Z") / 1000);
    expect(loader.frame).toHaveBeenCalledTimes(3);
  });

  it("每次 false→true 載入成功只通知一次，style/rerender 不重複", async () => {
    loader.loadManifest.mockResolvedValue(makeManifest());
    loader.loadDay.mockResolvedValue({ tracks: [], displayDate: "2026-08-15" });
    loader.frame.mockReturnValue({ lines: EMPTY, endpoints: EMPTY });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    expect(notice.show).toHaveBeenCalledTimes(1);

    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, true, 0.8, 0.5, false);
    expect(notice.show).toHaveBeenCalledTimes(1);
    expect(loader.loadManifest).toHaveBeenCalledTimes(1);

    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, false, 0.8, 0.5, false);
    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, true, 0.8, 0.5, false);
    await Promise.resolve();
    expect(notice.show).toHaveBeenCalledTimes(2);
    expect(loader.loadManifest).toHaveBeenCalledTimes(2);
  });

  it("關層後 manifest async 才 resolve 不顯示通知", async () => {
    let resolveLoad!: (value: unknown) => void;
    loader.loadManifest.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    loader.loadDay.mockResolvedValue({ tracks: [], displayDate: "2026-08-15" });
    loader.frame.mockReturnValue({ lines: EMPTY, endpoints: EMPTY });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, false, 0.75, 0.5, true);
    resolveLoad(makeManifest());
    await Promise.resolve();
    await Promise.resolve();
    expect(notice.show).not.toHaveBeenCalled();
  });

  it("快速跨 UTC 日時舊 daily response 不會覆蓋新日期", async () => {
    let resolveDay16!: (value: unknown) => void;
    loader.loadManifest.mockResolvedValue(makeManifest());
    loader.loadDay.mockImplementation((_: unknown, date: string) => {
      if (date === "2026-08-16") return new Promise((resolve) => { resolveDay16 = resolve; });
      return Promise.resolve({ tracks: [], displayDate: date });
    });
    loader.frame.mockReturnValue({ lines: EMPTY, endpoints: EMPTY });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    clock.current = Date.parse("2026-08-16T00:00:00Z") / 1000;
    harness.tick(clock.current);
    clock.current = Date.parse("2026-08-17T00:00:00Z") / 1000;
    harness.tick(clock.current);
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.frame.mock.calls[loader.frame.mock.calls.length - 1]?.[0])
      .toMatchObject({ displayDate: "2026-08-17" });

    resolveDay16({ tracks: [], displayDate: "2026-08-16" });
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.frame.mock.calls[loader.frame.mock.calls.length - 1]?.[0])
      .toMatchObject({ displayDate: "2026-08-17" });
  });

  it("時間軸超出 manifest days 時清空且不 fallback 七日整包", async () => {
    loader.loadManifest.mockResolvedValue(makeManifest());
    loader.loadDay.mockResolvedValue({ tracks: [], displayDate: "2026-08-15" });
    loader.frame.mockReturnValue({ lines: EMPTY, endpoints: EMPTY });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const callsBefore = loader.loadDay.mock.calls.length;

    clock.current = Date.parse("2026-08-22T00:00:00Z") / 1000;
    harness.tick(clock.current);
    expect(loader.loadDay).toHaveBeenCalledTimes(callsBefore);
    const lineSource = state.sources.get("gfw-hourly-tracks-source");
    expect(lineSource?.setData).toHaveBeenLastCalledWith(EMPTY);
  });
});
