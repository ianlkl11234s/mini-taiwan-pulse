import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerSource, type ManifestKey } from "../data/layerManifest";
import { describeRegisteredLayer } from "./registeredLayerReader";
import { registeredDatasetSnapshot } from "./researchDatasets";
import type { DatasetDescriptor } from "./dataContracts";

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
  dataRole: "point" | "admin_statistic" | "unknown";
  datasetIds: readonly string[];
  datasetKinds: readonly string[];
  access: { mode: "public" | "owner_only" | "unknown"; queryEnabled: boolean; requiredParameters: readonly string[] };
  supportedMeasures: readonly string[];
  timeModel: "static_version" | "unknown";
  freshness: "unknown" | "unsupported";
  sourceContract: { licenseStatus: "not_recorded"; publicationStatus: "existing_public_asset_not_a_license_verification" } | null;
  reason: string;
  onboarding: { required: readonly string[]; nextStep: string };
}

function sourceKinds(source: LayerSource | readonly LayerSource[]): string[] {
  return [...new Set((Array.isArray(source) ? source : [source]).map(item => item.kind))].sort();
}

function capabilityFor(key: ManifestKey, datasetsByLayer: ReadonlyMap<string, readonly DatasetDescriptor[]>): LayerCapability {
  const entry = LAYER_MANIFEST[key];
  const kinds = sourceKinds(entry.source);
  const descriptors = datasetsByLayer.get(key) ?? [];
  const queryDescriptor = descriptors.find(descriptor => descriptor.access.query.enabled);
  const ready = Boolean(queryDescriptor);
  const aggregateReady = descriptors.some(descriptor => descriptor.access.query.enabled && descriptor.supportedOperations.includes("aggregate"));
  const onDemand = !ready && describeRegisteredLayer(key) !== null;
  const state: CapabilityState = ready ? "ready" : onDemand ? "on_demand_validation" : "not_registered";
  const requiredParameters = [...new Set(descriptors.flatMap(descriptor => descriptor.parameters?.filter(parameter => parameter.required).map(parameter => parameter.name) ?? []))].sort();
  return {
    layerKey: key,
    label: entry.section === null ? key : entry.label,
    dataClass: entry.dataClass,
    sourceKinds: kinds,
    statistics: aggregateReady ? "ready" : onDemand ? "on_demand_validation" : "not_registered",
    recordSearch: state,
    aggregate: aggregateReady ? "complete_source_asset" : onDemand ? "validated_on_read" : "not_registered",
    dataRole: queryDescriptor?.kind === "point" ? "point" : queryDescriptor?.kind === "admin_statistic" ? "admin_statistic" : "unknown",
    datasetIds: descriptors.map(descriptor => descriptor.datasetId),
    datasetKinds: [...new Set(descriptors.map(descriptor => descriptor.kind))].sort(),
    access: { mode: descriptors.some(descriptor => descriptor.access.mode === "owner_only") ? "owner_only" : descriptors.length ? "public" : "unknown", queryEnabled: descriptors.some(descriptor => descriptor.access.query.enabled), requiredParameters },
    supportedMeasures: aggregateReady || onDemand ? ["count"] : [],
    timeModel: queryDescriptor?.kind === "event" ? "unknown" : ready || onDemand ? "static_version" : "unknown",
    freshness: ready || onDemand ? "unknown" : "unsupported",
    sourceContract: ready ? { licenseStatus: "not_recorded", publicationStatus: "existing_public_asset_not_a_license_verification" } : null,
    reason: ready
      ? queryDescriptor?.kind === "admin_statistic"
        ? "已登記 immutable 統計 release reader；必填 selector 與來源／邊界語意由 descriptor 明示；ready 僅代表分析 reader 就緒，不代表授權已驗證。"
        : aggregateReady
          ? "已登記有界來源 reader、欄位白名單與 aggregate；來源完整度仍以 receipt 為準；ready 僅代表分析 reader 就緒，不代表授權已驗證。"
          : "已登記有界 record reader；未宣告 aggregate，不能因此當成無法讀取；ready 僅代表分析 reader 就緒，不代表授權已驗證。"
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
      ? { required: [], nextStep: aggregateReady ? "可使用已宣告的 record search 與 aggregate；保留 selector 與範圍限制。" : "先 describe dataset 並用必需 selector 查詢；只使用 descriptor 已宣告的操作。" }
      : onDemand
        ? { required: ["實際 source readback", "Point geometry 與 budget 驗證", "runtime receipt"], nextStep: "先呼叫 describe statistics 觸發驗證；失敗即保持 fail-closed。" }
      : { required: ["record grain", "欄位白名單", "有界 reader", "完整來源 aggregate", "來源版本與缺值語意"], nextStep: "完成資料來源契約與驗證後，才可將能力登記為 ready。" },
  };
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Manifest-derived capability index. It describes registration, never guesses a reader from rendering. */
export function listLayerCapabilities(input: { query?: unknown; dataRole?: unknown; measure?: unknown; sourceKind?: unknown; status?: unknown; timeModel?: unknown; offset?: unknown; limit?: unknown } = {}, locked: ReadonlySet<string> = new Set()): Record<string, unknown> {
  if (!input || Object.keys(input).some(key => !["query", "dataRole", "measure", "sourceKind", "status", "timeModel", "offset", "limit"].includes(key))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.query !== undefined && (typeof input.query !== "string" || input.query.length > 120)) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.dataRole !== undefined && !["point", "admin_statistic", "unknown"].includes(String(input.dataRole))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.measure !== undefined && input.measure !== "count") throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.sourceKind !== undefined && !["custom", "geojson", "pmtiles", "supabase"].includes(String(input.sourceKind))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.status !== undefined && !["ready", "on_demand_validation", "not_registered"].includes(String(input.status))) throw new Error("INVALID_CAPABILITY_INPUT");
  if (input.timeModel !== undefined && !["static_version", "unknown"].includes(String(input.timeModel))) throw new Error("INVALID_CAPABILITY_INPUT");
  const query = (input.query ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/臺/g, "台");
  const offset = bounded(input.offset, 0, 0, 10_000);
  const limit = bounded(input.limit, 20, 1, 20);
  const datasetsByLayer = new Map<string, DatasetDescriptor[]>();
  for (const descriptor of registeredDatasetSnapshot()) {
    for (const layerKey of descriptor.layerRefs) {
      const group = datasetsByLayer.get(layerKey);
      if (group) group.push(descriptor); else datasetsByLayer.set(layerKey, [descriptor]);
    }
  }
  const all = MANIFEST_KEYS.filter(key => !locked.has(key)).map(key => capabilityFor(key, datasetsByLayer)).filter(item =>
    (query === "" || `${item.layerKey} ${item.label} ${item.sourceKinds.join(" ")}`.normalize("NFKC").toLocaleLowerCase().replace(/臺/g, "台").includes(query))
    && (input.dataRole === undefined || item.dataRole === input.dataRole)
    && (input.measure === undefined || item.supportedMeasures.includes(String(input.measure)))
    && (input.sourceKind === undefined || item.sourceKinds.includes(String(input.sourceKind)))
    && (input.status === undefined || item.recordSearch === input.status)
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
