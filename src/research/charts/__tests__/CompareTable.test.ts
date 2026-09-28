import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompareTable, type CompareTableColumn, type CompareTableRow } from "../CompareTable";

const columns: CompareTableColumn[] = [{ id: "1", label: "台北車站" }, { id: "2", label: "板橋車站" }, { id: "3", label: "新竹車站" }];
const rows: CompareTableRow[] = [
  { id: "a", label: "餐飲店家數", unit: null, cells: [{ value: 30, notCovered: false, rank: 1 }, { value: 10, notCovered: false, rank: 2 }, { value: null, notCovered: true, rank: null }] },
  { id: "b", label: "人口密度", unit: "人/km²", cells: [{ value: 5, notCovered: false, rank: 2 }, { value: 8, notCovered: false, rank: 1 }, { value: null, notCovered: false, rank: null }] },
];

describe("CompareTable component", () => {
  it("bolds the server-ranked best cell in each row and keeps 未涵蓋／無資料 separate from 0", () => {
    const html = renderToStaticMarkup(createElement(CompareTable, { columns, rows, theme: "dark" }));
    expect(html).toContain("台北車站");
    expect(html).toContain("未涵蓋");
    expect(html).toContain("無資料");
    expect(html.match(/agent-compare-table__best/g)).toHaveLength(2);
    expect(html).not.toContain(">0<");
  });

  it("renders a proportional mini-bar under every numeric cell, sized by its share of the row max", () => {
    const html = renderToStaticMarkup(createElement(CompareTable, { columns, rows, theme: "dark" }));
    const widths = [...html.matchAll(/width:(\d+)%/g)].map(match => Number(match[1]));
    // row a: 30 (max) -> 100%, 10 -> 33%; not-covered cell has no bar
    expect(widths).toContain(100);
    expect(widths).toContain(33);
  });

  it("renders no <button> without onSelectColumn, and one per column with it", () => {
    const plain = renderToStaticMarkup(createElement(CompareTable, { columns, rows, theme: "dark" }));
    expect(plain).not.toContain("<button");
    let clicked: string | null = null;
    const withSelect = renderToStaticMarkup(createElement(CompareTable, { columns, rows, theme: "dark", onSelectColumn: (id) => { clicked = id; } }));
    expect(withSelect.match(/<button/g)).toHaveLength(3);
    void clicked;
  });
});
