import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BridgeComparisonNewTaipeiPanel, OfficialBridgeNewTaipeiPanel, OsmBridgeCarrierPanel } from "../networkStructuresPanels";

describe("Network Structures popup semantics", () => {
  it("保留重合端點，且 0 登錄長度不會被當成缺值", () => {
    const html = renderToStaticMarkup(createElement(OfficialBridgeNewTaipeiPanel, { props: {
      official_id: "427", official_length_m: 0, geometry_role: "coincident_endpoints",
      source_date: "2025-12-29", source_name: "新北市政府", source_url: "https://example.com/source",
    } }));
    expect(html).toContain("原始重合端點；無可評估軸線");
    expect(html).toContain("0 m");
    expect(html).toContain("官方詮釋資料更新時間，非實測日期");
  });

  it("候選評分 null 明示未評估，並格式化 object[] 的比對原因", () => {
    const html = renderToStaticMarkup(createElement(BridgeComparisonNewTaipeiPanel, { props: {
      match_status: "NOT_EVALUATED", match_confidence: null,
      match_reasons: JSON.stringify([{ distance_m: 12.5, name_equal: false }]),
      geometry_role: "coincident_endpoints", source_date: "2025-12-29",
    } }));
    expect(html).toContain("未評估（缺值）");
    expect(html).toContain("線段距離（m）：12.5；名稱一致：否");
  });
  it("OSM 快照與官方詮釋資料日期分開說明", () => {
    const html = renderToStaticMarkup(createElement(OsmBridgeCarrierPanel, { props: {
      osm_type: "way", osm_id: "9", source_date: "2026-09-05T20:22:06Z", geometry_role: "carrier_segment",
      source_url: "javascript:alert(1)",
    } }));
    expect(html).toContain("OSM 快照截止時間");
    expect(html).toContain("OSM 承載路段");
    expect(html).not.toContain("官方詮釋資料");
    expect(html).not.toContain("javascript:");
  });
});
