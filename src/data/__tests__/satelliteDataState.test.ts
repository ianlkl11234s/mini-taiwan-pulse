import { describe, it, expect } from "vitest";
import {
  MANEUVERS_INITIAL,
  reduceManeuversResult,
  describeManeuversBanner,
  describeFreshness,
  formatTaipeiClock,
  computePassDiff,
  deriveFleetView,
  type ManeuversState,
} from "../satelliteDataState";
import type { ManeuverRow } from "../satelliteManeuversLoader";

const row = { norad_id: 1 } as ManeuverRow;
const ok = (rows: ManeuverRow[], fetchedAt = 1000) => ({ ok: true as const, rows, fetchedAt });
const fail = (reason: "unconfigured" | "rpc" = "rpc") => ({ ok: false as const, reason, message: "x" });

describe("reduceManeuversResult / describeManeuversBanner", () => {
  it("初始為 loading，不是「無變軌」", () => {
    expect(describeManeuversBanner(MANEUVERS_INITIAL).kind).toBe("loading");
  });

  it("首次就失敗 → error（資料讀取失敗），不是 empty", () => {
    const s = reduceManeuversResult(MANEUVERS_INITIAL, fail());
    expect(s.status).toBe("error");
    expect(describeManeuversBanner(s)).toEqual({ kind: "error", text: "資料讀取失敗" });
  });

  it("未設定 Supabase 有自己的文字", () => {
    const s = reduceManeuversResult(MANEUVERS_INITIAL, fail("unconfigured"));
    expect(describeManeuversBanner(s).kind).toBe("error");
    expect((describeManeuversBanner(s) as { text: string }).text).toContain("未設定");
  });

  it("成功且 0 筆 → empty（才是「無變軌」）", () => {
    const s = reduceManeuversResult(MANEUVERS_INITIAL, ok([]));
    expect(describeManeuversBanner(s).kind).toBe("empty");
  });

  it("空結果後更新失敗（stale）→ 不能顯示「無變軌」，要提示資料可能過期", () => {
    const good = reduceManeuversResult(MANEUVERS_INITIAL, ok([], 5000));
    const s = reduceManeuversResult(good, fail());
    expect(s.stale).toBe(true);
    const b = describeManeuversBanner(s);
    expect(b.kind).toBe("error");
    expect((b as { text: string }).text).toContain("過期");
  });

  it("成功有資料 → ok", () => {
    const s = reduceManeuversResult(MANEUVERS_INITIAL, ok([row]));
    expect(describeManeuversBanner(s).kind).toBe("ok");
    expect(s.fetchedAt).toBe(1000);
  });

  it("曾成功、之後更新失敗 → 保留舊資料並標 stale（不變成 error / 空）", () => {
    const good = reduceManeuversResult(MANEUVERS_INITIAL, ok([row], 5000));
    const s = reduceManeuversResult(good, fail());
    expect(s.status).toBe("ok");
    expect(s.stale).toBe(true);
    expect(s.rows).toEqual([row]);
    expect(s.fetchedAt).toBe(5000);
  });

  it("stale 之後再成功 → stale 解除", () => {
    const stale: ManeuversState = { ...MANEUVERS_INITIAL, status: "ok", rows: [row], fetchedAt: 1, stale: true };
    expect(reduceManeuversResult(stale, ok([], 9)).stale).toBe(false);
  });
});

describe("describeFreshness", () => {
  const now = Date.UTC(2026, 9, 4, 6, 0); // 台灣 14:00

  it("formatTaipeiClock 以台灣時間（UTC+8）顯示 HH:MM", () => {
    expect(formatTaipeiClock(Date.UTC(2026, 9, 4, 6, 5))).toBe("14:05");
  });

  it("尚無資料：讀取中 / 讀取失敗", () => {
    expect(describeFreshness({ label: "TLE", status: "loading", fetchedAt: null, nowMs: now }).text).toBe("TLE 讀取中…");
    const f = describeFreshness({ label: "TLE", status: "error", fetchedAt: null, nowMs: now });
    expect(f.text).toBe("TLE 讀取失敗");
    expect(f.tone).toBe("warn");
  });

  it("正常：更新 HH:MM", () => {
    const f = describeFreshness({ label: "變軌", status: "ok", fetchedAt: now - 60_000, nowMs: now });
    expect(f.text).toBe("變軌 更新 13:59");
    expect(f.tone).toBe("normal");
  });

  it("更新中斷（stale）→ 警示", () => {
    const f = describeFreshness({ label: "變軌", status: "ok", fetchedAt: now, stale: true, nowMs: now });
    expect(f.tone).toBe("warn");
    expect(f.text).toContain("更新中斷");
  });

  it("超過 6 個預期週期 → 資料過期", () => {
    const f = describeFreshness({ label: "TLE", status: "ok", fetchedAt: now - 13 * 3600_000, nowMs: now, periodMin: 120 });
    expect(f.text).toContain("資料過期");
    expect(f.tone).toBe("warn");
  });

  it("週期內不標過期", () => {
    const f = describeFreshness({ label: "TLE", status: "ok", fetchedAt: now - 3 * 3600_000, nowMs: now, periodMin: 120 });
    expect(f.tone).toBe("normal");
  });
});

describe("computePassDiff", () => {
  it("前段 > 0 → 給百分比", () => {
    expect(computePassDiff(4, 6)).toEqual({ before: 4, after: 6, diff: 2, pct: 50 });
    expect(computePassDiff(4, 2).pct).toBe(-50);
  });
  it("前段為 0 → 不給百分比（不再硬寫 100%），只留次數差", () => {
    expect(computePassDiff(0, 3)).toEqual({ before: 0, after: 3, diff: 3, pct: null });
    expect(computePassDiff(0, 0).pct).toBeNull();
  });
  it("前後相同且 > 0 → 0%", () => {
    expect(computePassDiff(5, 5).pct).toBe(0);
  });
});

describe("deriveFleetView", () => {
  it("loading 與 error 分開（失敗不再永遠「載入中」）", () => {
    expect(deriveFleetView("loading", 0, 0).kind).toBe("loading");
    const e = deriveFleetView("error", 0, 0);
    expect(e.kind).toBe("error");
    expect((e as { text: string }).text).toContain("讀取失敗");
  });
  it("讀取成功但目錄沒有台灣衛星 → empty", () => {
    expect(deriveFleetView("ok", 0, 0).kind).toBe("empty");
  });
  it("部分算不出位置 → ready 並回報略過顆數", () => {
    expect(deriveFleetView("ok", 15, 13)).toEqual({ kind: "ready", skipped: 2 });
    expect(deriveFleetView("ok", 15, 15)).toEqual({ kind: "ready", skipped: 0 });
  });
  it("全部算不出來 → 不顯示成空或載入中", () => {
    const v = deriveFleetView("ok", 15, 0);
    expect(v.kind).toBe("error");
    expect((v as { text: string }).text).toContain("15 顆暫無法計算");
  });
});
