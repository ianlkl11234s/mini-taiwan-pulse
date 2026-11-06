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

describe("模擬入口與實驗人人可見；站主限定實驗對非站主顯示鎖頭列、不濾掉（2026-11-06 統一）", () => {
  it("resolveLayerPanel：站主與非站主同一份清單", () => {
    expect(getThemeLayerKeys(resolveLayerPanel("simulation", "TW").themes)).toEqual(["bridgeResilienceTwinCity", "busCrowdingSim", "transitReachGrid", "transitReachPlayback", "transitAccessGrid", "transitAccessPlayback", "freewayTdcsSim", "mapchallengeDay04Population", "mapchallengeDay04Facility", "mapchallengeDay04Overlap", "mapchallengeDay04ScaleTcCh", "mapchallengeDay05SeaView", "mapchallengeDay05SeaViewRuns"]);
    expect(LAYER_PANELS[LAYER_PANELS.length - 1]!.id).toBe("simulation");
  });

  it("站主限定實驗留在模擬面板（由 lockedKeys 上鎖）；交通可及性公開", () => {
    expect([...panelLayerKeys("simulation")].filter((key) => GATED_LAYERS.has(key as keyof LayerVisibility))).toEqual(["bridgeResilienceTwinCity", "busCrowdingSim"]);
    expect(GATED_LAYERS.has("transitReachGrid")).toBe(false);
    expect(GATED_LAYERS.has("transitReachPlayback")).toBe(false);
  });

  it("桌機 rail：都有「模擬」按鈕", () => {
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
    expect([...panelLayerKeys("simulation", "TW")]).toEqual(["bridgeResilienceTwinCity", "busCrowdingSim", "transitReachGrid", "transitReachPlayback", "transitAccessGrid", "transitAccessPlayback", "freewayTdcsSim", "mapchallengeDay04Population", "mapchallengeDay04Facility", "mapchallengeDay04Overlap", "mapchallengeDay04ScaleTcCh", "mapchallengeDay05SeaView", "mapchallengeDay05SeaViewRuns"]);
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

describe("雙北國道逐車模擬（公開模擬）", () => {
  it("manifest section 指向模擬面板第五個主題；非站主看得到；Agent 開啟時導向模擬面板", () => {
    const theme = layerPanelDef("simulation").themes[4]!;
    expect(LAYER_MANIFEST.freewayTdcsSim.section).toEqual({ theme: theme.title, group: theme.groups[0]!.title });
    expect(GATED_LAYERS.has("freewayTdcsSim")).toBe(false);
    expect(panelForExplorationLayers(["freewayTdcsSim"]).panel).toBe("simulation");
    expect(getThemeLayerKeys(MAIN_THEMES)).not.toContain("freewayTdcsSim");
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
