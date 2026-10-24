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
import { LAYER_PANELS, layerPanelDef, panelLayerKeys, visibleLayerPanels } from "../sidebar/layerPanels";
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

describe("模擬入口只對站主顯示（simulation PLAN D-1）", () => {
  it("visibleLayerPanels：非站主不含模擬，站主含模擬且排在最後", () => {
    expect(visibleLayerPanels(false).map((panel) => panel.id)).toEqual(["layers", "statistics", "world", "japan"]);
    expect(visibleLayerPanels(true)).toBe(LAYER_PANELS);
    expect(visibleLayerPanels(true)[LAYER_PANELS.length - 1]!.id).toBe("simulation");
  });

  it("桌機 rail：站主有「模擬」按鈕，非站主與未傳（載入中）都沒有", () => {
    expect(rail({ showSimulation: true })).toContain("模擬 Simulation");
    expect(rail({ showSimulation: false })).not.toContain("模擬 Simulation");
    expect(rail({})).not.toContain("模擬 Simulation");
  });

  it("手機分頁：站主有「模擬」分頁，非站主沒有", () => {
    expect(mobile({ showSimulation: true })).toContain(">模擬<");
    const guest = mobile({});
    expect(guest).not.toContain(">模擬<");
    expect(guest).toContain(">日本<");
  });
});

describe("雙北跨河橋梁韌性搬到模擬面板（D-6）", () => {
  it("只有 bridgeResilienceTwinCity 搬走；BSS 兩層留在台灣入口", () => {
    expect([...panelLayerKeys("simulation")]).toEqual(["bridgeResilienceTwinCity"]);
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
    expect(panelForExplorationLayers(["bridgeResilienceTwinCity"])).toBe("simulation");
  });
});
