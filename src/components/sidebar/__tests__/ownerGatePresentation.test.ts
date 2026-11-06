import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// renderToStaticMarkup 需要 getServerSnapshot；元件只給 getSnapshot，測試裡以它充當伺服端快照
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: <T,>(subscribe: (cb: () => void) => () => void, get: () => T, server?: () => T) => actual.useSyncExternalStore(subscribe, get, server ?? get) };
});

import { LayersPanel } from "../LayersPanel";
import { GATED_LAYERS, THEMES } from "../layerCatalog";
import { resolveLayerPanel } from "../layerPanels";
import { searchLayers } from "../../../lib/layerSearch";
import type { LayerVisibility } from "../../../types";

// 2026-11-06 使用者拍板：站主限定圖層對非站主一律反灰＋鎖頭（spec §5.5），點了走權限提示；不再整個隱藏。
const noop = () => {};
const locked = GATED_LAYERS as ReadonlySet<keyof LayerVisibility>;
const panel = (extra: object) => renderToStaticMarkup(createElement(LayersPanel, {
  search: "", onSearchChange: noop, visibility: {} as LayerVisibility, lockedKeys: locked, expandedLayer: null,
  displayMode: "default", getCount: () => undefined, onLayerClick: noop, onToggleVisibility: noop, onDisplayModeChange: noop,
  ...extra,
} as never));
const lockIcons = (html: string) => (html.match(/lucide-lock/g) ?? []).length;

describe("站主限定圖層：非站主一律鎖頭列，不隱藏", () => {
  it("歷史底圖主題對非站主照常顯示", () => {
    const html = panel({ themes: THEMES.filter((t) => t.title === "歷史底圖 Historical Basemaps") });
    expect(html).toContain("歷史底圖");
  });

  it("模擬面板：站主限定實驗以鎖頭列呈現（未展開也看得到列）", () => {
    const themes = resolveLayerPanel("simulation", "TW").themes.map((t) => ({ ...t, defaultCollapsed: false }));
    const html = panel({ themes });
    expect(lockIcons(html)).toBe(2);
  });

  it("面板搜尋：上鎖圖層照常列出並帶鎖頭；Agent 預設路徑仍 fail-closed", () => {
    const html = panel({ themes: THEMES, search: "古地圖" });
    expect(html).toContain("古地圖");
    expect(lockIcons(html)).toBeGreaterThan(0);
    expect(searchLayers("古地圖").some((r) => r.key === "historicalMapSinica")).toBe(false);
    expect(searchLayers("古地圖", { excludeLocked: false }).some((r) => r.key === "historicalMapSinica")).toBe(true);
  });
});
