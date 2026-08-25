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
    subscribe: (callback: (time: number) => void) => { timeCallback = callback; return vi.fn(); },
    tick: (time: number) => timeCallback?.(time),
  };
});

const loader = vi.hoisted(() => ({ manifest: vi.fn(), hour: vi.fn() }));
const notice = vi.hoisted(() => ({ show: vi.fn() }));
const clock = vi.hoisted(() => ({ current: Date.parse("2026-08-15T00:20:00Z") / 1000 }));

vi.mock("react", () => ({ useRef: harness.useRef, useEffect: harness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/gfwDarkVesselsLoader", () => ({
  loadGfwDarkVesselsManifest: loader.manifest,
  loadGfwDarkVesselsHour: loader.hour,
}));
vi.mock("../../data/gfwHourlyGridLoader", () => ({
  floorUtcHourIso: (time: number) => new Date(Math.floor(time / 3600) * 3_600_000)
    .toISOString().replace(".000Z", "Z"),
}));
vi.mock("../../components/TransientNotice", () => ({ showTransientNotice: notice.show }));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.current,
    subscribeThrottled: (_ms: number, callback: (time: number) => void) => harness.subscribe(callback),
  },
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useGfwDarkVesselsLayer } from "../useGfwDarkVesselsLayer";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const DATA_A: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [{ type: "Feature", geometry: { type: "Point", coordinates: [123, 24] }, properties: { detections: 1 } }],
};
const DATA_B: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [{ type: "Feature", geometry: { type: "Point", coordinates: [124, 25] }, properties: { detections: 2 } }],
};

function manifest(latestCompleteDate = "2026-08-21") {
  return { releaseId: latestCompleteDate, latestCompleteDate, hours: new Map() };
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
    setLayoutProperty: vi.fn(), setPaintProperty: vi.fn(),
    on: vi.fn(), off: vi.fn(), once: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources };
}

describe("useGfwDarkVesselsLayer", () => {
  afterEach(() => {
    harness.reset();
    clock.current = Date.parse("2026-08-15T00:20:00Z") / 1000;
    loader.manifest.mockReset(); loader.hour.mockReset(); notice.show.mockReset();
  });

  it("每次 false→true refresh manifest 並通知一次，rerender 不重複", async () => {
    loader.manifest.mockResolvedValue(manifest());
    loader.hour.mockResolvedValue(DATA_A);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGfwDarkVesselsLayer(mapRef, true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(loader.manifest).toHaveBeenCalledTimes(1);
    expect(notice.show).toHaveBeenCalledWith(
      "GFW SAR 未匹配 AIS 資料最新完整日：2026-08-21（UTC，非即時）",
    );

    harness.rerender();
    useGfwDarkVesselsLayer(mapRef, true, 0.7);
    expect(loader.manifest).toHaveBeenCalledTimes(1);
    expect(notice.show).toHaveBeenCalledTimes(1);

    harness.rerender(); useGfwDarkVesselsLayer(mapRef, false);
    harness.rerender(); useGfwDarkVesselsLayer(mapRef, true);
    await Promise.resolve(); await Promise.resolve();
    expect(loader.manifest).toHaveBeenCalledTimes(2);
    expect(notice.show).toHaveBeenCalledTimes(2);
  });

  it("關層後 manifest 才 resolve 不通知", async () => {
    let resolveManifest!: (value: unknown) => void;
    loader.manifest.mockReturnValue(new Promise((resolve) => { resolveManifest = resolve; }));
    loader.hour.mockResolvedValue(DATA_A);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwDarkVesselsLayer(mapRef, true);
    harness.rerender(); useGfwDarkVesselsLayer(mapRef, false);
    resolveManifest(manifest());
    await Promise.resolve(); await Promise.resolve();
    expect(notice.show).not.toHaveBeenCalled();
  });

  it("快速拖曳時舊 hour response 不會覆蓋新整點", async () => {
    let resolveOld!: (value: GeoJSON.FeatureCollection) => void;
    loader.manifest.mockResolvedValue(manifest());
    loader.hour.mockImplementation((_manifest: unknown, hour: string) => {
      if (hour === "2026-08-15T01:00:00Z") return new Promise((resolve) => { resolveOld = resolve; });
      return Promise.resolve(hour === "2026-08-15T02:00:00Z" ? DATA_B : DATA_A);
    });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwDarkVesselsLayer(mapRef, true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    harness.tick(Date.parse("2026-08-15T01:00:00Z") / 1000);
    harness.tick(Date.parse("2026-08-15T02:00:00Z") / 1000);
    await Promise.resolve(); await Promise.resolve();
    const source = state.sources.get("gfw-dark-vessels-source");
    expect(source?.setData).toHaveBeenLastCalledWith(DATA_B);

    resolveOld(DATA_A);
    await Promise.resolve(); await Promise.resolve();
    expect(source?.setData).toHaveBeenLastCalledWith(DATA_B);
  });

  it("無對應 hour 時清空，不 fallback 到其他時間", async () => {
    loader.manifest.mockResolvedValue(manifest());
    loader.hour.mockResolvedValueOnce(DATA_A).mockResolvedValueOnce(null);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGfwDarkVesselsLayer(mapRef, true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    harness.tick(Date.parse("2026-08-22T00:00:00Z") / 1000);
    await Promise.resolve(); await Promise.resolve();
    expect(state.sources.get("gfw-dark-vessels-source")?.setData).toHaveBeenLastCalledWith(EMPTY);
  });
});
