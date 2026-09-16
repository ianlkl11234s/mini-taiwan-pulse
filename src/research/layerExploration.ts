import { fetchDataCatalogForLayer, type DataCatalogEntry } from "../data/dataCatalogLoader";
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { withLoading } from "../lib/loadingRegistry";
import { describeDataset } from "./researchDatasets";
import { dataReadSupport, describeLayer, type DiscoveryContext } from "./discovery";

const MAX_KEYS = 3;
const MAX_CATALOG_ENTRIES = 2;
const MAX_RELATED = 4;
const MAX_TEXT = 320;
const CATALOG_TIMEOUT_MS = 7_000;
const PAYLOAD_LIMIT_BYTES = 24 * 1024;

export interface LayerExplorationDependencies {
  fetchCatalog?: (key: ManifestKey) => Promise<readonly DataCatalogEntry[]>;
}

type ExternalLink = { label: string; url: string };
function text(value: unknown, limit = MAX_TEXT): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
}
function httpUrl(value: unknown): string | null {
  const candidate = text(value, 600); return candidate && /^https?:\/\//i.test(candidate) ? candidate : null;
}
function label(key: ManifestKey): string { const entry = LAYER_MANIFEST[key]; return entry.section === null ? key : entry.label; }
function sourceIdentity(key: ManifestKey): string { return JSON.stringify(LAYER_MANIFEST[key].source); }
function upstreamOf(key: ManifestKey) {
  return LAYER_MANIFEST[key].upstream as { derivedFromLayers?: readonly string[] };
}

function relatedLayers(key: ManifestKey, context: DiscoveryContext) {
  const entry = LAYER_MANIFEST[key];
  const related: Array<{ key: string; label: string; reason: "same_source" | "derived_lineage" | "same_group" | "shared_topic"; locked: boolean; visible: boolean }> = [];
  for (const candidate of Object.keys(LAYER_MANIFEST) as ManifestKey[]) {
    if (candidate === key || LAYER_MANIFEST[candidate].section === null) continue;
    const candidateEntry = LAYER_MANIFEST[candidate];
    const derived = upstreamOf(key).derivedFromLayers ?? [];
    const candidateDerived = upstreamOf(candidate).derivedFromLayers ?? [];
    const reason = sourceIdentity(candidate) === sourceIdentity(key) ? "same_source"
      : derived.includes(candidate) || candidateDerived.includes(key) ? "derived_lineage"
      : entry.section && candidateEntry.section && entry.section.group === candidateEntry.section.group ? "same_group"
      : candidateEntry.topics.some(topic => entry.topics.includes(topic)) ? "shared_topic" : null;
    if (!reason) continue;
    related.push({ key: candidate, label: label(candidate), reason, locked: context.locked.has(candidate), visible: context.visible.has(candidate) });
  }
  const order = { same_source: 0, derived_lineage: 1, same_group: 2, shared_topic: 3 };
  return related.sort((a, b) => order[a.reason] - order[b.reason] || a.label.localeCompare(b.label) || a.key.localeCompare(b.key)).slice(0, MAX_RELATED);
}

function catalogEntry(entry: DataCatalogEntry): { datasetId: string; provider: string | null; title: string | null; summary: string | null; sourceUrl: string | null; license: string | null; updateFrequency: string | null; lastUpdated: string | null; catalogMdPath: string | null; externalLinks: ExternalLink[]; metadataTrust: "untrusted" } {
  const sourceUrl = httpUrl(entry.sourceUrl);
  return {
    datasetId: text(entry.datasetId, 120) ?? "unknown", provider: text(entry.providerAgency), title: text(entry.title), summary: text(entry.summary), sourceUrl,
    license: text(entry.license), updateFrequency: text(entry.updateFrequency, 120), lastUpdated: text(entry.lastUpdated, 120), catalogMdPath: text(entry.catalogMdPath, 240),
    externalLinks: sourceUrl ? [{ label: "來源網站", url: sourceUrl }] : [], metadataTrust: "untrusted",
  };
}

async function within<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })]); }
  catch { return null; } finally { if (timer) clearTimeout(timer); }
}

function fieldSummary(key: ManifestKey) {
  const known = [] as Array<{ basis: "analysis_dataset_descriptor_not_layer_payload"; datasetId: string; fields: { name: string; type: string; nullable: boolean; unit: string | null }[]; fieldsTruncated: boolean }>;
  const ids = describeLayer(key)?.datasetIds ?? [];
  for (const datasetId of ids) try {
    const descriptor = describeDataset(datasetId);
    known.push({ basis: "analysis_dataset_descriptor_not_layer_payload", datasetId, fields: descriptor.fields.slice(0, 12).map(field => ({ name: field.name, type: field.type, nullable: field.nullable, unit: field.unit })), fieldsTruncated: descriptor.fields.length > 12 });
  } catch { /* Generic, unmaterialized sources intentionally have no guessed schema. */ }
  return known;
}

/** Bounded metadata view. Catalog rows are advisory metadata, never payload evidence. */
export async function describeLayers(keys: string[], context: DiscoveryContext, dependencies: LayerExplorationDependencies = {}) {
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > MAX_KEYS || keys.some(key => typeof key !== "string")) throw new Error("INVALID_LAYER_DETAILS_INPUT");
  const unique = [...new Set(keys)].slice(0, MAX_KEYS);
  const valid = unique.filter(key => Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, key)) as ManifestKey[];
  const fetchCatalog = dependencies.fetchCatalog ?? fetchDataCatalogForLayer;
  const details = await withLoading("research:layer-details", "整理圖層資料來源", Promise.all(valid.map(async key => {
    const description = describeLayer(key, context)!;
    const catalog = await within(Promise.resolve(fetchCatalog(key)), CATALOG_TIMEOUT_MS);
    const catalogEntries = catalog?.slice(0, MAX_CATALOG_ENTRIES).map(catalogEntry) ?? [];
    return {
      key, label: description.label, description: text(description.description, 500), locked: description.locked, visible: description.visible,
      displayCapability: description.displayCapability, readerCapability: dataReadSupport(key),
      theme: description.theme, group: description.group, manifestSources: description.manifestSources.map(source => ({ kind: text(source.kind, 60) ?? "unknown", reference: text(source.reference, 420) })),
      upstream: { status: text(description.upstream.status, 80) ?? "unknown", datasets: description.upstream.datasets.slice(0, 6).map(dataset => ({ datasetId: text(dataset.datasetId, 120) ?? "unknown", confidence: text(dataset.confidence, 40) ?? "unknown" })), note: text(description.upstream.note), processing: text(description.upstream.processing), derivedFromLayers: description.upstream.derivedFromLayers.slice(0, 8).map(item => text(item, 120)).filter((item): item is string => item !== null) },
      metadataBasis: description.metadataBasis, fieldSummary: fieldSummary(key), relatedLayers: relatedLayers(key, context),
      catalog: { status: catalogEntries.length ? "entries" : "no_entries_or_unavailable", entries: catalogEntries, metadataTrust: "untrusted" as const },
    };
  })));
  const output = { requested: unique, returned: details.length, missingKeys: unique.filter(key => !valid.includes(key as ManifestKey)), layers: details, payloadBoundBytes: PAYLOAD_LIMIT_BYTES, metadataTrust: "untrusted" as const };
  if (new TextEncoder().encode(JSON.stringify(output)).byteLength > PAYLOAD_LIMIT_BYTES) throw new Error("LAYER_DETAILS_PAYLOAD_LIMIT_EXCEEDED");
  return output;
}
