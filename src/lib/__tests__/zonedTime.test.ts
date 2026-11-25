import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  zonedDateKey,
  zonedDayRangeMs,
  zonedMidnightMs,
  zonedOffsetMinutes,
  zonedParts,
  zonedSecondsOfDay,
} from "../zonedTime";
import { taipeiDateKeyFromMs, taipeiMidnightMs } from "../taipeiDay";
import { taipeiParts } from "../../components/timeline/timelineAxis";
import { londonClock } from "../../countries/gb/gbRailReplay";

// 舊實作原文（本檔作為「逐字等價」的參照，不可改成呼叫新 helper）
const legacyDateKey = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
const legacyMidnight = (key: string) => Date.parse(`${key}T00:00:00+08:00`);
const legacyParts = (t: number) => {
  const d = new Date((t + 8 * 3600) * 1000);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
};

const HOUR = 3_600_000;
const SAMPLE_MS = [
  Date.UTC(1970, 0, 2, 3, 4, 5),
  Date.UTC(1999, 11, 31, 15, 59, 59), // 台北 23:59:59 前一刻
  Date.UTC(1999, 11, 31, 16, 0, 0), // 台北跨年
  Date.UTC(2024, 1, 29, 16, 0, 0), // 閏日跨日
  Date.UTC(2026, 10, 23, 0, 0, 0),
  Date.UTC(2026, 11, 31, 16, 30, 0),
  Date.UTC(2038, 0, 19, 3, 14, 8),
  Date.UTC(2051, 5, 15, 12, 0, 0), // 快速路徑範圍之外
  1_700_000_000_123,
];

describe("zonedTime：Asia/Taipei 與舊 helper 完全一致", () => {
  it("日期 key、午夜、分量", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Taipei");
    for (const ms of SAMPLE_MS) {
      expect(zonedDateKey(ms, "Asia/Taipei")).toBe(legacyDateKey(ms));
      expect(taipeiDateKeyFromMs(ms)).toBe(legacyDateKey(ms));
      const key = legacyDateKey(ms);
      expect(zonedMidnightMs(key, "Asia/Taipei")).toBe(legacyMidnight(key));
      expect(taipeiMidnightMs(key)).toBe(legacyMidnight(key));
      const t = ms / 1000;
      expect(taipeiParts(t)).toEqual(legacyParts(t));
      const p = zonedParts(ms, "Asia/Taipei");
      expect({ month: p.month, day: p.day, hour: p.hour, minute: p.minute, weekday: p.weekday }).toEqual(legacyParts(t));
    }
  });

  it("非有限數維持舊行為", () => {
    expect(zonedDateKey(NaN)).toBe(legacyDateKey(NaN));
    expect(taipeiMidnightMs("not-a-date")).toBeNaN();
  });

  it("每小時掃一整年，日期 key 與午夜都一致", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 24 * 366; i += 5) {
      const ms = start + i * HOUR;
      expect(zonedDateKey(ms)).toBe(legacyDateKey(ms));
    }
  });
});

