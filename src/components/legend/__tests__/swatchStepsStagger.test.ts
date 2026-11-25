import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwatchSteps, swatchStepsStaggered } from "../legendKit";
import { ID_RASTER_BY_KEY } from "../../../countries/id/idWavesLayers";

/** 2026-11-24 正式站驗收：色別標高「0100300600 1,0001,5002,5004,500 m」、多災種「P0–20P20–40…」刻度黏在一起。 */
describe("SwatchSteps 刻度太長時交錯兩列", () => {
  const relief = ID_RASTER_BY_KEY.idTerrainRelief.steps!;
  const multi = ID_RASTER_BY_KEY.idInariskMulti.steps!;
  const thirds = ID_RASTER_BY_KEY.idInariskFlood.steps!;

  it("色別標高 8 格、多災種 5 格交錯；三等分不交錯", () => {
    expect(swatchStepsStaggered(relief.length, relief.map((s) => s.label))).toBe(true);
    expect(swatchStepsStaggered(multi.length, multi.map((s) => s.label))).toBe(true);
    expect(swatchStepsStaggered(thirds.length, thirds.map((s) => s.label))).toBe(false);
  });
  it("刻度數與色格數不同（邊界刻度）不交錯，維持原排法", () => {
    expect(swatchStepsStaggered(3, ["0", "100", "1,000", "10,000 people per km²"])).toBe(false);
  });
  it("交錯時每個刻度對齊自己那一格，奇偶分兩列", () => {
    const html = renderToStaticMarkup(createElement(SwatchSteps, { colors: relief.map((s) => s.color), breaks: relief.map((s) => s.label) }));
    expect(html).toContain("data-stagger");
    expect(html).toContain("grid-column:2;grid-row:2");
    expect(html).toContain("grid-column:3;grid-row:1");
  });
  it("review #1241：標籤軌與色塊軌同為 minmax(0,1fr)、欄距相同，長標籤不會把自己那欄撐寬而與色塊錯位", () => {
    const html = renderToStaticMarkup(createElement(SwatchSteps, { colors: relief.map((s) => s.color), breaks: relief.map((s) => s.label) }));
    const n = relief.length;
    expect(html).toContain(`grid-template-columns:repeat(${n}, minmax(0, 1fr))`);
    expect(html).toContain("grid-auto-columns:minmax(0, 1fr)");
    expect(html).not.toMatch(/repeat\(\d+, 1fr\)/);
    expect(html.match(/(?:column-gap|gap):1px/g)!.length).toBeGreaterThanOrEqual(2);
  });
  it("不交錯時刻度之間仍留間距", () => {
    const html = renderToStaticMarkup(createElement(SwatchSteps, { colors: thirds.map((s) => s.color), breaks: thirds.map((s) => s.label) }));
    expect(html).not.toContain("data-stagger");
    expect(html).toContain("gap:4px");
  });
});
