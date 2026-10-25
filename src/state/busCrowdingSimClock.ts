/**
 * 公車擁擠模擬「時間回放」的播放時鐘（spec §5.40 S-1；不接全站 timeStore）。
 * 範圍、預設時刻、倍速照原型 taipei-gis-analytics output/bus_crowding/p3_viz/index.html：
 *   :115 slider min 25200（07:00）／max 32400（09:00）／value 27900（07:45）
 *   :116 倍速 ×30／×60（預設）／×120（模擬秒／牆鐘秒）
 *   :149 T0＝7×3600、T1＝9×3600；:500–501 播到 T1 就停、停在結尾時按播放從 T0 起
 */
import { BUS_CROWDING_SIM_CLOCK_ID } from "../data/busCrowdingSimTypes";
import { createSimPlaybackClock, registerSimPlaybackClock } from "./simPlaybackClock";

export const BUS_CROWDING_REPLAY_T0 = 7 * 3600;
export const BUS_CROWDING_REPLAY_T1 = 9 * 3600;

export const busCrowdingSimClock = registerSimPlaybackClock(BUS_CROWDING_SIM_CLOCK_ID, createSimPlaybackClock({
  t0: BUS_CROWDING_REPLAY_T0,
  t1: BUS_CROWDING_REPLAY_T1,
  start: 27900,
  speeds: [30, 60, 120],
  defaultSpeed: 60,
}));
