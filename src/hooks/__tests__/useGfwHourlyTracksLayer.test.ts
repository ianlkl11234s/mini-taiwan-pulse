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
  loadFrame: vi.fn(),
  frameTrail: vi.fn(),
}));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-08-15T03:20:00Z") / 1000 }));
const notice = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("react", () => ({ useRef: harness.useRef, useEffect: harness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/gfwHourlyTracksLoader", () => ({
  loadGfwHourlyTrackManifest: loader.loadManifest,
  loadGfwHourlyTracksDay: loader.loadDay,
  loadGfwHourlyTracksFrame: loader.loadFrame,
  gfwHourlyTracksFrame: loader.frame,
  gfwHourlyTrackFrameTrail: loader.frameTrail,
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

function makeV3Manifest(releaseId = "2026-08-21") {
  const v2 = makeManifest(releaseId);
  return {
    ...v2,
    releaseId,
    fullFidelity: true,
    days: new Map([...v2.days].map(([date, entry]) => [date, {
      ...entry,
      format: "pmtiles" as const,
      path: `releases/${releaseId}/tracks/days/${date}.pmtiles`,
    }])),
  };
}

function createMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const map = {
    isStyleLoaded: () => true,
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => { sources.set(id, { setData: vi.fn() }); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => { layers.set(layer.id, layer); },
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn((event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    }),
    off: vi.fn((event: string, listener: () => void) => listeners.get(event)?.delete(listener)),
    once: vi.fn(),
  } as unknown as MapboxMap;
  return {
    map,
    sources,
    layers,
    resetStyle: () => { sources.clear(); layers.clear(); },
    emit: (event: string) => { for (const listener of listeners.get(event) ?? []) listener(); },
  };
}

describe("useGfwHourlyTracksLayer timeline", () => {
  afterEach(() => {
    harness.reset();
    clock.current = Date.parse("2026-08-15T03:20:00Z") / 1000;
    loader.loadManifest.mockReset();
    loader.loadDay.mockReset();
    loader.frame.mockReset();
    loader.loadFrame.mockReset();
    loader.frameTrail.mockReset();
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

  it("v3 PMTiles archive 不掛 hidden 全日層；可見短尾只由 hourly frames 產生", async () => {
    const frame = {
      lines: {
        type: "FeatureCollection" as const,
        features: [{
          type: "Feature" as const,
          properties: { marker: "frame" },
          geometry: { type: "LineString" as const, coordinates: [[121, 25], [121.1, 25.1]] },
        }],
      },
      endpoints: EMPTY,
    };
    loader.loadManifest.mockResolvedValue(makeV3Manifest());
    loader.loadFrame.mockResolvedValue([]);
    loader.frameTrail.mockReturnValue(frame);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect([...state.sources.keys()]).not.toContain("gfw-hourly-tracks-pmtiles-edges-source");
    expect([...state.layers.keys()]).not.toContain("gfw-hourly-tracks-pmtiles-edges");
    expect(loader.loadFrame).toHaveBeenCalled();
    expect(loader.frameTrail).toHaveBeenCalled();
    expect(state.sources.get("gfw-hourly-tracks-source")?.setData).toHaveBeenLastCalledWith(frame.lines);
  });

  it("v3 style.load 後重建可見 frame sources/layers 並回填目前短尾", async () => {
    const frame = {
      lines: {
        type: "FeatureCollection" as const,
        features: [{
          type: "Feature" as const,
          properties: { marker: "runtime" },
          geometry: { type: "LineString" as const, coordinates: [[121, 25], [121.1, 25.1]] },
        }],
      },
      endpoints: EMPTY,
    };
    loader.loadManifest.mockResolvedValue(makeV3Manifest());
    loader.loadFrame.mockResolvedValue([]);
    loader.frameTrail.mockReturnValue(frame);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    state.resetStyle();
    state.emit("style.load");

    expect(state.layers.has("gfw-hourly-tracks-line")).toBe(true);
    expect(state.layers.has("gfw-hourly-tracks-endpoint")).toBe(true);
    expect(state.sources.get("gfw-hourly-tracks-source")?.setData).toHaveBeenLastCalledWith(frame.lines);
    expect(loader.loadDay).not.toHaveBeenCalled();
    expect(loader.loadFrame).toHaveBeenCalled();
  });

  it("重新開層取得新 release 時不重用舊 release 的 gzip frame promise", async () => {
    const oldManifest = makeV3Manifest("old-release");
    const newManifest = makeV3Manifest("new-release");
    const oldResolves: ((value: unknown) => void)[] = [];
    loader.loadManifest
      .mockResolvedValueOnce(oldManifest)
      .mockResolvedValueOnce(newManifest);
    loader.loadFrame.mockImplementation((manifest: { releaseId: string }) => {
      if (manifest.releaseId === "old-release") {
        return new Promise((resolve) => { oldResolves.push(resolve); });
      }
      return Promise.resolve([{ marker: "new-release" }]);
    });
    loader.frameTrail.mockImplementation((frames: ReadonlyMap<number, readonly { marker: string }[]>) => {
      const marker = [...frames.values()][0]?.[0]?.marker ?? "empty";
      return {
        lines: {
          type: "FeatureCollection" as const,
          features: [{
            type: "Feature" as const,
            properties: { marker },
            geometry: { type: "LineString" as const, coordinates: [[121, 25], [121.1, 25.1]] },
          }],
        },
        endpoints: EMPTY,
      };
    });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.loadFrame.mock.calls.some(([manifest]) => manifest === oldManifest)).toBe(true);

    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, false, 0.75, 0.5, true);
    harness.rerender();
    useGfwHourlyTracksLayer(mapRef, true, 0.75, 0.5, true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.loadFrame.mock.calls.some(([manifest]) => manifest === newManifest)).toBe(true);

    for (const resolve of oldResolves) resolve([{ marker: "old-release" }]);
    await Promise.resolve();
    await Promise.resolve();
    const lineSource = state.sources.get("gfw-hourly-tracks-source");
    const calls = lineSource?.setData.mock.calls ?? [];
    const finalData = calls[calls.length - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(finalData.features[0]?.properties?.marker).toBe("new-release");
  });
});
