/** 漣漪／脈動類 setPaintProperty 動畫的更新間隔（約每秒 20 次）。 */
export const RIPPLE_FRAME_MS = 50;

/**
 * 節流版 requestAnimationFrame 迴圈：每 intervalMs 最多呼叫一次 tick（仍對齊顯示器幀）。
 *
 * - tick 收到 rAF 時間戳（與 performance.now() 同一時間基準）。動畫相位一律用時間計算，
 *   不要數幀 —— 這樣改節流頻率不會改變動畫速度。
 * - tick 回傳 false 即停止迴圈（一次性動畫用）。
 * - 回傳 cancel 函式；圖層關閉時務必呼叫（通常放在 useEffect cleanup）。
 */
export function startThrottledRaf(
  tick: (now: number) => boolean | void,
  intervalMs: number = RIPPLE_FRAME_MS,
): () => void {
  let raf = 0;
  let last = -Infinity;
  let stopped = false;
  const loop = (ts: number) => {
    if (stopped) return;
    // 容許 4ms 抖動：60Hz 下每 3 幀（≈50ms）觸發一次，避免因幀時間抖動落到每 4 幀
    if (ts - last >= intervalMs - 4) {
      last = ts;
      if (tick(ts) === false) {
        stopped = true;
        return;
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
