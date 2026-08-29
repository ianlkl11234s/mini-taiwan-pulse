import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const notice = vi.hoisted(() => ({ show: vi.fn() }));
const detailContext = vi.hoisted(() => ({ set: vi.fn(), setDominantHour: vi.fn() }));

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
    subscribe: (cb: (time: number) => void) => {
      harness.setTimeCallback(cb);
      return vi.fn();
    },
  },
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../components/TransientNotice", () => ({ showTransientNotice: notice.show }));
vi.mock("../../map/pmtilesSourceType", () => ({ registerPmtilesSourceTypeOnce: vi.fn() }));
vi.mock("../../map/gfwPmtilesSourceType", () => ({
  GFW_PMTILES_SOURCE_TYPE: "gfw-pmtile-source",
  registerGfwPmtilesSourceTypeOnce: vi.fn(),
}));
vi.mock("../../data/gfwHourlyDetailLoader", () => ({
  setGfwHourlyGridDetailContext: detailContext.set,
  setGfwHourlyGridDominantHour: detailContext.setDominantHour,
}));

import {
  getGfwHourlyGridDataWindowSnapshot,
  getGfwHourlyGridDominantHitLayerId,
  isGfwHourlyGridDominantHitLayer,
  useGfwHourlyGridLayer,
} from "../useGfwHourlyGridLayer";

const FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const VESSEL_COUNT = ["to-number", ["get", "vessel_count"], 1];
const DENSITY_ALPHA = [
  "interpolate", ["linear"], VESSEL_COUNT,
  1, 0.28, 2, 0.34, 4, 0.40, 8, 0.47, 16, 0.54, 50, 0.62, 200, 0.68, 1161, 0.72,
];
/** 六級色階拆成數值通道後併進 rgba；alpha 由 vessel_count 密度提供。 */
const FILL_COLOR_WITH_DENSITY = [
  "rgba",
  ["step", VESSEL_COUNT, 124, 2, 154, 4, 194, 8, 234, 16, 251, 50, 255],
  ["step", VESSEL_COUNT, 45, 2, 52, 4, 65, 8, 88, 16, 146, 50, 237],
  ["step", VESSEL_COUNT, 18, 2, 18, 4, 12, 8, 12, 16, 60, 50, 213],
  DENSITY_ALPHA,
];
const OUTLINE_COLOR_WITH_DENSITY = ["rgba", 124, 45, 18, DENSITY_ALPHA];

type PaintCall = [string, string, unknown];

function paintCalls(map: MapboxMap): PaintCall[] {
  return (map.setPaintProperty as unknown as { mock: { calls: PaintCall[] } }).mock.calls;
}

