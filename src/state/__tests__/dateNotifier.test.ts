import { describe, it, expect } from "vitest";
import { createDateNotifier } from "../dateNotifier";

/** 手動時鐘 + 計時器，完全決定性 */
function createClock() {
  let t = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let nextId = 1;
  return {
    now: () => t,
    schedule: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, at: t + ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: (id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number);
    },
    advance(ms: number) {
      const target = t + ms;
      // 依到期時間排序逐一觸發
      while (true) {
        const due = [...timers.entries()]
          .filter(([, v]) => v.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = due[1].at;
        due[1].fn();
      }
      t = target;
    },
  };
}

function setup(quietMs = 300) {
  const clock = createClock();
  const emitted: string[] = [];
  const notifier = createDateNotifier((k) => emitted.push(k), {
    quietMs,
    now: clock.now,
    schedule: clock.schedule,
    cancel: clock.cancel,
  });
  return { clock, emitted, notifier };
}

describe("createDateNotifier", () => {
  it("fires immediately on a single date change (leading, 行為與原本相同)", () => {
    const { emitted, notifier } = setup();
    notifier.push("2026-06-09");
    expect(emitted).toEqual(["2026-06-09"]);
  });

  it("coalesces a fast scrub into first + last date only", () => {
    const { clock, emitted, notifier } = setup();
    notifier.push("2026-06-09"); // leading
    for (const d of ["2026-06-08", "2026-06-07", "2026-06-06", "2026-06-05"]) {
      clock.advance(50);
      notifier.push(d);
    }
    expect(emitted).toEqual(["2026-06-09"]); // 中間日期未送
    clock.advance(300); // 安靜期滿 → trailing 送最後日期
    expect(emitted).toEqual(["2026-06-09", "2026-06-05"]);
  });

  it("skips trailing if final key equals the last emitted key (scrub 來回又回到原日)", () => {
    const { clock, emitted, notifier } = setup();
    notifier.push("2026-06-09");
    clock.advance(50);
    notifier.push("2026-06-08");
    clock.advance(50);
    notifier.push("2026-06-09"); // 回到已通知過的日期
    clock.advance(400);
    expect(emitted).toEqual(["2026-06-09"]);
  });

  it("fires immediately again after the quiet window passes (播放跨日不延遲)", () => {
    const { clock, emitted, notifier } = setup();
    notifier.push("2026-06-09");
    clock.advance(1000);
    notifier.push("2026-06-10");
    expect(emitted).toEqual(["2026-06-09", "2026-06-10"]);
  });

  it("debounce timer resets while scrubbing continues", () => {
    const { clock, emitted, notifier } = setup();
    notifier.push("d1");
    for (let i = 0; i < 10; i++) {
      clock.advance(200); // 每 200ms 變一次，永遠不滿 300ms 安靜
      notifier.push(`d${i + 2}`);
    }
    expect(emitted).toEqual(["d1"]);
    clock.advance(300);
    expect(emitted).toEqual(["d1", "d11"]);
  });

  it("dispose cancels pending trailing notification", () => {
    const { clock, emitted, notifier } = setup();
    notifier.push("a");
    clock.advance(50);
    notifier.push("b");
    notifier.dispose();
    clock.advance(1000);
    expect(emitted).toEqual(["a"]);
  });
});
