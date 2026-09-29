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

import { useSoilLiquefactionPrivateAccess } from "./useSoilLiquefactionPrivateAccess";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function signIn(id: string) {
  mocks.useUser.mockReturnValue({ user: { id }, loading: false });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id }, access_token: `${id}-token` } } });
}

afterEach(() => {
  runtime.dispose();
  runtime.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSoilLiquefactionPrivateAccess", () => {
  it("keeps an authenticated non-owner silently locked", async () => {
    signIn("non-owner");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    runtime.render(useSoilLiquefactionPrivateAccess);
    await flush();

    expect(runtime.render(useSoilLiquefactionPrivateAccess).allowed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/private-research/soil-liquefaction/tiles?access=1", expect.objectContaining({
      headers: { Authorization: "Bearer non-owner-token" }, cache: "no-store",
    }));
    expect(warn).not.toHaveBeenCalled();
  });

  it("unlocks only when the sidecar confirms allowed === true for the same account", async () => {
    signIn("owner");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: true }), { status: 200 })));
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });

    runtime.render(useSoilLiquefactionPrivateAccess);
    await flush();

    expect(runtime.render(useSoilLiquefactionPrivateAccess)).toEqual({ allowed: true, userId: "owner" });
  });

  it("stays locked when the private service is not ready", async () => {
    signIn("owner");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    runtime.render(useSoilLiquefactionPrivateAccess);
    await flush();

    expect(runtime.render(useSoilLiquefactionPrivateAccess).allowed).toBe(false);
  });
});
