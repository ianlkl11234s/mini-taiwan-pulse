import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";
import type { EarthquakeGlobalEvent } from "../../data/earthquakesGlobalLoader";
import type { EarthquakeRippleLayerOptions } from "../../map/earthquakeRippleCustomLayer";

/**
 * 全球地震漣漪：動畫不得再經 Mapbox 資料管線（setPaintProperty / setFilter / setData），
 * RAF 只在「可見 ∧ 有新地震 ∧ 時間軸在走」時跑。這些斷言在舊實作（Mapbox circle 層逐幀
 * setPaintProperty data-driven circle-radius）下會失敗。
 */

const harness = vi.hoisted(() => {
  type Slot = { current?: unknown; deps?: readonly unknown[]; cleanup?: void | (() => void); value?: unknown };
  const slots: Slot[] = [];
  let cursor = 0;
  const same = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  let throttled: ((t: number) => void) | null = null;
  return {
    begin: () => { cursor = 0; },
    reset: () => {
      for (const s of slots) if (typeof s.cleanup === "function") s.cleanup();
      slots.length = 0;
      cursor = 0;
      throttled = null;
    },
    useRef: <T,>(initial: T) => (slots[cursor++] ??= { current: initial }) as { current: T },
    useState: <T,>(initial: T) => {
      const slot = (slots[cursor++] ??= { value: initial });
      return [slot.value as T, (v: T | ((c: T) => T)) => {
        slot.value = typeof v === "function" ? (v as (c: T) => T)(slot.value as T) : v;
      }] as const;
    },
    useCallback: <T,>(fn: T, deps: readonly unknown[]) => {
      const i = cursor++;
      const prev = slots[i];
      if (prev && same(prev.deps, deps)) return prev.value as T;
      slots[i] = { deps, value: fn };
      return fn;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const i = cursor++;
      const prev = slots[i];
      if (prev && same(prev.deps, deps)) return;
      if (typeof prev?.cleanup === "function") prev.cleanup();
      slots[i] = { deps, cleanup: effect() };
    },
    subscribeThrottled: (_ms: number, cb: (t: number) => void) => {
      throttled = cb;
      return () => { if (throttled === cb) throttled = null; };
    },
    setTime: (t: number) => throttled?.(t),
  };
});

const clock = vi.hoisted(() => ({ time: 0, perf: 0 }));
const events = vi.hoisted(() => ({ list: [] as EarthquakeGlobalEvent[] }));
const ripple = vi.hoisted(() => ({
  opts: null as EarthquakeRippleLayerOptions | null,
  creates: 0,
}));

vi.mock("react", async (orig) => ({
  ...await orig<typeof import("react")>(),
  useRef: harness.useRef,
  useState: harness.useState,
  useCallback: harness.useCallback,
  useEffect: harness.useEffect,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getTime: () => clock.time,
    getDateKey: () => "2026-10-01",
    subscribeDate: () => () => {},
    subscribeThrottled: harness.subscribeThrottled,
  },
}));
vi.mock("../../data/earthquakesGlobalLoader", async (orig) => ({
  ...await orig<typeof import("../../data/earthquakesGlobalLoader")>(),
  fetchEarthquakesGlobal: () => Promise.resolve(events.list),
}));
// 真的 mount / remove 流程，只把 three 模組換成記錄 opts 的假模組（node 無 WebGL）
vi.mock("../../map/lazyThreeLayers", async (orig) => {
  const real = await orig<typeof import("../../map/lazyThreeLayers")>();
  const fake = {
    createEarthquakeRippleLayer: (opts: EarthquakeRippleLayerOptions) => {
      ripple.opts = opts;
      ripple.creates++;
      return { id: real.EARTHQUAKE_RIPPLE_LAYER_ID, type: "custom", render: () => {} };
    },
  };
  return {
    ...real,
    earthquakeRippleModule: { get: () => fake, load: () => Promise.resolve(fake), ensure: () => Promise.resolve(fake) },
  };
});

import { useEarthquakesGlobalLayer, depthRgb } from "../useEarthquakesGlobalLayer";

const T0 = 1_790_857_631; // 某次地震發生時間（unix 秒）

