import { createElement, isValidElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ tab: "globalEvents" }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial === "all" ? harness.tab : typeof initial === "function" ? initial() : initial, vi.fn()],
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
vi.mock("../../../hooks/useNewsFilter", () => ({ useNewsFilter: () => ({ filter: { minRelevance: 0, eventsOnly: false, minSeverity: 0 }, setFilter: vi.fn() }) }));

import { IntelPanel } from "../IntelPanel";
import { FeedTabs } from "../alerts/FeedTabs";
import { GlobalEventsList } from "../../sidebar/GlobalEventsList";
import { globalEventsViewStore } from "../../../state/globalEventsViewStore";
import { parseGlobalEventRecord } from "../../../data/globalEventsLoader";

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const found = findButton(child, label); if (found) return found; }
  } else if (isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) {
    if (node.type === "button" && node.props.children === label) return node.props.onClick;
    return findButton(node.props.children, label);
  }
  return undefined;
}

const located = parseGlobalEventRecord({ event_id: "located", title_zh_tw: "可定位事件", geometry: { type: "Point", coordinates: [10, 20] } });
const unknown = parseGlobalEventRecord({ event_id: "unknown", title_zh_tw: "仍待定位事件", geometry: null });
const panel = (globalEventsEnabled = true, onEnableGlobalEvents = vi.fn()) => IntelPanel({ open: true, onClose: vi.fn(), globalEventsEnabled, onEnableGlobalEvents });

afterEach(() => {
  harness.tab = "globalEvents";
  globalEventsViewStore.set({ entries: [], status: "idle", message: null, windowLabel: "最近七天" });
  globalEventsViewStore.setSelectHandler(null);
});

describe("Global Events Intel tab", () => {
  it("removes duplicate sidebar list mounts while preserving the existing layer controls", () => {
    for (const file of ["LayerSidebar.tsx", "IconRailSidebar.tsx"]) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      expect(source).not.toContain("GlobalEventsList");
      expect(source).toContain("buildParamControls");
    }
  });

  it("adds an independent fourth tab without changing news/alert/all counts", () => {
    const markup = renderToStaticMarkup(createElement(FeedTabs, { tab: "globalEvents", onTab: vi.fn(), newsCount: 7, alertCount: 5, alertCountInAll: 3, alertSevere: 1 }));
    const buttons = markup.match(/<button\b[\s\S]*?<\/button>/g)!;
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.replace(/<[^>]+>/g, ""))).toEqual(["全部10", "新聞7", "警報5", "全球情勢"]);
    expect(buttons[3]).toContain('aria-selected="true"');
  });

  it("shows the original store statistics, unlocated events and selection without news timing/health", () => {
    globalEventsViewStore.set({ entries: [located, unknown], status: "ready", message: null, windowLabel: "最近七天總覽" });
    const markup = renderToStaticMarkup(panel());
    expect(markup).toContain("最近七天總覽 · 已載入 2 件 · 1 件待定位");
    expect(markup).toContain("可定位事件");
    expect(markup).toContain("仍待定位事件");
    for (const hidden of ["更新 ", "共 0 則", ">LIVE<", "1H", "6H", "24H", "SEVERITY ≥", "REPLAY", "來源管線", "max-height:240px"]) expect(markup).not.toContain(hidden);
    const selected = vi.fn();
    globalEventsViewStore.setSelectHandler(selected);
    findButton(GlobalEventsList({ fillPanel: true }), "定位並展開")!();
    expect(selected).toHaveBeenCalledWith(located);
    expect(located.coordinates).toEqual([10, 20]);
  });

  it("layer off hides cached statistics and requires the explicit existing-layer enable action", () => {
    globalEventsViewStore.set({ entries: [located, unknown], status: "ready", message: null, windowLabel: "舊時間窗" });
    const enable = vi.fn();
    const tree = panel(false, enable);
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain("開啟全球情勢圖層以載入");
    expect(markup).not.toContain("舊時間窗");
    expect(markup).not.toContain("已載入");
    expect(markup).not.toContain("可定位事件");
    expect(enable).not.toHaveBeenCalled();
    findButton(tree, "開啟全球情勢圖層以載入")!();
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("retains history/loading/partial semantics and leaves other tab controls intact", () => {
    globalEventsViewStore.set({ entries: [unknown], status: "partial", message: "AI 初判資料載入失敗，並非零件。", windowLabel: "跟隨時間軸" });
    expect(renderToStaticMarkup(panel())).toContain("跟隨時間軸 · 已載入 1 件 · 1 件待定位");
    expect(renderToStaticMarkup(panel())).toContain("並非零件");
    globalEventsViewStore.set({ entries: [], status: "loading", message: null, windowLabel: "跟隨時間軸" });
    expect(renderToStaticMarkup(panel())).toContain("正在載入全球情勢");
    expect(renderToStaticMarkup(panel())).not.toContain("已載入 0");
    harness.tab = "all";
    const all = renderToStaticMarkup(panel());
    expect(all).toContain("1H");
    expect(all).toContain("REPLAY");
    expect(all).toContain("更新 ");
    expect(all).not.toContain('aria-label="全球情勢事件列表"');
    harness.tab = "alerts";
    expect(renderToStaticMarkup(panel())).toContain("SEVERITY ≥");
  });
});
