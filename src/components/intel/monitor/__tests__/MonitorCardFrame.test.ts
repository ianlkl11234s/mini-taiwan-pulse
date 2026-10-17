import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MonitorCardFrame, formatMonitorTime } from "../MonitorCardFrame";
import { MonitorStyleContext } from "../monitorStyle";
import { MONITOR_CARD_META } from "../monitorCardMeta";
import { SectionLabel, Widget } from "../PressureRing";

describe("monitor v2 card shell (spec §5.35)", () => {
  it("formats same-day times as HH:MM and older ones as MM/DD", () => {
    const now = new Date(2026, 9, 1, 14, 0).getTime();
    expect(formatMonitorTime(new Date(2026, 9, 1, 9, 5).getTime(), now)).toBe("09:05");
    expect(formatMonitorTime(new Date(2026, 4, 15, 23, 0).getTime(), now)).toBe("05/15");
  });

  it("renders the Chinese title with the English note inside the frame", () => {
    const html = renderToStaticMarkup(
      createElement(MonitorCardFrame, { title: "供電", en: "Power grid", widgetId: "powerCard", children: "內容" }),
    );
    expect(html).toContain("mtp-mcard");
    expect(html).toContain("供電");
    expect(html).toContain("Power grid");
    expect(html).toContain("內容");
  });

  it("gives every card a Chinese title and no internal id", () => {
    for (const [id, meta] of Object.entries(MONITOR_CARD_META)) {
      expect(meta.title, id).toMatch(/[一-鿿]/);
      expect(meta.title, id).not.toMatch(/_/);
    }
  });

  it("keeps the legacy section label and drops uppercase under v2", () => {
    const legacy = renderToStaticMarkup(createElement(SectionLabel, null, "供電"));
    expect(legacy).toContain("uppercase");
    const v2 = renderToStaticMarkup(
      createElement(MonitorStyleContext.Provider, { value: "v2" }, createElement(SectionLabel, null, "供電")),
    );
    expect(v2).not.toContain("uppercase");
  });

  it("draws no own frame for Widget under v2", () => {
    const legacy = renderToStaticMarkup(createElement(Widget, null, "x"));
    expect(legacy).toContain("border");
    const v2 = renderToStaticMarkup(
      createElement(MonitorStyleContext.Provider, { value: "v2" }, createElement(Widget, null, "x")),
    );
    expect(v2).not.toContain("border:");
  });
});
