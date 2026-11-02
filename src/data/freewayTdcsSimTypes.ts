/**
 * 雙北國道逐車模擬（本機研究層 freewayTdcsSim）共用常數：scene／圖例／說明框三邊同一份色票與標籤。
 * 原型：taipei-gis-analytics pipelines/analysis/freeway_tdcs/（viewer/index.html、README.md）；
 * 資料：同 repo output/freeway_tdcs/ 的 trips.bin、trips_meta.json、network.json（換道版），本機複製到 public/freeway_tdcs/。
 */

export const FREEWAY_TDCS_SIM_KEY = "freewayTdcsSim" as const;
export const FREEWAY_TDCS_SIM_DIR = "/freeway_tdcs/";
/** 代表色：取車種「小客車」色 */
export const FREEWAY_TDCS_SIM_COLOR = "#39bff4";

/** 每段資料的時段（自當日 00:00 台北時間起秒數）；實際值以 trips_meta.json `window` 為準 */
export const FREEWAY_TDCS_SIM_DEFAULT_WINDOW: readonly [number, number] = [57600, 64800];

/** 車種（trips_meta `vt_codes` 31／32／41／42／5 的順序） */
export const FREEWAY_TDCS_VT_NAMES = ["小客車", "小貨車", "大客車", "大貨車", "聯結車"] as const;
export const FREEWAY_TDCS_VT_VALUES = ["car", "lightTruck", "bus", "truck", "trailer"] as const;
/** 車種色：沿用站上 GFW 航跡五類暗底色（同一張地圖已並用、彼此可分辨） */
export const FREEWAY_TDCS_VT_COLORS = ["#39bff4", "#58d68d", "#b3a0ff", "#ff8f43", "#f0cc66"] as const;

/** 顏色模式 */
export const FREEWAY_TDCS_COLOR_MODES = ["speed", "type"] as const;
export type FreewayTdcsColorMode = (typeof FREEWAY_TDCS_COLOR_MODES)[number];
export const FREEWAY_TDCS_COLOR_MODE_LABELS: Record<FreewayTdcsColorMode, string> = { speed: "依車速", type: "依車種" };

/**
 * 車速色階：viridis（map-layers F-3 指定的連續色階；暗底越亮＝越快）。
 * 最暗一階（#440154）在暗色底圖上看不到，所以從第 2 色起算——仍是 viridis，只截掉最暗端。
 */
export const FREEWAY_TDCS_SPEED_RAMP = ["#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"] as const;
/** 色階兩端（km/h）：≤ 下限用最暗、≥ 上限用最亮 */
export const FREEWAY_TDCS_SPEED_MIN = 20;
export const FREEWAY_TDCS_SPEED_MAX = 100;
/** 推算不出車速（同時刻兩影格）時的中性灰 */
export const FREEWAY_TDCS_SPEED_NA = "#9ca3af";

export const FREEWAY_TDCS_SOURCE = "交通部高速公路局「交通資料庫」（TDCS M06A，2026-09-28）；門架之間位置與車道為推算";

const hexRgb = (c: string): [number, number, number] => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) as [number, number, number];

/** 車速 → RGB（0–255） */
export function freewayTdcsSpeedRgb(v: number | null): [number, number, number] {
  if (v == null || !Number.isFinite(v)) return hexRgb(FREEWAY_TDCS_SPEED_NA);
  const ramp = FREEWAY_TDCS_SPEED_RAMP;
  const f = Math.max(0, Math.min(1, (v - FREEWAY_TDCS_SPEED_MIN) / (FREEWAY_TDCS_SPEED_MAX - FREEWAY_TDCS_SPEED_MIN)));
  const p = f * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(p));
  const t = p - i;
  const a = hexRgb(ramp[i]!), b = hexRgb(ramp[i + 1]!);
  return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * t)) as [number, number, number];
}

export const FREEWAY_TDCS_VT_RGB = FREEWAY_TDCS_VT_COLORS.map(hexRgb);

/** 旗標位元（trips.bin `flags`） */
export const FREEWAY_TDCS_FLAG_ENTER_BOUNDARY = 1;
export const FREEWAY_TDCS_FLAG_EXIT_BOUNDARY = 2;
export const FREEWAY_TDCS_FLAG_SERVICE_BREAK = 4;