describe("zonedTime：日光節約時間", () => {
  const len = (key: string, tz: string) => {
    const [s, e] = zonedDayRangeMs(key, tz);
    return (e - s) / HOUR;
  };

  it("Europe/London 春 23 小時、秋 25 小時", () => {
    expect(len("2026-03-29", "Europe/London")).toBe(23);
    expect(len("2026-10-25", "Europe/London")).toBe(25);
    expect(len("2026-07-01", "Europe/London")).toBe(24);
    expect(zonedMidnightMs("2026-03-29", "Europe/London")).toBe(Date.UTC(2026, 2, 29, 0, 0));
    expect(zonedMidnightMs("2026-07-01", "Europe/London")).toBe(Date.UTC(2026, 5, 30, 23, 0));
  });

  it("America/Toronto 2026-03-08 與 2026-11-01", () => {
    expect(len("2026-03-08", "America/Toronto")).toBe(23);
    expect(len("2026-11-01", "America/Toronto")).toBe(25);
    expect(zonedOffsetMinutes(Date.UTC(2026, 0, 15), "America/Toronto")).toBe(-300);
    expect(zonedOffsetMinutes(Date.UTC(2026, 6, 15), "America/Toronto")).toBe(-240);
  });

  it("固定位移時區", () => {
    const at = Date.UTC(2026, 6, 1);
    expect(zonedOffsetMinutes(at, "Asia/Tokyo")).toBe(540);
    expect(zonedOffsetMinutes(at, "Asia/Manila")).toBe(480);
    expect(zonedOffsetMinutes(at, "Asia/Bangkok")).toBe(420);
    for (const tz of ["Asia/Tokyo", "Asia/Manila", "Asia/Bangkok", "Asia/Taipei"]) {
      expect(len("2026-03-29", tz)).toBe(24);
      expect(len("2026-10-25", tz)).toBe(24);
    }
  });

  it("午夜不存在時取當日第一個存在的瞬間（Africa/Cairo 2026-04-24 跳到 01:00）", () => {
    const start = zonedMidnightMs("2026-04-24", "Africa/Cairo");
    expect(zonedDateKey(start, "Africa/Cairo")).toBe("2026-04-24");
    expect(zonedDateKey(start - 1, "Africa/Cairo")).toBe("2026-04-23");
    expect(zonedParts(start, "Africa/Cairo").hour).toBe(1);
  });

  it("zonedMidnightMs 與 zonedDateKey 互為反函式", () => {
    const zones = ["Europe/London", "Europe/Dublin", "Europe/Paris", "America/Toronto", "America/St_Johns", "America/Vancouver", "Asia/Tokyo", "Asia/Manila", "Asia/Bangkok", "Asia/Taipei"];
    const keys = ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-28", "2026-03-29", "2026-03-30", "2026-10-24", "2026-10-25", "2026-10-26", "2026-11-01", "2026-11-02", "2026-12-31", "2027-01-01"];
    for (const tz of zones) {
      for (const key of keys) {
        const start = zonedMidnightMs(key, tz);
        expect(zonedDateKey(start, tz)).toBe(key);
        expect(zonedDateKey(start - 1, tz)).not.toBe(key);
        expect(zonedSecondsOfDay(start, tz)).toBe(0);
        const [s, e] = zonedDayRangeMs(key, tz);
        expect(s).toBe(start);
        expect(zonedDateKey(e - 1, tz)).toBe(key);
      }
    }
  });
});

describe("zonedTime：與 gbRailReplay.londonClock 一致", () => {
  it("一批時間點（含 BST 切換前後）", () => {
    const base = Date.UTC(2026, 2, 28, 22, 0, 0) / 1000;
    for (let i = 0; i < 400; i++) {
      const sec = base + i * 1789 + (i % 3) * 0.25;
      const a = londonClock(sec);
      expect(zonedSecondsOfDay(sec * 1000, "Europe/London")).toBeCloseTo(a.secOfDay, 6);
      expect(zonedParts(sec * 1000, "Europe/London").hour).toBe(a.hour);
    }
    for (let i = 0; i < 400; i++) {
      const sec = Date.UTC(2026, 9, 24, 22, 0, 0) / 1000 + i * 1789;
      expect(zonedSecondsOfDay(sec * 1000, "Europe/London")).toBeCloseTo(londonClock(sec).secOfDay, 6);
    }
  });
});

describe("zonedTime：效能（快速路徑）", () => {
  it("1e5 次 Asia/Taipei 呼叫不跑 Intl", () => {
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += zonedParts(1_700_000_000_000 + i * 1000, "Asia/Taipei").minute;
    const ms = performance.now() - t0;
    expect(acc).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500); // 實測約 10–30ms；上限放寬避免 CI 抖動
  });
});
