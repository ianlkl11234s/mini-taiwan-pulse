import { localeStore, type LocaleSnapshot } from "../state/localeStore";

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

/** Translates an intentional research action into calm, non-quantified UI copy.
 *  純畫面文案（活動卡）：依介面語系翻譯，不會送回 Agent。 */
export function activityForOperation(operation: string, args: Record<string, unknown>, i18n: LocaleSnapshot = localeStore.getSnapshot()): Activity | null {
  const { t } = i18n;
  if (operation === "describe_layer_statistics") return { phase: "working", title: t("research.activity.describeStats.title"), detail: t("research.activity.describeStats.detail") };
  if (operation === "summarize_layer") return { phase: "working", title: t("research.activity.summarize.title"), detail: t("research.activity.summarize.detail") };
  if (operation === "list_layer_capabilities") return { phase: "working", title: t("research.activity.capabilities.title"), detail: t("research.activity.capabilities.detail") };
  if (operation === "search_layer_records") return { phase: "working", title: t("research.activity.searchRecords.title"), detail: t("research.activity.searchRecords.detail") };
  if (operation === "time_context") return { phase: "working", title: t("research.activity.timeContext.title"), detail: t("research.activity.timeContext.detail") };
  if (READBACK.has(operation)) return null;
  if (operation === "layer_controls") return { phase: "working", title: t("research.activity.layerControls.title"), detail: t("research.activity.layerControls.detail") };
  if (operation === "geocode_address") return { phase: "working", title: t("research.activity.geocode.title"), detail: t("research.activity.geocode.detail") };
  if (operation === "present_result" || operation === "wait_scene_ready") return { phase: "presenting", title: t("research.activity.present.title"), detail: t("research.activity.present.detail") };
  if (operation === "research_complete") return { phase: "complete", title: t("research.activity.complete.title"), detail: t("research.activity.complete.detail") };
  if (operation === "research_error") return { phase: "error", title: t("research.activity.error.title"), detail: t("research.activity.error.detail") };
  if (operation === "search_layers" || operation === "search_datasets" || operation === "explore_data") return { phase: "working", title: t("research.activity.findData.title"), detail: t("research.activity.findData.detail") };
  if (operation === "layer_details" || operation === "describe_layer" || operation === "describe_dataset" || operation === "plan_data_access") return { phase: "working", title: t("research.activity.dataInfo.title"), detail: t("research.activity.dataInfo.detail") };
  if (operation === "read_layer" || operation === "query_records" || operation === "materialize_data") return { phase: "working", title: t("research.activity.readData.title"), detail: t("research.activity.readData.detail") };
  if (operation === "nearby" || operation === "nearby_profile" || operation === "show_nearby") return { phase: "working", title: t("research.activity.nearby.title"), detail: t("research.activity.nearby.detail") };
  if (operation === "analysis_card_draft") return { phase: "working", title: t("research.activity.cardDraft.title"), detail: t("research.activity.cardDraft.detail") };
  if (operation === "import_warehouse_result") return { phase: "working", title: t("research.activity.importWarehouse.title"), detail: t("research.activity.importWarehouse.detail") };
  if (operation === "create_analysis_scope") return { phase: "working", title: t("research.activity.createScope.title"), detail: t("research.activity.createScope.detail") };
  if (operation === "spatial_query") return { phase: "working", title: t("research.activity.spatialQuery.title"), detail: args.predicate === "nearest" ? t("research.activity.spatialQuery.detailNearest") : t("research.activity.spatialQuery.detailRange") };
  if (operation === "aggregate_by_area") return { phase: "working", title: t("research.activity.aggregateArea.title"), detail: t("research.activity.aggregateArea.detail") };
  if (operation === "route_distance" || operation === "walking_isochrone") return { phase: "working", title: t("research.activity.route.title"), detail: t("research.activity.route.detail") };
  if (operation === "compare_neighborhoods") return { phase: "working", title: t("research.activity.compareNeighborhoods.title"), detail: t("research.activity.compareNeighborhoods.detail") };
  if (operation === "aggregate_records") return { phase: "working", title: t("research.activity.aggregateRecords.title"), detail: t("research.activity.aggregateRecords.detail") };
  if (operation === "join_records") return { phase: "working", title: t("research.activity.joinRecords.title"), detail: t("research.activity.joinRecords.detail") };
  if (operation === "calculate_metric" || operation === "compare_series" || operation === "compare_regions") return { phase: "working", title: t("research.activity.calcMetric.title"), detail: t("research.activity.calcMetric.detail") };
  if (operation === "read_series") return { phase: "working", title: t("research.activity.readSeries.title"), detail: t("research.activity.readSeries.detail") };
  return null;
}

/** Newest first, session-local, bounded; polling cannot duplicate the latest status. */
export function appendActivity(history: Activity[], next: Activity | null): Activity[] {
  if (!next) return [];
  const last = history[0];
  if (last?.phase === next.phase && last.title === next.title && last.detail === next.detail) return history;
  return [next, ...history].slice(0, 6);
}
