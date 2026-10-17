import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingStatus, statusText } from "../LoadingStatus";

describe("LoadingStatus", () => {
  it("中文文案，沒有英文大寫 LOADING 或 more", () => {
    expect(statusText({ visible: true, phase: "loading", label: "寺廟", extra: 2, count: 0 })).toEqual({ main: "載入中 · 寺廟", extra: "+2" });
    expect(statusText({ visible: true, phase: "done", label: "寺廟", extra: 0, count: 1 }).main).toBe("已載入 · 寺廟");
    expect(statusText({ visible: true, phase: "done", label: "寺廟", extra: 0, count: 3 }).main).toBe("已載入 3 項");
    expect(statusText({ visible: true, phase: "error", label: "淹水潛勢", extra: 0, count: 0 }).main).toBe("載入失敗 · 淹水潛勢");
  });

  it("初始為隱藏狀態（保留節點以便淡入淡出），位置在工具列下方", () => {
    const html = renderToStaticMarkup(createElement(LoadingStatus, { isDarkTheme: false }));
    expect(html).toContain('class="loading-status loading-status--loading loading-status--light"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("top:60px");
    expect(html).not.toMatch(/LOADING|more/);
  });
});
