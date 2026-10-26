import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  const cleanups: Array<(() => void) | undefined> = [];
  return {
    useEffect(effect: () => void | (() => void)) { cleanups.push(effect() ?? undefined); },
    useRef<T>(initial: T) { return { current: initial }; },
    cleanup() { cleanups.splice(0).forEach((cleanup) => cleanup?.()); },
  };
});
const lazy = vi.hoisted(() => ({
  mountLazyCustomLayer: vi.fn(),
  removeLazyCustomLayer: vi.fn(),
}));

vi.mock("react", () => ({ useEffect: reactHarness.useEffect, useRef: reactHarness.useRef }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../map/lazyThreeLayers", () => ({
  BUILDINGS_NIGHT_BLOOM_LAYER_ID: "bloom",
  buildingsNightBloomModule: {},
  POWER_GENERATION_BEAM_LAYER_ID: "beam",
  powerGenerationBeamModule: {},
  mountLazyCustomLayer: lazy.mountLazyCustomLayer,
  removeLazyCustomLayer: lazy.removeLazyCustomLayer,
}));
vi.mock("../../data/energyLoader", () => ({
  fetchPowerGeneration24h: vi.fn(() => new Promise(() => {})),
  invalidatePowerGeneration24h: vi.fn(),
  resolvePowerGenerationAt: vi.fn(() => []),
  fuelColorOf: vi.fn(),
  radiusForCapacity: vi.fn(),
}));
vi.mock("../../state/timeStore", () => ({
  timeStore: { getTime: () => 0, subscribeThrottled: () => () => {} },
}));
vi.mock("../../map/dynamicSourceFeed", () => ({ feedDynamicSource: () => ({ set() {}, dispose() {} }) }));

import { useBuildingsNightBloomLayer } from "../useBuildingsNightBloomLayer";
import { usePowerGenerationBeamLayer } from "../usePowerGenerationBeamLayer";

/** addLayer 失敗 → hook 會排 idle 重試；用 captured idle 模擬「清理後才觸發」。 */
function failingMap() {
  const events = new Map<string, Set<() => void>>();
  const map = {
    getLayer: vi.fn(() => undefined),
    triggerRepaint: vi.fn(),
    on(event: string, handler: () => void) { (events.get(event) ?? events.set(event, new Set()).get(event)!).add(handler); },
    once(event: string, handler: () => void) { (events.get(event) ?? events.set(event, new Set()).get(event)!).add(handler); },
    off(event: string, handler: () => void) { events.get(event)?.delete(handler); },
  };
  return {
    map: map as unknown as MapboxMap,
    count: (event: string) => events.get(event)?.size ?? 0,
    fire: (event: string) => [...(events.get(event) ?? [])].forEach((h) => h()),
  };
}

beforeAll(() => {
  vi.stubGlobal("window", { setInterval: () => 0, clearInterval: () => {} });
});

afterEach(() => { reactHarness.cleanup(); vi.clearAllMocks(); });

describe("3D 圖層掛載重試：關閉後不再掛（review F028／F034／F051）", () => {
  it("夜景 bloom：失敗後排了 idle 重試，關閉（cleanup）時取消，之後觸發也不會再掛", () => {
    lazy.mountLazyCustomLayer.mockImplementation(() => { throw new Error("style rebuilding"); });
    const state = failingMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    useBuildingsNightBloomLayer(mapRef, true, 1, 0);
    expect(lazy.mountLazyCustomLayer).toHaveBeenCalledTimes(1);
    expect(state.count("idle")).toBe(1);

    reactHarness.cleanup();
    expect(state.count("idle")).toBe(0);
    state.fire("idle");
    expect(lazy.mountLazyCustomLayer).toHaveBeenCalledTimes(1);
  });

  it("發電光柱：失敗後排 idle 重試，立體效果關閉（cleanup）時取消", () => {
    lazy.mountLazyCustomLayer.mockImplementation(() => { throw new Error("style rebuilding"); });
    const state = failingMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    usePowerGenerationBeamLayer(mapRef, true, 1, 1, 1, true);
    expect(state.count("idle")).toBe(1);
    reactHarness.cleanup();
    expect(state.count("idle")).toBe(0);
    state.fire("idle");
    expect(lazy.mountLazyCustomLayer).toHaveBeenCalledTimes(1);
  });

  it("發電光柱：立體效果關（stereo=false）時移除已掛的光柱圖層", () => {
    const state = failingMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;
    usePowerGenerationBeamLayer(mapRef, true, 1, 1, 1, false);
    expect(lazy.removeLazyCustomLayer).toHaveBeenCalledWith(state.map, "beam");
    expect(lazy.mountLazyCustomLayer).not.toHaveBeenCalled();
  });
});
