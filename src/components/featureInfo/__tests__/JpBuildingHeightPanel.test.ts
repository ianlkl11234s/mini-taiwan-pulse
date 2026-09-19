import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpBuildingHeightPanel } from "../urbanPanels";

describe("日本建物高度 popup 資料語意", () => {
  it("保留分片、年份、高度方法、輪廓方法與授權", () => {
    const html = renderToStaticMarkup(createElement(JpBuildingHeightPanel, { props: {
      height: 47, jp_region_label: "名古屋市 ・ 52366700", source_year: 2022,
      height_method: "bldg:measuredHeight", geometry_method: "bldg:lod0FootPrint",
      license: "Licensed under CC BY 4.0", attribution: "PLATEAU／名古屋市",
    } }));
    for (const value of ["名古屋市 ・ 52366700", "2022", "bldg:measuredHeight", "bldg:lod0FootPrint", "Licensed under CC BY 4.0"])
      expect(html).toContain(value);
  });

  it("高度缺值不會被顯示為零", () => {
    const html = renderToStaticMarkup(createElement(JpBuildingHeightPanel, { props: { height: null } }));
    expect(html).toContain("未提供（維持 2D 平面）");
    expect(html).not.toContain("0.0 m");
  });
});
