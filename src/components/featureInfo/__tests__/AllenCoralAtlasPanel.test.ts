import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AllenCoralAtlasPanel } from "../AllenCoralAtlasPanel";

describe("Allen Coral Atlas popup 資料語意", () => {
  it("將 MVT 缺欄位視為未提供，不把來源年份或取得日補成觀測日", () => {
    const html = renderToStaticMarkup(createElement(AllenCoralAtlasPanel, { props: {
      class_name: "Coral/Algae", source_year: undefined, source_area_sqkm: undefined,
      nominal_resolution_m: undefined, feature_id: "aca-1",
    } }));
    expect(html).toContain("未提供");
    expect(html).toContain("取得日 2026-09-15，不是觀測日");
    expect(html).not.toContain(">2026<");
    expect(html).not.toContain(">null<");
  });

  it("保留零來源完整要素面積，並揭露它不是研究區珊瑚總面積", () => {
    const html = renderToStaticMarkup(createElement(AllenCoralAtlasPanel, { props: {
      class_name: "Rock", source_area_sqkm: 0, nominal_resolution_m: 5,
    } }));
    expect(html).toContain("來源完整要素面積");
    expect(html).toContain("0 km²");
    expect(html).toContain("不能視為研究區珊瑚總面積");
  });

  it("保留棲地分類警語與金門馬祖 coverage 限制", () => {
    const html = renderToStaticMarkup(createElement(AllenCoralAtlasPanel, { props: { class_name: "Coral/Algae" } }));
    expect(html).toContain("不代表活珊瑚覆蓋率、健康或物種");
    expect(html).toContain("金門與馬祖無製圖要素，不代表沒有珊瑚");
  });
});
