import { translate } from "../i18n/translate";
import type { MessageKey } from "../i18n/keys";
import zhResultMessages from "../i18n/locales/zh-TW/researchResult.json";
import { localeStore, type LocaleSnapshot } from "../state/localeStore";

/** Bounded, serializable explanation of executed scope, never inferred from the viewport.
 *  `scope`／`sources` 會隨查詢結果回傳給 Agent（researchScope），固定是中文；`display` 才是畫面顯示的語系版本。 */
export type ResearchEvidence = {
  operation: string; resultId: string | null; scope: string[]; sources: string[];
  rows: Record<string, unknown>[]; units: Record<string, unknown>;
  display?: { scope: string[]; sources: string[] };
};
type Vars = Record<string, string | number>;
type Translate = (key: MessageKey, vars?: Vars) => string;
/** 給 Agent 的文字一律取 zh-TW 正本（與 JSON 同一份字串，不隨介面語系變）。 */
const zhT: Translate = (key, vars) => translate([zhResultMessages as Record<string, string>], "zh-TW", key, vars);
/** 同一句同時產出 Agent 用（中文）與畫面用（目前語系）兩個版本；vars 以函式帶入，讓「未知」這類字也能各自翻譯。 */
type Lines = Map<string, string>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function researchEvidence(operation: string, args: Record<string, unknown>, data: Record<string, unknown>, i18n: LocaleSnapshot = localeStore.getSnapshot()): ResearchEvidence {
  const scopes: Lines = new Map(); const sources: Lines = new Map();
  const add = (lines: Lines, key: MessageKey, vars?: (t: Translate) => Vars) => { lines.set(zhT(key, vars?.(zhT)), i18n.t(key, vars?.(i18n.t))); };
  const unknown = (t: Translate) => t("researchResult.evidence.unknown");
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 6) return;
    const entry = object(value); const query = object(entry.queryScope);
    if (typeof query.datasetId === "string") {
      add(scopes, "researchResult.evidence.dataScope", t => ({ id: String(query.datasetId), count: String(query.totalMatched ?? unknown(t)) }));
      if (query.bbox) add(scopes, "researchResult.evidence.bbox", () => ({ value: JSON.stringify(query.bbox) }));
      if (query.time) add(scopes, "researchResult.evidence.period", () => ({ value: JSON.stringify(query.time) }));
      if (Array.isArray(query.filters) && query.filters.length) add(scopes, "researchResult.evidence.filters", () => ({ value: JSON.stringify(query.filters) }));
      const parameters = object(query.parameters); if (parameters.releaseId) add(scopes, "researchResult.evidence.release", () => ({ value: String(parameters.releaseId) }));
    }
    if (Array.isArray(entry.inputs)) entry.inputs.forEach(input => visit(object(input).lineage, depth + 1));
    if (Array.isArray(entry.sourceInputs)) entry.sourceInputs.forEach(input => visit(object(input).lineage, depth + 1));
    if (Array.isArray(entry.operationTrail)) entry.operationTrail.forEach(value => {
      const step = object(value); const method = object(step.method);
      if (step.operation === "line_buffer") add(scopes, "researchResult.evidence.lineBuffer", () => ({ meters: String(method.radiusM) }));
      if (step.operation === "surface_intersection") add(scopes, "researchResult.evidence.surfaceIntersection");
      if (step.operation === "measure_geometry") add(scopes, "researchResult.evidence.measureGeometry");
    });
  };
  visit(data.lineage);
  if (operation === "query_records") visit({ queryScope: { ...object(object(data.method).parameters), totalMatched: data.totalMatched } });
  const networkResult = object(data.result);
  if (operation === "route_distance" && data.status === "READY") add(scopes, "researchResult.evidence.walkDistance", () => ({ meters: String(networkResult.distanceM), seconds: String(networkResult.durationSeconds) }));
  const graph = object(data.graph);
  if (graph.engineVersion) add(sources, "researchResult.evidence.engine", () => ({ version: String(graph.engineVersion), updated: String(graph.tilesetLastModified) }));
  if (args.center) add(scopes, "researchResult.evidence.center", () => ({ value: JSON.stringify(args.center) }));
  if (args.radiusM) {
    if (args.predicate === "line_buffer") add(scopes, "researchResult.evidence.lineBuffer", () => ({ meters: String(args.radiusM) }));
    else add(scopes, "researchResult.evidence.straightLine", () => ({ meters: String(args.radiusM) }));
  }
  if (args.predicate === "surface_intersection") add(scopes, "researchResult.evidence.surfaceIntersection");
  if (args.predicate === "measure_geometry") add(scopes, "researchResult.evidence.measureGeometry");
  if (args.areaCodes) add(scopes, "researchResult.evidence.compareAreas", () => ({ areas: JSON.stringify(args.areaCodes), baseline: String(args.baselineAreaCode) }));
  if (args.denominatorResultId) add(scopes, "researchResult.evidence.denominator", () => ({ id: String(args.denominatorResultId), per: String(args.per ?? 10000) }));
  if (operation === "route_distance" || operation === "walking_isochrone") add(scopes, "researchResult.evidence.walkModel", t => ({ status: String(data.status ?? unknown(t)) }));
  if (args.origin) add(scopes, "researchResult.evidence.origin", () => ({ origin: JSON.stringify(args.origin), destination: JSON.stringify(args.destination) }));
  if (args.contoursMinutes) add(scopes, "researchResult.evidence.contours", () => ({ value: JSON.stringify(args.contoursMinutes) }));
  const rows = Array.isArray(data.rows) ? data.rows.map(object) : [];
  const contract = object(object(data.method).sourceContract);
  if (contract.periodStart || contract.periodEnd) add(scopes, "researchResult.evidence.dataPeriod", t => ({ start: String(contract.periodStart ?? unknown(t)), end: String(contract.periodEnd ?? unknown(t)) }));
  if (contract.indicatorId) add(scopes, "researchResult.evidence.indicator", t => ({ id: String(contract.indicatorId), unit: String(contract.unit ?? unknown(t)), dimensions: String(contract.dimensions ?? unknown(t)) }));
  if (contract.boundaryVersion) add(scopes, "researchResult.evidence.boundary", () => ({ level: String(contract.level), version: String(contract.boundaryVersion) }));
  const first = rows[0];
  if (first?.period_start || first?.period_end) add(scopes, "researchResult.evidence.dataPeriod", t => ({ start: String(first.period_start ?? unknown(t)), end: String(first.period_end ?? unknown(t)) }));
  if (data.recordGrain === "admin_statistic" || operation === "compare_regions") add(scopes, "researchResult.evidence.adminStat");
  for (const ref of Array.isArray(data.sourceRefs) ? data.sourceRefs : []) {
    const source = object(ref);
    add(sources, "researchResult.evidence.sourceVersion", t => ({ source: String(source.sourceId ?? t("researchResult.evidence.unknownSource")), version: String(source.version ?? t("researchResult.evidence.unknownVersion")) }));
  }
  if (data.coverage) add(scopes, "researchResult.evidence.coverage", () => ({ value: String(data.coverage) }));
  if (data.freshness) add(scopes, "researchResult.evidence.freshness", () => ({ value: String(data.freshness) }));
  if (!scopes.size) add(scopes, "researchResult.evidence.none");
  const scopeEntries = [...scopes].slice(0, 16); const sourceEntries = [...sources].slice(0, 8);
  return {
    operation, resultId: typeof data.resultId === "string" ? data.resultId : null,
    scope: scopeEntries.map(([zh]) => zh), sources: sourceEntries.map(([zh]) => zh),
    rows: rows.slice(0, 8).map(({ geometry: _geometry, ...row }) => row), units: object(data.units),
    display: { scope: scopeEntries.map(([, shown]) => shown), sources: sourceEntries.map(([, shown]) => shown) },
  };
}
/** 畫面上的錯誤說明（活動卡）；不會回傳給 Agent。 */
export function analysisErrorMessage(code: string, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  if (code.startsWith("REGION_") || code.startsWith("SERIES_COMPARISON_")) return i18n.t("researchResult.evidence.errCompare", { code });
  return i18n.t("researchResult.evidence.errGeneric", { code });
}
