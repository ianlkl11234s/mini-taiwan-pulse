import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisResultPanel } from "../analysisResultPanels";
import { PANEL_REGISTRY, HEADER_LABELS } from "../registry";

const record = (title: string, facts: { label: string; value: string }[]) => ({ title, color: "#38bdf8", facts });

describe("AnalysisResultPanel", () => {
  it("is wired into the docked FeatureInfoPanel registry with a Chinese header", () => {
    expect(PANEL_REGISTRY.analysisResult).toBe(AnalysisResultPanel);
    expect(HEADER_LABELS.analysisResult).toBe("分析結果");
  });

  it("renders the first record's facts and the temporary-result footer", () => {
    const html = renderToStaticMarkup(createElement(AnalysisResultPanel, { props: {
      records: [record("甲國小", [{ label: "資料集", value: "國小周邊" }, { label: "距離", value: "120 公尺 · 直線" }])],
      total: 1, omitted: 0,
    } }));
    expect(html).toContain("甲國小");
    expect(html).toContain("國小周邊");
    expect(html).toContain("120 公尺 · 直線");
    expect(html).toContain("暫時分析結果 · 非完整來源圖層");
    expect(html).not.toContain("<select");
  });

  it("offers an overlap selector and discloses omitted records", () => {
    const html = renderToStaticMarkup(createElement(AnalysisResultPanel, { props: {
      records: [record("甲國小", []), record("乙國小", [])],
      total: 10, omitted: 8,
    } }));
    expect(html).toContain("aria-label=\"選擇重疊分析紀錄\"");
    expect(html).toContain("1. 甲國小");
    expect(html).toContain("2. 乙國小");
    expect(html).toContain("另有 8 筆重疊紀錄未列出");
  });

  it("falls back to the generic record fact for a malformed payload", () => {
    const html = renderToStaticMarkup(createElement(AnalysisResultPanel, { props: { label: "x" } }));
    expect(html).toContain("本次分析命中的空間紀錄");
  });
});
