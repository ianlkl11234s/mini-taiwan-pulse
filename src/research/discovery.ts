import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { LAYER_SEARCH_INDEX } from "../lib/layerSearch";
import { ALL_PRESETS } from "../map/cameraPresets";

export interface DiscoveryContext {
  locked: ReadonlySet<string>;
  visible: ReadonlySet<string>;
}

export type DataReadSupport = "supported" | "unsupported";

export interface LayerDiscovery {
  key: string;
  label: string;
  description: string;
  topics: readonly string[];
  locked: boolean;
  visible: boolean;
  dataReadSupport: DataReadSupport;
}

export interface LayerDescription extends LayerDiscovery {
  source: { kind: string; reference: string | null };
  sourceStatus: string;
  sourceStatusBasis: "manifest_registration_not_live_verification";
  sourceTime: "unknown";
  license: "unknown";
  coverage: "unknown";
}

export interface PlaceCandidate {
  id: string;
  name: string;
  category: string;
  coordinates: { lng: number; lat: number };
  zoom: number | null;
}

const DEFAULT_CONTEXT: DiscoveryContext = { locked: new Set(), visible: new Set() };

/** Deliberately small first pilot: it is an actual readable asset, not a claim about every visible layer. */
export function dataReadSupport(layerKey: string): DataReadSupport {
  return layerKey === "schools" ? "supported" : "unsupported";
}

function asDiscovery(key: ManifestKey, context: DiscoveryContext): LayerDiscovery {
  const entry = LAYER_MANIFEST[key];
  return {
    key,
    label: entry.section === null ? key : entry.label,
    description: entry.description,
    topics: [...entry.topics],
    locked: context.locked.has(key),
    visible: context.visible.has(key),
    dataReadSupport: dataReadSupport(key),
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
  query: string; offset: number; limit: number; totalMatched: number; returned: number; truncated: boolean; layers: LayerDiscovery[];
} {
  const safeOffset = bounded(offset, 0, 0, 10_000);
  const safeLimit = bounded(limit, 20, 1, 20);
  const terms = normalize(query).split(" ").filter(Boolean);
  const matched = LAYER_SEARCH_INDEX
    .filter(item => terms.every(term => [item.key, item.label, item.description, item.topics.join(" "), item.aliases.join(" ")].some(value => normalize(value).includes(term))))
    .map(item => asDiscovery(item.key, context))
    .sort((a, b) => a.key.localeCompare(b.key));
  const layers = matched.slice(safeOffset, safeOffset + safeLimit);
  return { query, offset: safeOffset, limit: safeLimit, totalMatched: matched.length, returned: layers.length, truncated: safeOffset + layers.length < matched.length, layers };
}

function sourceReference(key: ManifestKey): { kind: string; reference: string | null } {
  const source = LAYER_MANIFEST[key].source;
  const first = Array.isArray(source) ? source[0] : source;
  if (!first) return { kind: "unknown", reference: null };
  if (first.kind === "custom") return { kind: first.kind, reference: first.note };
  return { kind: first.kind, reference: "url" in first ? first.url : first.fallbackUrl };
}

export function describeLayer(layerKey: string, context: DiscoveryContext = DEFAULT_CONTEXT): LayerDescription | null {
  if (!Object.prototype.hasOwnProperty.call(LAYER_MANIFEST, layerKey)) return null;
  const key = layerKey as ManifestKey;
  const entry = LAYER_MANIFEST[key];
  return { ...asDiscovery(key, context), source: sourceReference(key), sourceStatus: entry.upstream.status, sourceStatusBasis: "manifest_registration_not_live_verification", sourceTime: "unknown", license: "unknown", coverage: "unknown" };
}

/** Camera presets are local named viewpoints only; no geocoder is consulted. */
export function findPlaces(query: string, limit = 10): { query: string; totalMatched: number; returned: number; candidates: PlaceCandidate[] } {
  const needle = normalize(query);
  const safeLimit = bounded(limit, 10, 1, 10);
  const candidates = needle === "" ? [] : ALL_PRESETS
    .filter(preset => normalize(`${preset.id} ${preset.name} ${preset.description ?? ""}`).includes(needle))
    .filter((preset): preset is typeof preset & { center: [number, number] } => Array.isArray(preset.center) && preset.center.length === 2)
    .map(preset => ({ id: preset.id, name: preset.name, category: preset.category, coordinates: { lng: preset.center[0], lat: preset.center[1] }, zoom: preset.zoom ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { query, totalMatched: candidates.length, returned: Math.min(candidates.length, safeLimit), candidates: candidates.slice(0, safeLimit) };
}
