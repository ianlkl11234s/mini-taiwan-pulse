// 日期變化通知的 debounce 邏輯（timeStore.subscribeDate 用）。
//
// 背景：timeline 快速 scrub 跨多天時，每跨一天就 notifyDate 一次，
// 6~10 個 hook 各自 loadDay → 瞬間數十個 RPC 並發（中間日期的結果
// 還沒回來就被丟棄）。
//
// 策略：leading + trailing debounce。
// - 距上次通知已安靜超過 quietMs → 立即通知（單次切日 / 播放跨日零延遲，
//   行為與原本相同）
// - 安靜期內又有變化 → 進 pending，等連續 quietMs 沒有新變化才送「最後
//   一個日期」；中間日期全部略過

type TimerId = ReturnType<typeof setTimeout>;

export interface DateNotifierOptions {
  quietMs?: number;
  /** 注入時鐘 / 計時器（單元測試用） */
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => TimerId;
  cancel?: (id: TimerId) => void;
}

export interface DateNotifier {
  /** 日期變化時呼叫（key = YYYY-MM-DD）。 */
  push(key: string): void;
  /** 取消尚未送出的 trailing 通知。 */
  dispose(): void;
}

export function createDateNotifier(
  emit: (key: string) => void,
  opts: DateNotifierOptions = {},
): DateNotifier {
  const quietMs = opts.quietMs ?? 300;
  const now = opts.now ?? (() => Date.now());
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = opts.cancel ?? ((id) => clearTimeout(id));

  let lastEmittedKey: string | null = null;
  let lastEmitAt = -Infinity;
  let pendingKey: string | null = null;
  let timer: TimerId | null = null;

  function fire(key: string) {
    lastEmittedKey = key;
    lastEmitAt = now();
    emit(key);
  }

  function flush() {
    timer = null;
    const key = pendingKey;
    pendingKey = null;
    if (key !== null && key !== lastEmittedKey) fire(key);
  }

  return {
    push(key: string) {
      if (timer === null && now() - lastEmitAt >= quietMs) {
        if (key !== lastEmittedKey) fire(key); // leading：安靜期外立即送
        return;
      }
      pendingKey = key;
      if (timer !== null) cancel(timer); // debounce：重置等待安靜
      timer = schedule(flush, quietMs);
    },
    dispose() {
      if (timer !== null) cancel(timer);
      timer = null;
      pendingKey = null;
    },
  };
}
