import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpBusStopsPanel, JpEvacuationSitesPanel, JpInlandFloodAreasPanel, JpLandslideWarningAreasPanel, JpPublicOfficesPanel } from "../japanPanels";

describe("日本第一波 popup 資料語意", () => {
  it("避難場所：緊急避難場所列出適用災害，並保留法定意義與資料時效警語", () => {
    const html = renderToStaticMarkup(createElement(JpEvacuationSitesPanel, {
      props: { name: "テスト公園", site_type: "emergency_site", hazard_flood: true, hazard_tsunami: true, hazard_earthquake: false, prefecture: "東京都", municipality: "東京都千代田区" },
    }));
    expect(html).toContain("テスト公園");
    expect(html).toContain("洪水");
    expect(html).toContain("津波");
    expect(html).not.toContain("地震");
    expect(html).toContain("不可相加");
    expect(html).toContain("請向市町村確認");
    expect(html).toContain("2026-10-19");
    expect(html).not.toContain(">null<");
  });

  it("避難場所：指定避難所不顯示災害種別，福祉避難所標示是", () => {
    const render = (is_welfare_shelter: unknown) => renderToStaticMarkup(createElement(JpEvacuationSitesPanel, { props: { site_type: "shelter", is_welfare_shelter } }));
    expect(render(true)).toContain("指定福祉避難所");
    expect(render(false)).not.toContain("指定福祉避難所");
    expect(render(true)).not.toContain("適用災害種別");
  });

  it("役所與公民館：顯示分類與 2022-04 基準", () => {
    const html = renderToStaticMarkup(createElement(JpPublicOfficesPanel, { props: { name: "テスト会館", facility_class: "assembly_facility", prefecture: "北海道", address: "札幌市" } }));
    expect(html).toContain("集會施設");
    expect(html).toContain("2022-04");
  });

  it("公車站：縣名由 pref_code 對照，並註明不含高速バス", () => {
    const html = renderToStaticMarkup(createElement(JpBusStopsPanel, { props: { stop_name: "テスト前", operator: "テストバス", bus_class: "community", route_count: 3, pref_code: "13" } }));
    expect(html).toContain("東京都");
    expect(html).toContain("テストバス");
    expect(html).toContain("社區巴士");
    expect(html).toContain("高速バス");
  });

  it("土砂災害警戒區域：概略位置與紅黃巢狀警語；有 license_note 才顯示授權限制", () => {
    const render = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(JpLandslideWarningAreasPanel, {
      props: { zone_class: "red", phenomenon_en: "debris_flow", designation_status: "designated", prefecture_code: "26", area_name: "テストE", address: "京都市", ...extra },
    }));
    const plain = render({});
    expect(plain).toContain("特別警戒區域");
    expect(plain).toContain("土石流");
    expect(plain).toContain("京都府");
    expect(plain).toContain("非法定圖書");
    expect(plain).toContain("不可相加");
    expect(plain).toContain("土砂災害警戒区域データ");
    expect(plain).not.toContain("授權限制");
    expect(render({ license_note: "商用利用不可" })).toContain("商用利用不可");
    expect(render({ license_note: "商用利用不可" })).toContain("授權限制");
  });

  it("內水浸水想定區域：想定最大規模降雨、只涵蓋 28 個市町村、無資料不代表無風險", () => {
    const html = renderToStaticMarkup(createElement(JpInlandFloodAreasPanel, {
      props: { prefecture: "福岡県", municipality: "大牟田市", depth_class: "1_to_3m", depth_rank: 4 },
    }));
    expect(html).toContain("大牟田市");
    expect(html).toContain("1–3 m");
    expect(html).toContain("想定最大規模降雨");
    expect(html).toContain("28 個市町村");
    expect(html).toContain("無資料不代表");
    expect(html).toContain("雨水出水");
  });
});
