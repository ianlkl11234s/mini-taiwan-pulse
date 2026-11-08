import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// renderToStaticMarkup 需要 getServerSnapshot；元件只給 getSnapshot，測試裡以它充當伺服端快照
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: <T,>(subscribe: (cb: () => void) => () => void, get: () => T, server?: () => T) => actual.useSyncExternalStore(subscribe, get, server ?? get) };
});

// 抓主題列「全部開關」的 handler，驗證全鎖主題不會靜默無反應
const bulkToggles = new Map<string, () => void>();
vi.mock("../ThemeBanner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ThemeBanner")>();
  return {
    ...actual,
    ThemeBanner: (props: { title: string; onBulkToggle: () => void }) => {
      bulkToggles.set(props.title, props.onBulkToggle);
      return actual.ThemeBanner(props as never);
    },
  };
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

// 全鎖主題：古地圖 2026-11-06 改公開後，現有主題沒有整個上鎖的，從「災害」主題只留站主限定層組一個
const LOCKED_KEY = "soilLiquefactionPotential";
const LOCKED_TITLE = "測試全鎖主題";
const lockedTheme = (() => {
  const base = THEMES.find((t) => t.groups.some((g) => g.layers.some((l) => l.key === LOCKED_KEY)))!;
  const groups = base.groups
    .map((g) => ({ ...g, layers: g.layers.filter((l) => locked.has(l.key)) }))
    .filter((g) => g.layers.length > 0);
  return { ...base, title: LOCKED_TITLE, groups, defaultCollapsed: false };
})();

describe("站主限定圖層：非站主一律鎖頭列，不隱藏", () => {
  it("整個上鎖的主題對非站主照常顯示（列帶鎖頭）", () => {
    const html = panel({ themes: [lockedTheme] });
    expect(html).toContain("土壤液化潛勢");
    expect(lockIcons(html)).toBeGreaterThan(0);
  });

  it("模擬面板：站主限定實驗以鎖頭列呈現（未展開也看得到列）", () => {
    const themes = resolveLayerPanel("simulation", "TW").themes.map((t) => ({ ...t, defaultCollapsed: false }));
    const html = panel({ themes });
    expect(lockIcons(html)).toBe(2);
  });

  it("面板搜尋：上鎖圖層照常列出並帶鎖頭；Agent 預設路徑仍 fail-closed", () => {
    const html = panel({ themes: THEMES, search: "土壤液化潛勢" });
    expect(html).toContain("土壤液化潛勢");
    expect(lockIcons(html)).toBeGreaterThan(0);
    expect(searchLayers("土壤液化潛勢").some((r) => r.key === LOCKED_KEY)).toBe(false);
    expect(searchLayers("土壤液化潛勢", { excludeLocked: false }).some((r) => r.key === LOCKED_KEY)).toBe(true);
  });

  it("全鎖主題的「全部開關」走鎖定列同一條權限提示（onToggleVisibility），不走 bulk", () => {
    const toggled: string[] = [];
    const bulk: string[][] = [];
    bulkToggles.clear();
    panel({
      themes: [lockedTheme],
      onToggleVisibility: (key: string) => toggled.push(key),
      onBulkSetVisibility: (keys: string[]) => bulk.push(keys),
    });
    bulkToggles.get(LOCKED_TITLE)!();
    expect(toggled.length).toBeGreaterThan(0);
    expect(toggled.every((k) => locked.has(k as keyof LayerVisibility))).toBe(true);
    expect(bulk).toEqual([]);
  });
});
