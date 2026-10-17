import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { localeStore } from "../../../state/localeStore";

type Panel = (arg: { props: Record<string, unknown> }) => ReactElement;
const modules = import.meta.glob<Record<string, unknown>>("../*Panels.tsx", { eager: true });
const SKIP = /japan|jma|jpMedical/i;
// 非縣市名欄位：IXP 是國外城市、森林通用面板逐欄照列、滯洪池與全國行道樹的縣市是代碼
const NOT_PLACE = new Set([
  "infraPanels.tsx#InternetExchangePointPanel",
  "forestryPanels.tsx#ForestryGenericPanel",
  "waterPanels.tsx#WaterDetentionBasinPanel",
  "urbanPanels.tsx#StreetTreesNationalPanel",
]);
const panels = Object.entries(modules)
  .filter(([path]) => !SKIP.test(path))
  .flatMap(([path, mod]) =>
    Object.entries(mod)
      .filter(([name, value]) => name.endsWith("Panel") && typeof value === "function")
      .map(([name, value]) => [`${path.replace("../", "")}#${name}`, value as Panel] as const),
  );

// 各說明框常見的縣市／鄉鎮欄位名
const place = {
  county: "臺北市", town: "中正區", city: "臺北市", district: "中正區", township: "中正區",
  County: "臺北市", Town: "中正區", City: "臺北市", COUNTYNAME: "臺北市", TOWNNAME: "中正區", COUNTY: "臺北市",
};
const render = (panel: Panel) => {
  try {
    return renderToStaticMarkup(createElement(panel, { props: place }));
  } catch {
    return null; // 需要專屬 props 的面板不在本測試範圍
  }
};

afterAll(() => localeStore.set("zh-TW"));

describe("說明框縣市欄", () => {
  it("中文介面照原文顯示，英文介面翻成官方英譯", async () => {
    localeStore.set("zh-TW");
    const zh = new Map(panels.map(([id, panel]) => [id, render(panel)]));
    await localeStore.ready("en");
    localeStore.set("en");
    let translated = 0;
    const raw: string[] = [];
    for (const [id, panel] of panels) {
      const zhHtml = zh.get(id);
      const enHtml = render(panel);
      if (NOT_PLACE.has(id) || zhHtml == null || enHtml == null || !zhHtml.includes("臺北市")) continue;
      // 只餵了地名欄位，英文畫面還留著中文縣市＝漏翻
      if (/臺北市|中正區/.test(enHtml)) raw.push(id);
      translated += 1;
    }
    expect(raw).toEqual([]);
    // 防止 glob 或 fixture 失效時測試空轉
    expect(translated).toBeGreaterThan(40);
  });
});
