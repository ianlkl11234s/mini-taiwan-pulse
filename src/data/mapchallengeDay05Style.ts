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

/**
 * V-1 全國視角（台灣 z7）：開闊海景／看得到海兩階在低縮放加粗（z7 道路 2、鐵路 2.5），到 z10 回到 L-1 標準值，
 * z14 照 L-1；看不到海／隧道維持細。L-1 本身只有 z10／z14 兩點，z7 這個插值點是本層的資料編碼例外。
 */
const NATIONAL_STRONG_Z7 = { road: 2, rail: 2.5 } as const;

/** 依運具＋判定的線寬（z7／z10／z14 三個插值點；z7 以下固定為 z7 值） */
export function mapchallengeDay05SegmentWidthExpr(scale = 1): unknown[] {
  const strong = [">=", ["to-number", ["get", "tier"], 0], 1];
  const at = (z: 0 | 1 | "z7") => {
    const pick = (rail: boolean) => z === "z7"
      ? ["case", strong, NATIONAL_STRONG_Z7[rail ? "rail" : "road"] * scale, widthStops(rail, 0)[0] * scale]
      : ["case", strong, widthStops(rail, 1)[z] * scale, widthStops(rail, 0)[z] * scale];
    return ["case", ["==", ["get", "kind"], "rail"], pick(true), pick(false)];
  };
  return ["interpolate", ["linear"], ["zoom"], 7, at("z7"), 10, at(0), 14, at(1)];
}

/** 一般名次＝強調階（2／3.5）；前 3 名再加粗（3／5，資料編碼例外） */
const RUN_WIDTH = { normal: LINE_WIDTH.emphasis, top: [3, 5] as const };

export function mapchallengeDay05RunWidthExpr(scale = 1): unknown[] {
  const at = (z: 0 | 1) => ["case", ["<=", ["to-number", ["get", "rank"], 99], MAPCHALLENGE_DAY05_TOP_RANK], RUN_WIDTH.top[z] * scale, RUN_WIDTH.normal[z] * scale];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

