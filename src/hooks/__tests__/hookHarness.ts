/**
 * 測試用的極簡 React hook 執行環境（本專案沒有 jsdom／testing-library）。
 * 用法：在測試檔 `vi.mock("react", async () => (await import("./hookHarness")).reactMock);`，
 * 每次呼叫 hook 前 `harness.begin()`，結束時 `harness.cleanup()` 跑完所有 effect cleanup。
 * useState 的 setter 只記錄最新值，不觸發重繪；要模擬重繪就再 begin() 並呼叫一次 hook。
 */
import { vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";

type Slot = { deps?: readonly unknown[]; cleanup?: void | (() => void) };

const refs: { current: unknown }[] = [];
const states: unknown[] = [];
const effects: Slot[] = [];
const memos: { deps?: readonly unknown[]; value: unknown }[] = [];
let r = 0;
let s = 0;
let e = 0;
let m = 0;

const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
  !!a && !!b && a.length === b.length && a.every((v, k) => Object.is(v, b[k]));

function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
  const i = e++;
  const prev = effects[i];
  if (prev && sameDeps(prev.deps, deps)) return;
  if (typeof prev?.cleanup === "function") prev.cleanup();
  effects[i] = { deps, cleanup: effect() };
}

function useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
  const i = m++;
  const prev = memos[i];
  if (prev && sameDeps(prev.deps, deps)) return prev.value as T;
  const value = factory();
  memos[i] = { deps, value };
  return value;
}

export const harness = {
  begin() { r = 0; s = 0; e = 0; m = 0; },
  cleanup() {
    for (const slot of effects) if (typeof slot.cleanup === "function") slot.cleanup();
    refs.length = 0; states.length = 0; effects.length = 0; memos.length = 0;
  },
};

export const reactMock = {
  useRef<T>(initial: T) { return (refs[r++] ??= { current: initial }) as { current: T }; },
  useState<T>(initial: T | (() => T)) {
    const i = s++;
    if (!(i in states)) states[i] = typeof initial === "function" ? (initial as () => T)() : initial;
    const set = (next: T | ((prev: T) => T)) => {
      states[i] = typeof next === "function" ? (next as (prev: T) => T)(states[i] as T) : next;
    };
    return [states[i] as T, set] as const;
  },
  useEffect,
  useLayoutEffect: useEffect,
  useCallback<T>(fn: T, deps?: readonly unknown[]) { return useMemo(() => fn, deps); },
  useMemo,
  useSyncExternalStore<T>(_subscribe: unknown, getSnapshot: () => T) { return getSnapshot(); },
};

/** 記錄 source／layer／事件／layout 呼叫的假 Mapbox 地圖。 */
export function createFakeMap(opts: { styleLoaded?: boolean } = {}) {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, Record<string, unknown>>();
  const layout = new Map<string, Record<string, unknown>>();
  const raw = {
    isStyleLoaded: vi.fn(() => opts.styleLoaded ?? true),
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => { sources.set(id, { setData: vi.fn() }); }),
    removeSource: vi.fn((id: string) => { sources.delete(id); }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    addLayer: vi.fn((layer: Record<string, unknown>) => {
      layers.set(layer.id as string, layer);
      layout.set(layer.id as string, { ...(layer.layout as Record<string, unknown> | undefined) });
    }),
    removeLayer: vi.fn((id: string) => { layers.delete(id); }),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn((id: string, key: string, value: unknown) => { layout.get(id)![key] = value; }),
    getLayoutProperty: vi.fn((id: string, key: string) => layout.get(id)?.[key]),
    setPaintProperty: vi.fn(),
    getPaintProperty: vi.fn(),
    setFilter: vi.fn(),
    setLayerZoomRange: vi.fn(),
    getStyle: vi.fn(() => ({ layers: [...layers.values()] })),
    triggerRepaint: vi.fn(),
    loaded: vi.fn(() => true),
    areTilesLoaded: vi.fn(() => true),
    on: vi.fn((ev: string, cb: (...args: unknown[]) => void) => {
      if (!handlers.has(ev)) handlers.set(ev, new Set());
      handlers.get(ev)!.add(cb);
      return raw;
    }),
    once: vi.fn((ev: string, cb: (...args: unknown[]) => void) => {
      const wrapped = (...args: unknown[]) => { handlers.get(ev)?.delete(wrapped); cb(...args); };
      raw.on(ev, wrapped);
      return raw;
    }),
    off: vi.fn((ev: string, cb: (...args: unknown[]) => void) => { handlers.get(ev)?.delete(cb); return raw; }),
  };
  return {
    map: raw as unknown as MapboxMap,
    raw,
    sources,
    layers,
    /** 模擬 setStyle()：清掉自建 source／layer 後觸發 style.load。 */
    restyle() { sources.clear(); layers.clear(); layout.clear(); this.emit("style.load"); },
    emit(ev: string, ...args: unknown[]) { [...(handlers.get(ev) ?? [])].forEach((cb) => cb(...args)); },
    count(ev: string) { return handlers.get(ev)?.size ?? 0; },
    visibility(id: string) { return layout.get(id)?.visibility; },
  };
}
