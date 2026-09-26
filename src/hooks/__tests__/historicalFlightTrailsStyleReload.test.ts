import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";
import type { HistoricalFlightCollection, HistoricalFlightManifest } from "../../data/historicalFlightTrailsTypes";
import { setMercatorEngine } from "../../utils/coordinates";

setMercatorEngine({
  fromLngLat: ([, lat], altitude = 0) => ({
    x: 0, y: lat / 180, z: altitude / 1_000_000,
    meterInMercatorCoordinateUnits: () => 1 / 1_000_000,
  }),
});

const reactHarness = vi.hoisted(() => {
  type EffectSlot = { deps?: readonly unknown[]; cleanup?: void | (() => void) };
  const states: unknown[] = [];
  const effects: EffectSlot[] = [];
  let stateCursor = 0;
  let effectCursor = 0;
  const depsChanged = (before?: readonly unknown[], after?: readonly unknown[]) =>
    !before || !after || before.length !== after.length || before.some((value, index) => !Object.is(value, after[index]));

  return {
    beginRender() { stateCursor = 0; effectCursor = 0; },
    useState<T>(initial: T) {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index] as T, (value: T | ((current: T) => T)) => {
        states[index] = typeof value === "function"
          ? (value as (current: T) => T)(states[index] as T)
          : value;
      }] as const;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = effectCursor++;
      const previous = effects[index];
      if (previous && !depsChanged(previous.deps, deps)) return;
      previous?.cleanup?.();
      effects[index] = { deps, cleanup: effect() };
    },
    cleanup() {
      for (const effect of effects) effect.cleanup?.();
      states.length = 0;
      effects.length = 0;
      stateCursor = 0;
      effectCursor = 0;
    },
  };
});

