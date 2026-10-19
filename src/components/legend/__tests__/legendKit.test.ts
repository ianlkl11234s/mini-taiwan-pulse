import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGEND_SWATCH, LegendCompactCtx, LegendNote, LegendThemeCtx, LegendTitle, LIGHT_LEGEND, SwatchDot, SwatchHatch } from "../legendKit";
import { UrbanDotRow } from "../legendShared";
import { LEGEND_REGISTRY } from "../../LegendPanel";
import { legendKeys } from "../../../data/legendGroups";
import { encodeParamsToOverlay, layerParamsStore } from "../../../state/layerParamsStore";
import { localeStore } from "../../../state/localeStore";
import type { LayerVisibility } from "../../../types";
import { hatchImageData } from "../../../map/mapStyleScale";
import { MEDICAL_POI_TYPES, MEDICAL_POI_PAINT_COLORS, medicalPoiColor } from "../../../data/medicalPOITypes";

describe("legendKit", () => {
  it("LG-11：標題中文在前、英文小字在後，不轉大寫", () => {
    const html = renderToStaticMarkup(createElement(LegendTitle, { zh: "醫療據點", en: "Medical" }));
    expect(html.indexOf("醫療據點")).toBeLessThan(html.indexOf("Medical"));
    expect(html).not.toMatch(/uppercase|MEDICAL/);
  });

  it("LG-1：點色票 10px，描邊用底圖色（淡色底圖為白）", () => {
    const html = renderToStaticMarkup(createElement(LegendThemeCtx.Provider, { value: LIGHT_LEGEND }, createElement(SwatchDot, { color: "#e53935" })));
    expect(html).toContain(`width:${LEGEND_SWATCH.dot}px`);
    expect(html).toContain("0 0 1px #ffffff");
  });

  it("LG-7：缺值單向斜線、遮蔽交叉斜線；地圖 hatch 圖同樣區分", () => {
    const missing = renderToStaticMarkup(createElement(SwatchHatch, { kind: "missing" }));
    const suppressed = renderToStaticMarkup(createElement(SwatchHatch, { kind: "suppressed" }));
    expect(missing.match(/repeating-linear-gradient/g)).toHaveLength(1);
    expect(suppressed.match(/repeating-linear-gradient/g)).toHaveLength(2);
    const lit = (kind: "missing" | "suppressed") => hatchImageData(kind, true).data.filter((_, i) => i % 4 === 3 && _ > 0).length;
    expect(lit("suppressed")).toBeGreaterThan(lit("missing"));
  });

  it("LG-9：compact 時註記不顯示", () => {
    const note = createElement(LegendNote, null, "來源：內政部");
    expect(renderToStaticMarkup(note)).toContain("來源：內政部");
    expect(renderToStaticMarkup(createElement(LegendCompactCtx.Provider, { value: true }, note))).toBe("");
  });
});

describe("LegendPanel 收斂 ratchet", () => {
  // 標題不手寫 letterSpacing: 1、手寫色票尺寸只能減少：改由 ESLint
  // pulse/legend-no-letter-spacing、legend-no-hand-sized-swatch 檢查（既有違規記在 eslint-suppressions.json）。
  it("R4 A 類圖例以對應 geometry 的 legendKit 色票渲染", () => {
    const html = (id: string) => {
      const entry = LEGEND_REGISTRY.find((e) => e.id === id);
      expect(entry, id).toBeDefined();
      const visibility = Object.fromEntries(legendKeys(id).map((k) => [k, true])) as unknown as LayerVisibility;
      return renderToStaticMarkup(createElement(Fragment, null, entry!.render({ visibility, overlayParams: encodeParamsToOverlay(layerParamsStore.getAll()), isDark: true, i18n: localeStore.getSnapshot() })));
    };
    const dots = (markup: string) => markup.split(`width:${LEGEND_SWATCH.dot}px;height:${LEGEND_SWATCH.dot}px`).length - 1;
    const squares = (markup: string) => markup.split(`width:${LEGEND_SWATCH.square.width}px;height:${LEGEND_SWATCH.square.height}px`).length - 1;
    const lines = (markup: string) => markup.split("<line ").length - 1;
    // 線圖層（道路、橋梁承載物）用線色票
    for (const id of ["osmRoadDrive", "osmBridgeCarriers"]) {
      const markup = html(id);
      expect(lines(markup), id).toBeGreaterThan(1);
      expect(dots(markup) + squares(markup), id).toBe(0);
    }
    // 點圖層（消火栓、噪音稽查、聲音照相）用點色票
    for (const id of ["fireHydrants", "noiseEnforcementEvents", "soundCameraLocations"]) {
      const markup = html(id);
      expect(dots(markup), id).toBeGreaterThan(1);
      expect(lines(markup) + squares(markup), id).toBe(0);
    }
    // 都市開放空間共用列：square 切面色票，否則點
    expect(squares(renderToStaticMarkup(createElement(UrbanDotRow, { color: "#22c55e", label: "公園", square: true })))).toBe(1);
    expect(dots(renderToStaticMarkup(createElement(UrbanDotRow, { color: "#22c55e", label: "行道樹" })))).toBe(1);
  });

  it("R4 K-1：醫療圖例與 paint 共用暗／淡主色常數", () => {
    for (const item of MEDICAL_POI_TYPES) {
      expect(medicalPoiColor(item.id, true)).toBe(MEDICAL_POI_PAINT_COLORS[item.id].dark);
      expect(medicalPoiColor(item.id, false)).toBe(MEDICAL_POI_PAINT_COLORS[item.id].light);
    }
  });
});
