import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactElement } from "react";
import { MonitorKpis, MonitorMetric, MonitorNote, MonitorRows, MonitorSub, toneColor } from "../MonitorMetric";
import { MonitorStyleContext } from "../monitorStyle";
import { COLORS } from "../../intelTokens";

const v2 = (el: ReactElement) =>
  renderToStaticMarkup(createElement(MonitorStyleContext.Provider, { value: "v2" }, el));

describe("monitor v2 metric row (spec §5.35 D3)", () => {
  it("uses the S13 main/body variables and tabular nums", () => {
    const html = v2(createElement(MonitorMetric, { value: "12.4", unit: "MW" }));
    expect(html).toContain("var(--mon-f-main)");
    expect(html).toContain("var(--mon-f-body)");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain(COLORS.textStrong);
  });

  it("puts a half-width gap before letter units but none before %", () => {
    expect(v2(createElement(MonitorMetric, { value: "12", unit: "MW" }))).toContain("margin-left:0.25em");
    expect(v2(createElement(MonitorMetric, { value: "12", unit: "%" }))).not.toContain("margin-left:0.25em");
  });

  it("mutes the main number for stale data, overriding the domain colour", () => {
    const html = v2(createElement(MonitorMetric, { value: "5", unit: "人", color: COLORS.statusErr, muted: true }));
    expect(html).toContain(`color:${COLORS.textMuted}`);
    expect(html).not.toContain(COLORS.statusErr);
  });

  it("colours the delta by tone", () => {
    const html = v2(createElement(MonitorMetric, { value: "5", delta: "▲ 1", tone: "warn" }));
    expect(html).toContain(toneColor.warn);
    expect(toneColor.up).toBe(COLORS.statusErr);
    expect(toneColor.down).toBe(COLORS.statusLive);
  });

  it("lays KPIs out on an auto-fit grid with label and kpi sizes", () => {
    const html = v2(createElement(MonitorKpis, { items: [{ label: "尖峰負載", value: "36,700", unit: "MW" }] }));
    expect(html).toContain("minmax(110px, 1fr)");
    expect(html).toContain("var(--mon-f-label)");
    expect(html).toContain("var(--mon-f-kpi)");
  });

  it("keeps every sub item unbroken and drops empty ones", () => {
    const html = v2(createElement(MonitorSub, { items: ["最大風速 25 kt", "3 小時前", null, ""] }));
    expect(html.match(/<span style="white-space:nowrap">/g)).toHaveLength(2);
    expect(html).toContain("flex-wrap:wrap");
  });

  it("renders the card-bottom note at label size in the tone colour", () => {
    const html = v2(createElement(MonitorNote, { tone: "err", children: "停更 139 天" }));
    expect(html).toContain("var(--mon-f-label)");
    expect(html).toContain(COLORS.statusErr);
  });
});

describe("MonitorRows small multiples (spec §5.35 F3)", () => {
  const rows = [
    { label: "急診", chart: createElement("svg"), value: "132", unit: "人" },
    { label: "供電", chart: createElement("svg"), value: "41,230", unit: "MW" },
    { label: "共機", chart: createElement("svg"), value: "15" },
  ];

  it("renders one name/chart/value triple per row on a shared 3-column grid", () => {
    const html = v2(createElement(MonitorRows, { rows }));
    expect(html).toContain("grid-template-columns:minmax(64px, auto) minmax(0,1fr) auto");
    expect(html.match(/data-testid="monitor-row-value"/g)).toHaveLength(3);
    expect(html.match(/<svg/g)).toHaveLength(3);
  });

  it("keeps values unbroken in the data font at body size, units at label size", () => {
    const html = v2(createElement(MonitorRows, { rows }));
    expect(html.match(/data-testid="monitor-row-value" style="white-space:nowrap"/g)).toHaveLength(3);
    expect(html).toContain("var(--mon-f-body)");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("margin-left:0.25em");
  });

  it("draws a soft hairline between rows only (not above the first)", () => {
    const html = v2(createElement(MonitorRows, { rows }));
    // 3 欄 × 第 2、3 列 = 6 格有上框線
    expect(html.match(/border-top:1px solid rgba\(255,255,255,0.06\)/g)).toHaveLength(6);
  });

  it("renders nothing for no rows", () => {
    expect(v2(createElement(MonitorRows, { rows: [] }))).toBe("");
  });
});
