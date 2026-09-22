import { describeRegisteredLayer } from "./registeredLayerReader";
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { LAYER_SEARCH_INDEX } from "../lib/layerSearch";
import { RESEARCH_QUERY_EXECUTOR, describeDataset } from "./researchDatasets";
import { searchScore } from "./researchSearch";
import type { DiscoveryContext } from "./discovery";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS } from "./dataContracts";

export function datasetIdsForLayer(layerKey: string): string[] {
  const known = RESEARCH_QUERY_EXECUTOR.descriptors().filter(d => d.layerRefs.includes(layerKey)).map(d => d.datasetId);
  return known.length ? known : describeRegisteredLayer(layerKey) ? [`layer:${layerKey}`] : [];
}
export function assertLayerSourceAccess(layerKey: string, locked: ReadonlySet<string>): void {
  const source = describeRegisteredLayer(layerKey)?.url.replace(/^\.\//, "/");
  if (locked.has(layerKey) || source && [...locked].some(key => describeRegisteredLayer(key)?.url.replace(/^\.\//, "/") === source)) throw new Error("LAYER_DENIED");
}
export function assertDatasetAccess(datasetId: string, locked: ReadonlySet<string>): void {
  let descriptor;
  try { descriptor = describeDataset(datasetId, locked); }
  catch { throw new Error("LAYER_DENIED"); }
  const refs = descriptor.layerRefs;
  refs.forEach(key => assertLayerSourceAccess(key, locked));
  const sourceRefs = refs.map(key => describeRegisteredLayer(key)?.url.replace(/^\.\//, "/")).filter(Boolean);
  if (refs.some(key => locked.has(key)) || [...locked].some(key => { const source = describeRegisteredLayer(key); return source && sourceRefs.includes(source.url.replace(/^\.\//, "/")); })) throw new Error("LAYER_DENIED");
}
export function datasetRecovery(code: string): string {
  const hints: Record<string, string> = {
    DATASET_ASSET_MISSING: "資料端點回傳404或HTML頁面，請修復本地asset或mount後重試；不是零筆，也不要用SPA首頁當GeoJSON。",
    INVALID_DATASET: "來源內容不符合GeoJSON契約；檢查端點內容及來源版本，不要改稱沒有資料。",
    DATASET_UNAVAILABLE: "來源讀取失敗；檢查服務及資產，不要以網路搜尋結果冒充本地分析。",
    LAYER_DENIED: "此資料所連接的圖層被鎖定，不能讀取或用其他操作繞過。",
  };
  return hints[code] ?? "保留錯誤狀態，查閱dataset參數與限制；不要轉成零筆或完整度結論。";
}

/** All layer metadata remains discoverable; only registered readers may touch payloads. */
export async function exploreData(args: { query: string; offset?: number; limit?: number; probe?: boolean }, context: DiscoveryContext,
  read: (datasetId: string) => Promise<Record<string, unknown>>) {
  const { query, offset = 0, limit = 5, probe = false } = args;
  if (typeof query !== "string" || query.length > 200 || !Number.isInteger(offset) || offset < 0 || offset > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 10 || typeof probe !== "boolean") throw new Error("INVALID_INPUT");
  const descriptors = RESEARCH_QUERY_EXECUTOR.descriptors();
  const scored = LAYER_SEARCH_INDEX.map(item => ({ item, score: searchScore(query, `${item.key} ${item.label} ${item.description} ${item.topics.join(" ")} ${item.aliases.join(" ")}`) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key));
  // Group physical sources so six display variants cannot crowd out independent data.
  const grouped = new Map<string, { keys: ManifestKey[]; score: number }>();
  const lockedSources = new Set([...context.locked].flatMap(key => {
    if (!Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, key)) return [];
    return [JSON.stringify(LAYER_MANIFEST[key as ManifestKey].source)];
  }));
  for (const { item, score } of scored) {
    const source = LAYER_MANIFEST[item.key].source;
    const identity = JSON.stringify(source) ?? item.key;
    if (context.locked.has(item.key) || lockedSources.has(identity)) continue;
    const group = grouped.get(identity);
    if (group) group.keys.push(item.key); else grouped.set(identity, { keys: [item.key], score });
  }
  // This optional reader probe is separate from display-first search_layers.
  const groups = [...grouped.values()].sort((a, b) => {
    const readable = (g: typeof a) => descriptors.some(d => d.layerRefs.some(key => g.keys.includes(key as ManifestKey))) ? 1 : 0;
    return readable(b) - readable(a) || b.score - a.score;
  });
  let probes = 0;
  const candidates = [];
  for (const group of groups.slice(offset, offset + limit)) {
    const key = group.keys[0]!; const entry = LAYER_MANIFEST[key];
    const datasets = descriptors.filter(d => d.layerRefs.some(ref => group.keys.includes(ref as ManifestKey)));
    const generic = datasets.length === 0 && describeRegisteredLayer(key);
    if (generic) {
      // Before payload read the field schema and coordinate meaning are deliberately unknown.
      datasets.push({ schemaVersion: "pulse-dataset/0.1", datasetId: `layer:${key}`, label: (entry.section === null ? key : entry.label), description: entry.description, layerRefs: group.keys,
        fields: [], kind: "point", recordGrain: "place", primaryKey: [], geometry: { type: "Point", role: "proxy", crs: "EPSG:4326", precision: "unreviewed; candidate reader must validate payload", spatialAnalysisEligible: false }, timeFields: [], license: "unknown", coverage: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS, versions: [],
        source: { publisher: "unknown", reference: generic.url, lineage: "manifest registration; not yet read" }, access: boundedAccess({ mode: "public", method: "static_asset", fields: [], maxRowsPerQuery: 50, maxScanRows: 20000, maxSourceBytes: 8 * 1024 * 1024, queryEnabled: false }), supportedOperations: ["query_records", "aggregate"], adapterId: "registered-local-geojson-v1" });
    }
    const readers = [];
    for (const descriptor of datasets) {
      const denied = descriptor.layerRefs.some(ref => context.locked.has(ref));
      let payload: Record<string, unknown> = { status: denied ? "denied" : "not_checked" };
      if (probe && !denied && probes < 3) {
        if (!descriptor.timeFields.length && descriptor.kind === "point") {
          probes++;
          try {
            const result = await read(descriptor.datasetId);
            payload = { status: "readable", resultId: result.resultId, totalMatched: result.totalMatched, sample: Array.isArray(result.rows) ? result.rows.slice(0, 2).map(row => Object.fromEntries(Object.entries(row).slice(0, 8).map(([field, value]) => [field, typeof value === "string" ? value.slice(0, 120) : value]))) : [], sourceRefs: result.sourceRefs, freshness: result.freshness, coverage: result.coverage, excludedByReason: result.excludedByReason };
          } catch (error) {
            const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "DATASET_UNAVAILABLE";
            payload = { status: "error", code, recovery: datasetRecovery(code) };
          }
        } else payload = { status: "parameters_or_specialized_reader_required", next: "describe_dataset then query_records with exact source parameters" };
      }
      const resolved = RESEARCH_QUERY_EXECUTOR.describe(descriptor.datasetId) ?? descriptor;
      readers.push({ datasetId: descriptor.datasetId, fieldCount: resolved.fields.length, fieldsTruncated: resolved.fields.length > 16, fields: resolved.fields.slice(0, 16).map(f => ({ name: f.name, type: f.type, unit: f.unit, nullable: f.nullable })), geometry: resolved.geometry, timeFields: descriptor.timeFields, license: descriptor.license, supportedOperations: descriptor.supportedOperations, payload });
    }
    const sources = (Array.isArray(entry.source) ? entry.source : [entry.source]).filter(Boolean).map(source => {
      const raw = source as unknown as Record<string, unknown>;
      return { kind: raw.kind, reference: String(raw.url ?? raw.fallbackUrl ?? raw.note ?? "unknown").slice(0, 500) };
    });
    candidates.push({ layerKeys: group.keys, label: (entry.section === null ? key : entry.label), description: entry.description.slice(0, 500), topics: entry.topics,
      visible: group.keys.some(ref => context.visible.has(ref)), locked: group.keys.some(ref => context.locked.has(ref)), sources,
      catalogStatus: "registered_not_payload_proof", readers, analysisReadiness: readers.length ? "reader_registered_check_payload" : "metadata_only_adapter_required",
      next: readers.length ? "Inspect sample and semantics; select filters and scope before composing analysis." : "Open this registered layer for map exploration. A data reader is only needed for calculations; do not infer zero from its absence." });
  }
  return { query, offset, limit, totalMatched: groups.length, returned: candidates.length, nextOffset: offset + candidates.length < groups.length ? offset + candidates.length : null,
    probes, candidates, workflow: { exploration: ["search_layers", "get_layer_details", "discuss relevant layers", "set_layers / set_camera when requested"], analysis: ["describe_dataset", "query_records with declared scope", "analysis operation", "present_result", "wait_scene_ready"] },
    interpretation: "Vocabulary matches are candidates, not evidence. Use source counts separately; declare scale and assumptions. Resource counts do not establish quality, capacity or walking access." };
}
