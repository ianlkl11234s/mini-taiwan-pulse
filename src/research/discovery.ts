import { searchScore } from "./researchSearch";
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { LAYER_SEARCH_INDEX } from "../lib/layerSearch";
import { ALL_PRESETS } from "../map/cameraPresets";

export interface DiscoveryContext {
  locked: ReadonlySet<string>;
  visible: ReadonlySet<string>;
}

export type DataReadSupport = "not_provided_in_first_phase";

export interface LayerDiscovery {
  key: string;
  label: string;
  description: string;
  topics: readonly string[];
  locked: boolean;
  visible: boolean;
  dataReadSupport: DataReadSupport;
  /** Display registration is a separate claim from whether a payload reader exists. */
  displayCapability: { canOpen: boolean; basis: "manifest_registration" };
  datasetIds: readonly string[];
}

export interface LayerDescription extends LayerDiscovery {
  source: { kind: string; reference: string | null };
  sourceStatus: string;
  sourceStatusBasis: "manifest_registration_not_live_verification";
  sourceTime: "unknown";
  license: "unknown";
  coverage: "unknown";
  manifestSources: readonly { kind: string; reference: string | null }[];
  upstream: { status: string; datasets: readonly { datasetId: string; confidence: string }[]; note: string | null; processing: string | null; derivedFromLayers: readonly string[] };
  theme: string | null;
  group: string | null;
  metadataBasis: "manifest_registration_not_live_verification";
}

export interface PlaceCandidate {
  id: string;
  name: string;
  category: string;
  coordinates: { lng: number; lat: number };
  zoom: number | null;
}

const DEFAULT_CONTEXT: DiscoveryContext = { locked: new Set(), visible: new Set() };

/** This phase describes map registrations only; it never claims payload-reader support. */
export function dataReadSupport(layerKey: string): DataReadSupport {
  void layerKey;
  return "not_provided_in_first_phase";
}

function asDiscovery(key: ManifestKey, context: DiscoveryContext): LayerDiscovery {
  const entry = LAYER_MANIFEST[key];
  const locked = context.locked.has(key);
  return {
    key,
    label: entry.section === null ? key : entry.label,
    description: entry.description,
    topics: [...entry.topics],
    locked,
    visible: context.visible.has(key),
    dataReadSupport: dataReadSupport(key),
    displayCapability: { canOpen: entry.section !== null && !locked, basis: "manifest_registration" },
    datasetIds: [],
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/臺/g, "台").replace(/[\s_\-/.]+/g, " ").trim();
}

function bounded(value: number, fallback: number, min: number, max: number): number {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Search uses the existing manifest-derived index; it does not grow a second catalog. */
export function discoverLayers(query: string, offset = 0, limit = 20, context: DiscoveryContext = DEFAULT_CONTEXT): {
  query: string; offset: number; limit: number; totalMatched: number; returned: number; truncated: boolean; nextOffset: number | null; layers: LayerDiscovery[];
} {
  const safeOffset = bounded(offset, 0, 0, 10_000);
  const safeLimit = bounded(limit, 20, 1, 20);
  const matched = LAYER_SEARCH_INDEX
    .filter(item => !context.locked.has(item.key))
    .map(item => ({ item, score: searchScore(query, `${item.key} ${item.label}`) * 3 + searchScore(query, `${item.description} ${item.topics.join(" ")} ${item.aliases.join(" ")} ${item.source}`) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key))
    .map(({ item }) => asDiscovery(item.key, context));
  const layers = matched.slice(safeOffset, safeOffset + safeLimit);
  const truncated = safeOffset + layers.length < matched.length;
  return { query, offset: safeOffset, limit: safeLimit, totalMatched: matched.length, returned: layers.length, truncated, nextOffset: truncated ? safeOffset + layers.length : null, layers };
}

function sourceReference(key: ManifestKey): { kind: string; reference: string | null } {
  const source = LAYER_MANIFEST[key].source;
  const first = Array.isArray(source) ? source[0] : source;
  if (!first) return { kind: "unknown", reference: null };
  if (first.kind === "custom") return { kind: first.kind, reference: first.note };
  return { kind: first.kind, reference: "url" in first ? first.url : first.fallbackUrl };
}

function allSources(key: ManifestKey): { kind: string; reference: string | null }[] {
  const source = LAYER_MANIFEST[key].source;
  return (Array.isArray(source) ? source : [source]).map(item => item.kind === "custom"
    ? { kind: item.kind, reference: item.note }
    : { kind: item.kind, reference: "url" in item ? item.url : item.fallbackUrl });
}

export function describeLayer(layerKey: string, context: DiscoveryContext = DEFAULT_CONTEXT): LayerDescription | null {
  if (!Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, layerKey)) return null;
  const key = layerKey as ManifestKey;
  if (context.locked.has(key)) return null;
  const entry = LAYER_MANIFEST[key];
  const upstream = entry.upstream as { status: string; datasets?: readonly { datasetId: string; confidence: string }[]; note?: string; processing?: string; derivedFromLayers?: readonly string[] };
  return {
    ...asDiscovery(key, context), source: sourceReference(key), manifestSources: allSources(key), sourceStatus: entry.upstream.status,
    sourceStatusBasis: "manifest_registration_not_live_verification", metadataBasis: "manifest_registration_not_live_verification", sourceTime: "unknown", license: "unknown", coverage: "unknown",
    upstream: { status: upstream.status, datasets: upstream.datasets ?? [], note: upstream.note ?? null, processing: upstream.processing ?? null, derivedFromLayers: upstream.derivedFromLayers ?? [] },
    theme: entry.section?.theme ?? null, group: entry.section?.group ?? null,
  };
}

/** Camera presets are local named viewpoints only; no geocoder is consulted. */
export function findPlaces(query: string, limit = 10): { query: string; totalMatched: number; returned: number; candidates: PlaceCandidate[] } {
  const needle = normalize(query);
  const compactNeedle = needle.replace(/ /g, "");
  const safeLimit = bounded(limit, 10, 1, 10);
  const candidates = needle === "" ? [] : ALL_PRESETS
    .filter((preset) => {
      const haystack = normalize(`${preset.id} ${preset.name} ${preset.description ?? ""}`);
      return haystack.includes(needle) || haystack.replace(/ /g, "").includes(compactNeedle);
    })
    .filter((preset): preset is typeof preset & { center: [number, number] } => Array.isArray(preset.center) && preset.center.length === 2)
    .map(preset => ({ id: preset.id, name: preset.name, category: preset.category, coordinates: { lng: preset.center[0], lat: preset.center[1] }, zoom: preset.zoom ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { query, totalMatched: candidates.length, returned: Math.min(candidates.length, safeLimit), candidates: candidates.slice(0, safeLimit) };
}
