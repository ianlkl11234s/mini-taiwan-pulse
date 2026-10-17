import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankBars, rankBarsWithOther, type RankBarItem } from "../RankBars";

const items: RankBarItem[] = [
  { id: "a", label: "A 區", value: 30, color: "#111111" },
  { id: "b", label: "B 區", value: 90, color: "#222222" },
  { id: "c", label: "C 區", value: null, color: "#333333" },
  { id: "d", label: "D 區", value: 10, color: "#444444" },
];

describe("rankBarsWithOther", () => {
  it("sorts by value descending with null values last", () => {
    const sorted = rankBarsWithOther(items, "dark", 10);
    expect(sorted.map(item => item.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("collapses everything past maxItems into one averaged 其他 N 區 row", () => {
    const many: RankBarItem[] = Array.from({ length: 13 }, (_, index) => ({ id: `r${index}`, label: `區 ${index}`, value: 13 - index, color: "#000" }));
    const collapsed = rankBarsWithOther(many, "dark", 10);
    expect(collapsed).toHaveLength(11);
    expect(collapsed[10]!.label).toBe("其他 3 區");
    // top 10 = values 13..4, rest = values 3,2,1 -> average 2
    expect(collapsed[10]!.value).toBe(2);
    expect(collapsed[10]!.color).toBe("#6b7280"); // categorical "other" dark
  });

  it("keeps everything when at or under maxItems (no 其他 row)", () => {
    const exact = rankBarsWithOther(items, "dark", 10);
    expect(exact.some(item => item.label.startsWith("其他"))).toBe(false);
  });
});

describe("RankBars component", () => {
  it("renders a role=img svg with a Chinese aria-label summarising the ranking", () => {
    const html = renderToStaticMarkup(createElement(RankBars, { items, theme: "dark", title: "測試排名" }));
    expect(html).toContain('role="img"');
    expect(html).toContain("測試排名");
    expect(html).toContain("排名長條圖");
    expect(html).toContain("最高「B 區」");
    expect(html).toContain("由高到低");
  });

  it("shows 無資料 for a null-value item instead of a fabricated bar", () => {
    const html = renderToStaticMarkup(createElement(RankBars, { items, theme: "dark" }));
    expect(html).toContain("無資料");
  });

  it("appends the unit to every value except a percent kind (already carries its own %)", () => {
    const withUnit = renderToStaticMarkup(createElement(RankBars, { items: [{ id: "a", label: "A", value: 12, color: "#000" }], theme: "dark", unit: "人/km²" }));
    expect(withUnit).toContain("12人/km²");
    const percent = renderToStaticMarkup(createElement(RankBars, { items: [{ id: "a", label: "A", value: 12.3, color: "#000" }], theme: "dark", valueKind: "percent", unit: "%" }));
    expect(percent).toContain("12.3%");
    expect(percent).not.toContain("12.3%%");
  });

  it("summarises an empty item list without crashing", () => {
    const html = renderToStaticMarkup(createElement(RankBars, { items: [], theme: "dark", title: "空清單" }));
    expect(html).toContain("暫無資料");
  });
});
