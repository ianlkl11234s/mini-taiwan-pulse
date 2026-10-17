// S1 疊加（O1）：同時最多 3 個分析結果；區域填色同時只有一個（其餘只畫邊線）；熱力同時只有一個。
// 超額時自動把「最久沒被打開」的結果關掉（改 item.visible，不刪除，結果清單的顯示開關可切回）。
import { visibleResultIds, type ResultCollection } from "./bridgeClient";

export const MAX_VISIBLE_ANALYSIS_RESULTS = 3;

/** area = choropleth / bivariate / compare_regions numeric fill; heat = heatmap; other = everything else. */
export type AnalysisStackKind = "area" | "heat" | "other";

/** resultId → activation stamp; larger = more recently turned visible. */
export type AnalysisActivations = ReadonlyMap<string, number>;

/**
 * Stamp every result that just became effectively visible (not visible before, or never stamped),
 * in collection order, so a result the user re-enables counts as the newest one.
 */
export function nextAnalysisActivations(previous: ResultCollection | null | undefined, next: ResultCollection | null | undefined, activations: AnalysisActivations): Map<string, number> {
  const before = new Set(visibleResultIds(previous));
  const visible = visibleResultIds(next);
  const known = new Set(next?.items.map(item => item.resultId) ?? []);
  const stamped = new Map([...activations].filter(([resultId]) => known.has(resultId)));
  let clock = Math.max(0, ...activations.values());
  for (const resultId of visible) if (!before.has(resultId) || !stamped.has(resultId)) stamped.set(resultId, ++clock);
  return stamped;
}

export type AnalysisStackPlan = {
  /** Same object when nothing had to be hidden. */
  collection: ResultCollection | null;
  /** Visible area results drawn as a 1.4px outline only (every area result but the newest). */
  outlineOnly: string[];
  /** Results this plan switched off. */
  autoHidden: string[];
};

/** Newest first: keep up to `max`, at most one heatmap; of the kept area results only the newest keeps its fill. */
export function planAnalysisStack(collection: ResultCollection | null | undefined, activations: AnalysisActivations, kindOf: (resultId: string) => AnalysisStackKind, max = MAX_VISIBLE_ANALYSIS_RESULTS): AnalysisStackPlan {
  if (!collection) return { collection: collection ?? null, outlineOnly: [], autoHidden: [] };
  const visible = visibleResultIds(collection);
  const order = new Map(visible.map((resultId, index) => [resultId, index]));
  const newestFirst = [...visible].sort((left, right) => (activations.get(right) ?? 0) - (activations.get(left) ?? 0) || order.get(right)! - order.get(left)!);
  const kept: string[] = [];
  const autoHidden: string[] = [];
  let heatKept = false;
  for (const resultId of newestFirst) {
    const heat = kindOf(resultId) === "heat";
    if (kept.length >= max || (heat && heatKept)) { autoHidden.push(resultId); continue; }
    kept.push(resultId);
    heatKept ||= heat;
  }
  const areas = kept.filter(resultId => kindOf(resultId) === "area");
  const hidden = new Set(autoHidden);
  return {
    collection: hidden.size ? { ...collection, items: collection.items.map(item => hidden.has(item.resultId) ? { ...item, visible: false } : item) } : collection,
    outlineOnly: areas.slice(1),
    autoHidden,
  };
}
