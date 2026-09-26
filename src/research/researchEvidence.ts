/** Bounded, serializable explanation of executed scope, never inferred from the viewport. */
export type ResearchEvidence = {
  operation: string; resultId: string | null; scope: string[]; sources: string[];
  rows: Record<string, unknown>[]; units: Record<string, unknown>;
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function researchEvidence(operation: string, args: Record<string, unknown>, data: Record<string, unknown>): ResearchEvidence {
  const scopes = new Set<string>(); const sources = new Set<string>();
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 6) return;
    const entry = object(value); const query = object(entry.queryScope);
    if (typeof query.datasetId === "string") {
      scopes.add(`資料：${query.datasetId}；完整符合 ${query.totalMatched ?? "未知"} 筆`);
      if (query.bbox) scopes.add(`查詢 bbox：${JSON.stringify(query.bbox)}`);
      if (query.time) scopes.add(`查詢期間：${JSON.stringify(query.time)}`);
      if (Array.isArray(query.filters) && query.filters.length) scopes.add(`篩選：${JSON.stringify(query.filters)}`);
      const parameters = object(query.parameters); if (parameters.releaseId) scopes.add(`發布版本：${String(parameters.releaseId)}`);
    }
    if (Array.isArray(entry.inputs)) entry.inputs.forEach(input => visit(object(input).lineage, depth + 1));
    if (Array.isArray(entry.sourceInputs)) entry.sourceInputs.forEach(input => visit(object(input).lineage, depth + 1));
    if (Array.isArray(entry.operationTrail)) entry.operationTrail.forEach(value => {
      const step = object(value); const method = object(step.method);
      if (step.operation === "line_buffer") scopes.add(`線形環域：${method.radiusM} 公尺；衍生邊界，不是服務可及範圍`);
      if (step.operation === "surface_intersection") scopes.add("面交集僅保留有面積的部分；邊界接觸不計覆蓋面積。");
      if (step.operation === "measure_geometry") scopes.add("球面面積／長度估算；不是地籍或工程測量。");
    });
  };
  visit(data.lineage);
  if (operation === "query_records") visit({ queryScope: { ...object(object(data.method).parameters), totalMatched: data.totalMatched } });
  const networkResult = object(data.result);
  if (operation === "route_distance" && data.status === "READY") scopes.add(`步行距離：${networkResult.distanceM} 公尺；模型時間：${networkResult.durationSeconds} 秒`);
  const graph = object(data.graph);
  if (graph.engineVersion) sources.add(`Valhalla ${String(graph.engineVersion)}；路網更新 ${String(graph.tilesetLastModified)}；未提供 graph checksum`);
  if (args.center) scopes.add(`中心：${JSON.stringify(args.center)}`);
  if (args.radiusM) scopes.add(args.predicate === "line_buffer" ? `線形環域：${args.radiusM} 公尺；衍生邊界，不是服務可及範圍` : `直線距離：${args.radiusM} 公尺；不是步行距離`);
  if (args.predicate === "surface_intersection") scopes.add("面交集僅保留有面積的部分；邊界接觸不計覆蓋面積。");
  if (args.predicate === "measure_geometry") scopes.add("球面面積／長度估算；不是地籍或工程測量。");
  if (args.areaCodes) scopes.add(`比較區域：${JSON.stringify(args.areaCodes)}；基準：${String(args.baselineAreaCode)}`);
  if (args.denominatorResultId) scopes.add(`分母結果：${String(args.denominatorResultId)}；標準化基數：${args.per ?? 10000}`);
  if (operation === "route_distance" || operation === "walking_isochrone") scopes.add(`步行路網模型：Valhalla pedestrian；狀態 ${String(data.status ?? "未知")}；不是實測旅行時間`);
  if (args.origin) scopes.add(`起點：${JSON.stringify(args.origin)}；終點：${JSON.stringify(args.destination)}`);
  if (args.contoursMinutes) scopes.add(`步行時間門檻：${JSON.stringify(args.contoursMinutes)} 分鐘`);
  const rows = Array.isArray(data.rows) ? data.rows.map(object) : [];
  const contract = object(object(data.method).sourceContract);
  if (contract.periodStart || contract.periodEnd) scopes.add(`資料期間：${String(contract.periodStart ?? "未知")} — ${String(contract.periodEnd ?? "未知")}`);
  if (contract.indicatorId) scopes.add(`指標：${String(contract.indicatorId)}；單位：${String(contract.unit ?? "未知")}；維度：${String(contract.dimensions ?? "未知")}`);
  if (contract.boundaryVersion) scopes.add(`行政層級：${String(contract.level)}；邊界：${String(contract.boundaryVersion)}`);
  const first = rows[0];
  if (first?.period_start || first?.period_end) scopes.add(`資料期間：${String(first.period_start ?? "未知")} — ${String(first.period_end ?? "未知")}`);
  if (data.recordGrain === "admin_statistic" || operation === "compare_regions") scopes.add("行政區整體統計；不能分攤或冒稱為半徑內統計。");
  for (const ref of Array.isArray(data.sourceRefs) ? data.sourceRefs : []) {
    const source = object(ref); sources.add(`${String(source.sourceId ?? "未知來源")} / ${String(source.version ?? "未知版本")}`);
  }
  if (data.coverage) scopes.add(`涵蓋範圍：${String(data.coverage)}`);
  if (data.freshness) scopes.add(`新鮮度：${String(data.freshness)}`);
  if (!scopes.size) scopes.add("本步沒有可確認的空間範圍；不以目前畫面代替。");
  return { operation, resultId: typeof data.resultId === "string" ? data.resultId : null, scope: [...scopes].slice(0, 16), sources: [...sources].slice(0, 8), rows: rows.slice(0, 8).map(({ geometry: _geometry, ...row }) => row), units: object(data.units) };
}
export function analysisErrorMessage(code: string): string {
  if (code.startsWith("REGION_") || code.startsWith("SERIES_COMPARISON_")) return `比較未執行：資料的指標、單位、期間、行政層級、邊界或必要證據不相容。請先對齊條件。原因：${code}`;
  return `這一步未完成（${code}）；不代表沒有資料，也不會以零代替。`;
}
