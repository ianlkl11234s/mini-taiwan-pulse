import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlertSummaryBar } from "../AlertSummaryBar";
import { tallySummary } from "../../../../data/alertsLoader";

const tally = tallySummary([
  { group: "weather", count: 3, severe: 1, top_term: null, sev_minor: 2, sev_moderate: 0, sev_severe: 1, sev_extreme: 0 },
] as unknown as Parameters<typeof tallySummary>[0]);
const base = { tally, status: "ready" as const, lastSuccessAt: 1, expanded: true, onToggle: () => {}, activeGroups: ["weather" as const], onPickGroup: () => {} };

describe("AlertSummaryBar 篩選後為 0（review #1215）", () => {
  it("全國有警報但篩選後 0 則：仍保留群組晶片與展開鈕，才能清除群組篩選", () => {
    const html = renderToStaticMarkup(createElement(AlertSummaryBar, { ...base, total: 0, severe: 0 }));
    expect(html).toContain("<button");
    expect(html.match(/<button/g)!.length).toBeGreaterThan(1);
  });

  it("全國也沒有警報：維持極簡單條（沒有按鈕）", () => {
    const empty = tallySummary([]);
    const html = renderToStaticMarkup(createElement(AlertSummaryBar, { ...base, tally: empty, total: 0, severe: 0 }));
    expect(html).not.toContain("<button");
  });
});
