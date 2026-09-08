import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoralReefPanel } from "../CoralReefPanel";

describe("珊瑚礁歷史分布 popup 資料語意", () => {
  it("將 MVT 缺欄位視為未提供，不把 source_year 補成發布年", () => {
    const html = renderToStaticMarkup(createElement(CoralReefPanel, { props: {
      feature_id: "cr-v4.1-00001", source_dataset: "WCMC-008", source_version: "v4.1", source_year: undefined,
      source_loc_def: "線緩衝區", area_km2: undefined,
    } }));
    expect(html).toContain("未提供");
    expect(html).toContain("線緩衝區");
    expect(html).not.toContain(">2021<");
    expect(html).not.toContain(">null<");
  });

  it("保留零面積，並標示為完整全球來源 feature 面積", () => {
    const html = renderToStaticMarkup(createElement(CoralReefPanel, { props: {
      feature_id: "cr-v4.1-00002", area_km2: 0, source_loc_def: "polygon", source_year: null,
    } }));
    expect(html).toContain("0 km²");
    expect(html).toContain("全球完整來源 feature");
  });

  it("不把極小正整筆來源面積四捨五入成零", () => {
    const html = renderToStaticMarkup(createElement(CoralReefPanel, { props: {
      area_km2: 0.0004, source_loc_def: "polygon",
    } }));
    expect(html).toContain("4.00e-4 km²");
    expect(html).not.toContain(">0 km²<");
  });
});