const loader = vi.hoisted(() => ({ manifest: vi.fn(), asset: vi.fn() }));
const status = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("react", () => ({ useEffect: reactHarness.useEffect, useState: reactHarness.useState }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/historicalFlightTrailsLoader", () => ({
  fetchHistoricalFlightManifest: loader.manifest,
  fetchHistoricalFlightAsset: loader.asset,
}));
vi.mock("../../state/historicalFlightTrailsStore", () => ({
  setHistoricalFlightStatus: status.set,
  useHistoricalFlightRetryRevision: () => 0,
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useHistoricalFlightTrailsLayer } from "../useHistoricalFlightTrailsLayer";

const lineId = "historical-flight-trails-tw-3d";
const asset = { path: "releases/r1/tw_RCTP_2026-03-10.geojson", bytes: 3, sha256: "a".repeat(64) };
const collection = {
  type: "FeatureCollection",
  meta: { country: "TW", airport: "RCTP", date: "2026-03-10", timezone: "Asia/Taipei", coverage: "partial", note: "observed" },
  features: [{
    type: "Feature",
    geometry: { type: "MultiLineString", coordinates: [[[121, 25, 100], [121.00001, 25.00001, 101]]] },
    properties: { flight_id: "f1", roles: ["arrival"], route_scope: "cross_border" },
  }],
} as unknown as HistoricalFlightCollection;
const manifest = {
  samples: [{ country: "TW", airport: "RCTP", date: "2026-03-10", asset, flight_count: 1 }],
} as unknown as HistoricalFlightManifest;

function createMap(initialStyleLoaded = true) {
  let styleLoaded = initialStyleLoaded;
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const handlers = new Map<string, Set<() => void>>();
  const addSource = vi.fn((id: string) => { sources.set(id, { setData: vi.fn() }); });
  const addLayer = vi.fn((layer: { id: string }) => { layers.set(layer.id, layer); });
  const layoutProperties = new Map<string, unknown>();
  const setLayoutProperty = vi.fn((id: string, name: string, value: unknown) => {
    layoutProperties.set(`${id}:${name}`, value);
  });
  const setPaintProperty = vi.fn();
  const setFilter = vi.fn();
  const map = {
    triggerRepaint: vi.fn(),
    getStyle: () => ({}),
    isStyleLoaded: () => styleLoaded,
    getSource: (id: string) => sources.get(id),
    addSource,
    getLayer: (id: string) => layers.get(id),
    addLayer,
    removeSource: (id: string) => { sources.delete(id); },
    removeLayer: (id: string) => { layers.delete(id); },
    getLayoutProperty: (id: string, name: string) => layoutProperties.get(`${id}:${name}`),
    setLayoutProperty,
    setPaintProperty,
    setFilter,
    on: (event: string, handler: () => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    off: (event: string, handler: () => void) => { handlers.get(event)?.delete(handler); },
  } as unknown as MapboxMap;
  return {
    map, sources, layers, addSource, addLayer, setLayoutProperty, setPaintProperty, setFilter,
    setStyleLoaded: (value: boolean) => { styleLoaded = value; },
    emit: (event: string) => handlers.get(event)?.forEach((handler) => handler()),
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useHistoricalFlightTrailsLayer style diff recovery", () => {
  afterEach(() => {
    reactHarness.cleanup();
    vi.clearAllMocks();
  });

  it("styledata restores missing layers or source from loaded data without another fetch", async () => {
    loader.manifest.mockResolvedValue(manifest);
    loader.asset.mockResolvedValue(collection);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    const render = () => {
      reactHarness.beginRender();
      useHistoricalFlightTrailsLayer(mapRef, true, "TW", {
        airport: "RCTP", date: "2026-03-10", opacity: 0.8, width: 1.5, direction: "arrival", routeScope: "cross_border",
      });
    };

    render();
    await flush();
    render();
    expect(state.layers.has(lineId)).toBe(true);
    expect(loader.asset).toHaveBeenCalledTimes(1);
    state.layers.clear();
    state.addLayer.mockClear();
    state.emit("styledata");
    expect(state.layers.has(lineId)).toBe(true);
    expect(state.addLayer).toHaveBeenCalledTimes(1);
    expect(loader.manifest).toHaveBeenCalledTimes(1);
    expect(loader.asset).toHaveBeenCalledTimes(1);

  });

  it("All Off immediately hides an existing custom layer while the style is busy", async () => {
    loader.manifest.mockResolvedValue(manifest);
    loader.asset.mockResolvedValue(collection);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    const render = (visible: boolean) => {
      reactHarness.beginRender();
      useHistoricalFlightTrailsLayer(mapRef, visible, "TW", {
        airport: "RCTP", date: "2026-03-10", opacity: 0.8, width: 1.5, direction: "arrival", routeScope: "cross_border",
      });
    };

    render(true);
    await flush();
    render(true);
    expect(state.layers.has(lineId)).toBe(true);

    state.setStyleLoaded(false);
    render(false);
    expect(state.setLayoutProperty).toHaveBeenCalledWith(lineId, "visibility", "none");
    expect(state.layers.has(lineId)).toBe(true);

    state.setStyleLoaded(true);
    state.emit("idle");
    expect(state.layers.has(lineId)).toBe(false);
  });

  it("restores a hidden custom layer when re-enabled after the style becomes idle", async () => {
    loader.manifest.mockResolvedValue(manifest);
    loader.asset.mockResolvedValue(collection);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    const render = (visible: boolean) => {
      reactHarness.beginRender();
      useHistoricalFlightTrailsLayer(mapRef, visible, "TW", {
        airport: "RCTP", date: "2026-03-10", opacity: 0.8, width: 1.5, direction: "arrival", routeScope: "cross_border",
      });
    };

    render(true);
    await flush();
    render(true);
    state.setStyleLoaded(false);
    render(false);
    render(true);
    expect(state.setLayoutProperty).not.toHaveBeenLastCalledWith(lineId, "visibility", "visible");

    state.setStyleLoaded(true);
    state.emit("idle");
    expect(state.setLayoutProperty).toHaveBeenLastCalledWith(lineId, "visibility", "visible");
    expect(state.layers.has(lineId)).toBe(true);
  });
});
