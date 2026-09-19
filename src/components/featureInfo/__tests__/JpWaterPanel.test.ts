import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpWaterPanel } from "../japanPanels";

describe("JpWaterPanel", () => {
  it("shows a name-derived supply category without overstating the source", () => {
    const html = renderToStaticMarkup(createElement(JpWaterPanel, { props: {
      name: "東浦浄水場", role: "上水道相關設施", facility_category: "water_treatment_plant",
      facility_category_label: "淨水場", classification_basis: "name_pattern", classification_match: "浄水場",
      water_system: "東浦上水道", year: "2010", source: "P21",
    } }));
    expect(html).toContain("東浦浄水場");
    expect(html).toContain("設施細類");
    expect(html).toContain("淨水場");
    expect(html).toContain("依設施名稱「浄水場」推定");
    expect(html).toContain("東浦上水道");
  });

  it("shows the P22 source subtype for sewer facilities", () => {
    const html = renderToStaticMarkup(createElement(JpWaterPanel, { props: {
      name: "中継ポンプ場", role: "下水道相關設施", facility_category: "sewer_pump_station",
      facility_category_label: "下水道泵場", classification_basis: "source_subtype", classification_match: "P22a",
      year: "2012", source: "P22",
    } }));
    expect(html).toContain("下水道泵場");
    expect(html).toContain("來源資料子型 P22a");
  });
});
