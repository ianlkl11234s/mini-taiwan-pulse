import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildBasemapStyle } from "../basemapStyle";

// basemapUrl() 用 window.location 組絕對網址；Node 環境補一個假的。
beforeAll(() => { vi.stubGlobal("window", { location: { href: "http://localhost/embed" } }); });
afterAll(() => { vi.unstubAllGlobals(); });

/** 抓出所有 symbol layer 的 text-field，序列化後看用了哪個 name 欄位。 */
function labelFields(locale: "zh-TW" | "en" | "ja"): string {
  const style = buildBasemapStyle(true, locale);
  return style.layers
    .filter((layer) => layer.type === "symbol")
    .map((layer) => JSON.stringify((layer.layout as Record<string, unknown> | undefined)?.["text-field"] ?? null))
    .join("\n");
}

describe("嵌入頁底圖地名語言", () => {
  it("中文介面維持繁中地名（name:zh-Hant）", () => {
    expect(labelFields("zh-TW")).toContain("name:zh-Hant");
  });
  it("英文介面用英文地名", () => {
    const fields = labelFields("en");
    expect(fields).toContain("name:en");
    expect(fields).not.toContain("name:zh-Hant");
  });
  it("日文介面用日文地名", () => {
    const fields = labelFields("ja");
    expect(fields).toContain("name:ja");
    expect(fields).not.toContain("name:zh-Hant");
  });
});
