export type Activity = {
  phase: "working" | "complete" | "error" | "presenting" | "ready";
  title: string;
  detail?: string;
};

const READBACK = new Set([
  "map_context", "get_analysis_result", "get_result_bounds", "get_record_evidence", "get_data_quality", "list_results",
]);

/** Translates an intentional research action into calm, non-quantified UI copy. */
export function activityForOperation(operation: string, args: Record<string, unknown>): Activity | null {
  if (operation === "describe_layer_statistics") return { phase: "working", title: "正在確認可統計範圍", detail: "確認來源、計數單位、可用欄位與缺值。" };
  if (operation === "summarize_layer") return { phase: "working", title: "正在計算來源紀錄", detail: "使用完整資產，保留缺值與未匹配行政區。" };
  if (operation === "list_layer_capabilities") return { phase: "working", title: "正在確認圖層能力", detail: "查看哪些圖層已登記統計、搜尋與完整來源摘要。" };
  if (operation === "search_layer_records") return { phase: "working", title: "正在搜尋來源紀錄", detail: "只讀取已驗證的資料來源與欄位。" };
  if (operation === "time_context") return { phase: "working", title: "正在確認資料時間", detail: "查看目前日期與已知可用資料日期。" };
  if (READBACK.has(operation)) return null;
  if (operation === "layer_controls") return { phase: "working", title: "正在查看圖層設定", detail: "確認可調整項目、選項與目前設定。" };
  if (operation === "geocode_address") return { phase: "working", title: "正在尋找位置", detail: "查詢本地地點與地址資料。" };
  if (operation === "present_result" || operation === "wait_scene_ready") return { phase: "presenting", title: "正在呈現研究結果", detail: "地圖會在準備完成後更新。" };
  if (operation === "research_complete") return { phase: "complete", title: "這一步已完成", detail: "可以繼續查看結果或選擇下一個地方。" };
  if (operation === "research_error") return { phase: "error", title: "這一步暫時無法完成", detail: "請確認資料範圍後再試。" };
  if (operation === "search_layers" || operation === "search_datasets" || operation === "explore_data") return { phase: "working", title: "正在探索可用資料", detail: "尋找相關圖層與資料內容。" };
  if (operation === "layer_details" || operation === "describe_layer" || operation === "describe_dataset" || operation === "plan_data_access") return { phase: "working", title: "正在查看資料說明", detail: "整理資料來源與可用欄位。" };
  if (operation === "read_layer" || operation === "query_records" || operation === "materialize_data") return { phase: "working", title: "正在讀取資料", detail: "只處理這次指定的資料範圍。" };
  if (operation === "nearby") return { phase: "working", title: "正在查看附近資料", detail: "依目前位置與條件整理。" };
  if (operation === "spatial_query") return { phase: "working", title: "正在比對空間關係", detail: args.predicate === "nearest" ? "正在找出接近的紀錄。" : "正在依指定範圍整理紀錄。" };
  if (operation === "aggregate_by_area") return { phase: "working", title: "正在依區域彙總", detail: "邊界版本、未匹配與零值會分開保留。" };
  if (operation === "route_distance" || operation === "walking_isochrone") return { phase: "working", title: "正在檢查步行路網", detail: "只會使用已登記版本的 pedestrian graph，不用直線距離代替。" };
  if (operation === "compare_neighborhoods") return { phase: "working", title: "正在比較周邊資料", detail: "各來源會分開保留，方便對照。" };
  if (operation === "aggregate_records") return { phase: "working", title: "正在彙整已取得的資料", detail: "不會將缺漏值改成零。" };
  if (operation === "join_records") return { phase: "working", title: "正在對照資料紀錄", detail: "正在保留可追溯的對照關係。" };
  if (operation === "calculate_metric" || operation === "compare_series") return { phase: "working", title: "正在計算比較結果", detail: "會保留無法計算的值。" };
  if (operation === "read_series") return { phase: "working", title: "正在整理時間變化", detail: "依指定時間範圍呈現。" };
  return null;
}

/** Newest first, session-local, bounded; polling cannot duplicate the latest status. */
export function appendActivity(history: Activity[], next: Activity | null): Activity[] {
  if (!next) return [];
  const last = history[0];
  if (last?.phase === next.phase && last.title === next.title && last.detail === next.detail) return history;
  return [next, ...history].slice(0, 6);
}
