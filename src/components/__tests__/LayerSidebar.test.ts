import { readFileSync } from "node:fs";
import ts from "typescript";
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

// LayerSidebar 本體 render 需要整包圖層狀態，改以 AST 驗證 provider 接線：
// palette 由 railPalette(isDarkTheme) 產生，且整棵樹包在 RailThemeContext.Provider value={palette} 內。
describe("LayerSidebar RailThemeContext wiring", () => {
  const source = ts.createSourceFile("LayerSidebar.tsx", readFileSync("src/components/LayerSidebar.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const providers: ts.JsxOpeningElement[] = [];
  const paletteDecls: ts.VariableDeclaration[] = [];
  (function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText() === "RailThemeContext.Provider") providers.push(node);
    if (ts.isVariableDeclaration(node) && node.name.getText() === "palette") paletteDecls.push(node);
    ts.forEachChild(node, visit);
  })(source);

  it("palette = railPalette(isDarkTheme)", () => {
    expect(paletteDecls).toHaveLength(1);
    expect(paletteDecls[0]!.initializer?.getText()).toBe("railPalette(isDarkTheme)");
  });

  it("RailThemeContext.Provider 只有一個，value 是上面的 palette", () => {
    expect(providers).toHaveLength(1);
    const value = providers[0]!.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === "value");
    expect(value?.initializer && ts.isJsxExpression(value.initializer) ? value.initializer.expression?.getText() : undefined).toBe("palette");
  });
});
