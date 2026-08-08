/**
 * `/embed` 回放時鐘（EM-16）
 *
 * 時間推進邏輯與 RAF 解耦（`createReplayClock` 注入 now/raf/caf），
 * 所以「走了多久 / 有沒有 loop / pause 有沒有真的停」都能純函數式驗證。
 */
import { describe, it, expect } from "vitest";
import {
  createReplayClock,
  defaultReplaySpeed,
  resolveReplaySpeed,
  resolveReplayStart,
  formatReplayClock,
  REPLAY_LOOP_SECONDS,
} from "../replayClock";

/** 可手動驅動的假 RAF + 假牆鐘。 */
function makeHarness() {
  let nowMs = 0;
  let pending: ((t: number) => void) | null = null;
  let cancels = 0;
  const clock = createReplayClock({
    now: () => nowMs,
    raf: (cb) => {
      pending = cb;
      return 1;
    },
    caf: () => {
      cancels++;
      pending = null;
    },
  });
  /** 讓牆鐘前進 ms 並跑一幀（沒有 pending frame 就什麼都不做） */
  const step = (ms: number) => {
    nowMs += ms;
    const cb = pending;
    pending = null;
    cb?.(nowMs);
  };
  return {
    clock,
    step,
    hasPending: () => pending !== null,
    cancels: () => cancels,
    setNow: (ms: number) => {
      nowMs = ms;
    },
  };
}

describe("createReplayClock", () => {
  it("setRange 後停在起點、未播放", () => {
    const { clock, hasPending } = makeHarness();
    clock.setRange(100, 200, 1);
    expect(clock.get()).toBe(100);
    expect(clock.getSnapshot().playing).toBe(false);
    expect(clock.getSnapshot().ready).toBe(true);
    expect(hasPending()).toBe(false);   // 沒播放不排 RAF
  });

  it("play 後依 dt × speed 推進", () => {
    const { clock, step } = makeHarness();
    clock.setRange(0, 1000, 10);
    clock.play();
    step(100);                          // 0.1 秒牆鐘 × 10 倍速 = 1 秒回放
    expect(clock.get()).toBeCloseTo(1, 6);
    step(200);
    expect(clock.get()).toBeCloseTo(3, 6);
  });

  it("走到 t1 會 loop 回 t0（modulo，不是硬跳）", () => {
    const { clock, step } = makeHarness();
    clock.setRange(0, 10, 100);         // 每 100ms 牆鐘 = 10 秒回放 = 整整一圈
    clock.play();
    step(100);
    expect(clock.get()).toBeCloseTo(0, 6);
    step(30);                           // 再 3 秒回放
    expect(clock.get()).toBeCloseTo(3, 6);
    // 連跑多圈仍恆在區間內
    for (let i = 0; i < 20; i++) step(70);
    const t = clock.get();
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(10);
  });

  it("區間不是從 0 開始時，loop 也回到 t0 而不是 0", () => {
    const { clock, step } = makeHarness();
    const t0 = 1_770_000_000;
    clock.setRange(t0, t0 + 10, 100);
    clock.play();
    step(120);                          // 12 秒回放 → 繞一圈多 2 秒
    expect(clock.get()).toBeCloseTo(t0 + 2, 4);
  });

  it("pause 停住時間並取消 RAF；再 play 不會補回暫停期間", () => {
    const h = makeHarness();
    const { clock, step } = h;
    clock.setRange(0, 1000, 10);
    clock.play();
    step(100);
    expect(clock.get()).toBeCloseTo(1, 6);

    clock.pause();
    expect(h.hasPending()).toBe(false);
    expect(h.cancels()).toBeGreaterThan(0);

    h.setNow(10_000);                   // 暫停期間牆鐘狂走
    expect(clock.get()).toBeCloseTo(1, 6);

    clock.play();
    step(100);
    expect(clock.get()).toBeCloseTo(2, 6);   // 只多走 1 秒，沒有補回 9.9 秒
  });

  it("toggle 在播放/暫停間切換", () => {
    const { clock } = makeHarness();
    clock.setRange(0, 100, 1);
    clock.toggle();
    expect(clock.getSnapshot().playing).toBe(true);
    clock.toggle();
    expect(clock.getSnapshot().playing).toBe(false);
  });

  it("setSpeed 不動當前時刻，只改之後的速率", () => {
    const { clock, step } = makeHarness();
    clock.setRange(0, 1000, 10);
    clock.play();
    step(100);
    const before = clock.get();
    clock.setSpeed(100);
    expect(clock.get()).toBe(before);   // 不跳時間
    step(100);
    expect(clock.get()).toBeCloseTo(before + 10, 6);
  });

  it("單幀 dt 有上限（分頁切回來不會暴衝）", () => {
    const { clock, step } = makeHarness();
    clock.setRange(0, 100_000, 10);
    clock.play();
    step(60_000);                       // 60 秒沒畫面 → 夾到 0.25s
    expect(clock.get()).toBeCloseTo(2.5, 6);
  });

  it("play 需要有效區間（t1 <= t0 一律不播，不 throw）", () => {
    const { clock } = makeHarness();
    clock.setRange(500, 500, 10);
    expect(clock.getSnapshot().ready).toBe(false);
    clock.play();
    expect(clock.getSnapshot().playing).toBe(false);
  });

  it("startAt 落在區間內就用它，越界退回 t0", () => {
    const { clock } = makeHarness();
    clock.setRange(100, 200, 1, 150);
    expect(clock.get()).toBe(150);
    clock.setRange(100, 200, 1, 999);
    expect(clock.get()).toBe(100);
  });

  it("seek 夾進區間並可在暫停時使用", () => {
    const { clock } = makeHarness();
    clock.setRange(0, 10, 1);
    clock.seek(23);                     // 23 % 10 = 3
    expect(clock.get()).toBeCloseTo(3, 6);
  });

  it("clear 停 RAF 並回到未就緒", () => {
    const h = makeHarness();
    h.clock.setRange(0, 10, 1);
    h.clock.play();
    h.clock.clear();
    expect(h.hasPending()).toBe(false);
    expect(h.clock.getSnapshot().ready).toBe(false);
  });

  it("subscribe 會在狀態變動時被通知，unsubscribe 後不再收到", () => {
    const { clock } = makeHarness();
    let n = 0;
    const off = clock.subscribe(() => n++);
    clock.setRange(0, 10, 1);
    expect(n).toBeGreaterThan(0);
    const seen = n;
    off();
    clock.play();
    expect(n).toBe(seen);
  });
});

