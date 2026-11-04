/**
 * 30 天地圖挑戰 Day 5 視野的線寬運算式（依賴 map/mapStyleScale 的 L-1 token，所以和 layerManifest 會 import 的
 * mapchallengeDay05Types.ts 分開；只有 overlayRegistry 用）。
 *
 * - 海景路段：鐵路用比道路高一階（路網 L-5：主要幹線＝強調），看不到海與隧道降一階。
 * - 最長連續海景：整體強調階，名次 ≤3 再加粗（規格 L-1 沒有更粗的階，登記為資料編碼例外）。
 */
import { LINE_WIDTH } from "../map/mapStyleScale";
import { MAPCHALLENGE_DAY05_TOP_RANK } from "./mapchallengeDay05Types";

/** 線寬階（L-1）：鐵路高一階；看不到海與隧道降一階 */
function widthStops(rail: boolean, tier: number): readonly [number, number] {
  const strong = tier >= 1;
  if (rail) return strong ? LINE_WIDTH.emphasis : LINE_WIDTH.standard;
  return strong ? LINE_WIDTH.standard : LINE_WIDTH.thin;
}

/** 依運具＋判定的線寬（z10／z14 兩個插值點，同 lineWidthExpr；z10 以下固定為 z10 值） */
export function mapchallengeDay05SegmentWidthExpr(scale = 1): unknown[] {
  const at = (z: 0 | 1) => ["case",
    ["==", ["get", "kind"], "rail"],
    ["case", [">=", ["to-number", ["get", "tier"], 0], 1], widthStops(true, 1)[z] * scale, widthStops(true, 0)[z] * scale],
    ["case", [">=", ["to-number", ["get", "tier"], 0], 1], widthStops(false, 1)[z] * scale, widthStops(false, 0)[z] * scale],
  ];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

/** 一般名次＝強調階（2／3.5）；前 3 名再加粗（3／5，資料編碼例外） */
const RUN_WIDTH = { normal: LINE_WIDTH.emphasis, top: [3, 5] as const };

export function mapchallengeDay05RunWidthExpr(scale = 1): unknown[] {
  const at = (z: 0 | 1) => ["case", ["<=", ["to-number", ["get", "rank"], 99], MAPCHALLENGE_DAY05_TOP_RANK], RUN_WIDTH.top[z] * scale, RUN_WIDTH.normal[z] * scale];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

