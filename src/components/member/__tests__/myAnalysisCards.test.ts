import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardStatusText, MyAnalysisCardsList } from "../MyAnalysisCards";

const now = Date.parse("2026-10-01T00:00:00Z");
const card = (overrides: Partial<Parameters<typeof cardStatusText>[0]> = {}) => ({ slug: "AbCdEfGh_-123456", title: "臺北市的公園密度最高", createdAt: "2026-09-28T02:00:00Z", expiresAt: "2026-10-28T02:00:00Z", revokedAt: null, bytes: 2048, ...overrides });

describe("我的卡片（會員專區）", () => {
  it("有效／已撤銷／已到期狀態文字", () => {
    expect(cardStatusText(card(), now)).toBe("連結到期：2026-10-28");
    expect(cardStatusText(card({ revokedAt: "2026-09-30T02:00:00Z" }), now)).toBe("已撤銷（2026-09-30）");
    expect(cardStatusText(card({ expiresAt: "2026-09-30T02:00:00Z" }), now)).toBe("已到期（2026-09-30）");
  });

  it("有效卡片可複製與撤銷；已撤銷的按鈕停用；空清單有說明", () => {
    const html = renderToStaticMarkup(createElement(MyAnalysisCardsList, { cards: [card(), card({ slug: "ZZZZZZZZZZZZZZZZ", revokedAt: "2026-09-30T02:00:00Z" })], busySlug: null, onCopy: () => {}, onRevoke: () => {}, now }));
    expect(html).toContain("臺北市的公園密度最高");
    expect(html.match(/<button>撤銷<\/button>/g)).toHaveLength(1);
    expect(html.match(/<button disabled="">撤銷<\/button>/g)).toHaveLength(1);
    expect(renderToStaticMarkup(createElement(MyAnalysisCardsList, { cards: [], busySlug: null, onCopy: () => {}, onRevoke: () => {} }))).toContain("還沒有發布過分析卡");
  });
});
