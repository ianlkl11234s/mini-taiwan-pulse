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

/**
 * 播放請求（例：聲景「播放此場景」）：跳到 startUnix 後以 speed（模擬秒／牆鐘秒）播放。
 * 實際寫入仍由 useTimeline（jumpToTime → setSpeed → play）執行；未掛時回 false。
 */
type PlayHandler = (startUnix: number, speed: number) => void;
let playHandler: PlayHandler | null = null;

export function setTimelinePlayHandler(fn: PlayHandler | null): void {
  playHandler = fn;
}

export function requestTimelinePlay(startUnix: number, speed: number): boolean {
  if (!playHandler || !Number.isFinite(startUnix) || !(speed > 0)) return false;
  playHandler(startUnix, speed);
  return true;
}