describe("倍速解析（越界 drop、絕不 throw）", () => {
  it("預設倍速讓資料跨度約 90 秒播完", () => {
    const speed = defaultReplaySpeed(0, 86400);
    expect(speed).toBeCloseTo(86400 / REPLAY_LOOP_SECONDS, 6);
    expect(86400 / speed).toBeCloseTo(REPLAY_LOOP_SECONDS, 6);
  });

  it("合法 p.speed 直接採用", () => {
    expect(resolveReplaySpeed(120, 0, 86400)).toBe(120);
  });

  it.each([0, -1, NaN, Infinity, 86401, undefined])(
    "越界／壞值 %p → 退回預設（不 clamp）",
    (bad) => {
      const speed = resolveReplaySpeed(bad as number | undefined, 0, 86400);
      expect(speed).toBeCloseTo(defaultReplaySpeed(0, 86400), 6);
    },
  );

  it("跨度為 0 時回 1，不產生 NaN / Infinity", () => {
    expect(defaultReplaySpeed(5, 5)).toBe(1);
    expect(Number.isFinite(resolveReplaySpeed(undefined, 5, 5))).toBe(true);
  });
});

describe("resolveReplayStart（h= 起始時刻，固定台北時區）", () => {
  const dayStart = Date.parse("2026-08-06T00:00:00+08:00") / 1000;
  const t0 = dayStart + 3600;        // 資料 01:00 開始
  const t1 = dayStart + 20 * 3600;   // 20:00 結束

  it("沒帶 h → t0", () => {
    expect(resolveReplayStart("2026-08-06", undefined, t0, t1)).toBe(t0);
  });

  it("h 在資料範圍內 → 該時刻", () => {
    expect(resolveReplayStart("2026-08-06", 8, t0, t1)).toBe(dayStart + 8 * 3600);
  });

  it("h 早於／晚於資料範圍 → 退回 t0（drop，不 clamp 到 t1）", () => {
    expect(resolveReplayStart("2026-08-06", 0, t0, t1)).toBe(t0);
    expect(resolveReplayStart("2026-08-06", 23, t0, t1)).toBe(t0);
  });

  it("壞日期不 throw", () => {
    expect(resolveReplayStart("not-a-date", 8, t0, t1)).toBe(t0);
  });
});

describe("formatReplayClock", () => {
  it("以台北時區輸出 HH:MM（與讀者所在時區無關）", () => {
    expect(formatReplayClock(Date.parse("2026-08-06T09:05:00+08:00") / 1000)).toBe("09:05");
    expect(formatReplayClock(Date.parse("2026-08-06T23:59:00+08:00") / 1000)).toBe("23:59");
  });

  it("未就緒時顯示佔位符而不是 1970", () => {
    expect(formatReplayClock(0)).toBe("--:--");
    expect(formatReplayClock(NaN)).toBe("--:--");
  });
});
