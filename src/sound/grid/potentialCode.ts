/**
 * W6-3 連續潛勢家族（飛機、列車、風吹樹葉、海浪、河川）的網格碼：
 *
 * - 0＝已判斷、沒有活動（inactive）；1–250＝相對潛勢 (0, 1]，碼 k ↔ 潛勢 ∈ [(k−1)/250, k/250)（k=250 含 1）；
 *   255＝無法判斷（unknown／unavailable，渲染器畫斜線）。251–254 不用。
 * - 刻度 1/250：常用門檻（0.04、0.1、0.2、0.25、0.5、0.75…）都是 1/250 的整數倍，所以「潛勢 ≥ 門檻」
 *   恰好等於「碼 ≥ 1 + 門檻×250」，切換顯示門檻只要換色表、不必重算幀。
 * - 網格值＝queryFamilyInterval(格心, 區間) 的 familyResultCode；顯示分級只在色表。
 */
import type { FamilyResult } from "../types";
import { GRID_UNKNOWN } from "./gridSpec";

export const POTENTIAL_CODE_SCALE = 250;
export const POTENTIAL_CODE_MAX = 250;

/** 潛勢 → 碼：≤0（或非有限）＝0；>0 一律 ≥1（有活動不會被量化成 0） */
export function quantizePotential(p: number): number {
  if (!(p > 0)) return 0;
  return 1 + Math.min(POTENTIAL_CODE_MAX - 1, Math.floor(p * POTENTIAL_CODE_SCALE));
}

/** 家族結果 → 碼（active→量化潛勢；inactive→0；unknown／unavailable→255） */
export function familyResultCode(r: Pick<FamilyResult, "status" | "relativePotential">): number {
  if (r.status === "active") return quantizePotential(r.relativePotential ?? 0);
  if (r.status === "inactive") return 0;
  return GRID_UNKNOWN;
}

/** 碼 → 潛勢區間 [lo, hi)（popup 顯示「約 0.12–0.13」用）；0 → [0,0]、255 → null */
export function codePotentialRange(code: number): [number, number] | null {
  if (code === GRID_UNKNOWN || code > POTENTIAL_CODE_MAX) return null;
  if (code === 0) return [0, 0];
  return [(code - 1) / POTENTIAL_CODE_SCALE, Math.min(1, code / POTENTIAL_CODE_SCALE)];
}

/** 潛勢門檻 → 最小碼（潛勢 ≥ t ⇔ 碼 ≥ 回傳值；t 須為 1/250 的整數倍才精確） */
export function minCodeForPotential(t: number): number {
  return 1 + Math.round(t * POTENTIAL_CODE_SCALE);
}

/** 共用顯示分級（地圖色表、圖例、popup 同一套）：0 沒有／低於門檻、1 低、2 中、3 高、4 很高 */
export const POTENTIAL_LEVEL_EDGES = [0.25, 0.5, 0.75] as const;

export type PotentialLevel = 0 | 1 | 2 | 3 | 4;

/** 碼 → 顯示分級；gate＝顯示門檻（潛勢 < gate 歸 0「沒有或低於門檻」）。255 → null */
export function potentialLevelOfCode(code: number, gate = 0): PotentialLevel | null {
  if (code === GRID_UNKNOWN || code > POTENTIAL_CODE_MAX) return null;
  if (code === 0 || code < minCodeForPotential(gate)) return 0;
  let lv = 1;
  for (const e of POTENTIAL_LEVEL_EDGES) if (code >= minCodeForPotential(e)) lv++;
  return lv as PotentialLevel;
}

/** 256×1 色表索引 → 分級（給 paletteFromClasses 組表）；255 與未用碼 → -1（不畫，渲染器另畫斜線） */
export function potentialLevelTable(gate = 0): Int8Array {
  const out = new Int8Array(256).fill(-1);
  for (let c = 0; c <= POTENTIAL_CODE_MAX; c++) out[c] = potentialLevelOfCode(c, gate)!;
  return out;
}

/**
 * 分箱：碼 → 所在箱下緣的碼（edges 為潛勢、遞增、1/250 整數倍）。(0, edges[0]) 的活動碼一律變 1；0、255 不變。
 * 預算包只存箱碼（例：飛機只需要門檻與顯示分級的邊界），壓縮後小很多；箱碼仍在同一碼空間，
 * 所以 potentialLevelOfCode 對任何「落在箱界上」的門檻與分級都和精確碼相同。
 */
export function binLookup(edges: readonly number[]): Uint8Array {
  const lut = new Uint8Array(256);
  const mins = edges.map(minCodeForPotential);
  for (let c = 0; c < 256; c++) {
    if (c === 0 || c === GRID_UNKNOWN || c > POTENTIAL_CODE_MAX) { lut[c] = c; continue; }
    let v = 1;
    for (const m of mins) if (c >= m) v = m;
    lut[c] = v;
  }
  return lut;
}
