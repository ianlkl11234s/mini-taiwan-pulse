import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { localeStore } from "../../../state/localeStore";
import { confirmWordMatches, DeleteAccountConfirm, deletionErrorText } from "../DeleteAccountSection";

const noop = () => {};
const render = (typed: string, extra: Partial<Parameters<typeof DeleteAccountConfirm>[0]> = {}) =>
  renderToStaticMarkup(createElement(DeleteAccountConfirm, { typed, busy: false, error: null, onType: noop, onCancel: noop, onConfirm: noop, ...extra }));

describe("刪除帳號確認區塊", () => {
  it("寫清後果；沒輸入確認字前「永久刪除」停用", () => {
    const html = render("");
    expect(html).toContain("永久刪除帳號");
    expect(html).toContain("無法復原");
    expect(html).toContain("tree-report");
    expect(html).toMatch(/<button type="submit" class="member-danger" disabled="">永久刪除<\/button>/);
  });

  it("輸入確認字後可按；處理中顯示「正在刪除…」並停用", () => {
    expect(render("刪除")).toMatch(/<button type="submit" class="member-danger">永久刪除<\/button>/);
    expect(render("刪除", { busy: true })).toMatch(/<button type="submit" class="member-danger" disabled="">正在刪除…<\/button>/);
  });

  it("失敗訊息顯示在區塊內（role=alert），技術細節只放 title", () => {
    const html = render("刪除", { error: { text: "刪除未完成，帳號與資料都還在。請稍後再試。", detail: "P0001 boom" } });
    expect(html).toContain('role="alert"');
    expect(html).toContain('title="P0001 boom"');
    expect(html).toContain("刪除未完成");
  });

  it("錯誤分類對應文案", () => {
    const i18n = localeStore.getSnapshot();
    expect(deletionErrorText({ ok: false, reason: "owner", detail: "" }, i18n)).toBe("站主帳號不能在這裡刪除。");
    expect(deletionErrorText({ ok: false, reason: "unavailable", detail: "" }, i18n)).toContain("目前無法使用");
    expect(deletionErrorText({ ok: false, reason: "failed", detail: "" }, i18n)).toContain("刪除未完成");
  });

  it("確認字比對忽略前後空白與大小寫", () => {
    expect(confirmWordMatches(" delete ", "DELETE")).toBe(true);
    expect(confirmWordMatches("刪", "刪除")).toBe(false);
  });
});
