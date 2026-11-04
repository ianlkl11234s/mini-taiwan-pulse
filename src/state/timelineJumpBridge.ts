/**
 * 時間軸跳轉橋：讓圖例等元件請求「跳到某個時刻」，實際寫入仍由 useTimeline 的 jumpToTime 執行
 * （timeStore 只有 useTimeline 可以寫）。App 掛上 handler；未掛時請求回 false。
 */
type JumpHandler = (unixSeconds: number) => void;

let handler: JumpHandler | null = null;

export function setTimelineJumpHandler(fn: JumpHandler | null): void {
  handler = fn;
}

export function requestTimelineJump(unixSeconds: number): boolean {
  if (!handler || !Number.isFinite(unixSeconds)) return false;
  handler(unixSeconds);
  return true;
}
