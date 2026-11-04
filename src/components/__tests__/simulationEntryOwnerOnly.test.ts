import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// renderToStaticMarkup 需要 getServerSnapshot；元件只給 getSnapshot，測試裡以它充當伺服端快照
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: <T,>(subscribe: (cb: () => void) => () => void, get: () => T, server?: () => T) => actual.useSyncExternalStore(subscribe, get, server ?? get) };
});

import { IconRailSidebar, MAIN_THEMES, getThemeLayerKeys } from "../IconRailSidebar";
import { LayerSidebar } from "../LayerSidebar";
import { LAYER_PANELS, layerPanelDef, panelLayerKeys, resolveLayerPanel } from "../sidebar/layerPanels";
import { GATED_LAYERS } from "../sidebar/layerCatalog";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { panelForExplorationLayers } from "../../research/explorationNavigation";
import type { LayerVisibility } from "../../types";

const noop = () => {};
const baseProps = {
  visibility: {} as LayerVisibility, expandedLayer: null, viewMode: "default", displayMode: "default", counts: {},
  onLayerClick: noop, onToggleVisibility: noop, onViewModeChange: noop, onDisplayModeChange: noop,
  onAllOff: noop, onLocationJump: noop, isDarkTheme: true,
};
const rail = (extra: object) => renderToStaticMarkup(createElement(IconRailSidebar, { ...baseProps, ...extra } as never));
const mobile = (extra: object) => renderToStaticMarkup(createElement(LayerSidebar, { ...baseProps, isMobile: true, ...extra } as never));

describe("模擬入口人人可見，站主限定實驗只列給站主（2026-11-01 改 D-1）", () => {
  it("resolveLayerPanel：非站主只見交通可及性兩層；站主四層", () => {
    expect(getThemeLayerKeys(resolveLayerPanel("simulation", "TW").themes)).toEqual(["transitReachGrid", "transitReachPlayback", "transitAccessGrid", "transitAccessPlayback"]);
    expect(getThemeLayerKeys(resolveLayerPanel("simulation", "TW", true).themes)).toEqual(["bridgeResilienceTwinCity", "busCrowdingSim", "transitReachGrid", "transitReachPlayback", "transitAccessGrid", "transitAccessPlayback"]);
    expect(LAYER_PANELS[LAYER_PANELS.length - 1]!.id).toBe("simulation");
  });

  it("非站主的模擬面板不含任何 GATED_LAYERS", () => {
    expect([...panelLayerKeys("simulation")].filter((key) => GATED_LAYERS.has(key as keyof LayerVisibility))).toEqual([]);
    expect(GATED_LAYERS.has("transitReachGrid")).toBe(false);
    expect(GATED_LAYERS.has("transitReachPlayback")).toBe(false);
  });

  it("桌機 rail：站主、非站主與未傳（載入中）都有「模擬」按鈕", () => {
    expect(rail({ simulationOwner: true })).toContain("模擬 Simulation");
    expect(rail({ simulationOwner: false })).toContain("模擬 Simulation");
    expect(rail({})).toContain("模擬 Simulation");
  });

  it("手機分頁：非站主也有「模擬」分頁", () => {
    const guest = mobile({});
    expect(guest).toContain(">模擬<");
    expect(guest).toContain(">世界<");
    expect(guest).not.toContain(">日本<");
  });
});

describe("雙北跨河橋梁韌性搬到模擬面板（D-6）", () => {
  it("模擬面板是橋梁韌性＋公車擁擠；BSS 兩層留在台灣入口", () => {
    expect([...panelLayerKeys("simulation", "TW", true)]).toEqual(["bridgeResilienceTwinCity", "busCrowdingSim", "transitReachGrid", "transitReachPlayback", "transitAccessGrid", "transitAccessPlayback"]);
    const main = new Set(getThemeLayerKeys(MAIN_THEMES));
    expect(main.has("bridgeResilienceTwinCity")).toBe(false);
    expect(main.has("bssNationalBridgePreview")).toBe(true);
    expect(main.has("bssNationalBridgePointsPreview")).toBe(true);
  });

  it("manifest section 指向模擬面板的主題與群組", () => {
    const theme = layerPanelDef("simulation").themes[0]!;
    expect(LAYER_MANIFEST.bridgeResilienceTwinCity.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
  });

  it("Agent 開啟該圖層時導向模擬面板", () => {
    expect(panelForExplorationLayers(["bridgeResilienceTwinCity"]).panel).toBe("simulation");
  });
});

describe("交通可及性（公開模擬）", () => {
  it("manifest section 指向模擬面板第三個主題；Agent 開啟時導向模擬面板", () => {
    const theme = layerPanelDef("simulation").themes[2]!;
    expect(LAYER_MANIFEST.transitReachGrid.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(LAYER_MANIFEST.transitReachPlayback.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(panelForExplorationLayers(["transitReachPlayback"]).panel).toBe("simulation");
  });
});

describe("雙北大眾運輸可及性（公開模擬）", () => {
  it("manifest section 指向模擬面板第四個主題；非站主看得到；Agent 開啟時導向模擬面板", () => {
    const theme = layerPanelDef("simulation").themes[3]!;
    expect(LAYER_MANIFEST.transitAccessGrid.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(LAYER_MANIFEST.transitAccessPlayback.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(GATED_LAYERS.has("transitAccessGrid")).toBe(false);
    expect(GATED_LAYERS.has("transitAccessPlayback")).toBe(false);
    expect(panelForExplorationLayers(["transitAccessGrid"]).panel).toBe("simulation");
  });
});

describe("公車擁擠模擬（Phase 2 第一刀）", () => {
  it("manifest section 指向模擬面板第二個主題，且只鎖 UI", () => {
    const theme = layerPanelDef("simulation").themes[1]!;
    expect(LAYER_MANIFEST.busCrowdingSim.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(new Set(getThemeLayerKeys(MAIN_THEMES)).has("busCrowdingSim")).toBe(false);
    expect(panelForExplorationLayers(["busCrowdingSim"]).panel).toBe("simulation");
  });
});
