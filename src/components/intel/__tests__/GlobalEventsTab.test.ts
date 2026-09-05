import { createElement } from "react";
import { existsSync, readFileSync } from "node:fs";
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
import { globalSituationFeedStore, EMPTY_GLOBAL_SITUATION_FEED } from "../../../state/globalSituationFeedStore";
import { parseGlobalEventCandidate, parseGlobalEventRecord } from "../../../data/globalEventsLoader";

const NOW = Date.now();
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

const publishedEvent = parseGlobalEventRecord({
  event_id: "evt-published",
  version_id: "ver-1",
  title_zh_tw: "已研究的國際事件",
  summary_zh_tw: "正式事件摘要。",
  category: "disaster",
  severity: 3,
  valid_from: iso(30),
  country_code: "JP",
  name: "東京都",
  geometry: { type: "Point", coordinates: [139.7, 35.7] },
});

const coreCandidate = parseGlobalEventCandidate({
  candidate_id: "core",
  observation_sha256: "sha-core",
  title_zh_tw: "AI 初判的重要事件",
  summary_zh_tw: "候選摘要。",
  category: "accident",
  severity: 2,
  decision: "keep_core",
  research_status: "ai_assessed",
  observed_at: iso(120),
  available_at: iso(110),
  source_urls: ["https://news.example.com/story/1"],
  geometry: null,
  location_kind: "unknown",
});

const noiseCandidate = parseGlobalEventCandidate({
  candidate_id: "noise",
  observation_sha256: "sha-noise",
  title_zh_tw: "低價值的雜訊條目",
  category: "other",
  decision: "drop_noise",
  research_status: "ai_assessed",
  observed_at: iso(20),
  available_at: iso(15),
  geometry: { type: "Point", coordinates: [1, 2] },
});

const watchCandidate = parseGlobalEventCandidate({
  candidate_id: "watch",
  observation_sha256: "sha-watch",
  title_zh_tw: "只在觀察中才出現",
  category: "policy",
  decision: "keep_watch",
  research_status: "ai_assessed",
  observed_at: iso(10),
  available_at: iso(5),
  geometry: { type: "Point", coordinates: [3, 4] },
});

const seed = (...entries: ReturnType<typeof parseGlobalEventRecord>[]) =>
  globalSituationFeedStore.set({ entries, status: "ready", message: null, dateKey: "today" });

const panel = () => IntelPanel({ open: true, onClose: vi.fn() });

afterEach(() => {
  harness.tab = "globalEvents";
  globalSituationFeedStore.set(EMPTY_GLOBAL_SITUATION_FEED);
});

describe("Global Events Intel tab", () => {
  it("列表只活在 INTEL：舊 sidebar 元件已移除，圖層 controls 保留", () => {
    expect(existsSync(new URL("../../sidebar/GlobalEventsList.tsx", import.meta.url))).toBe(false);
    for (const file of ["LayerSidebar.tsx", "IconRailSidebar.tsx"]) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      expect(source).not.toContain("GlobalEventsList");
      expect(source).toContain("buildParamControls");
    }
    const panelSource = readFileSync(new URL("../IntelPanel.tsx", import.meta.url), "utf8");
    // 不再有「圖層要先開」的門檻，也不再讀被地圖 effect 綁死的 view store
    expect(panelSource).not.toContain("globalEventsEnabled");
    expect(panelSource).not.toContain("onEnableGlobalEvents");
    expect(panelSource).not.toContain("globalEventsViewStore");
  });

  it("四個分頁都帶數字，全部＝新聞＋警報＋國際", () => {
    const markup = renderToStaticMarkup(createElement(FeedTabs, {
      tab: "globalEvents", onTab: vi.fn(), newsCount: 7, alertCount: 5,
      alertCountInAll: 3, alertSevere: 1, globalCount: 4, globalCountInAll: 2,
    }));
    const buttons = markup.match(/<button\b[\s\S]*?<\/button>/g)!;
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.replace(/<[^>]+>/g, ""))).toEqual(["全部12", "新聞7", "警報5", "全球情勢4"]);
    expect(buttons[3]).toContain('aria-selected="true"');
  });

  it("圖層關閉也有資料，且沒有任何「先開圖層」的 CTA", () => {
    seed(publishedEvent, coreCandidate);
    const markup = renderToStaticMarkup(panel());
    expect(markup).not.toContain("開啟全球情勢圖層以載入");
    expect(markup).not.toContain("等待全球情勢圖層載入");
    expect(markup).toContain("已研究的國際事件");
    expect(markup).toContain("AI 初判的重要事件");
    // 卡片格式與國內新聞同一個元件：國際／來源 chip、分類 chip、待定位地點
    expect(markup).toContain("國際");
    expect(markup).toContain("已研究");
    expect(markup).toContain("AI 初判");
    expect(markup).toContain("待定位");
    expect(markup).toContain("共 2 件 · 1 件待定位");
  });

  it("預設過濾掉 drop_noise，keep_watch 要靠「含觀察中」toggle", () => {
    seed(publishedEvent, coreCandidate, noiseCandidate, watchCandidate);
    const markup = renderToStaticMarkup(panel());
    expect(markup).not.toContain("低價值的雜訊條目");
    expect(markup).not.toContain("只在觀察中才出現");
    expect(markup).toContain("含觀察中");
    expect(markup).toContain("共 2 件");
  });

  it("沿用新聞的 RANGE，但不混入新聞 LIVE／健康列／警報篩選／REPLAY", () => {
    seed(publishedEvent);
    const markup = renderToStaticMarkup(panel());
    for (const shown of ["RANGE", "1H", "6H", "24H"]) expect(markup).toContain(shown);
    for (const hidden of ["共 0 則", ">LIVE<", "SEVERITY ≥", "REPLAY", "來源管線"]) expect(markup).not.toContain(hidden);
  });

  it("載入中／失敗保留語意，不用空清單假裝沒事", () => {
    globalSituationFeedStore.set({ entries: [], status: "loading", message: null, dateKey: "today" });
    expect(renderToStaticMarkup(panel())).toContain("正在載入全球情勢");
    globalSituationFeedStore.set({ entries: [], status: "error", message: "RPC 掛了", dateKey: "today" });
    const failed = renderToStaticMarkup(panel());
    expect(failed).toContain("全球情勢載入失敗");
    expect(failed).toContain("RPC 掛了");
    globalSituationFeedStore.set({ entries: [publishedEvent], status: "error", message: "RPC 掛了", dateKey: "today" });
    // 重抓失敗不清空舊資料
    expect(renderToStaticMarkup(panel())).toContain("已研究的國際事件");
  });

  it("「全部」分頁併入國際卡片、依事件時間降冪，其他分頁 controls 不動", () => {
    seed(publishedEvent, coreCandidate, noiseCandidate);
    harness.tab = "all";
    const all = renderToStaticMarkup(panel());
    expect(all).toContain("已研究的國際事件");
    expect(all).toContain("AI 初判的重要事件");
    expect(all).not.toContain("低價值的雜訊條目");
    // publishedEvent 30 分鐘前、coreCandidate 120 分鐘前 → 新的在前
    expect(all.indexOf("已研究的國際事件")).toBeLessThan(all.indexOf("AI 初判的重要事件"));
    expect(all).toContain("1H");
    expect(all).toContain("REPLAY");
    expect(all).toContain("更新 ");
    // 「共 N 則」維持新聞語意，不被國際筆數污染
    expect(all).toContain("共 0 則");
    harness.tab = "alerts";
    expect(renderToStaticMarkup(panel())).toContain("SEVERITY ≥");
  });
});
