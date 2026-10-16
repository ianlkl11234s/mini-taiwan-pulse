import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { localeStore } from "../../../state/localeStore";
import { serviceAreaName } from "../../../i18n/dataText";
import { BikeStationPanel, RailRoutesPanel, RailStationPanel } from "../transportPanels";
import { AirportPanel, LighthousePanel, PortPanel, ServiceAreaPanel, ServiceAreaPolygonPanel } from "../infraPanels";

type Panel = (arg: { props: Record<string, unknown> }) => ReactElement;
const render = (panel: Panel, props: Record<string, unknown>) => renderToStaticMarkup(createElement(panel, { props }));

const station = { station_id: "BL12", name: "台北車站", name_en: "Taipei Main Station", system_id: "trtc", line_name: "板南線", transfer: true };
const port = { name: "高雄港", name_en: "Kaohsiung Port", port_class: "國際商港", county: "高雄市" };
const lighthouse = { Name: "鵝鑾鼻燈塔", Lat: "21° 54'", Lon: "120° 51'" };
const serviceArea = { Name: "中壢", Freeway: "國1", Direction: "南北向同一側", Location: "國道1號55k" };

afterAll(() => localeStore.set("zh-TW"));

describe("站名類固定資料：中文介面不變", () => {
  it("中文用原欄位與原標籤", () => {
    localeStore.set("zh-TW");
    const html = render(RailStationPanel, station);
    expect(html).toContain("台北車站");
    expect(html).not.toContain("Taipei Main Station");
    expect(html).toContain("板南線");
    expect(render(PortPanel, port)).toContain("高雄港");
    expect(render(LighthousePanel, lighthouse)).toContain("鵝鑾鼻燈塔");
    expect(render(ServiceAreaPanel, serviceArea)).toContain("中壢");
    expect(render(ServiceAreaPanel, serviceArea)).toContain("國1");
    expect(render(BikeStationPanel, { StationName: "捷運市政府站", StationNameEn: "MRT Taipei City Hall Stataion" })).toContain("捷運市政府站");
    expect(render(RailRoutesPanel, { name: "板南線", system: "trtc" })).toContain("板南線");
    expect(serviceAreaName("泰安服務區(北上)", localeStore.getSnapshot())).toBe("泰安服務區(北上)");
  });
});

describe("站名類固定資料：英文介面", () => {
  it("標題用外文欄位、線名與類別查對照表", async () => {
    await localeStore.ready("en");
    localeStore.set("en");
    const html = render(RailStationPanel, station);
    expect(html).toContain("Taipei Main Station");
    expect(html).toContain("Bannan Line");
    expect(render(RailStationPanel, { ...station, name_en: undefined })).toContain("台北車站");
    expect(render(RailRoutesPanel, { name: "淡水信義線", system: "trtc" })).toContain("Tamsui-Xinyi Line");
    expect(render(BikeStationPanel, { StationName: "捷運市政府站", StationNameEn: "MRT Taipei City Hall Station" })).toContain("MRT Taipei City Hall Station");
    const portHtml = render(PortPanel, port);
    expect(portHtml).toContain("Kaohsiung Port");
    expect(portHtml).toContain("International commercial port");
    expect(render(PortPanel, { ...port, name_en: undefined })).toContain("高雄港");
    expect(render(LighthousePanel, lighthouse)).toContain("Eluanbi Lighthouse");
    expect(render(LighthousePanel, { Name: "野柳燈杆" })).toContain("野柳燈杆");
  });

  it("機場標題用英文名，英文介面不再重複列英文名這一列", () => {
    const airport = { name: "臺東豐年機場", name_en: "Taitung Airport", icao: "RCFN", iata: "" };
    const html = render(AirportPanel, airport);
    expect(html).toContain("Taitung Airport");
    expect(html).not.toContain("臺東豐年機場");
    expect(html.match(/Taitung Airport/g)).toHaveLength(1);
  });

  it("服務區：區名、方向、國道編號", () => {
    const html = render(ServiceAreaPanel, serviceArea);
    expect(html).toContain("Zhongli Service Area");
    expect(html).toContain("Freeway No. 1");
    expect(html).toContain("Both directions (same side)");
    expect(render(ServiceAreaPolygonPanel, { Name: "泰安服務區(北上)", Freeway: "國3", area_ha: 3 })).toContain("Tai&#x27;an Service Area (Northbound)");
    expect(serviceAreaName("未知服務區", localeStore.getSnapshot())).toBe("未知服務區");
  });
});

describe("站名類固定資料：日文介面", () => {
  it("沒有日文欄位時顯示中文站名，線名與類別用日文對照", async () => {
    await localeStore.ready("ja");
    localeStore.set("ja");
    const html = render(RailStationPanel, station);
    expect(html).toContain("台北車站");
    expect(html).not.toContain("Taipei Main Station");
    expect(render(RailRoutesPanel, { name: "桃園機場捷運", system: "trtc" })).toContain("桃園空港MRT");
    expect(render(PortPanel, port)).toContain("国際商港");
    expect(render(LighthousePanel, lighthouse)).toContain("鵝鑾鼻灯台");
    expect(render(ServiceAreaPanel, serviceArea)).toContain("中壢サービスエリア");
    expect(render(AirportPanel, { name: "臺東豐年機場", name_en: "Taitung Airport", iata: "" })).toContain("臺東豐年機場");
  });
});
