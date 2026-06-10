import { describe, it, expect, vi } from "vitest";
import { cachedOnce, cachedByKey } from "../loaderCache";

describe("cachedOnce", () => {
  it("fetches once and reuses the result", async () => {
    const fn = vi.fn(async () => 42);
    const cached = cachedOnce(fn, 1000);
    expect(await cached()).toBe(42);
    expect(await cached()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight calls", async () => {
    let resolve!: (v: number) => void;
    const fn = vi.fn(() => new Promise<number>((r) => { resolve = r; }));
    const cached = cachedOnce(fn, 1000);
    const p1 = cached();
    const p2 = cached();
    resolve(7);
    expect(await p1).toBe(7);
    expect(await p2).toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL expiry", async () => {
    let t = 0;
    const fn = vi.fn(async () => t);
    const cached = cachedOnce(fn, 100, () => t);
    await cached();
    t = 50;
    await cached();
    expect(fn).toHaveBeenCalledTimes(1);
    t = 150;
    await cached();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clears cache on rejection so next call retries", async () => {
    let fail = true;
    const fn = vi.fn(async () => {
      if (fail) throw new Error("boom");
      return "ok";
    });
    const cached = cachedOnce(fn, 1000);
    await expect(cached()).rejects.toThrow("boom");
    fail = false;
    expect(await cached()).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invalidate forces refetch", async () => {
    const fn = vi.fn(async () => 1);
    const cached = cachedOnce(fn, 100000);
    await cached();
    cached.invalidate();
    await cached();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("cachedByKey", () => {
  it("caches per key", async () => {
    const fn = vi.fn(async (k: string) => `v:${k}`);
    const cached = cachedByKey(fn, 1000);
    expect(await cached("a")).toBe("v:a");
    expect(await cached("b")).toBe("v:b");
    expect(await cached("a")).toBe("v:a");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("evicts least-recently-used beyond maxEntries", async () => {
    const fn = vi.fn(async (k: string) => k);
    const cached = cachedByKey(fn, 100000, 2);
    await cached("a");
    await cached("b");
    await cached("a"); // touch a → b 變最舊
    await cached("c"); // 超過上限 → 淘汰 b
    expect(fn).toHaveBeenCalledTimes(3);
    await cached("a"); // 仍在
    expect(fn).toHaveBeenCalledTimes(3);
    await cached("b"); // 已被淘汰 → 重抓
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("expires per key by TTL", async () => {
    let t = 0;
    const fn = vi.fn(async (k: string) => k);
    const cached = cachedByKey(fn, 100, 16, () => t);
    await cached("a");
    t = 150;
    await cached("a");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("drops failed entries", async () => {
    let fail = true;
    const fn = vi.fn(async (k: string) => {
      if (fail) throw new Error("x");
      return k;
    });
    const cached = cachedByKey(fn, 1000);
    await expect(cached("a")).rejects.toThrow();
    fail = false;
    expect(await cached("a")).toBe("a");
  });
});
