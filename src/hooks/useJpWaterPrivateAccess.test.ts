import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  let cursor = 0;
  let values: unknown[] = [];
  let dependencies: unknown[][] = [];
  let cleanups: Array<(() => void) | undefined> = [];
  return {
    reset() { cursor = 0; values = []; dependencies = []; cleanups = []; },
    render<T>(hook: () => T): T { cursor = 0; return hook(); },
    dispose() { cleanups.forEach((cleanup) => cleanup?.()); },
    useState<T>(initial: T) {
      const index = cursor++;
      if (index >= values.length) values[index] = initial;
      return [values[index] as T, (next: T | ((previous: T) => T)) => {
        values[index] = typeof next === "function" ? (next as (previous: T) => T)(values[index] as T) : next;
      }] as const;
    },
    useEffect(effect: () => void | (() => void), nextDependencies?: unknown[]) {
      const index = cursor++;
      const previous = dependencies[index];
      const changed = !previous || !nextDependencies || previous.length !== nextDependencies.length
        || previous.some((value, dependencyIndex) => value !== nextDependencies[dependencyIndex]);
      if (!changed) return;
      cleanups[index]?.();
      dependencies[index] = nextDependencies ?? [];
      cleanups[index] = effect() ?? undefined;
    },
  };
});

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  reportError: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: runtime.useEffect,
  useState: runtime.useState,
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
vi.mock("../lib/auth", () => ({ useUser: mocks.useUser }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: {
  getSession: mocks.getSession,
  onAuthStateChange: mocks.onAuthStateChange,
} } }));
vi.mock("../lib/loadingRegistry", () => ({ withLoading: (_id: string, _label: string, task: Promise<unknown>) => task }));
vi.mock("../data/jpWaterLoader", () => ({
  getJpWaterRuntime: () => ({ revision: 0 }),
  reportJpWaterError: mocks.reportError,
  subscribeJpWaterRuntime: () => () => {},
}));

import { useJpWaterPrivateAccess } from "./useJpWaterPrivateAccess";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  runtime.dispose();
  runtime.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useJpWaterPrivateAccess", () => {
  it("keeps an authenticated non-owner silently locked after the initial probe", async () => {
    const dispatchEvent = vi.fn();
    mocks.useUser.mockReturnValue({ user: { id: "non-owner" }, loading: false });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "non-owner" }, access_token: "non-owner-token" } },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent });

    runtime.render(useJpWaterPrivateAccess);
    await flush();

    expect(runtime.render(useJpWaterPrivateAccess).allowed).toBe(false);
    expect(mocks.reportError).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
