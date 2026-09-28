import { afterEach, describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnalysisResultPresentation } from "../analysisResultOverlay";
import { analysisLegendEntries, getAnalysisLegendSnapshot, publishAnalysisLegend, subscribeAnalysisLegend, type AnalysisLegendEntry } from "../analysisLegendStore";
import { AnalysisLegendSection } from "../AnalysisLegendSection";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import type { WarehouseStyleLegend } from "../warehouseResultStyle";
import { LegendPanel } from "../../components/LegendPanel";
import type { LayerVisibility } from "../../types";

const choroplethLegend: WarehouseStyleLegend = {
  kind: "choropleth", title: "人口密度（人/km²）", method: "分位數",
  entries: [{ label: "< 10", color: "#440154" }, { label: "≥ 10", color: "#fde725" }], breaks: [10],
  nullEntry: { label: "無資料", color: "#bdbdbd" },
};
const heatLegend: WarehouseStyleLegend = { kind: "heatmap", title: "事故密度", gradient: "linear-gradient(90deg, #000, #fff)", note: "依件數加權", nullEntry: null };
const presented = (overrides: Partial<AnalysisResultPresentation>): AnalysisResultPresentation => ({ resultId: "r1", datasetId: "fixture:ds", displayLabel: "各區人口密度", geometryType: "Polygon", featureCount: 2, ...overrides });

afterEach(() => publishAnalysisLegend({ entries: [], compact: false }));

describe("G1 analysis legend store", () => {
  it("keeps only rendered results that carry a legend, with a readable source", () => {
    const entries = analysisLegendEntries([
      presented({ styleLegend: choroplethLegend }),
      presented({ resultId: "plain", displayLabel: "原始點位" }),
      presented({ resultId: "ring", scopeRing: { radiusM: 500 } }),
    ], datasetId => datasetId === "fixture:ds" ? "內政部人口統計" : null);
    expect(entries.map(entry => [entry.resultId, entry.title, entry.source])).toEqual([["r1", "各區人口密度", "內政部人口統計"], ["ring", "各區人口密度", "內政部人口統計"]]);
    expect(entries[0]!.styleLegend).toBe(choroplethLegend);
  });

  it("notifies subscribers and collapses an empty publish to one stable snapshot", () => {
    let calls = 0;
    const unsubscribe = subscribeAnalysisLegend(() => { calls += 1; });
    publishAnalysisLegend({ entries: [], compact: true });
    expect(calls).toBe(0);
    const entries = analysisLegendEntries([presented({ styleLegend: choroplethLegend })], () => null);
    publishAnalysisLegend({ entries, compact: true });
    expect(calls).toBe(1);
    expect(getAnalysisLegendSnapshot()).toEqual({ entries, compact: true });
    unsubscribe();
  });
});

describe("G2 full vs compact legend", () => {
  const entries: AnalysisLegendEntry[] = analysisLegendEntries([presented({ styleLegend: choroplethLegend }), presented({ resultId: "heat", displayLabel: "事故熱區", styleLegend: heatLegend })], () => "內政部人口統計");

  it("full: title, colour bar, real break numbers, method and missing, one source line", () => {
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries, compact: false, isDark: true }));
    expect(html).toContain("分析結果");
    expect(html).toContain("人口密度（人/km²） · 分位數");
    expect(html).toContain("agent-style-legend__breaks");
    expect(html).toContain("無資料");
    expect(html.match(/來源 · 內政部人口統計/g)).toHaveLength(2);
  });

  it("compact (docked popup open): only the title and the colour bar", () => {
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries, compact: true, isDark: false }));
    expect(html).toContain("analysis-legend-group--light");
    expect(html).toContain("人口密度（人/km²）");
    expect(html).toContain("agent-style-legend__bar");
    expect(html).toContain("linear-gradient(90deg, #000, #fff)");
    for (const hidden of ["agent-style-legend__breaks", "無資料", "分位數", "來源 ·", "依件數加權"]) expect(html).not.toContain(hidden);
  });

  it("leaves the default (non-compact) WarehouseStyleLegendView markup unchanged", () => {
    expect(renderToStaticMarkup(h(WarehouseStyleLegendView, { legend: choroplethLegend, compact: false }))).toBe(renderToStaticMarkup(h(WarehouseStyleLegendView, { legend: choroplethLegend })));
  });
});

describe("G1 legend panel placement", () => {
  it("shows the 圖例 panel for analysis results even with no layer on", () => {
    const visibility = {} as LayerVisibility;
    expect(renderToStaticMarkup(h(LegendPanel, { visibility, overlayParams: {} }))).toBe("");
    publishAnalysisLegend({ entries: analysisLegendEntries([presented({ styleLegend: choroplethLegend })], () => null), compact: false });
    expect(renderToStaticMarkup(h(LegendPanel, { visibility, overlayParams: {} }))).toContain("圖例");
  });
});
