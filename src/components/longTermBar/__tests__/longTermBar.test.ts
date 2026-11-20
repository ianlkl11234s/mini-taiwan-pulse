import { afterEach, describe, expect, it, vi } from "vitest";
import { longTermPeriods, longTermUsesHeatmap, monthPeriodIndex, LONG_TERM_HEATMAP_MIN_MONTHS } from "../../../lib/longTermTime";
import { LONG_TERM_BAR_ADAPTERS, LONG_TERM_BAR_KEYS, LIVE_TIMELINE_KEYS, hasLongTermBar, isLiveTimelineLayer, longTermSpecOf } from "../../../data/longTermLayers";
import { LONG_TERM_ADAPTERS } from "../adapters";
import { longTermBarStore, periodsOf, selectionOf, trackOpened } from "../../../state/longTermBarStore";
import { badgeTipText, periodLabel } from "../longTermText";
import zh from "../../../i18n/locales/zh-TW/longTerm.json";

const t = ((key: string, vars?: Record<string, string | number>) => {
  const tpl = (zh as Record<string, string>)[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (m, n: string) => (vars && n in vars ? String(vars[n]) : m));
}) as Parameters<typeof badgeTipText>[2];

describe("期別軸（manifest coverage＋granularity）", () => {
  it("火災 2022-01 – 2024-12 每月＝36 期", () => {
    const p = longTermPeriods({ start: "2022-01-01", end: "2024-12-31" }, "month");
    expect(p).toHaveLength(36);
    expect(p[0]).toMatchObject({ year: 2022, month: 1 });
    expect(p[35]).toMatchObject({ year: 2024, month: 12 });
    expect(monthPeriodIndex(p, 2023, 4)).toBe(15);
    expect(monthPeriodIndex(p, 2025, 1)).toBe(-1);
  });
  it("年、季粒度", () => {
    expect(longTermPeriods({ start: "2015-01-01", end: "2024-12-31" }, "year")).toHaveLength(10);
    expect(longTermPeriods({ start: "2022-04-01", end: "2023-06-30" }, "quarter").map((x) => `${x.year}Q${x.quarter}`)).toEqual(["2022Q2", "2022Q3", "2022Q4", "2023Q1", "2023Q2"]);
  });
  it("熱區門檻：剛好 6 個月就改熱區（>=）", () => {
    expect(LONG_TERM_HEATMAP_MIN_MONTHS).toBe(6);
    expect(longTermUsesHeatmap("month", 5)).toBe(false);
    expect(longTermUsesHeatmap("month", 6)).toBe(true);
    expect(longTermUsesHeatmap("month", 12)).toBe(true);
  });
});

describe("圖層分類由 manifest 派生", () => {
  it("即時圖層：topics 含「即時」且沒有 longTerm", () => {
    for (const k of ["rainGauge", "flights", "ships", "busLive"]) expect(isLiveTimelineLayer(k), k).toBe(true);
    expect(isLiveTimelineLayer("fireEvents")).toBe(false);
    // 「畜牧 Livestock」不可被當成即時
    expect(isLiveTimelineLayer("livestockFeed")).toBe(false);
    expect(LIVE_TIMELINE_KEYS.some((k) => LONG_TERM_BAR_KEYS.includes(k))).toBe(false);
  });
  it("有時間條的長期圖層＝已實作類別且已接資料（1b 只有火災）", () => {
    expect(LONG_TERM_BAR_KEYS).toEqual(["fireEvents"]);
    expect(hasLongTermBar("popCount")).toBe(false);
    expect([...LONG_TERM_BAR_ADAPTERS].sort()).toEqual(Object.keys(LONG_TERM_ADAPTERS).sort());
  });
  it("tooltip 由涵蓋＋粒度產生，台灣附西元", () => {
    const fire = longTermSpecOf("fireEvents")!;
    expect(badgeTipText("fireEvents", fire, t)).toBe("111–113 年（2022–2024）・每月");
    expect(periodLabel("fireEvents", { start: "2023-04-01", year: 2023, month: 4 }, "month", t)).toBe("112/04");
  });
});

describe("longTermBarStore", () => {
  afterEach(() => { longTermBarStore.reset(); vi.useRealTimers(); });

  it("預設選最新一期；選取夾在範圍內", () => {
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([35, 35]);
    longTermBarStore.select("fireEvents", [15, 12]);
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([12, 15]);
    longTermBarStore.select("fireEvents", [-3, 99]);
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([0, 35]);
  });

  it("播放逐期跳，播到最後一期停住；在最後一期按播放從頭開始", () => {
    vi.useFakeTimers();
    longTermBarStore.select("fireEvents", [33, 33]);
    longTermBarStore.play("fireEvents");
    vi.advanceTimersByTime(1000);
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([34, 34]);
    longTermBarStore.setSpeed(4);
    vi.advanceTimersByTime(250);
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([35, 35]);
    expect(longTermBarStore.getSnapshot().playing).toBe(false);
    longTermBarStore.play("fireEvents");
    expect(selectionOf(longTermBarStore.getSnapshot(), "fireEvents")).toEqual([0, 0]);
    expect(periodsOf("fireEvents")).toHaveLength(36);
  });

  it("單獨打開記為最新並清掉手動指定；同批還原保留原先後與手動指定", () => {
    const on = new Set<string>();
    const sync = () => trackOpened((k) => on.has(k));
    sync();
    on.add("rainGauge"); sync();
    on.add("fireEvents"); sync();
    let s = longTermBarStore.getSnapshot();
    expect(s.openedAt.fireEvents!).toBeGreaterThan(s.openedAt.rainGauge!);
    longTermBarStore.pin("live");
    // 進歷史模式：全關；回來：同一批還原
    on.clear(); sync();
    on.add("fireEvents"); on.add("rainGauge"); sync();
    s = longTermBarStore.getSnapshot();
    expect(s.openedAt.fireEvents!).toBeGreaterThan(s.openedAt.rainGauge!);
    expect(s.pinned).toBe("live");
    // 使用者再單獨打開雨量 → 雨量最新、手動指定清掉
    on.delete("rainGauge"); sync();
    on.add("rainGauge"); sync();
    s = longTermBarStore.getSnapshot();
    expect(s.openedAt.rainGauge!).toBeGreaterThan(s.openedAt.fireEvents!);
    expect(s.pinned).toBeNull();
  });
});
