import { describe, expect, it } from "vitest";
import {
  planGfwHourlyGridPlayback,
  type GfwHourlyGridSlotReadiness,
} from "../gfwHourlyGridTypes";

const DAY_START_MS = Date.parse("2026-08-21T00:00:00Z");

/** UTC hour ISO `offset` hours after the release start. */
function hour(offset: number): string {
  return new Date(DAY_START_MS + offset * 3_600_000).toISOString().replace(".000Z", "Z");
}

/** Timeline seconds at `offset` hours + `minutes` into the release. */
function at(offset: number, minutes = 0): number {
  return (DAY_START_MS + offset * 3_600_000 + minutes * 60_000) / 1000;
}

function slot(sourceId: string, offset: number | null, ready: boolean, loaded = true): GfwHourlyGridSlotReadiness {
  return { sourceId, hour: offset === null ? null : hour(offset), ready, loaded };
}

/** The release covers 24 UTC hours, exactly like the formal v4 single-day artifact. */
const DAY_WINDOW = { startMs: DAY_START_MS, endMsExclusive: DAY_START_MS + 24 * 3_600_000 };

describe("planGfwHourlyGridPlayback crossfade", () => {
  it("next 尚未 ready 時 current 恆為 1，不被 progress 壓暗", () => {
    const slots = [slot("s0", 0, true), slot("s1", 1, false), slot("s2", 2, false)];
    for (const minutes of [0, 20, 40, 59]) {
      const plan = planGfwHourlyGridPlayback({
        timeSeconds: at(0, minutes), slots, currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
      });
      expect(plan.weights.get("s0")).toBe(1);
      expect(plan.weights.get("s1")).toBe(0);
      expect(plan.dominantHour).toBe(hour(0));
      expect(plan.holding).toBe(false);
    }
  });

  it("current hour 在 next ready 之前必須可見（回歸）", () => {
    // 播放超車：H 已 ready、H+1 還在載入。H 不得被 crossfade 或 readiness gate 弄不見。
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(0, 59.9),
      slots: [slot("s0", 0, true), slot("s1", 1, false), slot("s2", 2, false)],
      currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBe(1);
  });

  it("全部 ready 時 crossfade 權重和恆為 1", () => {
    const slots = [slot("s0", 0, true), slot("s1", 1, true), slot("s2", 2, true)];
    for (const minutes of [0, 15, 30, 45, 59]) {
      const plan = planGfwHourlyGridPlayback({
        timeSeconds: at(0, minutes), slots, currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
      });
      const total = (plan.weights.get("s0") ?? 0) + (plan.weights.get("s1") ?? 0);
      expect(total).toBeCloseTo(1, 10);
      expect(plan.weights.get("s1")).toBeCloseTo(minutes / 60, 10);
      expect(plan.weights.get("s2")).toBe(0);
    }
  });

  it("progress 過半後 dominant hour 交棒給 H+1", () => {
    const slots = [slot("s0", 0, true), slot("s1", 1, true), slot("s2", 2, true)];
    expect(planGfwHourlyGridPlayback({
      timeSeconds: at(0, 29), slots, currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    }).dominantHour).toBe(hour(0));
    expect(planGfwHourlyGridPlayback({
      timeSeconds: at(0, 31), slots, currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    }).dominantHour).toBe(hour(1));
  });
});

describe("planGfwHourlyGridPlayback hold-last-ready", () => {
  it("current 未 ready 時保留上一個 ready 小時，而不是變空白", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 10),
      slots: [slot("s0", 0, true), slot("s1", 1, false), slot("s2", 2, false)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBe(1);
    expect(plan.weights.get("s1")).toBe(0);
    expect(plan.holding).toBe(true);
    expect(plan.dominantHour).toBe(hour(0));
  });

  it("hold 中的小時會回報成 retainHour，供 slot 輪替排除回收", () => {
    // rollover 當下 H+1 尚未 ready：若 H 的 slot 被回收去掛 H+3，畫面就會空掉。
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 0),
      slots: [slot("s0", 0, true), slot("s1", 1, false), slot("s2", 2, false)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(plan.retainHour).toBe(hour(0));

    // current 一旦 ready 就不再需要保留，slot 可以回收去預載。
    const released = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 0),
      slots: [slot("s0", 0, true), slot("s1", 1, true), slot("s2", 2, false)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(released.retainHour).toBeNull();
    expect(released.weights.get("s1")).toBe(1);
  });

  it("時間軸一次跳過多個小時時，hold 取「不超過現在」的最新 ready 小時", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(2, 5),
      slots: [slot("s0", 0, true), slot("s1", 1, true), slot("s2", 2, false)],
      currentHour: hour(2), nextHour: hour(3), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s1")).toBe(1);
    expect(plan.weights.get("s0")).toBe(0);
    expect(plan.dominantHour).toBe(hour(1));
  });

  it("未來小時不會被拿來 hold", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 5),
      slots: [slot("s0", 0, false), slot("s1", 1, false), slot("s2", 2, true)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s2")).toBe(0);
    expect(plan.holding).toBe(false);
  });

  it("完全沒有 ready slot 時 current 仍全亮，避免永久隱形", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(0, 10),
      slots: [slot("s0", 0, false), slot("s1", 1, false), slot("s2", 2, false)],
      currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBe(1);
    expect(plan.dominantHour).toBe(hour(0));
  });

  it("release 缺 current 小時但 next 已 ready 時，由 next 單獨呈現", () => {
    // manifest 中間缺一小時（不是窗外）：H 不存在，H+1 就該獨自撐住畫面。
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(-1, 30),
      slots: [slot("s0", 0, true), slot("s1", null, false), slot("s2", null, false)],
      currentHour: null, nextHour: hour(0), dataWindow: null,
    });
    expect(plan.weights.get("s0")).toBe(1);
    expect(plan.dominantHour).toBe(hour(0));
  });
});

