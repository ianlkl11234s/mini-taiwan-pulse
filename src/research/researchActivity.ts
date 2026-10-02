export type Activity = {
  phase: "working" | "complete" | "error" | "presenting" | "ready";
  title: string;
  detail?: string;
};

/** Only an in-flight, observable map action may light the map viewport. */
export function isActivityBusy(activity: Activity | null): boolean {
  return activity?.phase === "working" || activity?.phase === "presenting";
}

const READBACK = new Set([
  "map_context", "get_analysis_result", "get_result_bounds", "get_record_evidence", "get_data_quality", "list_results",
]);

/** Translates an intentional research action into calm, non-quantified UI copy. */
export function activityForOperation(operation: string, args: Record<string, unknown>): Activity | null {
  if (operation === "describe_layer_statistics") return { phase: "working", title: "正在確認可統計範圍", detail: "確認這份資料可以統計哪些項目。" };
  if (operation === "summarize_layer") return { phase: "working", title: "正在統計資料", detail: "正在把完整資料整理成數字。" };
  if (operation === "list_layer_capabilities") return { phase: "working", title: "正在確認圖層能力", detail: "看看哪些圖層可以拿來統計與搜尋。" };
  if (operation === "search_layer_records") return { phase: "working", title: "正在搜尋資料", detail: "在資料裡找符合條件的項目。" };
  if (operation === "time_context") return { phase: "working", title: "正在確認資料時間", detail: "確認目前日期與資料更新到哪一天。" };
  if (READBACK.has(operation)) return null;
  if (operation === "layer_controls") return { phase: "working", title: "正在查看圖層設定", detail: "看看這個圖層可以怎麼調整。" };
  if (operation === "geocode_address") return { phase: "working", title: "正在尋找位置", detail: "把地名或地址對到地圖上的位置。" };
  if (operation === "present_result" || operation === "wait_scene_ready") return { phase: "presenting", title: "Agent 正在把結果畫到地圖", detail: "畫好後地圖會自動更新。" };
  if (operation === "research_complete") return { phase: "complete", title: "Agent 已完成這一步", detail: "可以繼續查看結果或選擇下一個地方。" };
  if (operation === "research_error") return { phase: "error", title: "這一步暫時無法完成", detail: "請確認資料範圍後再試。" };
  if (operation === "search_layers" || operation === "search_datasets" || operation === "explore_data") return { phase: "working", title: "Agent 正在找相關資料", detail: "找出和問題有關的圖層與資料。" };
  if (operation === "layer_details" || operation === "describe_layer" || operation === "describe_dataset" || operation === "plan_data_access") return { phase: "working", title: "正在查看資料說明", detail: "整理這份資料的來源與內容。" };
  if (operation === "read_layer" || operation === "query_records" || operation === "materialize_data") return { phase: "working", title: "正在讀取資料", detail: "只讀取這次問題需要的範圍。" };
  if (operation === "nearby" || operation === "nearby_profile" || operation === "show_nearby") return { phase: "working", title: "正在找附近的設施", detail: "依選定的位置往周圍找。" };
  if (operation === "analysis_card_draft") return { phase: "working", title: "卡片草稿已送到面板", detail: "在「與 Agent 協作」面板預覽，按「發布連結」才會產生分享網址。" };
  if (operation === "import_warehouse_result") return { phase: "working", title: "正在把結果畫到地圖", detail: "把分析好的結果放上地圖。" };
  if (operation === "create_analysis_scope") return { phase: "working", title: "正在標出分析範圍", detail: "在地圖上畫出中心點與範圍圈。" };
  if (operation === "spatial_query") return { phase: "working", title: "Agent 正在比對空間關係", detail: args.predicate === "nearest" ? "正在找出接近的紀錄。" : "正在依指定範圍整理紀錄。" };
  if (operation === "aggregate_by_area") return { phase: "working", title: "正在依區域統計", detail: "把資料按縣市或行政區分組計算。" };
  if (operation === "route_distance" || operation === "walking_isochrone") return { phase: "working", title: "正在計算步行距離", detail: "沿著實際可走的道路估算。" };
  if (operation === "compare_neighborhoods") return { phase: "working", title: "正在比較周邊資料", detail: "把各項資料放在一起方便對照。" };
  if (operation === "aggregate_records") return { phase: "working", title: "Agent 正在彙整資料", detail: "把相關數字合併計算。" };
  if (operation === "join_records") return { phase: "working", title: "正在對照資料紀錄", detail: "把不同資料中相同的項目配在一起。" };
  if (operation === "calculate_metric" || operation === "compare_series" || operation === "compare_regions") return { phase: "working", title: "正在計算比較結果", detail: "正在算出各項比較的結果。" };
  if (operation === "read_series") return { phase: "working", title: "正在整理時間變化", detail: "整理這段時間的變化。" };
  return null;
}

/** Newest first, session-local, bounded; polling cannot duplicate the latest status. */
export function appendActivity(history: Activity[], next: Activity | null): Activity[] {
  if (!next) return [];
  const last = history[0];
  if (last?.phase === next.phase && last.title === next.title && last.detail === next.detail) return history;
  return [next, ...history].slice(0, 6);
}
