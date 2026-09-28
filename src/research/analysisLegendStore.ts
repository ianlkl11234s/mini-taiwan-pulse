// G1（D1）：分析結果圖例併入「圖例」面板最上方一組。MainMapConnection 發佈、LegendPanel 訂閱。
// G2：停靠 popup 開著（compact）時只留標題＋色階條；關閉恢復完整版（分界、方法與缺值、來源）。
import { useSyncExternalStore } from "react";
import type { AnalysisResultPresentation } from "./analysisResultOverlay";

export type AnalysisLegendEntry = Pick<AnalysisResultPresentation, "resultId" | "styleLegend" | "numericLegend" | "countLegend" | "scopeRing"> & {
  title: string;
  /** Human-readable dataset name (never an internal id); null when unknown. */
  source: string | null;
};

export type AnalysisLegendSnapshot = { entries: readonly AnalysisLegendEntry[]; compact: boolean };

const EMPTY: AnalysisLegendSnapshot = { entries: [], compact: false };
let snapshot: AnalysisLegendSnapshot = EMPTY;
const listeners = new Set<() => void>();

/** Only rendered results that carry some legend; order follows the rendered result order. */
export function analysisLegendEntries(presented: readonly AnalysisResultPresentation[], source: (datasetId: string, displayLabel: string) => string | null): AnalysisLegendEntry[] {
  return presented.filter(result => result.styleLegend || result.numericLegend || result.countLegend || result.scopeRing).map(result => ({
    resultId: result.resultId,
    title: result.displayLabel,
    source: source(result.datasetId, result.displayLabel),
    ...(result.styleLegend ? { styleLegend: result.styleLegend } : {}),
    ...(result.numericLegend ? { numericLegend: result.numericLegend } : {}),
    ...(result.countLegend ? { countLegend: result.countLegend } : {}),
    ...(result.scopeRing ? { scopeRing: result.scopeRing } : {}),
  }));
}

export function publishAnalysisLegend(next: AnalysisLegendSnapshot): void {
  const value = next.entries.length ? next : EMPTY;
  if (value === snapshot) return;
  snapshot = value;
  for (const listener of [...listeners]) listener();
}

export function getAnalysisLegendSnapshot(): AnalysisLegendSnapshot { return snapshot; }

export function subscribeAnalysisLegend(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAnalysisLegend(): AnalysisLegendSnapshot {
  return useSyncExternalStore(subscribeAnalysisLegend, getAnalysisLegendSnapshot, getAnalysisLegendSnapshot);
}
