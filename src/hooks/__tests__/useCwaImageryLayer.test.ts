import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  type EffectSlot = {
    deps?: readonly unknown[];
    cleanup?: void | (() => void);
  };
  const refs: { current: unknown }[] = [];
  const effects: EffectSlot[] = [];
  let refCursor = 0;
  let effectCursor = 0;

  const depsChanged = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));

  return {
    beginRender() {
      refCursor = 0;
      effectCursor = 0;
    },
    useRef<T>(initial: T) {
      return (refs[refCursor++] ??= { current: initial }) as { current: T };
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
      refs.length = 0;
      effects.length = 0;
      refCursor = 0;
      effectCursor = 0;
    },
  };
});

const mocks = vi.hoisted(() => ({
  createLayer: vi.fn(),
  loadBatch: vi.fn(),
  windowKeys: ["2026-08-25"],
}));

vi.mock("react", () => ({
  useRef: reactHarness.useRef,
  useEffect: reactHarness.useEffect,
}));
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/cwaImageryLoader", () => ({
  loadCwaImageryBatch: mocks.loadBatch,
}));
vi.mock("../../map/cwaImageryLayer", () => ({
  createCwaImageryLayer: mocks.createLayer,
}));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../state/timeStore", () => ({
  timeStore: {
    getDateKey: () => "2026-08-25",
    getWindowDateKeys: () => [...mocks.windowKeys],
    getTime: () => Date.parse("2026-08-25T12:00:00+08:00") / 1000,
    subscribeDate: () => () => {},
    subscribeWindowDateKeys: () => () => {},
    subscribeThrottled: () => () => {},
  },
}));

import { useCwaImageryLayer } from "../useCwaImageryLayer";

