import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { areaPayload } from "../../card/__tests__/cardFixtures";
import { publishAnalysisCard, type CardRpcClient } from "../../lib/analysisCardApi";
import { AnalysisCardDraftSection, publishDraft } from "../AnalysisCardDraftSection";
import { parseAnalysisCardDraft } from "../analysisCardDraft";
import { EXPLORATION_OPERATIONS, completedActivityForOperation, makeCardHint } from "../MainMapConnection";
import { activityForOperation } from "../researchActivity";

const relayArgs = () => ({ draftId: "card-draft-2b6f0c1e-7d7a-4b43-9c0a-1f2d3e4f5a6b", resultId: "wh-2", bytes: 2100, expiresAt: "2026-10-28T10:00:00+08:00", gate: { publishable: true, message: "來源都是政府開放資料（OGDL）。" }, payload: areaPayload() });

describe("analysis_card_draft relay", () => {
  it("面板接受這個 operation，並有進行中／完成的活動文字", () => {
    expect(EXPLORATION_OPERATIONS.has("analysis_card_draft")).toBe(true);
    expect(activityForOperation("analysis_card_draft", {})?.title).toContain("卡片草稿");
    expect(completedActivityForOperation("analysis_card_draft", {}).detail).toContain("發布連結");
  });

  it("驗證 relay 參數；未知 payload 版本與不合法內容拒收", () => {
    const parsed = parseAnalysisCardDraft(relayArgs());
    expect(parsed.ok).toBe(true);
    expect(parseAnalysisCardDraft({ ...relayArgs(), payload: { ...areaPayload(), schema_version: 2 } })).toEqual({ ok: false, error: "CARD_SCHEMA_UNSUPPORTED" });
    expect(parseAnalysisCardDraft({ ...relayArgs(), payload: { ...areaPayload(), sources: [] } })).toEqual({ ok: false, error: "CARD_PAYLOAD_INVALID" });
    expect(parseAnalysisCardDraft({ ...relayArgs(), gate: { publishable: "yes" } }).ok).toBe(false);
    expect(parseAnalysisCardDraft({ ...relayArgs(), draftId: "../x" }).ok).toBe(false);
  });
});

describe("卡片草稿 → 發布（mock RPC）", () => {
  const draft = () => { const parsed = parseAnalysisCardDraft(relayArgs()); if (!parsed.ok) throw new Error(parsed.error); return parsed.draft; };
  const rpcClient = (result: { data: unknown; error: { code?: string; message?: string } | null }): CardRpcClient & { rpc: ReturnType<typeof vi.fn> } => ({ rpc: vi.fn().mockResolvedValue(result), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "owner" } } } }) } });

  it("草稿預覽顯示閘門訊息、卡片與兩個按鈕", () => {
    const html = renderToStaticMarkup(createElement(AnalysisCardDraftSection, { draft: draft(), onDiscard: () => {}, showMap: false }));
    expect(html).toContain("卡片草稿");
    expect(html).toContain("來源都是政府開放資料");
    expect(html).toContain("臺北市的公園密度最高");
    expect(html).toContain("發布連結");
    expect(html).toContain("捨棄");
    expect(html).toContain("發布後 30 天到期");
  });

  it("按「發布連結」：以草稿 payload 呼叫 publish_analysis_card，顯示可複製連結與到期日", async () => {
    const mock = rpcClient({ data: [{ slug: "AbCdEfGh_-123456", expires_at: "2026-10-27T17:00:00Z" }], error: null });
    const state = await publishDraft(draft(), payload => publishAnalysisCard(payload, mock));
    expect(mock.rpc).toHaveBeenCalledWith("publish_analysis_card", { p_payload: draft().payload });
    expect(state).toEqual({ phase: "published", url: "https://mini-taiwan-pulse.itsmigu.com/card/AbCdEfGh_-123456", expiresAt: "2026-10-27T17:00:00Z" });
    const html = renderToStaticMarkup(createElement(AnalysisCardDraftSection, { draft: draft(), onDiscard: () => {}, showMap: false, initialState: state }));
    expect(html).toContain("https://mini-taiwan-pulse.itsmigu.com/card/AbCdEfGh_-123456");
    expect(html).toContain("連結到期：2026-10-28");
    expect(html).toContain("複製連結");
  });

  it("非 owner：顯示清楚訊息；閘門不通過時不呼叫 RPC", async () => {
    const denied = await publishDraft(draft(), payload => publishAnalysisCard(payload, rpcClient({ data: null, error: { code: "42501", message: "only owner can publish analysis cards" } })));
    expect(denied.phase).toBe("error");
    const html = renderToStaticMarkup(createElement(AnalysisCardDraftSection, { draft: draft(), onDiscard: () => {}, showMap: false, initialState: denied }));
    expect(html).toContain("站長");
    const publish = vi.fn();
    const blocked = await publishDraft({ ...draft(), gate: { publishable: false, message: "還不能公開" } }, publish);
    expect(publish).not.toHaveBeenCalled();
    expect(blocked).toEqual({ phase: "error", message: "還不能公開" });
  });

  it("「做成卡片」提示說明要在對話中請 Agent 產卡", () => {
    expect(makeCardHint("公園密度")).toContain("做成卡片");
    expect(makeCardHint("公園密度")).toContain("發布連結");
  });
});
