import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeatureInfoPanel } from "../../FeatureInfoPanel";
import { SiteStudyMLegend } from "../../legend/siteStudyLegends";
import type { FeatureInfo } from "../../../types";

// 測試資料全部自編，不含任何實際資料內容。
const render = (properties: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(FeatureInfoPanel, { feature: { layerType: "siteStudyM", properties } as FeatureInfo, onClose: () => {} }));

describe("設施研究 M popup", () => {
  it("主資料：標題用 name，欄位標題是中性字且不是原始 i18n key", () => {
    const html = render({
      _part: "sites", name: "甲地", names: "甲地|甲地舊名", kind_label: "類型甲", status_label: "狀態甲", geom_label: "面",
      sources_label: "來源甲、來源乙", area_m2: 12345, color: "#112233",
    });
    for (const text of ["甲地", "類型", "類型甲", "狀態", "狀態甲", "幾何", "來源", "來源甲、來源乙", "其他名稱", "甲地舊名", "面積", "12,345 m²"]) expect(html, text).toContain(text);
    expect(html).not.toContain("popup.siteStudy.");
    expect(html).not.toContain("來源資訊待補");
  });

  it("沒有 name 時標題退回 kind_label；空值與字串 null 的列不顯示", () => {
    const html = render({ _part: "sites", name: "null", names: "", kind_label: "類型乙", status_label: null, area_m2: null });
    expect(html).toContain("類型乙");
    expect(html).not.toContain("null");
    expect(html).not.toContain("其他名稱");
    expect(html).not.toContain("面積");
    expect(html).not.toContain("狀態");
  });

  it("參考資料：列出類型、幾何、來源、日期、備註與關聯編號", () => {
    const html = render({
      _part: "overlays", name: null, overlay_label: "參考甲", geom_label: "點", source_label: "來源丙", source_date: "2026-01-01",
      note: "備註文字", link_site_ids: "S-1", color: "#445566",
    });
    for (const text of ["參考甲", "幾何", "點", "來源丙", "2026-01-01", "備註文字", "關聯編號", "S-1"]) expect(html, text).toContain(text);
    expect(html).not.toContain("popup.siteStudy.");
  });
});

describe("設施研究 M 圖例", () => {
  it("資料還沒載入時顯示圖層名與載入中，不是原始 i18n key", () => {
    const html = renderToStaticMarkup(createElement(SiteStudyMLegend));
    expect(html).toContain("設施研究 M");
    expect(html).toContain("載入中");
    expect(html).not.toContain("legend.siteStudy.");
    expect(html).not.toContain("參考資料"); // 開關預設關閉
  });
});
