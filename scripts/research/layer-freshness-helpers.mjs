// build-layer-freshness.mjs 的純函式（可單測，不含 I/O）。
export const safeIdent = value => /^[a-z_][a-z0-9_]*$/.test(value);
const safeLiteral = value => /^[A-Za-z0-9_.:-]{1,64}$/.test(value);

/**
 * 一張 live 表裡有多個獨立 feed 時（例：marine_observation_current 的 source_network、cwa_imagery_frames 的
 * dataset_id），live-map 的 spec 可帶 `filter: { column, value }`；快照 key 與查詢都要含此條件，
 * 否則某 feed 的活動會讓同表兄弟圖層全被判 fresh。
 */
export function snapshotKey(spec) {
  const base = `${spec.schema}.${spec.table}.${spec.time_column}`;
  return spec.filter ? `${base}@${spec.filter.column}=${spec.filter.value}` : base;
}
export function filterClause(filter) {
  if (!filter) return "";
  if (!safeIdent(String(filter.column)) || !safeLiteral(String(filter.value))) return null;
  return ` where ${filter.column} = '${filter.value}'`;
}
