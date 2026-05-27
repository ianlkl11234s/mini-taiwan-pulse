/**
 * 出動引擎 — 腳本式 A→B 沿線移動
 *
 * 刻意不重用 BusEngine（那是為 GPS snap / trip 分段 / 異常剔除設計，
 * 與「照腳本從站點開到火場」無關）。只重用核心：
 *   progress = clamp(elapsed / duration) → interpolateOnLineString(route, progress)
 */

import type { DispatchInject } from "../types/scenario";
import { interpolateOnLineString } from "./railUtils";

export interface DispatchUnit {
  id: string;
  unitKind: DispatchInject["unitKind"];
  position: [number, number]; // [lng, lat]
  progress: number; // 0..1
  arrived: boolean;
}

const UNIT_COLOR: Record<DispatchInject["unitKind"], string> = {
  engine: "#ff3b30", // 消防車（紅）
  ladder: "#ff9800", // 雲梯車（橙）
  ambulance: "#ffffff", // 救護車（白）
};

export function unitColor(kind: DispatchInject["unitKind"]): string {
  return UNIT_COLOR[kind];
}

/**
 * 算出某 unix 時刻所有「已出動」單位的位置。
 * elapsedSec < 0（尚未出動）的單位不回傳。
 */
export function computeDispatchUnits(
  injects: DispatchInject[],
  startUnix: number,
  unix: number,
): DispatchUnit[] {
  const units: DispatchUnit[] = [];
  for (const inj of injects) {
    const elapsed = unix - startUnix - inj.at;
    if (elapsed < 0) continue;
    const progress = inj.durationSec > 0 ? Math.min(1, elapsed / inj.durationSec) : 1;
    units.push({
      id: inj.id,
      unitKind: inj.unitKind,
      position: interpolateOnLineString(inj.route, progress),
      progress,
      arrived: progress >= 1,
    });
  }
  return units;
}
