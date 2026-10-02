import { afterEach, describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { warehouseSourceLabel, type AnalysisResultPresentation } from "../analysisResultOverlay";
import { analysisLegendEntries, getAnalysisLegendSnapshot, publishAnalysisLegend, subscribeAnalysisLegend, type AnalysisLegendEntry, type AnalysisLegendPlayback } from "../analysisLegendStore";
import { AnalysisLegendSection } from "../AnalysisLegendSection";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import type { WarehouseResultStyle, WarehouseStyleLegend } from "../warehouseResultStyle";
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

  it("uses a warehouse result's own dataset titles, shared with its radius-ring sibling", () => {
    const entries = analysisLegendEntries([
      presented({ resultId: "wh-7:point", datasetId: "warehouse:wh-7", geometryType: "Point", categoryLegend: { entries: [{ label: "醫療", color: "#f00" }] }, sourceLabel: "醫療院所、捷運站" }),
      presented({ resultId: "wh-7:polygon", datasetId: "warehouse:wh-7", scopeRing: { radiusM: 500 } }),
    ], () => null);
    expect(entries.map(entry => entry.source)).toEqual(["醫療院所、捷運站", "醫療院所、捷運站"]);
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries, compact: false, isDark: true }));
    expect(html).not.toContain("來源資訊待補");
    expect(html).not.toContain("warehouse:");
  });

  it("formats the source line from row titles: unique, in order, first three + 等 N 份", () => {
    expect(warehouseSourceLabel([{ _role: "center" }, { _wh_source: "甲" }, { _wh_source: "乙" }, { _wh_source: "甲" }])).toBe("甲、乙");
    expect(warehouseSourceLabel([{ _wh_source: "甲" }, { _wh_source: "乙" }, { _wh_source: "丙" }, { _wh_source: "丁" }, { _wh_source: "戊" }])).toBe("甲、乙、丙 等 5 份");
    expect(warehouseSourceLabel([{ name: "x" }, { _wh_source: " " }])).toBeUndefined();
  });

  it("attaches playback (T2 A2) only for a timed choropleth entry when playbackFor is given", () => {
    const timedChoropleth = {
      kind: "choropleth", field: "n", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "房價", breaks: [50], colors: ["#eff3ff", "#08519c"], labels: ["< 50", "≥ 50"], min: 1, max: 90, nullColor: "#bdbdbd", nullCount: 0,
      timeField: "wk", idField: null, periods: ["2024-01-01", "2024-02-01"], periodUnit: "month", seriesProperty: "_style_series", latestPeriod: "2024-02-01",
    } as const satisfies WarehouseResultStyle;
    const playback: AnalysisLegendPlayback = { periods: timedChoropleth.periods, periodUnit: "month", index: 0, playing: false, onToggle: () => {}, onScrub: () => {} };
    const entries = analysisLegendEntries([
      presented({ resultId: "timed", styleLegend: choroplethLegend, resultStyle: timedChoropleth }),
      presented({ resultId: "plain", styleLegend: choroplethLegend }), // no resultStyle at all
    ], () => null, resultId => (resultId === "timed" ? playback : undefined));
    expect(entries.find(entry => entry.resultId === "timed")!.playback).toBe(playback);
    expect(entries.find(entry => entry.resultId === "plain")!.playback).toBeUndefined();
    // Without a playbackFor at all, no entry carries one — existing callers are unaffected.
    const withoutPlaybackFor = analysisLegendEntries([presented({ resultId: "timed", styleLegend: choroplethLegend, resultStyle: timedChoropleth })], () => null);
    expect(withoutPlaybackFor[0]!.playback).toBeUndefined();
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

  it("T2 A2: renders a play/pause + scrub bar above the legend for an entry carrying playback", () => {
    const playback: AnalysisLegendPlayback = { periods: ["2024-01-01", "2024-02-01", "2024-03-01"], periodUnit: "month", index: 1, playing: false, onToggle: () => {}, onScrub: () => {} };
    const withPlayback = analysisLegendEntries([presented({ styleLegend: choroplethLegend })], () => null).map(entry => ({ ...entry, playback }));
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries: withPlayback, compact: false, isDark: true }));
    expect(html).toContain("播放");
    expect(html).toContain("2024-02-01"); // the current (scrubbed) period, not necessarily the latest
    expect(html).toContain('aria-pressed="false"');
    expect(html.indexOf("analysis-legend-group__playback")).toBeLessThan(html.indexOf("agent-style-legend__bar")); // above the legend
  });

  it("disables the playback toggle for a single-period result (nothing to play)", () => {
    const playback: AnalysisLegendPlayback = { periods: ["2024-01-01"], periodUnit: "other", index: 0, playing: false, onToggle: () => {}, onScrub: () => {} };
    const entries = analysisLegendEntries([presented({ styleLegend: choroplethLegend })], () => null).map(entry => ({ ...entry, playback }));
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries, compact: false, isDark: true }));
    expect(html).toContain("disabled");
  });

  it("shows 暫停 and aria-pressed=true while playing", () => {
    const playback: AnalysisLegendPlayback = { periods: ["2024-01-01", "2024-02-01"], periodUnit: "month", index: 1, playing: true, onToggle: () => {}, onScrub: () => {} };
    const entries = analysisLegendEntries([presented({ styleLegend: choroplethLegend })], () => null).map(entry => ({ ...entry, playback }));
    const html = renderToStaticMarkup(h(AnalysisLegendSection, { entries, compact: false, isDark: true }));
    expect(html).toContain("暫停");
    expect(html).toContain('aria-pressed="true"');
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
