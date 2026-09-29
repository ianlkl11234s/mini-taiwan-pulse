import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisCard, CardMapFallback } from "../AnalysisCard";
import { CardPageView } from "../CardApp";
import { areaPayload, pointsPayload } from "./cardFixtures";

describe("卡片頁渲染", () => {
  it("完整 payload：結論、重點數字、前 3 名、圖例、來源、到期日、Pulse 標記", () => {
    const html = renderToStaticMarkup(createElement(AnalysisCard, { payload: areaPayload(), expiresAt: "2026-10-27T17:00:00Z", mapSlot: createElement("div", { id: "map-slot" }) }));
    expect(html).toContain("臺北市的公園密度最高");
    expect(html).toContain("最高：臺北市");
    expect(html).toContain("有資料的區域");
    expect(html).toContain("前 3 名");
    expect(html).toContain("新北市");
    expect(html).toContain("公園密度（處/km²）");
    expect(html).toContain("分位數分級");
    expect(html).toContain("無資料");
    expect(html).toContain("都市計畫公園");
    expect(html).toContain("授權 OGDL-Taiwan-1.0");
    expect(html).toContain("內政部國土測繪中心");
    expect(html).toContain("金門縣沒有資料");
    expect(html).toContain("連結到期：");
    expect(html).toContain("2026-10-28");
    expect(html).toContain("Mini Taiwan Pulse");
    expect(html).toContain('id="map-slot"');
  });

  it("比率類數值依 legend.value_kind 保留小數，不被當件數四捨五入", () => {
    const base = areaPayload();
    const payload = { ...base, top: [{ name: "嘉義縣", value: 1.5004829, class_index: 4 }, { name: "雲林縣", value: 1.4900405, class_index: 4 }, { name: "臺東縣", value: 1.4880952, class_index: 4 }], legend: { ...base.legend, unit: "件／萬名居民", value_kind: "ratio" as const } };
    const html = renderToStaticMarkup(createElement(AnalysisCard, { payload, expiresAt: null, mapSlot: null }));
    expect(html).toContain("1.5");
    expect(html).toContain("1.49");
    expect(html).not.toMatch(/>2<|>2件/);
  });
  it("界線載入失敗：地圖區顯示容錯訊息，其他內容照常", () => {
    const html = renderToStaticMarkup(createElement(AnalysisCard, { payload: areaPayload(), expiresAt: null, mapSlot: createElement(CardMapFallback, { message: "地圖邊界暫時無法載入" }) }));
    expect(html).toContain("地圖邊界暫時無法載入");
    expect(html).toContain("臺北市的公園密度最高");
    expect(html).toContain("都市計畫公園");
  });

  it("點類卡片沒有長條也能渲染", () => {
    const html = renderToStaticMarkup(createElement(AnalysisCard, { payload: pointsPayload(), expiresAt: null, expiryNote: "發布後 30 天到期", mapSlot: null, variant: "preview" }));
    expect(html).toContain("analysis-card--preview");
    expect(html).toContain("發布後 30 天到期");
    expect(html).not.toContain("前 3 名");
  });

  it("失效、無效連結、暫時無法載入是三個不同畫面", () => {
    expect(renderToStaticMarkup(createElement(CardPageView, { state: { status: "gone" } }))).toContain("這張卡片已失效");
    expect(renderToStaticMarkup(createElement(CardPageView, { state: { status: "invalid" } }))).toContain("連結無效");
    const error = renderToStaticMarkup(createElement(CardPageView, { state: { status: "error", detail: "HTTP_500" } }));
    expect(error).toContain("暫時無法載入");
    expect(error).not.toContain("已失效");
  });
});
