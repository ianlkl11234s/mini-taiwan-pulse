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
