import { warehouseBaseResultId, type ResultCollection, type WarehouseResultsMeta } from "./bridgeClient";

/**
 * P1 (SPEC-prod-connect §6.2): after a reload the study scene still lists warehouse
 * results (`wh-N`, possibly split as `wh-N:point`) but the browser session store is
 * empty. Re-import them from the gateway before the scene is validated; drop the items
 * whose upload is gone (missing) or fails to import, and keep presenting the rest.
 */
export const WAREHOUSE_RESTORE_DEADLINE_MS = 20_000;

export type WarehouseRestoreDeps = {
  has: (resultId: string) => boolean;
  meta: (baseIds: string[]) => Promise<WarehouseResultsMeta>;
  importResult: (args: Record<string, unknown>) => Promise<unknown>;
  /** Base ids already known to be gone in this connection; skipped without another meta round-trip. */
  expired?: Set<string>;
  deadlineMs?: number;
};
export type WarehouseRestoreOutcome = { collection: ResultCollection | null; restored: string[]; dropped: string[] };

function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error("WAREHOUSE_RESTORE_TIMEOUT"));
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("WAREHOUSE_RESTORE_TIMEOUT")), remaining); }),
  ]).finally(() => clearTimeout(timer));
}

const LEGACY_SUFFIX: Record<string, string> = { multipolygon: "polygon", multilinestring: "linestring", multipoint: "point" };

/**
 * Ids a stored scene item may now be presented under. Imports group Polygon+MultiPolygon (and the
 * line/point pairs) together, so a scene saved before that change may hold `wh-3:multipolygon`
 * while the session now has `wh-3:polygon`, or plain `wh-3` when only one group remains (review F018).
 */
function presentedIdCandidates(resultId: string): string[] {
  const base = warehouseBaseResultId(resultId);
  if (base === null || base === resultId) return [resultId];
  const suffix = resultId.slice(base.length + 1);
  const normalized = `${base}:${LEGACY_SUFFIX[suffix] ?? suffix}`;
  return [...new Set([resultId, normalized, base])];
}

function resolvePresentedId(resultId: string, has: (resultId: string) => boolean): string | null {
  return presentedIdCandidates(resultId).find(has) ?? null;
}

export async function restoreWarehouseResults(collection: ResultCollection, deps: WarehouseRestoreDeps): Promise<WarehouseRestoreOutcome> {
  const missingBases = [...new Set(collection.items.filter(item => resolvePresentedId(item.resultId, deps.has) === null).map(item => warehouseBaseResultId(item.resultId)).filter((id): id is string => id !== null))];
  if (!missingBases.length) return { collection: remapItems(collection, deps.has).collection, restored: [], dropped: [] };
  const deadline = Date.now() + (deps.deadlineMs ?? WAREHOUSE_RESTORE_DEADLINE_MS);
  const restored: string[] = [];
  const toFetch = missingBases.filter(id => !deps.expired?.has(id));
  if (toFetch.length) {
    try {
      const meta = await withDeadline(deps.meta(toFetch.slice(0, 8)), deadline);
      for (const id of meta.missing) deps.expired?.add(id);
      for (const item of meta.results) {
        if (!toFetch.includes(item.resultId)) continue;
        try {
          await withDeadline(deps.importResult({ resultId: item.resultId, sha256: item.sha256, label: item.label, featureCount: item.featureCount, ...(item.style ? { style: item.style } : {}) }), deadline);
          restored.push(item.resultId);
        } catch (error) {
          // Integrity or contract failures will not heal on retry; transient ones may.
          if (error instanceof Error && /SHA_MISMATCH|INVALID/.test(error.message)) deps.expired?.add(item.resultId);
        }
      }
    } catch { /* Meta unavailable: drop for this render only; a later render retries. */ }
  }
  return { ...remapItems(collection, deps.has), restored };
}

/** Maps legacy split ids to the ids now present; anything still absent locally (gone or failed) is dropped. */
function remapItems(collection: ResultCollection, has: (resultId: string) => boolean): { collection: ResultCollection | null; dropped: string[] } {
  const items: ResultCollection["items"] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  let changed = false;
  for (const item of collection.items) {
    const resolved = warehouseBaseResultId(item.resultId) === null ? item.resultId : resolvePresentedId(item.resultId, has);
    if (resolved === null) { dropped.push(item.resultId); changed = true; continue; }
    // Two legacy items (`:polygon` and `:multipolygon`) can now be the same result: keep the first.
    if (seen.has(resolved)) { changed = true; continue; }
    seen.add(resolved);
    if (resolved !== item.resultId) changed = true;
    items.push(resolved === item.resultId ? item : { ...item, resultId: resolved });
  }
  if (!changed) return { collection, dropped };
  const usedGroups = new Set(items.map(item => item.groupId).filter((id): id is string => id !== null));
  return { collection: items.length ? { items, groups: collection.groups.filter(group => usedGroups.has(group.groupId)) } : null, dropped };
}
