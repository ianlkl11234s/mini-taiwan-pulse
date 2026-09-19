import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BasemapLabelToggle } from "./App";

describe("BasemapLabelToggle", () => {
  it("keeps the desktop label, pressed state, and contextual title", () => {
    const html = renderToStaticMarkup(createElement(BasemapLabelToggle, {
      isDarkTheme: false,
      visible: true,
      onToggle: vi.fn(),
      title: "隱藏底圖地名",
    }));

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('title="隱藏底圖地名"');
    expect(html).toContain("地名：開");
    expect(html).toContain("background:rgba(255,255,255,0.85)");
  });

  it("keeps the mobile dark theme without a desktop title", () => {
    const html = renderToStaticMarkup(createElement(BasemapLabelToggle, {
      isDarkTheme: true,
      visible: false,
      onToggle: vi.fn(),
    }));

    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("title=");
    expect(html).toContain("地名：關");
    expect(html).toContain("background:rgba(0,0,0,0.6)");
  });
});
