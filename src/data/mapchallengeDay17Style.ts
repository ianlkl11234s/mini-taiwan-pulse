/**
 * 30 天地圖挑戰 Day 17「衛星看不到光的路段」的線寬運算式（依賴 map/mapStyleScale 的 L-1 token，所以和 layerManifest 會 import 的
 * mapchallengeDay17Types.ts 分開；只有 overlayRegistry 用）。
 *
 * - 路段：「0」標準階、「低」細階（弱於 0）。
 * - 連續暗路段：一般名次標準階（與路段 0 同寬，主要當點擊範圍與詳細說明）；前 10 名 3／5（同 Day 5 前 3 名，資料編碼例外）。
 */
import { LINE_WIDTH } from "../map/mapStyleScale";
import { MAPCHALLENGE_DAY17_TOP_RANK } from "./mapchallengeDay17Types";

export function mapchallengeDay17SegmentWidthExpr(scale = 1): unknown[] {
  const at = (z: 0 | 1) => ["case", ["==", ["get", "cls"], "0"], LINE_WIDTH.standard[z] * scale, LINE_WIDTH.thin[z] * scale];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

const RUN_WIDTH = { normal: LINE_WIDTH.standard, top: [3, 5] as const };

export function mapchallengeDay17RunWidthExpr(scale = 1): unknown[] {
  const at = (z: 0 | 1) => ["case", ["<=", ["to-number", ["get", "rank"], 999], MAPCHALLENGE_DAY17_TOP_RANK], RUN_WIDTH.top[z] * scale, RUN_WIDTH.normal[z] * scale];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

/** 前 10 名的光暈寬：只算前 10 名的寬 × 倍率 */
export function mapchallengeDay17TopWidthExpr(scale: number): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 10, RUN_WIDTH.top[0] * scale, 14, RUN_WIDTH.top[1] * scale];
}
