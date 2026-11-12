import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MergedCompareLegend, type StatisticsLegendViewProps } from "../CompareStatisticsLegend";

const KEY = "statsMortalityRateTownship";
const RIGHT = `${KEY}::R`;
// 假的 View：只印出被要求畫哪一塊、讀哪一份
const View = ({ storeKey, part }: StatisticsLegendViewProps) => h("i", null, `[${part ?? "full"}@${storeKey ?? KEY}]`);
const render = (splitRows: boolean) => renderToStaticMarkup(h(MergedCompareLegend, { layerKey: KEY, rightKey: RIGHT, View, splitRows }));
const count = (html: string, text: string) => html.split(text).length - 1;

describe("比較模式合成圖例", () => {
  it("指標名一次、左右各一行期別；色階相同只畫一組色票", () => {
    const html = render(false);
    expect(count(html, "[title@")).toBe(1);
    expect(html).toContain(`[period@${KEY}]`);
    expect(html).toContain(`[period@${RIGHT}]`);
    expect(count(html, "[rows@")).toBe(1);
    expect(html).toContain("左：");
    expect(html).toContain("右：");
  });

  it("色階不同：左右兩排色票並列", () => {
    const html = render(true);
    expect(html).toContain(`[rows@${KEY}]`);
    expect(html).toContain(`[rows@${RIGHT}]`);
    expect(html).toContain("左側");
    expect(html).toContain("右側");
  });

  it("出典與說明預設收合：按鈕 aria-expanded=false，註記不畫", () => {
    const html = render(true);
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>說明/);
    expect(html).not.toContain("[notes@");
    expect(html).not.toContain("[full@");
  });
});
