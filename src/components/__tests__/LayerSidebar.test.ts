import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// renderToStaticMarkup 需要 getServerSnapshot；元件只給 getSnapshot，測試裡以它充當伺服端快照
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: <T,>(subscribe: (cb: () => void) => () => void, get: () => T, server?: () => T) => actual.useSyncExternalStore(subscribe, get, server ?? get) };
});

import { LayerToggleSwitch } from "../sidebar/LayerToggleSwitch";
import { ListRow } from "../sidebar/LayerRow";
import { MedicalStatisticsGroupControls } from "../sidebar/MedicalStatisticsGroupControls";
import { DARK_PALETTE, LIGHT_PALETTE, RailThemeContext, railPalette } from "../sidebar/railTheme";
import type { LayerVisibility } from "../../types";

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

  it("mobile 與桌機用同一套列開關：共用列與醫療群組列的開關都取 RailThemeContext 色票", () => {
    // 刻意用不存在於任何主題的色票，證明開關顏色來自 context 而非寫死
    const palette = { ...railPalette(false), ACCENT_TOGGLE: "#123456", TOGGLE_KNOB_ON: "#abcdef" };
    const inTheme = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(RailThemeContext.Provider, { value: palette }, child));
    const row = inTheme(createElement(ListRow, { label: "測試圖層", ariaLabel: "測試圖層", active: true, toggle: { on: true, onChange: () => {}, label: "切換測試圖層" } }));
    const group = inTheme(createElement(MedicalStatisticsGroupControls, {
      groupKey: "hospitalCount",
      visibility: { statsHealthHospitalCount: true } as unknown as LayerVisibility,
      expandedLayer: null, onLayerClick: () => {}, renderControls: () => null,
    }));
    for (const markup of [row, group]) {
      expect(markup).toContain("background:#123456");
      expect(markup).toContain("background:#abcdef");
    }
    expect(railPalette(false)).toBe(LIGHT_PALETTE);
    expect(railPalette(true)).toBe(DARK_PALETTE);
  });
});
