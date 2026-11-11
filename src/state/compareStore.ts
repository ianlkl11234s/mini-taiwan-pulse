/**
 * 比較模式（雙地圖＋把手）的狀態（docs/features/compare-mode/DESIGN.md §3，P1）。
 *
 * - 主地圖＝左側；比較時另建一張右圖疊在上面，用 CSS 裁切露出把手右邊。
 * - 側別（左／右／兩側）只有 P1 支援的圖層可以設：古地圖六層（`historicalMapSinica.ts`）與統計圖層（面量圖、比例圓）。
 *   其他圖層在比較模式照畫在左側（使用者 2026-11-11 Q1 (a)），圖層列標「比較模式暫不支援，只顯示在左側」。
 * - 統計左右不同的期別／細項不存在這裡：選擇只存在 `regionalStatisticsStore`（右側另一份 `key::R`，
 *   見 `compareStatistics.ts`），這裡只放開關、把手位置、側別。
 * - 側別只活在這次瀏覽（不寫 localStorage）；分享網址另外記（`urlState` 的 `cmp*` 參數）。
 */
import { useSyncExternalStore } from "react";
import { HISTORICAL_MAP_GROUPS } from "../data/historicalMapSinica";
import { isStatisticsRenderLayer } from "../data/regionalStatisticsRecipes";

export type CompareSide = "left" | "right" | "both";

export interface CompareState {
  enabled: boolean;
  /** 把手位置（0..1，畫面寬度比例） */
  split: number;
  /** 圖層側別；缺省＝兩側 */
  sides: Readonly<Record<string, CompareSide>>;
}

export const COMPARE_DEFAULT_SPLIT = 0.5;
export const COMPARE_SPLIT_MIN = 0.05;
export const COMPARE_SPLIT_MAX = 0.95;
/** 鍵盤 ←→ 一次移動的比例 */
export const COMPARE_SPLIT_STEP = 0.05;

const HISTORICAL_KEYS: ReadonlySet<string> = new Set(HISTORICAL_MAP_GROUPS.map((group) => group.key));

/** P1 支援左右指定的圖層：古地圖六層＋統計圖層 */
export function isCompareSupported(key: string): boolean {
  return HISTORICAL_KEYS.has(key) || isStatisticsRenderLayer(key);
}

export function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return COMPARE_DEFAULT_SPLIT;
  return Math.min(COMPARE_SPLIT_MAX, Math.max(COMPARE_SPLIT_MIN, value));
}

const INITIAL: CompareState = { enabled: false, split: COMPARE_DEFAULT_SPLIT, sides: {} };
let state: CompareState = INITIAL;
const listeners = new Set<() => void>();

function commit(next: CompareState) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/** 圖層在比較模式的側別（不支援的圖層一律「左」） */
export function compareSideOf(key: string, snapshot: CompareState = state): CompareSide {
  if (!isCompareSupported(key)) return "left";
  return snapshot.sides[key] ?? "both";
}

/** 主地圖（左）畫不畫：比較關閉時＝圖層開關 */
export function shownOnLeft(key: string, visible: boolean, snapshot: CompareState = state): boolean {
  return visible && (!snapshot.enabled || compareSideOf(key, snapshot) !== "right");
}

/** 右圖畫不畫：只有比較中、支援的圖層 */
export function shownOnRight(key: string, visible: boolean, snapshot: CompareState = state): boolean {
  return visible && snapshot.enabled && isCompareSupported(key) && compareSideOf(key, snapshot) !== "left";
}

export const compareStore = {
  getSnapshot: (): CompareState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setEnabled(enabled: boolean) {
    if (state.enabled === enabled) return;
    commit({ ...state, enabled });
  },
  setSplit(split: number) {
    const next = clampSplit(split);
    if (next === state.split) return;
    commit({ ...state, split: next });
  },
  /** 不支援的圖層忽略；「兩側」＝刪掉紀錄（缺省值） */
  setSide(key: string, side: CompareSide) {
    if (!isCompareSupported(key) || compareSideOf(key) === side) return;
    const sides = { ...state.sides };
    if (side === "both") delete sides[key]; else sides[key] = side;
    commit({ ...state, sides });
  },
  /** 一次套用（分享網址還原用）；非法值略過 */
  hydrate(next: { enabled?: boolean; split?: number; sides?: Readonly<Record<string, CompareSide>> }) {
    const sides: Record<string, CompareSide> = {};
    for (const [key, side] of Object.entries(next.sides ?? {})) {
      if (isCompareSupported(key) && (side === "left" || side === "right")) sides[key] = side;
    }
    commit({ enabled: next.enabled ?? state.enabled, split: next.split === undefined ? state.split : clampSplit(next.split), sides: { ...state.sides, ...sides } });
  },
  /** 測試用 */
  reset() { commit(INITIAL); },
};

export function useCompareState(): CompareState {
  return useSyncExternalStore(compareStore.subscribe, compareStore.getSnapshot, compareStore.getSnapshot);
}
