import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGEND_SWATCH, LegendCompactCtx, LegendNote, LegendThemeCtx, LegendTitle, LIGHT_LEGEND, SwatchDot, SwatchHatch } from "../legendKit";
import { hatchImageData } from "../../../map/mapStyleScale";

const legendPanelSource = () => readFileSync(fileURLToPath(new URL("../../LegendPanel.tsx", import.meta.url)), "utf8");

describe("legendKit", () => {
  it("LG-11：標題中文在前、英文小字在後，不轉大寫", () => {
    const html = renderToStaticMarkup(createElement(LegendTitle, { zh: "醫療據點", en: "Medical" }));
    expect(html.indexOf("醫療據點")).toBeLessThan(html.indexOf("Medical"));
    expect(html).not.toMatch(/uppercase|MEDICAL/);
  });

  it("LG-1：點色票 10px，描邊用底圖色（淡色底圖為白）", () => {
    const html = renderToStaticMarkup(createElement(LegendThemeCtx.Provider, { value: LIGHT_LEGEND }, createElement(SwatchDot, { color: "#e53935" })));
    expect(html).toContain(`width:${LEGEND_SWATCH.dot}px`);
    expect(html).toContain("0 0 1px #ffffff");
  });

  it("LG-7：缺值單向斜線、遮蔽交叉斜線；地圖 hatch 圖同樣區分", () => {
    const missing = renderToStaticMarkup(createElement(SwatchHatch, { kind: "missing" }));
    const suppressed = renderToStaticMarkup(createElement(SwatchHatch, { kind: "suppressed" }));
    expect(missing.match(/repeating-linear-gradient/g)).toHaveLength(1);
    expect(suppressed.match(/repeating-linear-gradient/g)).toHaveLength(2);
    const lit = (kind: "missing" | "suppressed") => hatchImageData(kind, true).data.filter((_, i) => i % 4 === 3 && _ > 0).length;
    expect(lit("suppressed")).toBeGreaterThan(lit("missing"));
  });

  it("LG-9：compact 時註記不顯示", () => {
    const note = createElement(LegendNote, null, "來源：內政部");
    expect(renderToStaticMarkup(note)).toContain("來源：內政部");
    expect(renderToStaticMarkup(createElement(LegendCompactCtx.Provider, { value: true }, note))).toBe("");
  });
});

describe("LegendPanel 收斂 ratchet", () => {
  it("標題不再手寫 letterSpacing: 1 的英文大寫樣式", () => {
    expect(legendPanelSource()).not.toMatch(/letterSpacing: 1\b/);
  });

  it("手寫色票尺寸（width: N, height: N）只能減少，新圖例請用 legendKit 的 Swatch*", () => {
    const count = legendPanelSource().match(/width: \d+, height: \d+/g)?.length ?? 0;
    expect(count).toBeLessThanOrEqual(90);
  });
});
