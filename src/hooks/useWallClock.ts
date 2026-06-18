/**
 * useWallClock — 訂閱真實掛鐘時間（Date.now()）
 *
 * 用 useSyncExternalStore 接 timeStore.wallClock，每 `ms` 觸發一次 re-render。
 * 多個元件共用相同 ms 桶（store 內部單一 setInterval）。
 *
 * 目的：把 1Hz / 30s 等「跳秒」UI 從 parent component 隔離出來，
 *       避免整棵子樹被 1Hz setState 帶著重 reconcile。
 *
 * 範例：
 *   const now = useWallClock(1000);           // 每秒跳
 *   const now = useWallClock(30_000, nowTs);  // 每 30 秒跳，初始值 fallback
 */
import { useEffect, useState } from "react";
import { wallClock } from "../state/timeStore";

// 注意：原本用 useSyncExternalStore，但 getSnapshot 直接回 Date.now() 每次
// 呼叫值都不同，React 認為 store 一直在變 → 無限 re-render。
// 改 useState + subscribe：setState 只由 timer callback 觸發，安全。
export function useWallClock(ms: number, initial?: number): number {
  const [now, setNow] = useState(() => initial ?? wallClock.getWallNow());
  useEffect(() => {
    return wallClock.subscribeWallClock(ms, setNow);
  }, [ms]);
  return now;
}
