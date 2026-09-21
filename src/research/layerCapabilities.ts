import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerSource, type ManifestKey } from "../data/layerManifest";
import { registeredDatasetForLayer } from "./researchDatasets";

type CapabilityState = "ready" | "on_demand_validation" | "not_registered";
type AggregateState = "complete_source_asset" | "validated_on_read" | "not_registered";

export interface LayerCapability {
  layerKey: string;
  label: string;
  dataClass: string;
  sourceKinds: string[];
  statistics: CapabilityState;
  recordSearch: CapabilityState;
  aggregate: AggregateState;
  /** Source semantic role only; never inferred from the Mapbox render primitive. */
  dataRole: "point" | "unknown";
  supportedMeasures: readonly string[];
  timeModel: "static_version" | "unknown";
  freshness: "unknown" | "unsupported";
  reason: string;
  onboarding: { required: readonly string[]; nextStep: string };
}

const FULL_SOURCE_STATISTICS = new Set(["schools", "policeStation"]);

function sourceKinds(source: LayerSource | readonly LayerSource[]): string[] {
  return [...new Set((Array.isArray(source) ? source : [source]).map(item => item.kind))].sort();
}

function capabilityFor(key: ManifestKey): LayerCapability {
  const entry = LAYER_MANIFEST[key];
  const kinds = sourceKinds(entry.source);
  const descriptor = registeredDatasetForLayer(key);
  const ready = FULL_SOURCE_STATISTICS.has(key) || Boolean(descriptor?.supportedOperations.includes("aggregate") && descriptor.access.query.enabled && descriptor.access.method === "static_asset");
  const onDemand = !ready && !Array.isArray(entry.source) && entry.source.kind === "geojson";
  const state: CapabilityState = ready ? "ready" : onDemand ? "on_demand_validation" : "not_registered";
  return {
    layerKey: key,
    label: entry.section === null ? key : entry.label,
    dataClass: entry.dataClass,
    sourceKinds: kinds,
    statistics: state,
    recordSearch: state,
    aggregate: ready ? "complete_source_asset" : onDemand ? "validated_on_read" : "not_registered",
    dataRole: ready ? "point" : "unknown",
    supportedMeasures: ready || onDemand ? ["count"] : [],
    timeModel: ready || onDemand ? "static_version" : "unknown",
    freshness: ready || onDemand ? "unknown" : "unsupported",
    reason: ready
      ? "已驗證完整 GeoJSON 資產、欄位白名單與來源紀錄粒度。"
      : onDemand
        ? "單一 same-origin GeoJSON 候選；只有實際 readback 通過 bytes/rows/Point geometry/receipt 驗證後，才可對該快照計數。"
      : kinds.includes("pmtiles")
        ? "PMTiles 僅按視窗載入；尚未登記同版完整來源 aggregate，因此不可由畫面 tile 計數或搜尋全部紀錄。"
        : kinds.includes("supabase")
          ? "動態來源尚未登記有界查詢與完整來源 aggregate。"
          : kinds.includes("custom")
            ? "custom loader 尚未提供統一、已驗證的 record reader 或 aggregate。"
            : "尚未登記已驗證的 record reader、欄位白名單與完整來源 aggregate。",
    onboarding: ready
      ? { required: [], nextStep: "已可使用統計與 record search。" }
      : onDemand
        ? { required: ["實際 source readback", "Point geometry 與 budget 驗證", "runtime receipt"], nextStep: "先呼叫 describe statistics 觸發驗證；失敗即保持 fail-closed。" }
      : { required: ["record grain", "欄位白名單", "有界 reader", "完整來源 aggregate", "來源版本與缺值語意"], nextStep: "完成資料來源契約與驗證後，才可將能力登記為 ready。" },
  };
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Manifest-derived capability index. It describes registration, never guesses a reader from rendering. */
export function listLayerCapabilities(input: { query?: unknown; dataRole?: unknown; measure?: unknown; sourceKind?: unknown; status?: unknown; timeModel?: unknown; offset?: unknown; limit?: unknown } = {}): Record<string, unknown> {
  if (!input || Object.keys(input).some(key => !["query", "dataRole", "measure", "sourceKind", "status", "timeModel", "offset", "limit"].includes(key))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.query !== undefined && (typeof input.query !== "string" || input.query.length > 120)) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.dataRole !== undefined && !["point", "unknown"].includes(String(input.dataRole))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.measure !== undefined && input.measure !== "count") throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.sourceKind !== undefined && !["custom", "geojson", "pmtiles", "supabase"].includes(String(input.sourceKind))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.status !== undefined && !["ready", "on_demand_validation", "not_registered"].includes(String(input.status))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.timeModel !== undefined && !["static_version", "unknown"].includes(String(input.timeModel))) throw new Error("INVALID_CAPABILITY_INPUT");
  const query = (input.query ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/臺/g, "台");
  const offset = bounded(input.offset, 0, 0, 10_000);
  const limit = bounded(input.limit, 20, 1, 20);
  const all = MANIFEST_KEYS.map(capabilityFor).filter(item =>
    (query === "" || `${item.layerKey} ${item.label} ${item.sourceKinds.join(" ")}`.normalize("NFKC").toLocaleLowerCase().replace(/臺/g, "台").includes(query))
    && (input.dataRole === undefined || item.dataRole === input.dataRole)
    && (input.measure === undefined || item.supportedMeasures.includes(String(input.measure)))
    && (input.sourceKind === undefined || item.sourceKinds.includes(String(input.sourceKind)))
    && (input.status === undefined || item.statistics === input.status)
    && (input.timeModel === undefined || item.timeModel === input.timeModel));
  const layers = all.slice(offset, offset + limit);
  const truncated = offset + layers.length < all.length;
  return {
    schemaVersion: "pulse-layer-capabilities/1",
    scope: "所有已登記 manifest layer；能力是 browser reader/aggregate 登記狀態，不是前端 render type 或目前畫面可見性。",
    query: input.query ?? "", filters: { dataRole: input.dataRole ?? null, measure: input.measure ?? null, sourceKind: input.sourceKind ?? null, status: input.status ?? null, timeModel: input.timeModel ?? null },
    offset, limit, totalMatched: all.length, returned: layers.length, truncated,
    nextOffset: truncated ? offset + layers.length : null,
    layers,
  };
}
