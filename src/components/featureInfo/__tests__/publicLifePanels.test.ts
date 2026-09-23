import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessibleParkFacilitiesPanel, NationalParkPanel, PublicLifeOsmPanel } from "../publicLifePanels";
import { PublicToiletPanel } from "../infraPanels";

describe("public life popup panels", () => {
  it("OSM 點位揭露快照限制、geometry precision 與來源連結", () => {
    const html = renderToStaticMarkup(createElement(PublicLifeOsmPanel, { props: {
      name: "建華里資源回收場",
      feature_type: "recycling",
      wheelchair: "unknown",
      geometry_precision: "osm_mapped_point",
      source_geometry_type: "MultiPolygon",
      display_geometry_method: "representative_point_for_point_layer",
      coverage_scope: "Taiwan OSM snapshot; community-mapped and incomplete",
      source: "OpenStreetMap Taiwan extract",
      source_url: "https://download.geofabrik.de/asia/taiwan.html",
      license: "ODbL-1.0",
      fetched_at: "2026-06-21T20:21:58Z",
    } }));

    expect(html).toContain("建華里資源回收場");
    expect(html).toContain("OSM 公共生活設施快照");
    expect(html).toContain("osm_mapped_point");
    expect(html).toContain("MultiPolygon");
    expect(html).toContain("由原始線／面取內部代表點");
    expect(html).toContain("community-mapped and incomplete");
    expect(html).toContain("OpenStreetMap Taiwan extract");
    expect(html).toContain("原始下載頁");
  });

  it("國家公園 popup 保留計畫邊界與非即時管制語意", () => {
    const html = renderToStaticMarkup(createElement(NationalParkPanel, { props: {
      name: "太魯閣國家公園",
      type: "national_park",
      plan_revision: "第2次通盤檢討",
      coverage_mode: "official_plan_boundary",
      geometry_precision: "official plan-map geometry; no simplification",
      source_url: "https://example.test/park.zip",
      license: "政府資料開放授權條款-第1版",
      fetched_at: "2026-09-22T15:18:22+00:00",
    } }));

    expect(html).toContain("太魯閣國家公園");
    expect(html).toContain("官方計畫邊界");
    expect(html).toContain("不代表即時開放、封閉或遊客管制狀態");
    expect(html).toContain("原始下載頁");
  });

  it("無障礙 popup 使用狀態色語意，不被 playground 類型覆蓋", () => {
    const html = renderToStaticMarkup(createElement(AccessibleParkFacilitiesPanel, { props: {
      name: "共融遊戲場",
      feature_type: "playground",
      wheelchair: "limited",
      accessibility_status: "limited",
      source: "OpenStreetMap Taiwan extract",
    } }));

    expect(html).toContain("部分可使用（limited）");
    expect(html).toContain("background:#f59e0b");
    expect(html).not.toContain("background:#ec4899");
  });

  it("公廁 popup 補上資料角色、來源、授權與抓取日", () => {
    const html = renderToStaticMarkup(createElement(PublicToiletPanel, { props: {
      name: "測試公廁",
      county: "臺北市",
      grade: "特優級",
      type2: "公園",
    } }));

    expect(html).toContain("環境部列管公廁（同址聚合）");
    expect(html).toContain("環境部環境資料開放平台");
    expect(html).toContain("OGDL-Taiwan-1.0");
    expect(html).toContain("2026-07-17");
    expect(html).toContain("原始下載頁");
  });
});
