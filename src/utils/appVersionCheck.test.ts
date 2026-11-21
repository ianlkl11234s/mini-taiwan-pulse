import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRemoteVersion,
  isDifferentBuild,
  isUpdateSimulated,
  parseUpdateStyle,
  parseVersionPayload,
  startVersionWatcher,
  type AppVersionInfo,
} from "./appVersionCheck";

const local: AppVersionInfo = { version: "2.43.0", build: "abc123" };

describe("parseVersionPayload", () => {
  it("接受 version＋build", () => {
    expect(parseVersionPayload({ version: "2.43.0", build: "x" })).toEqual({ version: "2.43.0", build: "x" });
  });
  it("缺 build 視為空字串", () => {
    expect(parseVersionPayload({ version: "2.43.0" })).toEqual({ version: "2.43.0", build: "" });
  });
  it("格式不對回 null", () => {
    expect(parseVersionPayload(null)).toBeNull();
    expect(parseVersionPayload("2.43.0")).toBeNull();
    expect(parseVersionPayload({ version: "" })).toBeNull();
    expect(parseVersionPayload({ version: 2 })).toBeNull();
  });
});

describe("isDifferentBuild", () => {
  it("遠端不知道時不提示", () => {
    expect(isDifferentBuild(local, null)).toBe(false);
  });
  it("兩邊都有 build 時以 build 為準", () => {
    expect(isDifferentBuild(local, { version: "2.43.0", build: "abc123" })).toBe(false);
    expect(isDifferentBuild(local, { version: "2.43.0", build: "def456" })).toBe(true);
  });
  it("任一邊沒有 build 時比版號", () => {
    expect(isDifferentBuild({ version: "2.43.0", build: "" }, { version: "2.43.0", build: "z" })).toBe(false);
    expect(isDifferentBuild(local, { version: "2.44.0", build: "" })).toBe(true);
  });
});

describe("fetchRemoteVersion", () => {
  const res = (body: string, init: ResponseInit & { type?: string } = {}) =>
    new Response(body, { status: init.status ?? 200, headers: { "content-type": init.type ?? "application/json" } });

  it("200＋JSON 回傳版本，且不走快取", async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => res('{"version":"2.44.0","build":"n"}'));
    await expect(fetchRemoteVersion(f as unknown as typeof fetch)).resolves.toEqual({ version: "2.44.0", build: "n" });
    expect(f.mock.calls[0]![1]).toMatchObject({ cache: "no-store" });
  });
  it("dev server／SPA fallback 回 index.html 時當不知道", async () => {
    const f = async () => res("<!doctype html><html></html>", { type: "text/html" });
    await expect(fetchRemoteVersion(f as unknown as typeof fetch)).resolves.toBeNull();
  });
  it("非 200、JSON 壞掉、網路錯誤都當不知道", async () => {
    await expect(fetchRemoteVersion((async () => res("nf", { status: 404 })) as unknown as typeof fetch)).resolves.toBeNull();
    await expect(fetchRemoteVersion((async () => res("{bad")) as unknown as typeof fetch)).resolves.toBeNull();
    await expect(fetchRemoteVersion((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).resolves.toBeNull();
  });
});

describe("startVersionWatcher", () => {
  let visibility: DocumentVisibilityState;
  let handler: (() => void) | null;
  let t: number;
  const doc = {
    get visibilityState() { return visibility; },
    addEventListener: (_: string, fn: () => void) => { handler = fn; },
    removeEventListener: () => { handler = null; },
  } as unknown as Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    handler = null;
    t = 0;
  });
  afterEach(() => vi.useRealTimers());

  const setup = (remote: AppVersionInfo | null) => {
    const fetchVersion = vi.fn(async () => remote);
    const onUpdate = vi.fn();
    const stop = startVersionWatcher({ local, fetchVersion, onUpdate, doc, now: () => t, intervalMs: 1000, minRecheckMs: 500 });
    return { fetchVersion, onUpdate, stop };
  };

  it("定時檢查，偵測到新版後通知一次並停止", async () => {
    const { fetchVersion, onUpdate } = setup({ version: "2.44.0", build: "new" });
    expect(fetchVersion).not.toHaveBeenCalled();
    t = 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdate).toHaveBeenCalledWith({ version: "2.44.0", build: "new" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchVersion).toHaveBeenCalledTimes(1);
    expect(handler).toBeNull();
  });

  it("同版本不通知、繼續輪詢；背景分頁不打", async () => {
    const { fetchVersion, onUpdate } = setup({ ...local });
    await vi.advanceTimersByTimeAsync(1000);
    visibility = "hidden";
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchVersion).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("回到前景時檢查，但距上次太近就跳過", async () => {
    const { fetchVersion, onUpdate, stop } = setup({ version: "2.43.0", build: "new" });
    t = 100;
    handler?.();
    expect(fetchVersion).not.toHaveBeenCalled();
    t = 600;
    handler?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchVersion).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("網址參數", () => {
  it("upd_style 只認 a|b|c", () => {
    expect(parseUpdateStyle("?upd_style=b")).toBe("b");
    expect(parseUpdateStyle("?upd_style=C")).toBe("c");
    expect(parseUpdateStyle("?upd_style=z")).toBe("a");
    expect(parseUpdateStyle("")).toBe("a");
  });
  it("模擬只在開發模式生效", () => {
    const storage = { getItem: (k: string) => (k === "pulse.updSim" ? "1" : null) };
    expect(isUpdateSimulated("?upd_sim=1", null, true)).toBe(true);
    expect(isUpdateSimulated("", storage, true)).toBe(true);
    expect(isUpdateSimulated("?upd_sim=1", storage, false)).toBe(false);
    expect(isUpdateSimulated("", null, true)).toBe(false);
  });
});
