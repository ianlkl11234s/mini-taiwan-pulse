import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { DengueClustersLegend } from "../twLiveLegends";
import { setTwLiveSummary } from "../../../data/twLiveSnapshots";

afterEach(() => setTwLiveSummary("dengueClusters", null));

describe("登革熱聚集區圖例（B8）", () => {
  it("沒有聚集區時寫明「近兩週沒有本土聚集區」與資料日期", () => {
    setTwLiveSummary("dengueClusters", { shown: 0, dataTime: "2026-11-20" });
    const html = renderToStaticMarkup(createElement(DengueClustersLegend));
    expect(html).toContain("近兩週沒有本土聚集區");
    expect(html).toContain("2026-11-20");
    expect(html).toContain('role="status"');
  });

  it("有聚集區時寫個數，不出現空資料提示", () => {
    setTwLiveSummary("dengueClusters", { shown: 2, dataTime: "2026-11-22" });
    const html = renderToStaticMarkup(createElement(DengueClustersLegend));
    expect(html).toContain("2 個聚集區");
    expect(html).not.toContain("近兩週沒有本土聚集區");
  });
});