function quake(overrides: Partial<EarthquakeGlobalEvent> = {}): EarthquakeGlobalEvent {
  return { event_id: "q1", mag: 5.3, place: "Japan", depth_km: 41.65, lng: 140.5, lat: 35.7, observed_ts: T0, ...overrides };
}

function createMap() {
  const layers = new Map<string, { id: string }>();
  const setData = vi.fn();
  const sources = new Map<string, { setData: typeof setData }>();
  const map = {
    getStyle: () => ({}),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string) => { sources.set(id, { setData }); }),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: { id: string }) => { layers.set(layer.id, layer); }),
    removeLayer: vi.fn((id: string) => { layers.delete(id); }),
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    triggerRepaint: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  return { map, layers, setData };
}

// 手動 RAF：frame() 推進掛鐘並執行排隊中的 callback
const raf = { queue: new Map<number, (ts: number) => void>(), next: 1 };
function frame(ms = 50) {
  clock.perf += ms;
  const cbs = [...raf.queue.values()];
  raf.queue.clear();
  for (const cb of cbs) cb(clock.perf);
}

async function mount(visible = true, opacity = 0.9, ripple3D = true) {
  const state = createMap();
  const ref = { current: state.map as unknown as MapboxMap } as RefObject<MapboxMap | null>;
  const render = (v = visible, o = opacity, r = ripple3D) => {
    harness.begin();
    useEarthquakesGlobalLayer(ref, v, o, 1, r);
  };
  render();
  await Promise.resolve();
  await Promise.resolve();
  render(); // dataTick 遞增後的重繪
  return { ...state, render };
}

