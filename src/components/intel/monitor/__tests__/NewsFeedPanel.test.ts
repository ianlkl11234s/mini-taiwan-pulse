import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NewsFeedPanel } from "../NewsFeedPanel";

const props = {
  events: [], cats: [],
  onToggleCat: vi.fn(), onResetCats: vi.fn(),
  timeRange: "24h" as const, onTimeRange: vi.fn(),
  county: "全部", onCounty: vi.fn(),
  filter: { minRelevance: 0 as const, eventsOnly: false, minSeverity: 0 as const }, onFilterChange: vi.fn(),
  selectedId: null, expandedId: null, onSelectCard: vi.fn(), onToggleExpand: vi.fn(),
  isTrendingFor: vi.fn(), nowTs: Date.now(), lastSuccessAt: null,
};

describe("NewsFeedPanel query status", () => {
  it("does not render an interrupted feed as green or animated live data", () => {
    const markup = renderToStaticMarkup(createElement(NewsFeedPanel, { ...props, status: "error" }));
    expect(markup).toContain("更新中斷");
    expect(markup).toContain("background:#ef4444;box-shadow:0 0 5px #ef4444;animation:none");
    expect(markup).toContain("font-size:9px;font-weight:700;color:#ef4444\">更新中斷");
    expect(markup).not.toContain("animation:intelRing");
  });
});