/** 最後一次對某 layer/property 的 paint 寫入值。 */
function lastPaint(map: MapboxMap, layerId: string, property: string): unknown {
  const matched = paintCalls(map).filter((call) => call[0] === layerId && call[1] === property);
  return matched.length === 0 ? undefined : matched[matched.length - 1]![2];
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function createMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn>; definition?: unknown }>();
  const layers = new Map<string, unknown>();
  const listeners = new Map<string, Set<(event: { sourceId?: string; tile?: unknown; sourceDataType?: string }) => void>>();
  const sourceReady = new Set<string>();
  const addSource = vi.fn((id: string, definition: unknown) => { sources.set(id, { setData: vi.fn(), definition }); });
  const on = vi.fn((event: string, callback: (value: { sourceId?: string; tile?: unknown; sourceDataType?: string }) => void) => {
    (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(callback);
  });
  const off = vi.fn((event: string, callback: (value: { sourceId?: string; tile?: unknown; sourceDataType?: string }) => void) => listeners.get(event)?.delete(callback));
  const map = {
    isStyleLoaded: () => true,
    isSourceLoaded: (id: string) => sourceReady.has(id),
    getSource: (id: string) => sources.get(id),
    addSource,
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => { layers.set(layer.id, layer); },
    removeLayer: (id: string) => { layers.delete(id); },
    removeSource: vi.fn((id: string) => { sources.delete(id); }),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on,
    off,
    once: vi.fn(),
  } as unknown as MapboxMap;
  return {
    map, sources, layers, addSource,
    emit: (event: string, value: { sourceId?: string; tile?: unknown; sourceDataType?: string } = {}) => {
      for (const callback of listeners.get(event) ?? []) callback(value);
    },
    clearStyle: () => {
      sources.clear();
      layers.clear();
      sourceReady.clear();
    },
    /** mapbox 的 tile 載入事件帶 `tile`；source-level metadata/content 事件不帶。 */
    ready: (sourceId: string) => {
      sourceReady.add(sourceId);
      for (const callback of listeners.get("sourcedata") ?? []) callback({ sourceId, tile: { uid: 1 } });
    },
    /** addSource 之後、任何 tile 送出之前的 metadata/content 事件（isSourceLoaded 已是 true）。 */
    announceMetadata: (sourceId: string) => {
      sourceReady.add(sourceId);
      for (const callback of listeners.get("sourcedata") ?? []) callback({ sourceId, sourceDataType: "metadata" });
    },
    /** 讓已 ready 的 slot 進入 reload（isSourceLoaded 轉 false，但既有 tile 仍在畫）。 */
    beginReload: (sourceId: string) => { sourceReady.delete(sourceId); },
  };
}