describe("useEarthquakesGlobalLayer ripple (Three.js)", () => {
  beforeEach(() => {
    clock.time = T0 + 120;
    clock.perf = 10_000;
    events.list = [quake(), quake({ event_id: "old", observed_ts: T0 - 7200, mag: 4.1 })];
    ripple.opts = null;
    ripple.creates = 0;
    raf.queue.clear();
    vi.spyOn(performance, "now").mockImplementation(() => clock.perf);
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: (ts: number) => void) => {
      const id = raf.next++;
      raf.queue.set(id, cb);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { raf.queue.delete(id); }));
  });

  afterEach(() => {
    harness.reset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("only builds the static post/pre circle layers plus one custom ripple layer", async () => {
    const { layers } = await mount();
    expect([...layers.keys()]).toEqual([
      "earthquakes-global-circle",
      "earthquakes-global-pre",
      "earthquakes-global-ripple-3d--lazy-anchor",
      "earthquakes-global-ripple-3d",
    ]);
  });

  it("animation ticks never touch Mapbox paint, filter or source data", async () => {
    const { map, setData } = await mount();
    map.setPaintProperty.mockClear();
    map.setFilter.mockClear();
    setData.mockClear();
    map.triggerRepaint.mockClear();

    for (let i = 0; i < 20; i++) frame();

    expect(map.setPaintProperty).not.toHaveBeenCalled();
    expect(map.setFilter).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
    expect(map.triggerRepaint.mock.calls.length).toBeGreaterThanOrEqual(15);
    expect(ripple.opts?.getIsAnimating()).toBe(true);
  });

  it("feeds only quakes inside the fresh window to the scene, with the depth colour ramp", async () => {
    await mount();
    const snap = ripple.opts!.getRipples();
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0]).toMatchObject({ lng: 140.5, lat: 35.7, mag: 5.3 });
    expect(snap.items[0]!.rgb).toEqual(depthRgb(41.65));
  });

  it("starts nothing before a quake enters the window, starts when it does, stops when it expires", async () => {
    clock.time = T0 - 60; // 地震尚未發生
    const { map } = await mount();
    expect(raf.queue.size).toBe(0);
    expect(ripple.opts!.getRipples().items).toHaveLength(0);

    clock.perf += 100;
    harness.setTime(T0 + 30); // 時間軸走過發生時間
    expect(raf.queue.size).toBe(1);
    expect(ripple.opts!.getRipples().items).toHaveLength(1);
    frame();
    expect(ripple.opts!.getIsAnimating()).toBe(true);

    clock.perf += 100;
    harness.setTime(T0 + 1201); // 超過 20 分鐘窗口
    expect(raf.queue.size).toBe(0);
    expect(ripple.opts!.getRipples().items).toHaveLength(0);
    expect(ripple.opts!.getIsAnimating()).toBe(false);
    map.triggerRepaint.mockClear();
    frame();
    expect(map.triggerRepaint).not.toHaveBeenCalled();
  });

  it("stops the RAF when the timeline is paused (clock not moving)", async () => {
    const { map } = await mount();
    for (let i = 0; i < 10; i++) frame(); // 0.5s
    expect(raf.queue.size).toBe(1);
    for (let i = 0; i < 60; i++) frame(); // +3s 沒有 setTime
    expect(raf.queue.size).toBe(0);
    expect(ripple.opts!.getIsAnimating()).toBe(false);
    map.triggerRepaint.mockClear();
    frame();
    expect(map.triggerRepaint).not.toHaveBeenCalled();

    harness.setTime(T0 + 125); // 恢復播放
    expect(raf.queue.size).toBe(1);
  });

  it("hiding the layer stops the RAF and removes the custom layer (onRemove disposes GPU resources)", async () => {
    const { map, layers, render } = await mount();
    frame();
    expect(raf.queue.size).toBe(1);
    render(false);
    expect(raf.queue.size).toBe(0);
    expect(layers.has("earthquakes-global-ripple-3d")).toBe(false);
    expect(map.removeLayer).toHaveBeenCalledWith("earthquakes-global-ripple-3d");
    expect(ripple.opts!.getIsAnimating()).toBe(false);
  });

  it("R6：立體效果關 → 只建平面圓點，不掛 Three 漣漪、不跑 RAF（即使有剛發生的地震）", async () => {
    const { layers, map } = await mount(true, 0.9, false);
    expect([...layers.keys()]).toEqual(["earthquakes-global-circle", "earthquakes-global-pre"]);
    expect(ripple.creates).toBe(0);
    expect(raf.queue.size).toBe(0);
    clock.perf += 100;
    harness.setTime(T0 + 30); // 時間軸在走、地震在窗口內
    expect(raf.queue.size).toBe(0);
    map.triggerRepaint.mockClear();
    frame();
    expect(map.triggerRepaint).not.toHaveBeenCalled();
  });

  it("R6：立體效果開 → 掛漣漪；再關 → 移除漣漪並停 RAF", async () => {
    const { layers, map, render } = await mount(true, 0.9, false);
    render(true, 0.9, true);
    expect(layers.has("earthquakes-global-ripple-3d")).toBe(true);
    expect(raf.queue.size).toBe(1);
    render(true, 0.9, false);
    expect(layers.has("earthquakes-global-ripple-3d")).toBe(false);
    expect(map.removeLayer).toHaveBeenCalledWith("earthquakes-global-ripple-3d");
    expect(raf.queue.size).toBe(0);
    expect(layers.has("earthquakes-global-circle")).toBe(true);
  });

  it("the opacity slider reaches the ripple layer as well as the epicentre circles", async () => {
    const { map, render } = await mount(true, 0.9);
    render(true, 0.4);
    expect(ripple.opts!.getOpacity()).toBeCloseTo(0.4);
    expect(map.setPaintProperty).toHaveBeenCalledWith("earthquakes-global-circle", "circle-opacity", expect.closeTo(0.55 * 0.4));
  });

  it("does not re-issue setFilter while the filtered set is unchanged", async () => {
    const { map } = await mount();
    map.setFilter.mockClear();
    clock.perf += 100;
    harness.setTime(T0 + 130);
    clock.perf += 100;
    harness.setTime(T0 + 140);
    expect(map.setFilter).not.toHaveBeenCalled();
    harness.setTime(T0 - 10); // q1 從「已發生」回到「預示」→ 集合變了才重設
    expect(map.setFilter).toHaveBeenCalledTimes(2);
  });
});

describe("depthRgb", () => {
  it("matches the Mapbox ramp stops and interpolates linearly in rgb", () => {
    expect(depthRgb(0)).toEqual([220 / 255, 38 / 255, 38 / 255]);
    expect(depthRgb(300)).toEqual([0x39 / 255, 0x49 / 255, 0xab / 255]);
    expect(depthRgb(999)).toEqual(depthRgb(300));
    const mid = depthRgb(15);
    expect(mid[0]).toBeCloseTo((0xdc + 0xf9) / 2 / 255);
    expect(mid[1]).toBeCloseTo((0x26 + 0x73) / 2 / 255);
  });
});
