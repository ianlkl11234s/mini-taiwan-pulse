import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MedicalPOIPanel, normalizeMedicalPOIProps } from "../medicalPanels";

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(MedicalPOIPanel, { props }));

// 欄位形狀取自正式站 medical_aed_v2／medical_ltc_v2 PMTiles（2026-11-20 解圖磚）
const AED = {
  PlaceID: "1361", PlaceName: "福容大飯店股份有限公司淡水漁人碼頭分公司", County: "新北市", District: "淡水區",
  Address: "新北市淡水區觀海路83號", PlaceCategory: "旅宿場所", PlaceType: "飯店", AEDID: "7472",
  AEDLocation: "門廳，大廳櫃檯旁", AEDLocationDesc: "進入飯店大門後，右側前方", EmergencyPhone: "02-26287777",
  lat: 25.181986, lng: 121.415829,
};
const LTC = {
  Name: "屏東縣琉球鄉天福社區發展協會", OrgCode: "BF1600300", OrgKind: "BF", County: "10013", District: "10013220",
  Address: "屏東縣琉球鄉天福村中正路3巷", ABCType: "C", ServiceItems: "巷弄長照站", Phone: "0933-596806",
  OpenBeds: 0, CurrentResidents: 0, lng: 120.3592529297, lat: 22.3287982941,
};

// 欄位形狀取自正式站 medical_pharmacies PMTiles／medical_hospitals.geojson（2026-11-21）
const PHARMACY = {
  facility_id: "5901010076", name: "榮星藥局", category: "pharmacy", contract_type: "5", facility_kind: "藥劑生自營", form_type: "02",
  county: "臺北市", district_code: "63000", address: "臺北市松山區南京東路４段１３３巷５弄１號", phone: "(02)27124696",
  specialties: "", services: "", source_did: "39284,168341",
};
const HOSPITAL = {
  facility_id: "0101090517", name: "臺北市立聯合醫院", category: "hospital_regional", facility_kind: "綜合醫院",
  county: "臺北市", address: "臺北市大同區鄭州路１４５號（代表）", phone: "(02)25553000", specialties: "不分科,家醫科,內科", source_did: "39281,168341",
};

describe("MedicalPOIPanel 健保特約院所（藥局、醫院）", () => {
  it("藥局：顯示名稱、類型、縣市、地址、電話與健保署來源", () => {
    const html = render(PHARMACY);
    expect(html).toContain("榮星藥局");
    expect(html).toContain("健保特約藥局");
    expect(html).toContain("臺北市松山區南京東路４段１３３巷５弄１號");
    expect(html).toContain("(02)27124696");
    expect(html).not.toContain("醫療據點");
    expect(html).toContain("中央健康保險署");
    expect(html).toContain("data.gov.tw/dataset/39284");
  });
  it("醫院：顯示名稱、等級、地址、電話、科別", () => {
    const html = render(HOSPITAL);
    expect(html).toContain("臺北市立聯合醫院");
    expect(html).toContain("區域醫院");
    expect(html).toContain("臺北市大同區鄭州路１４５號（代表）");
    expect(html).toContain("(02)25553000");
    expect(html).toContain("不分科,家醫科,內科");
    expect(html).not.toContain("醫療據點");
  });
  it("分類對應：hospital_* → hospital、clinic → clinic、其餘 → other_medical", () => {
    expect(normalizeMedicalPOIProps(HOSPITAL).med_cat).toBe("hospital");
    expect(normalizeMedicalPOIProps(PHARMACY).med_cat).toBe("pharmacy");
    expect(normalizeMedicalPOIProps({ ...PHARMACY, category: "clinic" }).med_cat).toBe("clinic");
    expect(render({ ...PHARMACY, category: "health_center" })).toContain("衛生所");
  });
});

describe("MedicalPOIPanel 官方欄位對應（VPB-28）", () => {
  it("AED：顯示場所名稱、類別、地址、電話，不退成 Medical facility", () => {
    const html = render(AED);
    expect(html).toContain("福容大飯店股份有限公司淡水漁人碼頭分公司");
    expect(html).toContain("旅宿場所");
    expect(html).toContain("飯店");
    expect(html).toContain("新北市淡水區觀海路83號");
    expect(html).toContain("02-26287777");
    expect(html).not.toContain("醫療據點");
    expect(html).toContain("衛生福利部醫事司");
    expect(html).not.toContain("來源資訊待補");
  });

  it("長照：顯示機構名稱、類別、地址、電話；行政區代碼與 0 床不外露", () => {
    const html = render(LTC);
    expect(html).toContain("屏東縣琉球鄉天福社區發展協會");
    expect(html).toContain("C 巷弄長照站");
    expect(html).toContain("屏東縣琉球鄉天福村中正路3巷");
    expect(html).toContain("0933-596806");
    expect(html).not.toContain("10013");
    expect(html).not.toContain("空床");
    expect(html).toContain("長照服務資源地理地圖系統");
  });

  it("已有 med_cat 的舊形狀原樣通過", () => {
    const p = { med_cat: "ltc", name: "屏東縣枋山鄉婦女會", source: "nlsc" };
    expect(normalizeMedicalPOIProps(p)).toBe(p);
    expect(render(p)).toContain("屏東縣枋山鄉婦女會");
  });
});
