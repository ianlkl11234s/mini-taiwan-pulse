/**
 * useMapReadyTick 的行為（原 mapReadyTickCoverage.test.ts 以 regex 比對原始碼）。
 *
 * mapRef.current 變動不觸發 re-render：map 晚於圖層 effect 就緒時，靠這個 tick 逼 effect 重跑。
 * 「deps 含 mapRef 就要含 mapTick」由 ESLint pulse/map-ready-tick-deps 檢查；這裡驗 hook 本身：
 * 就緒時遞增 tick 並停掉輪詢、已就緒或停用時完全不建 timer。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";

// 最小 React harness：useState 存值、useEffect 依 deps 決定重跑（同 useCwaImageryLayer.test 的做法）。
const react = vi.hoisted(() => {
  const states: unknown[] = [];
  const effects: { deps?: readonly unknown[]; cleanup?: void | (() => void) }[] = [];
  let stateCursor = 0;
  let effectCursor = 0;
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  return {
    begin() {
      stateCursor = 0;
      effectCursor = 0;
    },
    useState<T>(initial: T) {
      const i = stateCursor++;
      if (!(i in states)) states[i] = initial;
      const set = (next: T | ((prev: T) => T)) => {
        states[i] = typeof next === "function" ? (next as (prev: T) => T)(states[i] as T) : next;
      };
      return [states[i] as T, set] as const;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const i = effectCursor++;
      const prev = effects[i];
      if (prev && !changed(prev.deps, deps)) return;
      prev?.cleanup?.();
      effects[i] = { deps, cleanup: effect() };
    },
    reset() {
      for (const e of effects) e.cleanup?.();
      states.length = 0;
      effects.length = 0;
    },
  };
});

vi.mock("react", () => ({ useState: react.useState, useEffect: react.useEffect }));

import { useMapReadyTick } from "../useMapReadyTick";

const fakeMap = {} as MapboxMap;
const render = (mapRef: { current: MapboxMap | null }, enabled?: boolean) => {
  react.begin();
  return useMapReadyTick(mapRef, enabled);
};

describe("useMapReadyTick", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    react.reset();
    vi.useRealTimers();
  });

  it("map 晚就緒：就緒時 tick +1，並停掉輪詢（不留常駐 timer）", () => {
    const mapRef = { current: null as MapboxMap | null };
    expect(render(mapRef)).toBe(0);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(render(mapRef)).toBe(0);

    mapRef.current = fakeMap;
    vi.advanceTimersByTime(200);
    expect(vi.getTimerCount()).toBe(0);
    expect(render(mapRef)).toBe(1);

    vi.advanceTimersByTime(5000);
    expect(render(mapRef)).toBe(1);
  });

  it("map 已就緒時不建 timer", () => {
    expect(render({ current: fakeMap })).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("停用（圖層關著）時不輪詢", () => {
    expect(render({ current: null }, false)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
