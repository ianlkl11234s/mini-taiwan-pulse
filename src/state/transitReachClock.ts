/**
 * 交通可及性「單一起點播放」的 scoped 時鐘（spec §5.40 S-1；不接全站 timeStore，development-rules §8）。
 * 時間是「出發後經過的秒數」（0–12 小時），播放列以經過時間顯示（`format: "elapsed"`）。
 * 倍速照原型 reach.html：1x＝12 小時 24 秒（1,800 模擬秒／秒），另給一半與兩倍。
 */
import { TRANSIT_REACH_CLOCK_ID, TRANSIT_REACH_T_MAX_MIN } from "../data/transitReachTypes";
import { createSimPlaybackClock, registerSimPlaybackClock } from "./simPlaybackClock";

export const TRANSIT_REACH_T1 = TRANSIT_REACH_T_MAX_MIN * 60;
/** 預設停在 2 小時（同原型 t=120） */
export const TRANSIT_REACH_START = 2 * 3600;

export const transitReachClock = registerSimPlaybackClock(TRANSIT_REACH_CLOCK_ID, createSimPlaybackClock({
  t0: 0,
  t1: TRANSIT_REACH_T1,
  start: TRANSIT_REACH_START,
  speeds: [900, 1800, 3600],
  defaultSpeed: 1800,
  format: "elapsed",
}));
