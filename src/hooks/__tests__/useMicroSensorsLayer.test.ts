import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  type Slot = { deps?: readonly unknown[]; cleanup?: void | (() => void) };
  const refs: { current: unknown }[] = [];
  const effects: Slot[] = [];
  let r = 0, e = 0;
  return {
    begin() { r = 0; e = 0; },
    useRef<T>(initial: T) { return (refs[r++] ??= { current: initial }) as { current: T }; },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const i = e++;
      const prev = effects[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && prev.deps.every((v, k) => Object.is(v, deps[k]))) return;
      prev?.cleanup?.();
      effects[i] = { deps, cleanup: effect() };
    },
    cleanup() { for (const s of effects) s.cleanup?.(); refs.length = 0; effects.length = 0; },
  };
});

vi.mock("react", () => ({ useRef: reactHarness.useRef, useEffect: reactHarness.useEffect }));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/microSensorsLoader", () => ({
  fetchMicroSensorsLatest: vi.fn().mockResolvedValue([]),
  buildMicroSensorsGeoJSON: () => ({ type: "FeatureCollection", features: [] }),
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { useMicroSensorsLayer } from "../useMicroSensorsLayer";

function createMap(styleLoaded: boolean) {
  const handlers = new Map<string, Array<() => void>>();
  const sources = new Set<string>();
  const layers = new Set<string>();
  const map = {
    isStyleLoaded: () => styleLoaded,
    getSource: (id: string) => (sources.has(id) ? { setData: vi.fn() } : undefined),
    addSource: (id: string) => sources.add(id),
    removeSource: (id: string) => sources.delete(id),
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    addLayer: (l: { id: string }) => layers.add(l.id),
    removeLayer: (id: string) => layers.delete(id),
    setPaintProperty: vi.fn(),
    once: vi.fn((ev: string, cb: () => void) => { handlers.set(ev, [...(handlers.get(ev) ?? []), cb]); }),
    off: vi.fn((ev: string, cb: () => void) => { handlers.set(ev, (handlers.get(ev) ?? []).filter((h) => h !== cb)); }),
  };
  const fire = (ev: string) => { const hs = handlers.get(ev) ?? []; handlers.delete(ev); hs.forEach((h) => h()); };
  return { map: map as unknown as MapboxMap, raw: map, layers, fire };
}

describe("useMicroSensorsLayer style readiness (R5-1)", () => {
  beforeEach(() => { vi.stubGlobal("window", { setInterval, clearInterval }); });
  afterEach(() => { reactHarness.cleanup(); vi.unstubAllGlobals(); });

  it("style 未就緒時等 idle 而非 load（load 在地圖載入後不會再觸發），idle 後建立圖層", () => {
    const { map, raw, layers, fire } = createMap(false);
    const ref = { current: map } as RefObject<MapboxMap | null>;
    reactHarness.begin();
    useMicroSensorsLayer(ref, true, false, 0, 1);
    const events = raw.once.mock.calls.map((c) => c[0]);
    expect(events).toContain("idle");
    expect(events).not.toContain("load");
    expect(layers.size).toBe(0);
    fire("idle");
    expect(layers.has("aqi-micro-circle")).toBe(true);
  });

  it("style 已就緒時立即建立圖層", () => {
    const { map, layers } = createMap(true);
    const ref = { current: map } as RefObject<MapboxMap | null>;
    reactHarness.begin();
    useMicroSensorsLayer(ref, true, false, 0, 1);
    expect(layers.has("aqi-micro-circle")).toBe(true);
  });
});
