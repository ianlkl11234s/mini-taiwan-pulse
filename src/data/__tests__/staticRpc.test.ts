import { afterEach, describe, expect, it, vi } from "vitest";
import { staticRpc, staticRpcFile } from "../staticRpc";

describe("staticRpc", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("returns a valid snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 1 }]), { status: 200 })));
    await expect(staticRpc("example")).resolves.toEqual({ data: [{ id: 1 }], error: null });
  });
  it("returns explicit errors for 404, invalid JSON, and network failure without a database fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response("{", { status: 200 })).mockRejectedValueOnce(new Error("offline")));
    await expect(staticRpc("missing")).resolves.toMatchObject({ data: null, error: { message: expect.stringContaining("HTTP 404") } });
    await expect(staticRpc("invalid")).resolves.toMatchObject({ data: null, error: { message: expect.stringContaining("invalid JSON") } });
    await expect(staticRpc("offline")).resolves.toMatchObject({ data: null, error: { message: expect.stringContaining("offline") } });
  });
  it("shares only concurrent requests and cleans inflight after settlement", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const first = staticRpc("same"); const second = staticRpc("same");
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response("null", { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ data: null, error: null }, { data: null, error: null }]);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("[]", { status: 200 }));
    await staticRpc("same");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("staticRpcFile reads parameterized snapshot paths and exposes HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("[1]", { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 404 })));
    await expect(staticRpcFile("/static-rpc/get_x_1.json")).resolves.toEqual({ data: [1], error: null });
    expect(fetch).toHaveBeenCalledWith("/static-rpc/get_x_1.json");
    await expect(staticRpcFile("/static-rpc/get_x_2.json")).resolves.toMatchObject({ data: null, error: { status: 404 } });
  });
  it("staticRpcFile rejects paths outside /static-rpc/", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(staticRpcFile("/geo/x.json")).resolves.toMatchObject({ data: null, error: { message: expect.stringContaining("/static-rpc/") } });
    expect(fetch).not.toHaveBeenCalled();
  });
});
