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

  it("mobile 與桌機用同一套列開關：LayerSidebar 依主題提供 rail palette，列與醫療群組都用 RailToggle", () => {
    const source = readFileSync("src/components/LayerSidebar.tsx", "utf8");
    expect(source).toContain("const palette = railPalette(isDarkTheme);");
    expect(source).toContain("<RailThemeContext.Provider value={palette}>");
    const panel = readFileSync("src/components/sidebar/LayersPanel.tsx", "utf8");
    expect(panel).toContain("renderToggle={(on, onChange, label) => <RailToggle on={on} onChange={onChange} label={label} />}");
    expect(readFileSync("src/components/sidebar/LayerRow.tsx", "utf8")).toContain("<RailToggle on={toggle.on} onChange={toggle.onChange} label={toggle.label} />");
  });
});
