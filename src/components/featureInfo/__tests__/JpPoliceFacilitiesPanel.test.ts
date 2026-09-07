import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpPoliceFacilitiesPanel } from "../japanPanels";

describe("日本警察設施 popup 資料語意", () => {
  it.each([null, undefined, "", "null"])("缺漏電話 %s 顯示未提供", phone => {
    const html = renderToStaticMarkup(createElement(JpPoliceFacilitiesPanel, { props: { name: "測試交番", facility_type: "koban", phone } }));
    expect(html).toContain("未提供");
    expect(html).not.toContain(">null<");
    expect(html).not.toContain(">undefined<");
  });
  it("只對 degraded 明示約略位置並保留地址來源", () => {
    const render = (geom_status: string) => renderToStaticMarkup(createElement(JpPoliceFacilitiesPanel, { props: { geom_status, geom_precision: "town", geometry_source: "gsi_address" } }));
    expect(render("degraded")).toContain("約略位置");
    expect(render("degraded")).toContain("国土地理院 AddressSearch");
    expect(render("hit")).not.toContain("約略位置");
  });
});
