/**
 * AU-3：兩種 day prefetch 有意分工，不能因名稱相近而靜默合併或再複製。
 * 此為結構契約；payload、cache 和 CWA object URL 的 runtime 行為由各 hook/loader 測試涵蓋。
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const timeStore = vi.hoisted(() => ({
  getDateKey: vi.fn(),
  getWindowDateKeys: vi.fn(),
  subscribeDate: vi.fn(),
  subscribeWindowDateKeys: vi.fn(),
}));

vi.mock("../../state/timeStore", () => ({ timeStore }));

import { prefetchWindow, subscribePrefetchWindow } from "../dayPrefetch";

const shared = readFileSync("src/lib/dayPrefetch.ts", "utf8");
const cwa = readFileSync("src/hooks/useCwaImageryLayer.ts", "utf8");
const scope = readFileSync("docs/research/day-prefetch-scope-2026-10-05.md", "utf8");

describe("AU-3 day-prefetch scope", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    timeStore.getDateKey.mockReturnValue("2026-10-05");
    timeStore.getWindowDateKeys.mockReturnValue(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
    timeStore.subscribeDate.mockReturnValue(() => {});
    timeStore.subscribeWindowDateKeys.mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("文件明確列出共享 queue 與 CWA 串行例外", () => {
    expect(scope).toContain("`src/lib/dayPrefetch.ts`");
    expect(scope).toContain("`src/hooks/useCwaImageryLayer.ts`");
    expect(scope).toContain("全域 queue，最多 2 個並行");
    expect(scope).toContain("hook-local 串行");
  });

  it("共享 helper 以最多兩個並行預抓 window 的非前景日", async () => {
    const started: string[] = [];
    const release: Array<() => void> = [];
    prefetchWindow((key) => new Promise<void>((resolve) => {
      started.push(key);
      release.push(resolve);
    }), "[test]", "2026-10-05");

    expect(timeStore.getWindowDateKeys).toHaveBeenCalledOnce();
    expect(started).toEqual(["2026-10-03", "2026-10-04"]);
    expect(started).not.toContain("2026-10-05");
    release.forEach((resolve) => resolve());
    await vi.runAllTimersAsync();
    expect(started).toEqual(["2026-10-03", "2026-10-04", "2026-10-06"]);
    release[2]?.();
    await vi.runAllTimersAsync();
  });

  it("訂閱 window 和日期變更後，仍用 timeStore 的當前日略過 foreground", async () => {
    let onWindow: (() => void) | undefined;
    let onDate: (() => void) | undefined;
    const unsubscribeWindow = vi.fn();
    const unsubscribeDate = vi.fn();
    timeStore.subscribeWindowDateKeys.mockImplementation((cb: () => void) => {
      onWindow = cb;
      return unsubscribeWindow;
    });
    timeStore.subscribeDate.mockImplementation((cb: () => void) => {
      onDate = cb;
      return unsubscribeDate;
    });
    const seen: string[] = [];
    const unsubscribe = subscribePrefetchWindow(async (key) => { seen.push(key); }, "[test]");

    expect(timeStore.subscribeWindowDateKeys).toHaveBeenCalledOnce();
    expect(timeStore.subscribeDate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toEqual(["2026-10-03", "2026-10-04", "2026-10-06"]);

    timeStore.getDateKey.mockReturnValue("2026-10-06");
    onWindow?.();
    onDate?.();
    await vi.advanceTimersByTimeAsync(500);
    expect(seen.slice(-3)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    unsubscribe();
    expect(unsubscribeWindow).toHaveBeenCalledOnce();
    expect(unsubscribeDate).toHaveBeenCalledOnce();
  });

  it("CWA 保留 foreground、LRU 與逐一 silent background 的獨立保護", () => {
    expect(cwa).toContain("loadCwaImageryBatch([dsId], windowForDate(dateKey), { silent: !foreground })");
    expect(cwa).toContain("const allKeys = timeStore.getWindowDateKeys()");
    expect(cwa).toContain("if (!allKeys.includes(dk)) allKeys.push(dk)");
    expect(cwa).toContain("const protect = new Set(allKeys)");
    expect(cwa).toContain("for (const k of allKeys)");
    expect(cwa).toContain("for (const dsId of datasets)");
    expect(cwa).toContain("await loadOne(dsId, k, false)");
    expect(cwa).toContain("const PREFETCH_DEBOUNCE_MS = 600");
    expect(cwa).not.toContain("subscribePrefetchWindow");
  });

  it("兩條路徑都從 timeStore 取日期，沒有 currentTime React dependency", () => {
    for (const source of [shared, cwa]) {
      expect(source).toContain("timeStore");
      expect(source).not.toMatch(/\[\s*[^\]]*currentTime[^\]]*\]/);
    }
  });
});
