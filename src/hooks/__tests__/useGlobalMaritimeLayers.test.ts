import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  let cursor = 0;
  return {
    reset: () => { cursor = 0; },
    useRef: <T,>(initial: T) => (refs[cursor++] ??= { current: initial }) as { current: T },
    useEffect: (effect: () => void | (() => void)) => { effect(); },
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
  };
});

vi.mock("react", () => ({
  useRef: reactHarness.useRef,
  useEffect: reactHarness.useEffect,
  useCallback: reactHarness.useCallback,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/globalMaritimeLoader", () => ({
  fetchAisstreamVessels: () => Promise.resolve([]),
  fetchGfwVesselPresence: () => Promise.resolve([]),
  aisstreamToGeoJSON: () => ({ type: "FeatureCollection", features: [] }),
  gfwToGeoJSON: () => ({ type: "FeatureCollection", features: [] }),
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useGlobalMaritimeLayers } from "../useGlobalMaritimeLayers";

function createMap(styleLoaded = true) {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const handlers = new Map<string, () => void>();
  const map = {
    isStyleLoaded: () => styleLoaded,
    getBounds: () => ({ getWest: () => 120, getEast: () => 125, getSouth: () => 20, getNorth: () => 28 }),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => { sources.set(id, { setData: vi.fn() }); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => { layers.set(layer.id, layer); },
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: (event: string, handler: () => void) => { handlers.set(event, handler); },
    off: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources, layers, handlers };
}

describe("useGlobalMaritimeLayers style lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    reactHarness.reset();
  });

  it("底圖 style.load 後重建兩個 source/layer", () => {
    vi.stubGlobal("window", { setInterval: () => 1, clearInterval: vi.fn() });
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useGlobalMaritimeLayers(mapRef, true, true);

    expect(state.sources.has("global-maritime-aisstream-current")).toBe(true);
    expect(state.sources.has("global-maritime-gfw-presence")).toBe(true);
    expect(state.layers.has("global-maritime-aisstream-circle")).toBe(true);
    expect(state.layers.has("global-maritime-gfw-circle")).toBe(true);

    state.sources.clear();
    state.layers.clear();
    state.handlers.get("style.load")?.();

    expect(state.sources.has("global-maritime-aisstream-current")).toBe(true);
    expect(state.sources.has("global-maritime-gfw-presence")).toBe(true);
    expect(state.layers.has("global-maritime-aisstream-circle")).toBe(true);
    expect(state.layers.has("global-maritime-gfw-circle")).toBe(true);
  });

  it("style busy 時 All Off 仍立即隱藏既有海事圖層", () => {
    vi.stubGlobal("window", { setInterval: () => 1, clearInterval: vi.fn() });
    const state = createMap(false);
    state.layers.set("global-maritime-aisstream-circle", {});
    state.layers.set("global-maritime-gfw-circle", {});
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    useGlobalMaritimeLayers(mapRef, false, false);

    expect(state.map.setLayoutProperty).toHaveBeenCalledWith(
      "global-maritime-aisstream-circle", "visibility", "none",
    );
    expect(state.map.setLayoutProperty).toHaveBeenCalledWith(
      "global-maritime-gfw-circle", "visibility", "none",
    );
  });
});
