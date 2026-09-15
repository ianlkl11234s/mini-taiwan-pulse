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
  useUser: vi.fn(),
}));

vi.mock("react", () => ({ useEffect: runtime.useEffect, useState: runtime.useState }));
vi.mock("../lib/auth", () => ({ useUser: mocks.useUser }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: {
  getSession: mocks.getSession,
  onAuthStateChange: mocks.onAuthStateChange,
} } }));

import { useAllenCoralPrivateAccess } from "./useAllenCoralPrivateAccess";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function flush() {
  await Promise.resolve();
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

describe("useAllenCoralPrivateAccess", () => {
  it("re-probes a refreshed token for the same owner and ignores the stale probe", async () => {
    const listeners: Array<(event: string) => void> = [];
    const deniedListeners = new Set<() => void>();
    const oldProbe = deferred<Response>();
    mocks.useUser.mockReturnValue({ user: { id: "owner" }, loading: false });
    mocks.onAuthStateChange.mockImplementation((listener: (event: string) => void) => {
      listeners.push(listener);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: { user: { id: "owner" }, access_token: "old-token" } } })
      .mockResolvedValueOnce({ data: { session: { user: { id: "owner" }, access_token: "new-token" } } });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(oldProbe.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ allowed: false })));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("sessionStorage", { setItem: vi.fn() });
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: () => void) => { if (type === "allen-coral-access-denied") deniedListeners.add(listener); },
      removeEventListener: (type: string, listener: () => void) => { if (type === "allen-coral-access-denied") deniedListeners.delete(listener); },
      sessionStorage: { setItem: vi.fn() },
    });

    runtime.render(useAllenCoralPrivateAccess);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    deniedListeners.forEach((listener) => listener());
    listeners[0]!("TOKEN_REFRESHED");

    runtime.render(useAllenCoralPrivateAccess);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ headers: { Authorization: "Bearer new-token" } });

    oldProbe.resolve(new Response(JSON.stringify({ allowed: true })));
    await flush();
    expect(runtime.render(useAllenCoralPrivateAccess).allowed).toBe(false);
  });

  it("keeps a healthy grant during TOKEN_REFRESHED without closing the layer", async () => {
    const listeners: Array<(event: string) => void> = [];
    mocks.useUser.mockReturnValue({ user: { id: "owner" }, loading: false });
    mocks.onAuthStateChange.mockImplementation((listener: (event: string) => void) => {
      listeners.push(listener);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "owner" }, access_token: "healthy-token" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ allowed: true }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("sessionStorage", { setItem: vi.fn() });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      sessionStorage: { setItem: vi.fn() },
    });

    runtime.render(useAllenCoralPrivateAccess);
    await flush();
    expect(runtime.render(useAllenCoralPrivateAccess).allowed).toBe(true);
    listeners[listeners.length - 1]!("TOKEN_REFRESHED");
    expect(runtime.render(useAllenCoralPrivateAccess).allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
