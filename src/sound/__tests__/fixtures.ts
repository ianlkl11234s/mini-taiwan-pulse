/** 去識別、手寫小量 fixture（非真實站名／路線） */
import type { Receiver } from "../types";

export const DATE = "2026-07-14"; // 週二（臺北）
export const DAY_START = Date.parse(`${DATE}T00:00:00+08:00`) / 1000;

export const RECV: Receiver = { id: "r1", longitude: 121.5, latitude: 25.0, environment: "outdoor" };

/** 從 RECV 往北 meters 公尺的緯度 */
export const latNorth = (meters: number, lat = RECV.latitude) => lat + meters / 111_195;