describe("useGfwHourlyGridLayer timeline", () => {
  // hit layer 的 visibility 節流用 setTimeout + Date.now，需要可控時鐘。
  beforeEach(() => { vi.useFakeTimers(); });

  afterEach(() => {
    harness.reset();
    vi.useRealTimers();
    clock.current = Date.parse("2026-08-15T00:20:00Z") / 1000;
    loader.loadManifest.mockReset();
    loader.loadHour.mockReset();
    notice.show.mockReset();
    detailContext.set.mockReset();
    detailContext.setDominantHour.mockReset();
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

  it("首次開啟只通知一次最新完整日與非即時語意", async () => {
    loader.loadManifest.mockResolvedValue({ hours: [], dateEndInclusive: "2026-08-15" });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    expect(notice.show).toHaveBeenCalledWith("GFW 小時網格資料最新完整日：2026-08-15（UTC，非即時）");
    harness.rerender(); useGfwHourlyGridLayer(mapRef, true, 0.8);
    expect(notice.show).toHaveBeenCalledTimes(1);
  });

  it("opacity rerender 會重新綁定已載入 release 的 grid detail context", async () => {
    const manifest = { hours: [], dateEndInclusive: "2026-08-15" };
    loader.loadManifest.mockResolvedValue(manifest);
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    expect(detailContext.set).toHaveBeenLastCalledWith(manifest);

    harness.rerender(); useGfwHourlyGridLayer(mapRef, true, 0.8);
    expect(detailContext.set).toHaveBeenLastCalledWith(manifest);
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
    await flushAsync();

    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    harness.tick(Date.parse("2026-08-15T02:00:00Z") / 1000);
    await flushAsync();
    const source = state.sources.get("gfw-hourly-grid-source");
    expect(source?.setData).toHaveBeenLastCalledWith(data2);

    resolveHour1(data1);
    await flushAsync();
    expect(source?.setData).toHaveBeenLastCalledWith(data2);
  });

  it("預載 H/H+1，同一 UTC 小時不重抓，跨整點只補下一個 hour file", async () => {
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await Promise.resolve();
    await Promise.resolve();

    expect(state.layers.has("gfw-hourly-grid-circle")).toBe(true);
    expect(state.layers.has("gfw-hourly-grid-count")).toBe(true);
    expect(loader.loadHour).toHaveBeenCalledTimes(2);
    expect(loader.loadHour.mock.calls[0]?.[1]).toBe("2026-08-15T00:00:00Z");
    expect(loader.loadHour.mock.calls[1]?.[1]).toBe("2026-08-15T01:00:00Z");

    harness.tick(Date.parse("2026-08-15T00:59:59Z") / 1000);
    await Promise.resolve();
    expect(loader.loadHour).toHaveBeenCalledTimes(2);

    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(loader.loadHour).toHaveBeenCalledTimes(3);
    expect(loader.loadHour.mock.calls[2]?.[1]).toBe("2026-08-15T02:00:00Z");
  });

  it("H+1 成功才 crossfade，H+1 失敗時 H 保持 100%", async () => {
    const current: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockImplementation((_manifest: unknown, hour: string) =>
      Promise.resolve(hour === "2026-08-15T00:00:00Z" ? current : null),
    );
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();

    // 初始時刻 00:20，next missing；current opacity 不能被 1 - 20/60 壓暗。
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-circle", "circle-opacity", 0.6);
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-next-circle", "circle-opacity", 0);
  });

  it("v4 六級色階與密度併進 rgba color，每 tick 只送純數字 opacity", async () => {
    const hours = ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z", "2026-08-15T02:00:00Z"].map((observedAt) => ({
      observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`,
      cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [],
    }));
    loader.loadManifest.mockResolvedValue({
      schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours,
      dateStart: "2026-08-15", dateEndInclusive: "2026-08-15",
    });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();

    const fill = state.layers.get("gfw-hourly-grid-pmtiles-fill") as { paint: Record<string, unknown> };
    expect(fill.paint["fill-color"]).toEqual(FILL_COLOR_WITH_DENSITY);
    // 每 tick 的 opacity 一定要是常數，否則 mapbox-gl 會 requiresRelayout 重刷整個 source。
    expect(fill.paint["fill-opacity"]).toBe(0);
    expect(fill.paint["fill-opacity-transition"]).toEqual({ duration: 0, delay: 0 });
    const outline = state.layers.get("gfw-hourly-grid-pmtiles-outline") as { paint: Record<string, unknown> };
    expect(outline.paint["line-color"]).toEqual(OUTLINE_COLOR_WITH_DENSITY);
    expect(outline.paint["line-opacity-transition"]).toEqual({ duration: 0, delay: 0 });

    state.ready("gfw-hourly-grid-pmtiles-source");
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();
    // 逐 tick 的 PMTiles opacity 寫入一律是純數字（含 data-driven 就會 requiresRelayout）。
    const perTickCalls = paintCalls(state.map).filter((call) => call[0].startsWith("gfw-hourly-grid-pmtiles-"));
    expect(perTickCalls.length).toBeGreaterThan(0);
    expect(perTickCalls.every((call) => typeof call[2] === "number")).toBe(true);
    expect(perTickCalls.every((call) => call[1] === "fill-opacity" || call[1] === "line-opacity")).toBe(true);
    // 00:20 → progress 1/3；H 權重 2/3、H+1 權重 1/3，乘上使用者 opacity 0.6。
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-fill", "fill-opacity", 0.4);
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-outline", "line-opacity", 0.26);
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBeCloseTo(0.2);

    expect(getGfwHourlyGridDataWindowSnapshot()).toEqual({
      status: "in-window",
      startIso: "2026-08-15T00:00:00Z",
      endIsoExclusive: "2026-08-15T03:00:00Z",
      utcDateLabel: "2026-08-15",
    });

    expect(state.sources.has("gfw-hourly-grid-pmtiles-hit-source")).toBe(false);
    expect((state.layers.get("gfw-hourly-grid-pmtiles-hit-fill") as { source?: string }).source)
      .toBe("gfw-hourly-grid-pmtiles-source");
    expect((state.layers.get("gfw-hourly-grid-pmtiles-next-hit-fill") as { source?: string }).source)
      .toBe("gfw-hourly-grid-pmtiles-next-source");
    harness.tick(Date.parse("2026-08-15T00:40:00Z") / 1000);
    expect(detailContext.setDominantHour).toHaveBeenLastCalledWith("2026-08-15T01:00:00Z");
    // dominant 換手只更新查詢期的選擇器；hit layer 恆 visible（翻 visibility 會 reload 共用 source）。
    expect(getGfwHourlyGridDominantHitLayerId()).toBe("gfw-hourly-grid-pmtiles-next-hit-fill");
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-next-hit-fill")).toBe(true);
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-hit-fill")).toBe(false);
  });

  it("v4 H+1 尚未 first-ready 時 H 維持全亮", async () => {
    const hours = ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z"].map((observedAt) => ({
      observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [],
    }));
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    state.ready("gfw-hourly-grid-pmtiles-source");
    await flushAsync();
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-fill", "fill-opacity", 0.6);
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-next-fill", "fill-opacity", 0);
  });

  it("v4 播放超車：current 尚未 ready 時保留上一個 ready 小時，slot 不被回收", async () => {
    const hours = [0, 1, 2, 3].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    // 只有 H 供出了第一批 tile；H+1 還在載入。
    state.ready("gfw-hourly-grid-pmtiles-source");
    await flushAsync();
    const h0Source = state.sources.get("gfw-hourly-grid-pmtiles-source");

    clock.current = Date.parse("2026-08-15T01:00:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    // H 的 slot 沒被拿去掛 H+3，畫面仍由 H 撐著（不是空白）。
    expect(state.sources.get("gfw-hourly-grid-pmtiles-source")).toBe(h0Source);
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-fill", "fill-opacity")).toBe(0.6);
    expect(detailContext.setDominantHour).toHaveBeenLastCalledWith("2026-08-15T00:00:00Z");

    // H+1 一旦 ready，hold 解除、被跳過的 H+3 預載補掛上來。
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();
    expect(state.sources.get("gfw-hourly-grid-pmtiles-source")?.definition).toMatchObject({
      url: "http://localhost/gfw-v4-poc/grid/hours/20260815T03Z.pmtiles",
    });
  });

  it("v4 剛掛上的 slot 只收到 metadata 事件時不算 ready，crossfade 不得爬到空 source 上", async () => {
    // 量測到的空白（1182ms / 3558ms）：slot ld=0、n=0，opacity 卻已到 0.8。
    // 成因是 SourceCache.loaded() 在「還沒送出任何 tile 請求」時就回 true。
    const hours = [0, 1, 2, 3].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    state.ready("gfw-hourly-grid-pmtiles-source");
    await flushAsync();

    // H+1 只宣告 metadata（archive header 讀完），一塊 tile 都還沒回來。
    state.announceMetadata("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();
    clock.current = Date.parse("2026-08-15T00:30:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    // 半小時處若誤判 ready 會是 0.3/0.3 的 crossfade；正確行為是 H 全亮、H+1 不吃權重。
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-fill", "fill-opacity")).toBe(0.6);
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBe(0);

    // 真的有 tile 回來之後才開始 crossfade。
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBeCloseTo(0.3, 6);
  });

  it("v4 crossfade 目標進入 reload 時停止淡入，畫面交回仍 renderable 的 slot", async () => {
    const hours = [0, 1, 2, 3].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    state.ready("gfw-hourly-grid-pmtiles-source");
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();

    // 小時中段：H 與 H+1 正在 crossfade，H+1 已吃到大部分權重。
    clock.current = Date.parse("2026-08-15T00:50:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBeCloseTo(0.5, 6);

    // H+1 的 source 開始 reload（hit layer visibility 翻面就會造成）：
    // 淡入必須停住並把權重交回仍 renderable 的 H，而不是亮在重新 parse 中的 source 上。
    state.beginReload("gfw-hourly-grid-pmtiles-next-source");
    clock.current += 1;
    harness.tick(clock.current);
    await flushAsync();
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-fill", "fill-opacity")).toBe(0.6);
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBe(0);
  });

  it("v4 點擊選擇走查詢期述詞：只有 dominant 小時的 hit layer 可回答，且 hit layer 恆 visible", async () => {
    const hours = [0, 1, 2].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({
      schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours,
      dateStart: "2026-08-15", dateEndInclusive: "2026-08-15",
    });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    state.ready("gfw-hourly-grid-pmtiles-source");
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();

    // 三個 hit layer 都恆 visible —— 翻 visibility 會 reload 與視覺層共用的 source。
    for (const id of [
      "gfw-hourly-grid-pmtiles-hit-fill",
      "gfw-hourly-grid-pmtiles-next-hit-fill",
      "gfw-hourly-grid-pmtiles-preload-hit-fill",
    ]) {
      expect((state.layers.get(id) as { layout?: { visibility?: string } }).layout?.visibility).toBe("visible");
    }

    expect(getGfwHourlyGridDominantHitLayerId()).toBe("gfw-hourly-grid-pmtiles-hit-fill");
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-next-hit-fill")).toBe(false);
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-preload-hit-fill")).toBe(false);

    clock.current = Date.parse("2026-08-15T00:40:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    expect(getGfwHourlyGridDominantHitLayerId()).toBe("gfw-hourly-grid-pmtiles-next-hit-fill");
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-hit-fill")).toBe(false);

    // 完全淡出資料窗後沒有 dominant，任何 hit layer 都不得回答點擊。
    clock.current = Date.parse("2026-08-15T04:00:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    expect(getGfwHourlyGridDominantHitLayerId()).toBeNull();
    for (const id of [
      "gfw-hourly-grid-pmtiles-hit-fill",
      "gfw-hourly-grid-pmtiles-next-hit-fill",
      "gfw-hourly-grid-pmtiles-preload-hit-fill",
    ]) expect(isGfwHourlyGridDominantHitLayer(id)).toBe(false);
  });

  it("v3 沒有 dominant 選擇機制時，述詞放行既有的單一 hit layer", async () => {
    loader.loadManifest.mockResolvedValue({ schemaVersion: 3, hours: [] });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    expect(getGfwHourlyGridDominantHitLayerId()).toBeNull();
    // v3 重用同一個 layer id 當唯一 hit layer；濾掉它等於整個 popup 失效。
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-pmtiles-hit-fill")).toBe(true);
    expect(isGfwHourlyGridDominantHitLayer("gfw-hourly-grid-hit-fill")).toBe(true);
  });

  it("v4 時間軸離開 release 資料窗時淡出並標示窗外，不 teardown source", async () => {
    const hours = [0, 1].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({
      schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours,
      dateStart: "2026-08-15", dateEndInclusive: "2026-08-15",
    });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    state.ready("gfw-hourly-grid-pmtiles-source");
    state.ready("gfw-hourly-grid-pmtiles-next-source");
    await flushAsync();
    const removedBefore = (state.map.removeSource as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;

    // 資料窗是 [00:00, 02:00)；跳到 02:07:30 = 窗外半個 fade。
    harness.tick(Date.parse("2026-08-15T02:07:30Z") / 1000);
    await flushAsync();
    expect(getGfwHourlyGridDataWindowSnapshot()).toMatchObject({
      status: "out-of-window", utcDateLabel: "2026-08-15",
    });
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBeCloseTo(0.3, 6);
    // 淡出是 layer-local 的 paint 行為，source 一律留著。
    expect((state.map.removeSource as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(removedBefore);
    expect(state.sources.has("gfw-hourly-grid-pmtiles-next-source")).toBe(true);

    harness.tick(Date.parse("2026-08-15T02:20:00Z") / 1000);
    await flushAsync();
    expect(lastPaint(state.map, "gfw-hourly-grid-pmtiles-next-fill", "fill-opacity")).toBe(0);
  });

  it("v4 fill/outline/hit 關閉後全隱藏，重開與 style reload 都會復原", async () => {
    const hours = [0, 1, 2].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    const v4LayerIds = [
      "gfw-hourly-grid-pmtiles-fill", "gfw-hourly-grid-pmtiles-outline",
      "gfw-hourly-grid-pmtiles-next-fill", "gfw-hourly-grid-pmtiles-next-outline",
      "gfw-hourly-grid-pmtiles-preload-fill", "gfw-hourly-grid-pmtiles-preload-outline",
      "gfw-hourly-grid-pmtiles-hit-fill", "gfw-hourly-grid-pmtiles-next-hit-fill",
      "gfw-hourly-grid-pmtiles-preload-hit-fill",
    ];

    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    expect(v4LayerIds.every((id) => state.layers.has(id))).toBe(true);

    harness.rerender(); useGfwHourlyGridLayer(mapRef, false, 0.6);
    for (const id of v4LayerIds) {
      expect(state.map.setLayoutProperty).toHaveBeenCalledWith(id, "visibility", "none");
    }

    harness.rerender(); useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    expect(v4LayerIds.every((id) => state.layers.has(id))).toBe(true);

    state.clearStyle();
    state.emit("style.load");
    await flushAsync();
    expect(v4LayerIds.every((id) => state.layers.has(id))).toBe(true);
  });

  it("v4 初始 mounted H/H+1/H+2，fractional drag 同一 UTC 小時只 repaint、不重建 source", async () => {
    const hours = [0, 1, 2, 3].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    const h1 = state.sources.get("gfw-hourly-grid-pmtiles-next-source");
    const h2 = state.sources.get("gfw-hourly-grid-pmtiles-preload-source");
    expect(state.sources.has("gfw-hourly-grid-pmtiles-source")).toBe(true);
    expect(h1).toBeTruthy();
    expect(h2).toBeTruthy();
    expect(state.map.setPaintProperty).toHaveBeenCalledWith(
      "gfw-hourly-grid-pmtiles-preload-fill", "fill-opacity", 0,
    );
    expect(state.layers.get("gfw-hourly-grid-pmtiles-next-warm")).toMatchObject({
      source: "gfw-hourly-grid-pmtiles-next-source",
      filter: ["==", ["get", "cell_id"], "__gfw_v4_preload_never__"],
    });
    const h0 = state.sources.get("gfw-hourly-grid-pmtiles-source");
    const mounted = state.addSource.mock.calls.length;
    const removed = (state.map.removeSource as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    // Seek events carry fractional seconds. Neither half-hour nor the last second of
    // the same UTC hour may replace immutable PMTiles sources (and reissue Range).
    harness.tick(Date.parse("2026-08-15T00:30:00.250Z") / 1000);
    harness.tick(Date.parse("2026-08-15T00:59:59.750Z") / 1000);
    expect(state.addSource).toHaveBeenCalledTimes(mounted);
    expect((state.map.removeSource as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(removed);
    expect(state.sources.get("gfw-hourly-grid-pmtiles-source")).toBe(h0);
    expect(state.sources.get("gfw-hourly-grid-pmtiles-next-source")).toBe(h1);
    expect(state.sources.get("gfw-hourly-grid-pmtiles-preload-source")).toBe(h2);
    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    await flushAsync();
    expect(state.sources.get("gfw-hourly-grid-pmtiles-next-source")).toBe(h1);
    expect(state.sources.get("gfw-hourly-grid-pmtiles-preload-source")).toBe(h2);
    expect(state.sources.get("gfw-hourly-grid-pmtiles-source")?.definition).toMatchObject({
      type: "gfw-pmtile-source",
      url: "http://localhost/gfw-v4-poc/grid/hours/20260815T03Z.pmtiles",
    });
  });

  it("v4 缺少 H+2 時維持 H/H+1，且邊界 rollover 不壓暗可用 H", async () => {
    const hours = [0, 1].map((offset) => {
      const observedAt = `2026-08-15T0${offset}:00:00Z`;
      return { observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z.pmtiles`, cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [] };
    });
    loader.loadManifest.mockResolvedValue({ schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours });
    const state = createMap();
    useGfwHourlyGridLayer({ current: state.map } as RefObject<MapboxMap | null>, true, 0.6);
    await flushAsync();
    expect(state.sources.has("gfw-hourly-grid-pmtiles-preload-source")).toBe(false);
    state.ready("gfw-hourly-grid-pmtiles-source"); state.ready("gfw-hourly-grid-pmtiles-next-source");
    clock.current = Date.parse("2026-08-15T01:00:00Z") / 1000;
    harness.tick(clock.current);
    await flushAsync();
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-next-fill", "fill-opacity", 0.6);
  });

  it("v3 維持固定橘色及 0.24 Polygon opacity", async () => {
    loader.loadManifest.mockResolvedValue({ schemaVersion: 3, hours: [] });
    loader.loadHour.mockResolvedValue(FC);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();

    const fill = state.layers.get("gfw-hourly-grid-fill") as { paint: Record<string, unknown> };
    expect(fill.paint).toMatchObject({ "fill-color": "#fb923c", "fill-opacity": 0.24 });
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-fill", "fill-opacity", 0.096);
  });

  it("click hit source 隨 alpha dominant 切換，透明的 H+1 不會提早搶 popup", async () => {
    const current: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [123, 24] }, properties: { observed_at: "H" } }] };
    const next: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [124, 25] }, properties: { observed_at: "H+1" } }] };
    loader.loadManifest.mockResolvedValue({ hours: [] });
    loader.loadHour.mockImplementation((_manifest: unknown, hour: string) => Promise.resolve(hour === "2026-08-15T00:00:00Z" ? current : next));
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    const hit = state.sources.get("gfw-hourly-grid-hit-source");
    const initialHit = hit?.setData.mock.calls[(hit?.setData.mock.calls.length ?? 1) - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(initialHit.features[0]?.properties)
      .toMatchObject({ observed_at: "H", dominant_observed_at: "2026-08-15T00:00:00Z" });

    harness.tick(Date.parse("2026-08-15T00:40:00Z") / 1000);
    const laterHit = hit?.setData.mock.calls[(hit?.setData.mock.calls.length ?? 1) - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(laterHit.features[0]?.properties)
      .toMatchObject({ observed_at: "H+1", dominant_observed_at: "2026-08-15T01:00:00Z" });
  });

  it("v3 PMTiles H/H+1 以兩個 native source crossfade，不退回日 GeoJSON", async () => {
    const hours = ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z"].map((observedAt, index) => ({
      observedAt, observedAtMs: Date.parse(observedAt), path: `releases/2026-08-15/grid/hours/${index}.pmtiles`,
      cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [],
    }));
    loader.loadManifest.mockResolvedValue({ manifestUrl: "https://cdn.example/global-maritime/gfw-hourly/v3-shadow/manifest.json", sourceLayer: "gfw_grid", hours });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();
    expect(state.sources.has("gfw-hourly-grid-pmtiles-source")).toBe(true);
    expect(state.sources.has("gfw-hourly-grid-pmtiles-next-source")).toBe(true);
    expect(state.layers.has("gfw-hourly-grid-pmtiles-fill")).toBe(true);
    expect(state.layers.has("gfw-hourly-grid-pmtiles-hit-fill")).toBe(true);
    expect(state.layers.has("gfw-hourly-grid-pmtiles-count")).toBe(false);
    expect(state.layers.has("gfw-hourly-grid-pmtiles-next-count")).toBe(false);
    expect(state.map.setPaintProperty).not.toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-count", "text-opacity", expect.anything());
    expect(loader.loadHour).not.toHaveBeenCalled();
  });
});
