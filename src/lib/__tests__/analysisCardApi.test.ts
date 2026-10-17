import { describe, expect, it, vi } from "vitest";
import { analysisCardUrl, cardErrorMessage, listMyAnalysisCards, publishAnalysisCard, revokeAnalysisCard, type CardRpcClient } from "../analysisCardApi";

/** mock RPC client（不連任何遠端；414 尚未套用到正式環境）。 */
function client(result: { data: unknown; error: { code?: string; message?: string } | null }, session: unknown = { user: { id: "owner" } }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) } } satisfies CardRpcClient;
}

describe("publishAnalysisCard", () => {
  it("用登入 session 呼叫 publish_analysis_card(p_payload)，回傳連結與到期日", async () => {
    const mock = client({ data: [{ slug: "AbCdEfGh_-123456", expires_at: "2026-10-28T02:00:00Z" }], error: null });
    const result = await publishAnalysisCard({ schema_version: 1 }, mock);
    expect(mock.rpc).toHaveBeenCalledWith("publish_analysis_card", { p_payload: { schema_version: 1 } });
    expect(result).toEqual({ ok: true, value: { slug: "AbCdEfGh_-123456", expiresAt: "2026-10-28T02:00:00Z", url: "https://mini-taiwan-pulse.itsmigu.com/card/AbCdEfGh_-123456" } });
  });

  it("未登入不呼叫 RPC，給清楚訊息", async () => {
    const mock = client({ data: null, error: null }, null);
    const result = await publishAnalysisCard({}, mock);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("登入");
  });

  it("非 owner、payload 不合法、migration 未套用、上限各有白話訊息", async () => {
    const message = async (error: { code?: string; message?: string }) => {
      const result = await publishAnalysisCard({}, client({ data: null, error }));
      return result.ok ? "" : result.message;
    };
    expect(await message({ code: "42501", message: "only owner can publish analysis cards" })).toContain("站長");
    expect(await message({ code: "22023", message: "invalid analysis card payload" })).toContain("伺服器檢查");
    expect(await message({ code: "PGRST202", message: "Could not find the function public.publish_analysis_card" })).toContain("414");
    expect(await message({ code: "23514", message: "analysis_cards quota of 200 reached" })).toContain("200");
    expect(cardErrorMessage(null)).toContain("稍後再試");
  });

  it("伺服器回傳的 slug 格式不對就不給連結", async () => {
    const result = await publishAnalysisCard({}, client({ data: [{ slug: "../x", expires_at: "2026-10-28T02:00:00Z" }], error: null }));
    expect(result.ok).toBe(false);
  });
});

describe("revoke／list", () => {
  it("撤銷：RPC 回 true 才算成功", async () => {
    const mock = client({ data: true, error: null });
    expect(await revokeAnalysisCard("AbCdEfGh_-123456", mock)).toEqual({ ok: true, value: true });
    expect(mock.rpc).toHaveBeenCalledWith("revoke_analysis_card", { p_slug: "AbCdEfGh_-123456" });
    expect((await revokeAnalysisCard("AbCdEfGh_-123456", client({ data: false, error: null }))).ok).toBe(false);
    expect((await revokeAnalysisCard("AbCdEfGh_-123456", client({ data: null, error: { code: "42501" } }))).ok).toBe(false);
  });

  it("列出自己的卡片並正規化欄位", async () => {
    const result = await listMyAnalysisCards(client({ data: [
      { slug: "AbCdEfGh_-123456", title: "卡片一", created_at: "2026-09-28T02:00:00Z", expires_at: "2026-10-28T02:00:00Z", revoked_at: null, bytes: 2048 },
      { slug: 42 },
    ], error: null }));
    expect(result).toEqual({ ok: true, value: [{ slug: "AbCdEfGh_-123456", title: "卡片一", createdAt: "2026-09-28T02:00:00Z", expiresAt: "2026-10-28T02:00:00Z", revokedAt: null, bytes: 2048 }] });
    expect(analysisCardUrl("AbCdEfGh_-123456")).toBe("https://mini-taiwan-pulse.itsmigu.com/card/AbCdEfGh_-123456");
  });
});
