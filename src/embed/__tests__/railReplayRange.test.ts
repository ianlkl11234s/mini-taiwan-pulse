/**
 * 鐵路回放的**時鐘語意**護欄（EM-16 Phase 3）。
 *
 * rail 與 flights / ships 的差別在於：後者的 [t0,t1] 來自軌跡資料本身，錯了會一眼看出來
 * （車子不動）；rail 的區間是**人為選定的**「該日台北 00:00–24:00」，選錯只會讓某些
 * 時段的班次悄悄消失 —— 截圖看不出來。故把推導本身測起來。
 *
 * 完整理由見 `src/embed/railReplayData.ts` 檔頭。
 */
import { describe, it, expect } from "vitest";
import { railReplayRange } from "../railReplayData";
import { timeToSeconds, unixToExtendedDaySeconds } from "../../engines/railUtils";

/** 引擎判斷「這班車現在在跑嗎」的核心式子（見 TraTrainEngine / RailEngine）。 */
function elapsedAt(unixSec: number, departureTime: string): number {
  return unixToExtendedDaySeconds(unixSec) - timeToSeconds(departureTime);
}

describe("railReplayRange", () => {
  it("回傳該日台北時間 00:00 起算的整整 86400 秒", () => {
    const range = railReplayRange("2026-08-06");
    expect(range).not.toBeNull();
    const [t0, t1] = range!;
    expect(t0).toBe(Date.parse("2026-08-06T00:00:00+08:00") / 1000);
    expect(t1 - t0).toBe(86400);
    expect(t1).toBe(Date.parse("2026-08-07T00:00:00+08:00") / 1000);
  });

  it("不看瀏覽器時區 —— date 指的永遠是台灣的那一天", () => {
    // 若誤用 local time 解析，跑在 UTC 的 CI 會得到差 8 小時的結果。
    const [t0] = railReplayRange("2026-01-01")!;
    expect(new Date(t0 * 1000).toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("格式壞掉回 null（呼叫端據此靜默略過該層）", () => {
    expect(railReplayRange("not-a-date")).toBeNull();
  });
});

describe("整日窗涵蓋延長日制的所有班次", () => {
  const [t0, t1] = railReplayRange("2026-08-06")!;

  it("00:30 的末班車在 00:30 出現、白天不出現", () => {
    // 延長日制把 00:30 算成前一個營運日的 24:30（+86400），
    // 所以它落在窗的**開頭**而不是結尾 —— 這正是不能用 min/max 推區間的原因。
    expect(elapsedAt(t0 + 30 * 60, "00:30:00")).toBe(0);
    expect(elapsedAt(t0 + 12 * 3600, "00:30:00")).toBeLessThan(0);
  });

  it("23:50 開、跨過午夜才到站的車，在午夜後仍算在跑", () => {
    // 23:50 發車 + 40 分行駛：00:20 時 elapsed 應為 1800 秒（仍在旅途中）。
    expect(elapsedAt(t0 + 20 * 60, "23:50:00")).toBe(1800);
  });

  it("窗內每個整分鐘都對應到一個合法的延長日秒數，且首尾銜接成 loop", () => {
    for (let s = 0; s < 86400; s += 60) {
      const ext = unixToExtendedDaySeconds(t0 + s);
      expect(ext).toBeGreaterThanOrEqual(21000);   // DAY_START_SECONDS
      expect(ext).toBeLessThan(21000 + 86400);
    }
    // t1 wrap 回 t0 時是同一個延長日時刻 → loop 不跳格
    expect(unixToExtendedDaySeconds(t1)).toBe(unixToExtendedDaySeconds(t0));
  });
});