describe("planGfwHourlyGridPlayback reload 去黏著", () => {
  it("current 正在 reload 時退回前一個 renderable slot，而不是亮在空 source 上", () => {
    // 量測到的空白型態：唯一權重非 0 的 slot ld=0、n=0，opacity 卻已爬到 0.8。
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 30),
      slots: [slot("s0", 0, true, true), slot("s1", 1, true, false), slot("s2", 2, false, false)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBe(1);
    expect(plan.weights.get("s1")).toBe(0);
    expect(plan.holding).toBe(true);
    expect(plan.retainHour).toBe(hour(0));
  });

  it("沒有更早的 renderable slot 時，reload 中的 current 仍照畫（舊 tile 還在）", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(1, 0),
      slots: [slot("s0", 0, false, false), slot("s1", 1, true, false), slot("s2", 2, false, false)],
      currentHour: hour(1), nextHour: hour(2), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s1")).toBe(1);
    expect(plan.dominantHour).toBe(hour(1));
  });

  it("next 正在 reload 時不啟動 crossfade，current 維持 1", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(0, 45),
      slots: [slot("s0", 0, true, true), slot("s1", 1, true, false), slot("s2", 2, false, false)],
      currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBe(1);
    expect(plan.weights.get("s1")).toBe(0);
  });

  it("loaded 未提供時視為已載入（向後相容）", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(0, 30),
      slots: [
        { sourceId: "s0", hour: hour(0), ready: true },
        { sourceId: "s1", hour: hour(1), ready: true },
      ],
      currentHour: hour(0), nextHour: hour(1), dataWindow: DAY_WINDOW,
    });
    expect(plan.weights.get("s0")).toBeCloseTo(0.5, 10);
    expect(plan.weights.get("s1")).toBeCloseTo(0.5, 10);
  });
});

describe("planGfwHourlyGridPlayback 資料窗", () => {
  it("窗內回報 in-window 且不衰減", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(12, 30),
      slots: [slot("s0", 12, true), slot("s1", 13, true), slot("s2", 14, true)],
      currentHour: hour(12), nextHour: hour(13), dataWindow: DAY_WINDOW,
    });
    expect(plan.dataWindowStatus).toBe("in-window");
    expect(plan.windowFade).toBe(1);
  });

  it("超出資料窗時保留最後一個 ready 小時並線性淡出，不直接消失", () => {
    const slots = [slot("s0", 22, true), slot("s1", 23, true), slot("s2", null, false)];
    const base = { slots, currentHour: null, nextHour: null, dataWindow: DAY_WINDOW, fadeSeconds: 900 };

    const justOutside = planGfwHourlyGridPlayback({ ...base, timeSeconds: at(24, 0) });
    expect(justOutside.dataWindowStatus).toBe("out-of-window");
    expect(justOutside.weights.get("s1")).toBe(1);
    expect(justOutside.dominantHour).toBe(hour(23));

    const halfway = planGfwHourlyGridPlayback({ ...base, timeSeconds: at(24, 7.5) });
    expect(halfway.windowFade).toBeCloseTo(0.5, 10);
    expect(halfway.weights.get("s1")).toBeCloseTo(0.5, 10);

    const faded = planGfwHourlyGridPlayback({ ...base, timeSeconds: at(24, 20) });
    expect(faded.windowFade).toBe(0);
    expect(faded.weights.get("s1")).toBe(0);
    expect(faded.dataWindowStatus).toBe("out-of-window");
    // 完全淡出後不得再有 dominant hour，否則看不見的格子仍會接走 popup。
    expect(faded.dominantHour).toBeNull();
  });

  it("窗前（時間軸早於 release）同樣走淡出而非硬切", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(0, -7.5),
      slots: [slot("s0", 0, true), slot("s1", 1, true), slot("s2", null, false)],
      currentHour: null, nextHour: null, dataWindow: DAY_WINDOW, fadeSeconds: 900,
    });
    expect(plan.dataWindowStatus).toBe("out-of-window");
    expect(plan.windowFade).toBeCloseTo(0.5, 10);
    // 窗前沒有「不超過現在」的 ready 小時，權重維持 0；狀態仍要讓 UI 說得出「窗外」。
    expect(plan.weights.get("s0")).toBe(0);
  });

  it("沒有資料窗資訊（legacy manifest）時一律視為窗內", () => {
    const plan = planGfwHourlyGridPlayback({
      timeSeconds: at(99, 0),
      slots: [slot("s0", 0, true), slot("s1", 1, true), slot("s2", 2, true)],
      currentHour: null, nextHour: null, dataWindow: null,
    });
    expect(plan.dataWindowStatus).toBe("in-window");
    expect(plan.windowFade).toBe(1);
  });
});
