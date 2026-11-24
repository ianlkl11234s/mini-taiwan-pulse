import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  MapchallengeDay19PenaltiesLegend, MapchallengeDay21OsmRoadsLegend,
  MapchallengeDay23TasteTermsLegend, MapchallengeDay23TasteVariantsLegend,
  MapchallengeDay23TastePlacesLegend, MapchallengeDay23TasteForeignLegend,
} from "../mapchallengeLegends";
import { MAPCHALLENGE_DAY23_FOREIGN, mapchallengeDay23Radius } from "../../../data/mapchallengeDay23Types";
import { mapchallengeDay19PenaltyRadius } from "../../../data/mapchallengeDay19Types";
import { layerParamsStore } from "../../../state/layerParamsStore";

const w = (r: number) => `width:${r * 2}px`;

afterEach(() => {
  layerParamsStore.setParam("mapchallengeDay23TasteTerms", "mapchallengeDay23TasteTermsScale", 1);
  layerParamsStore.setParam("mapchallengeDay23TasteVariants", "mapchallengeDay23TasteVariantsScale", 1);
  layerParamsStore.setParam("mapchallengeDay19Penalties", "mapchallengeDay19PenaltiesScale", 1);
  layerParamsStore.setParam("mapchallengeDay23TastePlaces", "mapchallengeDay23TastePlacesScale", 1);
  layerParamsStore.setParam("mapchallengeDay23TasteForeign", "mapchallengeDay23TasteForeignScale", 1);
});

describe("K3 大小圖例跟著大小滑桿縮放（map-layers LG-5）", () => {
  it("Day 23 用詞：store 的大小滑桿", () => {
    layerParamsStore.setParam("mapchallengeDay23TasteTerms", "mapchallengeDay23TasteTermsScale", 2);
    const html = renderToStaticMarkup(createElement(MapchallengeDay23TasteTermsLegend, { isDark: true }));
    expect(html).toContain(w(mapchallengeDay23Radius(5, 2)));
    expect(html).toContain(w(mapchallengeDay23Radius(20, 2)));
  });
  it("Day 23 用詞：embed 傳入 scale 優先", () => {
    const html = renderToStaticMarkup(createElement(MapchallengeDay23TasteTermsLegend, { isDark: true, scale: 1.5 }));
    expect(html).toContain(w(mapchallengeDay23Radius(5, 1.5)));
  });
  it("Day 23 寫法組", () => {
    layerParamsStore.setParam("mapchallengeDay23TasteVariants", "mapchallengeDay23TasteVariantsScale", 2);
    const html = renderToStaticMarkup(createElement(MapchallengeDay23TasteVariantsLegend, { isDark: true }));
    expect(html).toContain(w(mapchallengeDay23Radius(20, 2)));
  });
  it("Day 23 店名裡的地名（develop 後加的同型圖例）", () => {
    layerParamsStore.setParam("mapchallengeDay23TastePlaces", "mapchallengeDay23TastePlacesScale", 2);
    const html = renderToStaticMarkup(createElement(MapchallengeDay23TastePlacesLegend, { isDark: true }));
    expect(html).toContain(w(mapchallengeDay23Radius(8, 2)));
  });
  it("Day 23 外來料理（develop 後加的同型圖例）", () => {
    layerParamsStore.setParam("mapchallengeDay23TasteForeign", "mapchallengeDay23TasteForeignScale", 2);
    const html = renderToStaticMarkup(createElement(MapchallengeDay23TasteForeignLegend, { isDark: true }));
    expect(html).toContain(w(mapchallengeDay23Radius(50, 2, MAPCHALLENGE_DAY23_FOREIGN[0]!.k)));
  });
  it("Day 23 地名／外來料理：embed 傳入 scale 優先", () => {
    const a = renderToStaticMarkup(createElement(MapchallengeDay23TastePlacesLegend, { isDark: true, scale: 1.5 }));
    expect(a).toContain(w(mapchallengeDay23Radius(8, 1.5)));
    const b = renderToStaticMarkup(createElement(MapchallengeDay23TasteForeignLegend, { isDark: true, scale: 1.5 }));
    expect(b).toContain(w(mapchallengeDay23Radius(50, 1.5, MAPCHALLENGE_DAY23_FOREIGN[0]!.k)));
  });
  it("Day 19 裁罰（同類問題）", () => {
    layerParamsStore.setParam("mapchallengeDay19Penalties", "mapchallengeDay19PenaltiesScale", 2);
    const html = renderToStaticMarkup(createElement(MapchallengeDay19PenaltiesLegend, { isDark: true }));
    expect(html).toContain(w(mapchallengeDay19PenaltyRadius(20, 2)));
  });
});

describe("K7 OSM 年份圖例接 embed 參數", () => {
  it("embed 傳入年份與只看當年新增", () => {
    const html = renderToStaticMarkup(createElement(MapchallengeDay21OsmRoadsLegend, { isDark: true, year: 2015, newOnly: true }));
    expect(html).toContain("2015");
    expect(html).not.toContain("畫到 2026");
    const html2 = renderToStaticMarkup(createElement(MapchallengeDay21OsmRoadsLegend, { isDark: true, year: 2015, newOnly: false }));
    expect(html2).toContain("畫到 2015");
  });
});
