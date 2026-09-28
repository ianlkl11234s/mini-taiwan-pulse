import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrendLine, type TrendPoint } from "../TrendLine";

const points: TrendPoint[] = [
  { id: "p1", label: "09/01", value: 10 },
  { id: "p2", label: "09/02", value: null },
  { id: "p3", label: "09/03", value: 30 },
];

describe("TrendLine component", () => {
  it("renders a role=img svg with a Chinese aria-label naming the latest period's value", () => {
    const html = renderToStaticMarkup(createElement(TrendLine, { points, title: "測試趨勢" }));
    expect(html).toContain('role="img"');
    expect(html).toContain("測試趨勢");
    expect(html).toContain("趨勢折線圖");
    expect(html).toContain('最新一期「09/03」30');
  });

  it("breaks the line into separate path segments around a null value (never interpolates across it)", () => {
    const html = renderToStaticMarkup(createElement(TrendLine, { points }));
    // Two "M " subpaths: one for [p1] alone, one for [p3] alone — never a single continuous run.
    const linePathMatch = html.match(/<path d="([^"]*)" fill="none" stroke="currentColor" stroke-width="1.75"/);
    expect(linePathMatch).not.toBeNull();
    const moveCommands = (linePathMatch![1]!.match(/M /g) ?? []).length;
    expect(moveCommands).toBe(2);
  });

  it("draws a dashed baseline line when a baseline series is given, and mentions it in the summary", () => {
    const baseline: TrendPoint[] = [
      { id: "p1", label: "去年09/01", value: 8 },
      { id: "p2", label: "去年09/02", value: 9 },
      { id: "p3", label: "去年09/03", value: 20 },
    ];
    const withBaseline = renderToStaticMarkup(createElement(TrendLine, { points, baseline }));
    expect(withBaseline).toContain("stroke-dasharray");
    expect(withBaseline).toContain("已加上比較基準線");
    const withoutBaseline = renderToStaticMarkup(createElement(TrendLine, { points }));
    expect(withoutBaseline).not.toContain("stroke-dasharray");
  });

  it("drops the axes (ticks/gridlines) in compact mode but keeps the aria-label summary", () => {
    const compact = renderToStaticMarkup(createElement(TrendLine, { points, compact: true }));
    expect(compact).toContain('role="img"');
    expect(compact).not.toContain("font-size=\"8\""); // no x-axis tick labels
    const full = renderToStaticMarkup(createElement(TrendLine, { points }));
    expect(full).toContain("09/01"); // an x-axis tick label appears in the full chart
  });

  it("says 最新一期無資料 when the very last point is null, without inventing a dot", () => {
    const trailingNull: TrendPoint[] = [{ id: "p1", label: "09/01", value: 10 }, { id: "p2", label: "09/02", value: null }];
    const html = renderToStaticMarkup(createElement(TrendLine, { points: trailingNull }));
    expect(html).toContain("最新一期無資料");
    expect(html).not.toContain("<circle");
  });

  it("appends the unit to the latest-value label except for a percent kind", () => {
    const withUnit = renderToStaticMarkup(createElement(TrendLine, { points: [{ id: "p1", label: "09/01", value: 12 }], unit: "件" }));
    expect(withUnit).toContain("12件");
  });
});
