import { describe, expect, it } from "vitest";
import { maxSourceSuccessMs, newsFreshnessInput, taipeiDayKey } from "../newsFreshness";

const NOW = Date.parse("2026-10-09T08:00:00Z");
const H = 3600_000;

describe("newsFreshnessInput", () => {
  it("歷史日期不判斷新鮮度（dataMs＝現在），仍顯示該日資料時間", () => {
    const r = newsFreshnessInput({ dayKey: "2026-10-01", nowMs: NOW, latestNewsMs: NOW - 8 * 24 * H, aggregatedMs: null, healthMs: NOW - 8 * 24 * H });
    expect(r.dataMs).toBe(NOW);
    expect(r.time).toBe(NOW - 8 * 24 * H);
    expect(r.quiet).toBe(false);
  });
  it("當日：來源健康超過 12 小時才判定收集可能停了，並帶出原因", () => {
    const r = newsFreshnessInput({ dayKey: taipeiDayKey(NOW), nowMs: NOW, latestNewsMs: NOW - 13 * H, aggregatedMs: NOW - 5 * 60_000, healthMs: NOW - 13 * H });
    expect(r.quiet).toBe(true);
    expect(r.reason).toContain("收集可能停了");
  });
  it("當日：只有篩選後的新聞很舊、來源健康正常 → 不誤判，沿用彙整時間", () => {
    const agg = NOW - 5 * 60_000;
    const r = newsFreshnessInput({ dayKey: taipeiDayKey(NOW), nowMs: NOW, latestNewsMs: NOW - 13 * H, aggregatedMs: agg, healthMs: NOW - 10 * 60_000 });
    expect(r.quiet).toBe(false);
    expect(r.dataMs).toBe(agg);
  });
  it("沒有來源健康資料時不下停更結論", () => {
    const r = newsFreshnessInput({ dayKey: taipeiDayKey(NOW), nowMs: NOW, latestNewsMs: NOW - 20 * H, aggregatedMs: null, healthMs: null });
    expect(r.quiet).toBe(false);
  });
});

describe("maxSourceSuccessMs", () => {
  it("取最大值並略過無效值", () => {
    expect(maxSourceSuccessMs([{ last_success_at: null }, { last_success_at: "2026-10-09T01:00:00Z" }, { last_success_at: "bad" }, { last_success_at: "2026-10-09T02:00:00Z" }])).toBe(Date.parse("2026-10-09T02:00:00Z"));
    expect(maxSourceSuccessMs(undefined)).toBeNull();
  });
});
