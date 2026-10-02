import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactElement } from "react";
import { MonitorKpis, MonitorMetric, MonitorNote, MonitorSub, toneColor } from "../MonitorMetric";
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
