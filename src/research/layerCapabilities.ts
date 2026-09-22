import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerSource, type ManifestKey } from "../data/layerManifest";

type CapabilityState = "ready" | "not_registered";
type AggregateState = "complete_source_asset" | "not_registered";

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
  sourceContract: { licenseStatus: "not_recorded"; publicationStatus: "existing_public_asset_not_a_license_verification" } | null;
  reason: string;
  onboarding: { required: readonly string[]; nextStep: string };
}

const FULL_SOURCE_STATISTICS = new Set(["schools", "policeStation"]);

function sourceKinds(source: LayerSource | readonly LayerSource[]): string[] {
  return [...new Set((Array.isArray(source) ? source : [source]).map(item => item.kind))].sort();
}

function capabilityFor(key: ManifestKey): LayerCapability {
  const entry = LAYER_MANIFEST[key];
  const ready = FULL_SOURCE_STATISTICS.has(key);
  const kinds = sourceKinds(entry.source);
  return {
    layerKey: key,
    label: entry.section === null ? key : entry.label,
    dataClass: entry.dataClass,
    sourceKinds: kinds,
    statistics: ready ? "ready" : "not_registered",
    recordSearch: ready ? "ready" : "not_registered",
    aggregate: ready ? "complete_source_asset" : "not_registered",
    dataRole: ready ? "point" : "unknown",
    supportedMeasures: ready ? ["count"] : [],
    timeModel: ready ? "static_version" : "unknown",
    freshness: ready ? "unknown" : "unsupported",
    sourceContract: ready ? { licenseStatus: "not_recorded", publicationStatus: "existing_public_asset_not_a_license_verification" } : null,
    reason: ready
      ? "已驗證完整 GeoJSON 資產、欄位白名單與來源紀錄粒度；ready 僅代表分析 reader 就緒，不代表授權已驗證。"
      : kinds.includes("pmtiles")
        ? "PMTiles 僅按視窗載入；尚未登記同版完整來源 aggregate，因此不可由畫面 tile 計數或搜尋全部紀錄。"
        : kinds.includes("supabase")
          ? "動態來源尚未登記有界查詢與完整來源 aggregate。"
          : kinds.includes("custom")
            ? "custom loader 尚未提供統一、已驗證的 record reader 或 aggregate。"
            : "尚未登記已驗證的 record reader、欄位白名單與完整來源 aggregate。",
    onboarding: ready
      ? { required: [], nextStep: "已可使用統計與 record search。" }
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
  if (input.status !== undefined && !["ready", "not_registered"].includes(String(input.status))) throw new Error("INVALID_CAPABILITY_INPUT");
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
