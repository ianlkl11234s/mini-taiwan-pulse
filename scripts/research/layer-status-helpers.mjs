// build-layer-status.mjs 的純函式（可單測，不含任何 I/O）。
// byLayer 值：陣列＝倉庫 dataset id；物件＝{datasets, rowFilter?, geometry?}（共用表的逐層條件）。
export function layerAlias(aliasMap, key) {
  const value = aliasMap?.[key];
  if (value === undefined) return { datasets: [], rowFilter: "", geometry: "", explicit: false };
  if (Array.isArray(value)) return { datasets: value, rowFilter: "", geometry: "", explicit: true };
  return { datasets: value.datasets ?? [], rowFilter: value.rowFilter ?? "", geometry: value.geometry ?? "", explicit: true };
}

/** 同一張混合幾何表被多層共用、卻沒有逐層 rowFilter：整表計數與幾何都會混入其他圖層的列。 */
export function sharedTableWarning({ spatial, rowFilter, tableUsers }) {
  if (rowFilter || !spatial.length) return "";
  const shared = spatial.some(item => String(item.geometry_type).includes("+") && (tableUsers.get(item.table)?.size ?? 0) > 1);
  return shared ? "unfiltered_shared_table" : "";
}
