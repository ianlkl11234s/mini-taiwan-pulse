import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoadingStatusController, LOADING_STATUS_TIMING as T, type LoadingStatusView } from "../loadingStatusController";
import { loadingRegistry, withLoading, type LoadingEvent } from "../loadingRegistry";

function setup() {
  const views: LoadingStatusView[] = [];
  const c = createLoadingStatusController({ onChange: (v) => views.push(v), now: () => Date.now() });
  const start = (id: string, label = id) => c.handle({ type: "start", id, label });
  const end = (id: string, label = id) => c.handle({ type: "end", id, label });
  const fail = (id: string, label = id) => c.handle({ type: "fail", id, label });
  return { c, views, start, end, fail, last: () => views[views.length - 1]! };
}

describe("loadingStatusController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("150ms 內就結束的任務完全不顯示", () => {
    const s = setup();
    s.start("a");
    vi.advanceTimersByTime(80);
    s.end("a");
    vi.advanceTimersByTime(5000);
    expect(s.views).toEqual([]);
  });

  it("出現後「載入中」至少停 600ms，再顯示「已載入」2 秒後淡出", () => {
    const s = setup();
    s.start("a", "公車即時位置");
    vi.advanceTimersByTime(T.showDelayMs);
    expect(s.last()).toMatchObject({ visible: true, phase: "loading", label: "公車即時位置" });
    s.end("a", "公車即時位置");
    vi.advanceTimersByTime(T.minLoadingMs - 1);
    expect(s.last().phase).toBe("loading");
    vi.advanceTimersByTime(1);
    expect(s.last()).toMatchObject({ visible: true, phase: "done", label: "公車即時位置", count: 1 });
    vi.advanceTimersByTime(T.doneHoldMs);
    expect(s.last()).toMatchObject({ visible: false, phase: "done" });
  });

  it("同一批多項：顯示 +N，完成時顯示總項數", () => {
    const s = setup();
    s.start("a", "寺廟");
    s.start("b", "文化設施");
    vi.advanceTimersByTime(T.showDelayMs);
    expect(s.last()).toMatchObject({ phase: "loading", label: "文化設施", extra: 1 });
    s.end("a");
    s.end("b");
    vi.advanceTimersByTime(T.minLoadingMs);
    expect(s.last()).toMatchObject({ phase: "done", count: 2 });
  });

  it("「已載入」期間來了新任務：回到載入中，不先消失", () => {
    const s = setup();
    s.start("a");
    vi.advanceTimersByTime(T.showDelayMs);
    s.end("a");
    vi.advanceTimersByTime(T.minLoadingMs);
    expect(s.last().phase).toBe("done");
    s.start("b", "人口密度");
    expect(s.last()).toMatchObject({ visible: true, phase: "loading", label: "人口密度" });
  });

  it("失敗顯示錯誤 4 秒後淡出", () => {
    const s = setup();
    s.start("a", "淹水潛勢");
    vi.advanceTimersByTime(T.showDelayMs);
    s.fail("a", "淹水潛勢");
    expect(s.last()).toMatchObject({ visible: true, phase: "error", label: "淹水潛勢" });
    vi.advanceTimersByTime(T.errorHoldMs - 1);
    expect(s.last().visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(s.last()).toMatchObject({ visible: false, phase: "error" });
  });

  it("時間軸播放中不顯示「已載入」，停下後才顯示", () => {
    const s = setup();
    s.c.setPlaying(true);
    s.start("a");
    vi.advanceTimersByTime(T.showDelayMs);
    s.end("a");
    vi.advanceTimersByTime(5000);
    expect(s.last().phase).toBe("loading");
    s.c.setPlaying(false);
    vi.advanceTimersByTime(T.settleMs);
    expect(s.last().phase).toBe("done");
  });
});

describe("loadingRegistry 事件", () => {
  it("withLoading：resolve 發 end；reject 與 Supabase { error } 發 fail", async () => {
    const events: LoadingEvent[] = [];
    const off = loadingRegistry.subscribeEvents((e) => events.push(e));
    await withLoading("ok", "成功", Promise.resolve({ data: 1, error: null }));
    await withLoading("sb", "查詢", Promise.resolve({ data: null, error: { message: "x" } }));
    await expect(withLoading("rj", "失敗", Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    off();
    expect(events.map((e) => `${e.type}:${e.id}`)).toEqual(["start:ok", "end:ok", "start:sb", "fail:sb", "start:rj", "fail:rj"]);
    expect(loadingRegistry.snapshot()).toEqual([]);
  });

  it("withLoading signal：呼叫端取消（signal 已 abort）發 end；未取消的 reject 仍發 fail", async () => {
    const events: LoadingEvent[] = [];
    const off = loadingRegistry.subscribeEvents((e) => events.push(e));
    const cancelled = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const pending = withLoading("cx", "取消", new Promise((_, reject) => cancelled.signal.addEventListener("abort", () => reject(abortError))), { signal: cancelled.signal });
    cancelled.abort();
    await expect(pending).rejects.toBe(abortError);
    await expect(withLoading("live", "真失敗", Promise.reject(new Error("boom")), { signal: new AbortController().signal })).rejects.toThrow("boom");
    // AbortError without the caller's signal (e.g. an internal timeout controller) is still a real failure.
    await expect(withLoading("bare", "逾時", Promise.reject(new DOMException("aborted", "AbortError")))).rejects.toThrow();
    const done = new AbortController();
    const value = withLoading("late", "完成後取消", Promise.resolve(7), { signal: done.signal });
    done.abort();
    await expect(value).resolves.toBe(7);
    off();
    expect(events.map((e) => `${e.type}:${e.id}`)).toEqual(["start:cx", "end:cx", "start:live", "fail:live", "start:bare", "fail:bare", "start:late", "end:late"]);
    expect(loadingRegistry.snapshot()).toEqual([]);
  });

  it("controller：取消只結束任務，不進入 error 狀態，也不吞掉下一個 start", () => {
    vi.useFakeTimers();
    try {
      const { start, end, last, c } = setup();
      start("a", "統計");
      vi.advanceTimersByTime(T.showDelayMs + 1);
      end("a", "統計"); // cancelled request → end
      start("a", "統計"); // StrictMode rerun
      vi.advanceTimersByTime(T.showDelayMs + 1);
      expect(last().phase).toBe("loading");
      c.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
