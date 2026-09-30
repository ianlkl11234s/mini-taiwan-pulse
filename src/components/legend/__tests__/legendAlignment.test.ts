import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGEND_REGISTRY } from "../../LegendPanel";
import { OVERLAY_REGISTRY } from "../../../map/overlayRegistry";
import { legendKeys } from "../../../data/legendGroups";
import { encodeParamsToOverlay, layerParamsStore } from "../../../state/layerParamsStore";
import type { LayerVisibility } from "../../../types";

const params = encodeParamsToOverlay(layerParamsStore.getAll());
const themeIds = ["companyCapitalGrid", "ecoNetworkZones", "forestCompartments", "industrialParkBoundaries", "industrialParkComparison", "jpAccommodationDensity", "medHospital", "newsEvents", "ooklaPerformanceGrid", "realEstateRentalGrid", "schools", "waterCanals"];
function colors(value: unknown): string[] {
  if (typeof value === "string") return value.match(/#[\da-f]{6}\b|rgba?\([^)]+\)/gi)?.map((v) => v.toLowerCase().replace(/ /g, "")) ?? [];
  return Array.isArray(value) ? value.flatMap(colors) : [];
}

describe("R4 legend theme colors agree with map paint", () => {
  for (const id of themeIds) it(`${id}: both themes render a matching theme-specific paint color`, () => {
    const entry = LEGEND_REGISTRY.find((e) => e.id === id)!;
    const members = legendKeys(id);
    const visibility = Object.fromEntries(members.map((k) => [k, true])) as unknown as LayerVisibility;
    const palettes = [true, false].map((dark) => new Set(OVERLAY_REGISTRY.filter((c) => members.includes(c.id)).flatMap((c) => c.layers.flatMap((l) => {
      const paint = typeof l.paint === "function" ? l.paint(dark, params) : l.paint;
      const opposite = typeof l.paint === "function" ? l.paint(!dark, params) : l.paint;
      return Object.entries(paint ?? {}).filter(([key, value]) => /^(circle|fill|line|fill-extrusion)-color$/.test(key) && JSON.stringify(value) !== JSON.stringify((opposite as Record<string, unknown>)?.[key])).flatMap(([, value]) => colors(value));
    }))));
    [true, false].forEach((isDark, i) => {
      const own = [...palettes[i]!];
      expect(own.length, `${id} must have an actual theme-dependent primary paint color`).toBeGreaterThan(0);
      const html = renderToStaticMarkup(createElement(Fragment, null, entry.render({ visibility, overlayParams: params, isDark }))).toLowerCase();
      // Test rendered color values, not theme data attributes or incidental text differences.
      const swatches = [...html.matchAll(/(?:background(?:-color)?|border(?:-color)?|box-shadow|stroke|color)[=:]["']?([^;"']+)/g)].flatMap((m) => colors(m[1]));
      expect(own.some((color) => swatches.includes(color)), `${id} ${isDark ? "dark" : "light"}: missing ${own.join(", ")}`).toBe(true);
    });
  });
});

describe("R4 grouped legend modes", () => {
  const render = (id: string, visibility: Partial<LayerVisibility>, isDark: boolean) => renderToStaticMarkup(createElement(Fragment, null,
    LEGEND_REGISTRY.find((e) => e.id === id)!.render({ visibility: visibility as LayerVisibility, overlayParams: { ...params, schoolLevelColor: 0 }, isDark })));

  it("retains the category color when a school category and uniform legacy layer are both visible", () => {
    const html = render("schools", { schools: true, eduSchoolElementary: true }, false);
    expect(html).toContain("#1565c0");
    expect(html).toContain("#66bb6a");
  });

  it("uses the Taiwan outline when only Taiwan Ookla data is visible", () => {
    const html = render("ooklaPerformanceGrid", { ooklaMobileTaiwan: true }, false);
    expect(html).toContain("rgba(15,23,42,0.45)");
    expect(html).not.toContain("rgba(15,23,42,0.55)");
  });
});
