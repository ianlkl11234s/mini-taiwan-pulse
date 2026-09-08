import { describe, expect, it, vi } from "vitest";
import { __test__, MAX_PRIVATE_CORAL_RANGE_BYTES, PRIVATE_CORAL_REQUEST_TIMEOUT_MS } from "../privateCoralPmtiles";

const URL = "https://private.example.test/coral.pmtiles";

function partialResponse(offset: number, length: number, status = 206): Response {
  return new Response(new Uint8Array(length), {
    status,
    headers: { "Content-Range": `bytes ${offset}-${offset + length - 1}/999`, ETag: "archive-v1" },
  });
}

describe("PrivateCoralFetchSource", () => {
  it("每次 Range 都取當前 token，傳 Bearer、Range 並禁止 HTTP cache", async () => {
    const getToken = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const fetchFn = vi.fn((_request: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(partialResponse(12, 4)));
    const source = new __test__.PrivateCoralFetchSource(URL, getToken, fetchFn);

    await source.getBytes(12, 4);
    await source.getBytes(12, 4);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(1, URL, expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer first", Range: "bytes=12-15" } }));
    expect(fetchFn).toHaveBeenNthCalledWith(2, URL, expect.objectContaining({ headers: { Authorization: "Bearer second", Range: "bytes=12-15" } }));
  });

  it("拒絕 401/403、非 206 或錯誤 Content-Range，取消 response body 且不交資料", async () => {
    const deniedBody = { cancel: vi.fn().mockResolvedValue(undefined) };
    const denied = { status: 403, headers: new Headers(), body: deniedBody, arrayBuffer: vi.fn() } as unknown as Response;
    const source = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn().mockResolvedValue(denied));
    await expect(source.getBytes(0, 4)).rejects.toMatchObject({ status: 403 });
    expect(denied.arrayBuffer).not.toHaveBeenCalled();
    expect(deniedBody.cancel).toHaveBeenCalledOnce();

    const wrongStatus = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn().mockResolvedValue(partialResponse(0, 4, 200)));
    await expect(wrongStatus.getBytes(0, 4)).rejects.toThrow("requires HTTP 206");
    const badRange = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn().mockResolvedValue(new Response(new Uint8Array(4), { status: 206, headers: { "Content-Range": "bytes 1-4/999" } })));
    await expect(badRange.getBytes(0, 4)).rejects.toThrow("invalid Content-Range");
  });

  it("source dispose 會 abort pending requests，且單次 Range 不可超過 8 MiB", async () => {
    let signal: AbortSignal | undefined;
    const pending = new Promise<Response>(() => {});
    const source = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending;
    }));
    void source.getBytes(0, 4).catch(() => undefined);
    await vi.waitFor(() => expect(signal).toBeDefined());
    source.dispose();
    expect(signal?.aborted).toBe(true);
    const oversized = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn());
    await expect(oversized.getBytes(0, MAX_PRIVATE_CORAL_RANGE_BYTES + 1)).rejects.toThrow("refused invalid Range");
  });

  it("呼叫端 abort 會取消 fetch，並在完成後移除 signal listener", async () => {
    const external = new AbortController();
    const removeEventListener = vi.spyOn(external.signal, "removeEventListener");
    let fetchSignal: AbortSignal | undefined;
    const source = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      fetchSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }));
    const request = source.getBytes(0, 4, external.signal);
    await Promise.resolve(); await Promise.resolve();
    external.abort();
    await expect(request).rejects.toBeDefined();
    expect(fetchSignal?.aborted).toBe(true);
    expect(removeEventListener).toHaveBeenCalled();
  });

  it("token 或 fetch 停滯時有固定 timeout", async () => {
    vi.useFakeTimers();
    try {
      const source = new __test__.PrivateCoralFetchSource(URL, () => new Promise<string>(() => {}), vi.fn());
      const request = source.getBytes(0, 4);
      const rejected = expect(request).rejects.toThrow("request timed out");
      await vi.advanceTimersByTimeAsync(PRIVATE_CORAL_REQUEST_TIMEOUT_MS);
      await rejected;
    } finally {
      vi.useRealTimers();
    }
  });

  it("dispose 若發生在 response body 讀取中，不會交出已讀成功資料", async () => {
    let resolveBody!: (value: ArrayBuffer) => void;
    const response = {
      status: 206,
      headers: new Headers({ "Content-Range": "bytes 0-3/999" }),
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
      arrayBuffer: vi.fn(() => new Promise<ArrayBuffer>((resolve) => { resolveBody = resolve; })),
    } as unknown as Response;
    const source = new __test__.PrivateCoralFetchSource(URL, () => "token", vi.fn().mockResolvedValue(response));
    const request = source.getBytes(0, 4);
    await vi.waitFor(() => expect(response.arrayBuffer).toHaveBeenCalledOnce());
    source.dispose();
    resolveBody(new Uint8Array(4).buffer);
    await expect(request).rejects.toThrow("source was disposed");
  });

  it("每個 source 保有自己的 request state，dispose A 不會取消 B", async () => {
    let aSignal: AbortSignal | undefined;
    let bSignal: AbortSignal | undefined;
    const pending = new Promise<Response>(() => {});
    const a = new __test__.PrivateCoralFetchSource(URL, () => "account-a", vi.fn((_: RequestInfo | URL, init?: RequestInit) => { aSignal = init?.signal ?? undefined; return pending; }));
    const b = new __test__.PrivateCoralFetchSource(URL, () => "account-b", vi.fn((_: RequestInfo | URL, init?: RequestInit) => { bSignal = init?.signal ?? undefined; return pending; }));
    void a.getBytes(0, 4).catch(() => undefined);
    void b.getBytes(0, 4).catch(() => undefined);
    await vi.waitFor(() => {
      expect(aSignal).toBeDefined();
      expect(bSignal).toBeDefined();
    });
    a.dispose();
    expect(aSignal?.aborted).toBe(true);
    expect(bSignal?.aborted).toBe(false);
    b.dispose();
  });
});
