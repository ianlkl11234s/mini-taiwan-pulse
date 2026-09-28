import { describe, expect, it } from "vitest";
import { rampFor } from "../../research/vizSpec";
import { buildCardAreaFeatures, classColors, geodesicCircle, loadCardGeometry, rampColors, sha256Hex, taipeiDate } from "../cardStyle";
import { areaPayload } from "./cardFixtures";

const square = (x: number) => ({ type: "Polygon", coordinates: [[[x, 25], [x + 0.1, 25], [x + 0.1, 25.1], [x, 25]]] });
const geojson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: square(121.5), properties: { area_code: "63000", area_name: "臺北市" } },
    { type: "Feature", geometry: square(121.4), properties: { area_code: "65000", area_name: "新北市" } },
    { type: "Feature", geometry: square(121.1), properties: { area_code: "10014", area_name: "臺東縣" } },
    { type: "Feature", geometry: square(118.3), properties: { area_code: "09020", area_name: "金門縣" } },
    { type: "Feature", geometry: square(120.0), properties: { area_code: "10013", area_name: "屏東縣" } },
  ],
};

describe("卡片配色（vizSpec 暗色組）", () => {
  it("級距數 = breaks + 1，取色規則與 mcp rampColors 相同", () => {
    expect(classColors("viridis", [1, 2, 3, 4])).toEqual(rampFor("viridis", "dark"));
    expect(classColors("viridis", [1, 5])).toEqual(rampColors(rampFor("viridis", "dark"), 3));
    expect(classColors("no-such-ramp", [1])).toHaveLength(2);
  });
});

describe("buildCardAreaFeatures", () => {
  it("只留 areas 列到的區域、依 class_index 上色、缺值不上色，只標前幾名名稱", () => {
    const payload = areaPayload();
    const features = buildCardAreaFeatures(geojson, payload.map!, payload.top);
    expect(features.map(feature => feature.properties.area_code)).toEqual(["63000", "65000", "10014", "09020"]);
    const colors = classColors("viridis", [1, 5]);
    expect(features[0]!.properties.fill).toBe(colors[2]);
    expect(features[3]!.properties.fill).toBeNull();
    expect(features.filter(feature => feature.properties.label).map(feature => feature.properties.label)).toEqual(["臺北市", "新北市", "臺東縣"]);
  });

  it("同名鄉鎮以 class_index 相同者標籤", () => {
    const towns = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: square(121.5), properties: { TOWNCODE: "63000050", TOWNNAME: "中正區" } },
      { type: "Feature", geometry: square(121.7), properties: { TOWNCODE: "10017070", TOWNNAME: "中正區" } },
    ] };
    const map = { ...areaPayload().map!, geometry: { ...areaPayload().map!.geometry, level: "township" as const }, areas: [["63000050", 2], ["10017070", 0]] as [string, number | null][] };
    const features = buildCardAreaFeatures(towns, map, [{ name: "臺北市中正區", value: 9, class_index: 2 }]);
    expect(features.map(feature => feature.properties.label)).toEqual(["中正區", null]);
  });

  it("top 有 code 時只標代碼相符的那一個同名區", () => {
    const towns = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: square(121.5), properties: { TOWNCODE: "63000050", TOWNNAME: "中正區" } },
      { type: "Feature", geometry: square(121.7), properties: { TOWNCODE: "10017070", TOWNNAME: "中正區" } },
    ] };
    const map = { ...areaPayload().map!, geometry: { ...areaPayload().map!.geometry, level: "township" as const }, areas: [["63000050", 1], ["10017070", 1]] as [string, number | null][] };
    const features = buildCardAreaFeatures(towns, map, [{ name: "中正區", value: 9, class_index: 1, code: "10017070" }]);
    expect(features.map(feature => feature.properties.label)).toEqual([null, "中正區"]);
  });

  it("檔案格式不對或代碼對不上就 throw（由地圖區顯示容錯訊息）", () => {
    const payload = areaPayload();
    expect(() => buildCardAreaFeatures({ type: "Feature" }, payload.map!, payload.top)).toThrow("CARD_GEOMETRY_SHAPE");
    expect(() => buildCardAreaFeatures({ type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: { area_code: "99999" } }] }, payload.map!, payload.top)).toThrow("CARD_GEOMETRY_NO_CODES");
  });

  it("loadCardGeometry 驗 sha256：不符或 HTTP 失敗都 throw", async () => {
    const body = new TextEncoder().encode(JSON.stringify(geojson));
    const sha = await sha256Hex(body.buffer as ArrayBuffer);
    const map = { ...areaPayload().map!, geometry: { ...areaPayload().map!.geometry, sha256: sha } };
    const ok = await loadCardGeometry(map, (async () => new Response(body)) as unknown as typeof fetch);
    expect((ok as { features: unknown[] }).features).toHaveLength(5);
    await expect(loadCardGeometry(areaPayload().map!, (async () => new Response(body)) as unknown as typeof fetch)).rejects.toThrow("CARD_GEOMETRY_SHA256");
    await expect(loadCardGeometry(map, (async () => new Response("", { status: 404 })) as unknown as typeof fetch)).rejects.toThrow("CARD_GEOMETRY_HTTP_404");
  });
});

describe("時間與幾何小工具", () => {
  it("到期日以台灣時間顯示", () => {
    expect(taipeiDate("2026-10-27T17:00:00Z")).toBe("2026-10-28");
    expect(taipeiDate("not a date")).toBeNull();
  });
  it("半徑圈首尾相接、距中心約等於半徑", () => {
    const ring = geodesicCircle([121.5, 25.04], 500, 8);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const [lng, lat] = ring[2]!;
    const dx = (lng - 121.5) * 111_320 * Math.cos(25.04 * Math.PI / 180);
    const dy = (lat - 25.04) * 110_574;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(490);
    expect(Math.hypot(dx, dy)).toBeLessThan(510);
  });
});
