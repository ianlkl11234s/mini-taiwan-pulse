import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpExpresswaysPanel, JpMajorRoadsPanel, JpWelfareChildPanel, JpWelfareDisabilityPanel } from "../japanPanels";

describe("日本第四波 popup 資料語意", () => {
  it("福祉：license_note 非空才顯示；代表點標示位置正確度", () => {
    const base = { name: "南かやべ認定こども園", category_code: "0504", category_ja: "保育所等", minor_ja: "幼保連携型認定こども園", pref: "北海道", municipality: "函館市", address: "川汲町1601-1", position_accuracy: 1 };
    const withNote = renderToStaticMarkup(createElement(JpWelfareChildPanel, { props: { ...base, license_note: "商用利用不可（施設の同意未取得）" } }));
    expect(withNote).toContain("南かやべ認定こども園");
    expect(withNote).toContain("保育所等");
    expect(withNote).toContain("商用利用不可");
    expect(withNote).toContain("福祉施設データ");
    const plain = renderToStaticMarkup(createElement(JpWelfareDisabilityPanel, { props: { name: "やまぶき荘", category_code: "9911", category_ja: "障害者サービス施設", pref: "北海道", position_accuracy: 4 } }));
    expect(plain).not.toContain("自治體利用條件");
    expect(plain).toContain("市區町村代表點");
  });

  it("主要道路：代碼查表；有料／幅員／狀態顯示名", () => {
    const html = renderToStaticMarkup(createElement(JpMajorRoadsPanel, { props: { road_class_code: 1, width_class: "13_to_19_5m", toll: true, road_state: "tunnel" } }));
    expect(html).toContain("國道");
    expect(html).toContain("13m–19.5m未満");
    expect(html).toContain("有料");
    expect(html).toContain("トンネル");
    expect(html).toContain("不含市町村道");
  });

  it("高速道路：線顯示路線與車道數（null 寫未記載）；點顯示接合部與推導路線", () => {
    const line = renderToStaticMarkup(createElement(JpExpresswaysPanel, { props: { route_name: "伊豆縦貫自動車道", road_category_en: "national_route_expressway", service_status_en: "provisional", lanes: null, opened_year: 2014 } }));
    expect(line).toContain("伊豆縦貫自動車道");
    expect(line).toContain("暫定供用");
    expect(line).toContain(">未記載<");
    expect(line).toContain("2014");
    const point = renderToStaticMarkup(createElement(JpExpresswaysPanel, { props: { name: "南相馬鹿島SIC", junction_type_en: "smart_interchange", route_names: "常磐自動車道", attached_to_sa_pa: false, opened_year: 2015 } }));
    expect(point).toContain("南相馬鹿島SIC");
    expect(point).toContain("SIC");
    expect(point).toContain("常磐自動車道");
    expect(point).toContain("空間推導");
  });
});
