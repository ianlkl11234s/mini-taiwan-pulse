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
const notice = vi.hoisted(() => ({ show: vi.fn() }));
const detailContext = vi.hoisted(() => ({ set: vi.fn() }));

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
vi.mock("../../data/gfwHourlyDetailLoader", () => ({ setGfwHourlyGridDetailContext: detailContext.set }));

import { useGfwHourlyGridLayer } from "../useGfwHourlyGridLayer";

const FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
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
    removeLayer: (id: string) => { layers.delete(id); },
    removeSource: (id: string) => { sources.delete(id); },
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
    notice.show.mockReset();
    detailContext.set.mockReset();
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

  it("v4 0.1° Polygon 以 vessel_count 六級色階著色，且 base opacity 為 0.50", async () => {
    const hours = ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z"].map((observedAt, index) => ({
      observedAt, observedAtMs: Date.parse(observedAt), path: `grid/hours/${index}.pmtiles`,
      cellCount: 1, vesselCount: 1, format: "pmtiles" as const, detailBuckets: [],
    }));
    loader.loadManifest.mockResolvedValue({
      schemaVersion: 4, manifestUrl: "/gfw-v4-poc/manifest.json", sourceLayer: "gfw_grid_0_1", hours,
    });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwHourlyGridLayer(mapRef, true, 0.6);
    await flushAsync();

    const fill = state.layers.get("gfw-hourly-grid-pmtiles-fill") as { paint: Record<string, unknown> };
    expect(fill.paint["fill-color"]).toEqual([
      "step", ["to-number", ["get", "vessel_count"], 1], "#7c2d12",
      2, "#9a3412", 4, "#c2410c", 8, "#ea580c", 16, "#fb923c", 50, "#ffedd5",
    ]);
    // 00:20 的 H 權重為 40/60；0.50 × user opacity 0.60 × 2/3 = 0.20。
    expect(state.map.setPaintProperty).toHaveBeenCalledWith("gfw-hourly-grid-pmtiles-fill", "fill-opacity", 0.2);
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
