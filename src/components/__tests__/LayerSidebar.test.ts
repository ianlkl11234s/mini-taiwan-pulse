import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LayerToggleSwitch } from "../sidebar/LayerToggleSwitch";

const LIGHT_TOGGLE = { ACCENT_TOGGLE: "#1F2937", TOGGLE_OFF: "#D1D5DB", TOGGLE_KNOB_ON: "#fff", TOGGLE_KNOB_OFF: "#fff" };

describe("LayerSidebar light statistics toggles", () => {
  it("renders an enabled light track with the existing rail palette", () => {
    const markup = renderToStaticMarkup(createElement(LayerToggleSwitch, { on: true, onChange: () => {}, ...LIGHT_TOGGLE }));
    expect(markup).toContain("background:#1F2937");
    expect(markup).toContain("background:#fff");
  });

  it("defaults follow the theme when no colors are passed (spec §5.10 列開關)", () => {
    const light = renderToStaticMarkup(createElement(LayerToggleSwitch, { on: true, onChange: () => {}, isDarkTheme: false }));
    expect(light).toContain("background:#1f2937");
    const dark = renderToStaticMarkup(createElement(LayerToggleSwitch, { on: true, onChange: () => {} }));
    expect(dark).toContain("background:#ffffff");
    expect(dark).toContain("background:#111827");
  });

  it("passes that palette to both the statistics row and medical fallback", () => {
    const source = readFileSync("src/components/LayerSidebar.tsx", "utf8");
    expect(source).toContain("renderToggle={(on, onChange, label) => <LayerToggleSwitch on={on} onChange={onChange} label={label} {...togglePalette} />}");
    expect(source).toContain("<LayerToggleSwitch on={active} onChange={() => onToggleVisibility(key)} label={`${displayLabel} 顯示`} {...togglePalette} />");
  });
});