type TestHandle = {
  setVisible: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  setUrl: ReturnType<typeof vi.fn>;
  ensure: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function makeHandle(): TestHandle {
  return {
    setVisible: vi.fn(),
    setOpacity: vi.fn(),
    setUrl: vi.fn(),
    ensure: vi.fn(),
    remove: vi.fn(),
  };
}

function createMap() {
  let styleLoaded = true;
  const handlers = new Map<string, Set<() => void>>();
  const map = {
    isStyleLoaded: () => styleLoaded,
    on: (event: string, handler: () => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    once: (event: string, handler: () => void) => {
      const once = () => {
        handlers.get(event)?.delete(once);
        handler();
      };
      const set = handlers.get(event) ?? new Set();
      set.add(once);
      handlers.set(event, set);
    },
    off: (event: string, handler: () => void) => handlers.get(event)?.delete(handler),
  } as unknown as MapboxMap;
  return { map, setStyleLoaded: (value: boolean) => { styleLoaded = value; } };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useCwaImageryLayer visibility lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    mocks.loadBatch.mockImplementation(async (datasetIds: string[]) => {
      const result = new Map();
      for (const datasetId of datasetIds) {
        const observedAtIso = "2026-08-25T04:00:00.000Z";
        result.set(datasetId, {
          bundle: {
            datasetId,
            frames: [{
              datasetId,
              observedAtIso,
              observedAtMs: Date.parse(observedAtIso),
              mimeType: "image/png",
              lonMin: 118,
              lonMax: 123,
              latMin: 20,
              latMax: 27,
              imageSize: 1,
            }],
          },
          urls: new Map([[observedAtIso, `blob:${datasetId}`]]),
        });
      }
      return result;
    });
  });

  afterEach(() => {
    reactHarness.cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    mocks.windowKeys = ["2026-08-25"];
  });

  const render = (mapRef: RefObject<MapboxMap | null>, opts: { cloudVisible: boolean; radarVisible: boolean; cloudOpacity?: number; radarOpacity?: number }) => {
    reactHarness.beginRender();
    useCwaImageryLayer({ mapRef, cloudOpacity: 1, radarOpacity: 0.85, ...opts });
  };

  it("F220：隱藏中的圖層不寫 opacity，可見的照常更新", async () => {
    const cloudHandle = makeHandle();
    const radarHandle = makeHandle();
    mocks.createLayer.mockImplementation((_map, opts: { layerId: string }) =>
      opts.layerId === "cwa-cloud-layer" ? cloudHandle : radarHandle,
    );
    const mapRef = { current: createMap().map } as RefObject<MapboxMap | null>;
    render(mapRef, { cloudVisible: true, radarVisible: true });
    await flushPromises();
    render(mapRef, { cloudVisible: true, radarVisible: false });
    cloudHandle.setOpacity.mockClear();
    radarHandle.setOpacity.mockClear();

    render(mapRef, { cloudVisible: true, radarVisible: false, cloudOpacity: 0.4, radarOpacity: 0.3 });
    expect(cloudHandle.setOpacity).toHaveBeenCalledWith(0.4);
    expect(radarHandle.setOpacity).not.toHaveBeenCalled();
  });

  it("AU-3：CWA 背景預抓 debounce 600ms、逐一串行、silent，且略過前景日", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    mocks.windowKeys = ["2026-08-24", "2026-08-25", "2026-08-26"];
    mocks.createLayer.mockImplementation(() => makeHandle());
    const foreground = mocks.loadBatch.getMockImplementation()!;
    const pending: Array<() => void> = [];
    mocks.loadBatch.mockImplementation((ids: string[], window: unknown, opts: { silent?: boolean }) => {
      if (!opts?.silent) return foreground(ids, window, opts);
      return new Promise((resolve) => { pending.push(() => resolve(new Map())); });
    });
    const calls = () => mocks.loadBatch.mock.calls.map((call) => ({ silent: !!call[2]?.silent, window: JSON.stringify(call[1]) }));
    const mapRef = { current: createMap().map } as RefObject<MapboxMap | null>;

    render(mapRef, { cloudVisible: false, radarVisible: true });
    expect(calls()).toHaveLength(1);
    expect(calls()[0]!.silent).toBe(false); // 前景日立即、非 silent
    const foregroundWindow = calls()[0]!.window;
    await vi.advanceTimersByTimeAsync(599);
    expect(calls().filter((c) => c.silent)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls().filter((c) => c.silent)).toHaveLength(1); // 串行：一次只有一個背景請求
    pending.shift()!();
    await flushPromises();
    await flushPromises();
    const background = calls().filter((c) => c.silent);
    expect(background).toHaveLength(2);
    expect(new Set(background.map((c) => c.window)).size).toBe(2);
    expect(background.map((c) => c.window)).not.toContain(foregroundWindow); // 不重抓前景日
    pending.splice(0).forEach((release) => release());
  });

  it("F304：effect 重跑時作廢進行中的串行背景預抓，舊迴圈不再抓下一天", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    mocks.windowKeys = ["2026-08-24", "2026-08-25", "2026-08-26"];
    mocks.createLayer.mockImplementation(() => makeHandle());
    const foreground = mocks.loadBatch.getMockImplementation()!;
    let releaseBackground: (() => void) | null = null;
    mocks.loadBatch.mockImplementation((ids: string[], window: unknown, opts: { silent?: boolean }) => {
      if (!opts?.silent) return foreground(ids, window, opts);
      return new Promise((resolve) => { releaseBackground = () => resolve(new Map()); });
    });
    const silentCalls = () => mocks.loadBatch.mock.calls.filter((call) => call[2]?.silent).length;
    const mapRef = { current: createMap().map } as RefObject<MapboxMap | null>;

    render(mapRef, { cloudVisible: false, radarVisible: true });
    await vi.advanceTimersByTimeAsync(600);
    expect(silentCalls()).toBe(1); // 舊迴圈卡在第一天

    render(mapRef, { cloudVisible: true, radarVisible: true }); // 可見性變動 → cleanup + 新 effect
    releaseBackground!();
    await flushPromises();
    await flushPromises();
    expect(silentCalls()).toBe(1);
  });

  it("Mapbox busy 時關閉雷達仍立即 soft-hide，不等待下一個 load", async () => {
    const radarHandle = makeHandle();
    mocks.createLayer.mockReturnValue(radarHandle);
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    reactHarness.beginRender();
    useCwaImageryLayer({
      mapRef,
      cloudVisible: false,
      radarVisible: true,
      cloudOpacity: 1,
      radarOpacity: 0.85,
    });
    await flushPromises();
    expect(mocks.createLayer).toHaveBeenCalledWith(
      state.map,
      expect.objectContaining({ layerId: "cwa-radar-layer" }),
    );

    state.setStyleLoaded(false);
    radarHandle.setVisible.mockClear();
    reactHarness.beginRender();
    useCwaImageryLayer({
      mapRef,
      cloudVisible: false,
      radarVisible: false,
      cloudOpacity: 1,
      radarOpacity: 0.85,
    });

    expect(radarHandle.setVisible).toHaveBeenCalledWith(false);
  });

  it("雲圖關閉拋錯時仍會繼續關閉雷達", async () => {
    const cloudHandle = makeHandle();
    const radarHandle = makeHandle();
    mocks.createLayer.mockImplementation((_map, opts: { layerId: string }) =>
      opts.layerId === "cwa-cloud-layer" ? cloudHandle : radarHandle,
    );
    const state = createMap();
    const mapRef = { current: state.map } as RefObject<MapboxMap | null>;

    reactHarness.beginRender();
    useCwaImageryLayer({
      mapRef,
      cloudVisible: true,
      radarVisible: true,
      cloudOpacity: 1,
      radarOpacity: 0.85,
    });
    await flushPromises();

    cloudHandle.setVisible.mockImplementation(() => { throw new Error("style transition"); });
    radarHandle.setVisible.mockClear();
    reactHarness.beginRender();
    useCwaImageryLayer({
      mapRef,
      cloudVisible: false,
      radarVisible: false,
      cloudOpacity: 1,
      radarOpacity: 0.85,
    });

    expect(radarHandle.setVisible).toHaveBeenCalledWith(false);
  });
});
