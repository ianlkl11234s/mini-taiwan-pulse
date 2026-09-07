import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  const slots: unknown[] = [];
  const effects: Array<{ deps?: readonly unknown[]; cleanup?: () => void; effect: () => void | (() => void) }> = [];
  const pending = new Set<number>();
  let cursor = 0;
  return {
    resetCursor: () => { cursor = 0; },
    reset: () => { slots.length = 0; effects.length = 0; pending.clear(); cursor = 0; },
    cleanup: () => effects.forEach((entry) => entry.cleanup?.()),
    flushEffects: () => {
      for (const i of pending) {
        const entry = effects[i]!;
        entry.cleanup?.();
        entry.cleanup = entry.effect() ?? undefined;
      }
      pending.clear();
    },
    useState: <T,>(initial: T | (() => T)) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [slots[i] as T, (next: T | ((old: T) => T)) => {
        slots[i] = typeof next === "function" ? (next as (old: T) => T)(slots[i] as T) : next;
      }] as const;
    },
    useRef: <T,>(initial: T) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i] as { current: T };
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const i = cursor++;
      const prior = effects[i];
      const changed = !prior || !deps || !prior.deps || deps.length !== prior.deps.length || deps.some((v, n) => v !== prior.deps?.[n]);
      effects[i] = { effect, deps, cleanup: prior?.cleanup };
      if (changed) pending.add(i);
    },
  };
});

vi.mock("react", () => ({
  useState: runtime.useState,
  useRef: runtime.useRef,
  useEffect: runtime.useEffect,
}));

import { useIntelPollingQuery } from "../useIntelPollingQuery";

const empty: number[] = [];
const result = (data: number[]) => ({ status: "ready" as const, data, lastSuccessAt: Date.now() });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("useIntelPollingQuery runtime scheduling", () => {
  afterEach(() => { runtime.cleanup(); runtime.reset(); vi.useRealTimers(); });

  function render(queryKey: string, load: () => Promise<ReturnType<typeof result>>, enabled = true) {
    runtime.resetCursor();
    const view = useIntelPollingQuery({ enabled, queryKey, intervalMs: 1000, emptyData: empty, load });
    runtime.flushEffects();
    return view;
  }

  it("does not overlap a slow refresh and schedules the next only after completion", async () => {
    vi.useFakeTimers();
    let resolve!: (value: ReturnType<typeof result>) => void;
    const load = vi.fn(() => new Promise<ReturnType<typeof result>>((r) => { resolve = r; }));
    render("today", load);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(result([1]));
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("cleanup prevents the next timer from firing after unmount", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => result([1]));
    render("today", load);
    await flush();
    runtime.cleanup();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a normal rerender keeps its timer, while disabled work cannot start another request", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => result([1]));
    render("today", load);
    await flush();
    render("today", load); // same deps: no second immediate fetch or timer reset
    expect(load).toHaveBeenCalledTimes(1);
    render("today", load, false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("waits for an old query then runs the newest query without applying a second overlap", async () => {
    vi.useFakeTimers();
    let resolve!: (value: ReturnType<typeof result>) => void;
    const load = vi.fn(() => new Promise<ReturnType<typeof result>>((r) => { resolve = r; }));
    render("old", load);
    const newView = render("new", load);
    expect(newView).toMatchObject({ status: "unknown", data: [] });
    expect(load).toHaveBeenCalledTimes(1);
    resolve(result([1]));
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(render("new", load)).toMatchObject({ status: "unknown", data: [], queryKey: "new" });
    resolve(result([2]));
    await flush();
    expect(render("new", load)).toMatchObject({ status: "ready", data: [2], queryKey: "new" });
  });

  it("turns a rejected 42501 response into denied and clears query data", async () => {
    vi.useFakeTimers();
    let resolve!: (value: ReturnType<typeof result>) => void;
    let reject!: (reason: unknown) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<ReturnType<typeof result>>((r) => { resolve = r; }))
      .mockImplementationOnce(() => new Promise<ReturnType<typeof result>>((_resolve, r) => { reject = r; }));
    render("restricted", load);
    resolve(result([7]));
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    reject({ code: "42501", message: "permission denied" });
    await flush();
    expect(render("restricted", load)).toMatchObject({ status: "denied", data: [] });
  });

  it("keeps one timer over 480 refresh cycles and releases it on close", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => result([1]));
    render("today", load);
    await vi.advanceTimersByTimeAsync(480_000);
    expect(load).toHaveBeenCalledTimes(481);
    expect(vi.getTimerCount()).toBe(1);
    render("today", load, false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a pending result after unmount and never schedules another timer", async () => {
    vi.useFakeTimers();
    let resolve!: (value: ReturnType<typeof result>) => void;
    const load = vi.fn(() => new Promise<ReturnType<typeof result>>((r) => { resolve = r; }));
    render("today", load);
    runtime.cleanup();
    resolve(result([99]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(render("today", load)).toMatchObject({ status: "unknown", data: [] });
  });

});
