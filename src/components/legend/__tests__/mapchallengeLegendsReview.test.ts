import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  MapchallengeDay19PenaltiesLegend, MapchallengeDay21OsmRoadsLegend,
  MapchallengeDay23TasteTermsLegend, MapchallengeDay23TasteVariantsLegend,
} from "../mapchallengeLegends";
import { mapchallengeDay23Radius } from "../../../data/mapchallengeDay23Types";
import { mapchallengeDay19PenaltyRadius } from "../../../data/mapchallengeDay19Types";
import { layerParamsStore } from "../../../state/layerParamsStore";

const w = (r: number) => `width:${r * 2}px`;

afterEach(() => {
  layerParamsStore.setParam("mapchallengeDay23TasteTerms", "mapchallengeDay23TasteTermsScale", 1);
  layerParamsStore.setParam("mapchallengeDay23TasteVariants", "mapchallengeDay23TasteVariantsScale", 1);
  layerParamsStore.setParam("mapchallengeDay19Penalties", "mapchallengeDay19PenaltiesScale", 1);
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
