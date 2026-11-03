/**
 * 雙北大眾運輸可及性「單一起點播放」的 scoped 時鐘（spec §5.40 S-1；不接全站 timeStore，development-rules §8）。
 * 時間是「出發後經過的秒數」（0–4 小時，P1 上限 240 分），播放列以經過時間顯示。
 * 倍速：1x＝4 小時 16 秒（900 模擬秒／秒），另給一半與兩倍。
 */
import { TRANSIT_ACCESS_CLOCK_ID } from "../data/transitAccessTypes";
import { createSimPlaybackClock, registerSimPlaybackClock } from "./simPlaybackClock";

export const TRANSIT_ACCESS_T1 = 240 * 60;
/** 預設停在 1 小時 */
export const TRANSIT_ACCESS_START = 3600;

export const transitAccessClock = registerSimPlaybackClock(TRANSIT_ACCESS_CLOCK_ID, createSimPlaybackClock({
  t0: 0,
  t1: TRANSIT_ACCESS_T1,
  start: TRANSIT_ACCESS_START,
  speeds: [450, 900, 1800],
  defaultSpeed: 900,
  format: "elapsed",
}));
