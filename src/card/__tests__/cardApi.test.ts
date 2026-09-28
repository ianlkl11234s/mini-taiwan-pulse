import { describe, expect, it, vi } from "vitest";
import { fetchAnalysisCard } from "../cardApi";
import { areaPayload } from "./cardFixtures";

const config = (fetchImpl: typeof fetch) => ({ supabaseUrl: "https://example.supabase.test/", anonKey: "anon-test-key", fetchImpl });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("fetchAnalysisCard（anon get_analysis_card，mock fetch）", () => {
  it("以 anon key 呼叫 RPC，回傳 payload 與到期時間", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json([{ payload: areaPayload(), created_at: "2026-09-28T02:00:00Z", expires_at: "2026-10-28T02:00:00Z" }]));
    const result = await fetchAnalysisCard("AbCdEfGh_-123456", config(fetchImpl as unknown as typeof fetch));
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.expiresAt).toBe("2026-10-28T02:00:00Z");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.test/rest/v1/rpc/get_analysis_card");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("anon-test-key");
    expect(init.headers.Authorization).toBe("Bearer anon-test-key");
    expect(JSON.parse(init.body)).toEqual({ p_slug: "AbCdEfGh_-123456" });
  });

  it("0 列（不存在／撤銷／過期）算失效；卡片存在但版本看不懂算暫時無法載入", async () => {
    expect((await fetchAnalysisCard("AbCdEfGh_-123456", config(vi.fn().mockResolvedValue(json([])) as unknown as typeof fetch))).status).toBe("gone");
    expect(await fetchAnalysisCard("AbCdEfGh_-123456", config(vi.fn().mockResolvedValue(json([{ payload: { ...areaPayload(), schema_version: 9 }, expires_at: "x" }])) as unknown as typeof fetch))).toEqual({ status: "error", detail: "PAYLOAD_UNKNOWN_SCHEMA_VERSION" });
  });

  it("HTTP 或網路錯誤是「暫時無法載入」，不是失效", async () => {
    expect((await fetchAnalysisCard("AbCdEfGh_-123456", config(vi.fn().mockResolvedValue(json({ message: "boom" }, 500)) as unknown as typeof fetch))).status).toBe("error");
    expect((await fetchAnalysisCard("AbCdEfGh_-123456", config(vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch))).status).toBe("error");
    expect((await fetchAnalysisCard("AbCdEfGh_-123456", { supabaseUrl: undefined, anonKey: undefined })).status).toBe("error");
  });
});
