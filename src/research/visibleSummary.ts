import { LAYER_MANIFEST, type LayerSource } from "../data/layerManifest";
import { layerDataProviderFor, type DataRanked, type LayerDataProvider } from "./layerDataSummary";

/**
 * AG-1 (SPEC-prod-connect §2.7): a bounded "what is drawn in the viewport" digest for
 * `map_context`. Counts only rendered features — never infers data readiness, never
 * reverse-geocodes, never guesses a value field.
 */
export type VisibleSummaryStyleLayer = {
  id: string;
  type: string;
  source?: unknown;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};
export type VisibleSummaryFeature = {
  id?: string | number;
  source?: string;
  sourceLayer?: string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};
type LngLatBoundsLike = { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
/** Minimal map surface so the algorithm stays testable without Mapbox. */
export type VisibleSummaryMap = {
  getBounds(): LngLatBoundsLike | null;
  getStyle(): { layers?: VisibleSummaryStyleLayer[] } | null | undefined;
  getLayer(id: string): unknown;
  queryRenderedFeatures(options: { layers: string[] }): VisibleSummaryFeature[];
};

export type VisibleSummaryArea = { level: "town" | "county"; field: string; items: { name: string; count: number }[] };
export type VisibleSummaryMax = { field: string; value: number; name: string | null; lngLat: [number, number] | null };
export type VisibleSummaryLayer =
  | { layerKey: string; label: string; status: "ok"; featureCount: number; capped: boolean; topAreas: VisibleSummaryArea | null; max: VisibleSummaryMax | null }
  /** Custom-rendered layer digested from the hook's in-memory rows (see layerDataSummary.ts). */
  | { layerKey: string; label: string; basis: "layer_data"; status: "ok"; featureCount: number; capped: boolean; topAreas: VisibleSummaryArea | null; max: (VisibleSummaryMax & { at?: string }) | null; ranked?: DataRanked; asOf?: string | null; note?: string }
  | { layerKey: string; label: string; basis: "layer_data"; status: "data_not_loaded"; note: string }
  | { layerKey: string; label: string; basis: "layer_data"; status: "not_applicable"; reason: "raster"; seeLayerKey: string; note: string }
  | { layerKey: string; status: "not_applicable"; reason: "custom_renderer" | "raster" | "no_style_layer" }
  | { layerKey: string; label: string; status: "no_rendered_features" | "skipped_budget" };
export type VisibleSummary = { basis: "rendered_viewport"; note: string; truncated: boolean; layers: VisibleSummaryLayer[] };

export const VISIBLE_SUMMARY_MAX_LAYERS = 10;
export const VISIBLE_SUMMARY_MAX_FEATURES = 5000;
export const VISIBLE_SUMMARY_BUDGET_MS = 150;
const NOTE = "只統計目前畫面範圍內已畫出的圖徵；圖磚未載完時可能偏少。自繪圖層（basis: layer_data）改用網頁已載入的圖層資料統計";
const TOWN_FIELDS = ["TOWNNAME", "townname", "town", "town_name", "鄉鎮市區", "TOWN"];
const COUNTY_FIELDS = ["COUNTYNAME", "countyname", "county", "county_name", "縣市", "COUNTY"];
const NAME_FIELDS = ["name", "名稱", "title", "NAME", "station_name"];
const PAINT_ORDER = ["circle-radius", "circle-color", "fill-color", "fill-extrusion-height", "heatmap-weight", "line-width", "line-color", "icon-size"];
const SUMMARIZABLE_KINDS = new Set(["geojson", "pmtiles", "supabase"]);
const MAX_TEXT = 60;
const DATA_NOT_LOADED_NOTE = "圖層資料還在載入（或此時段沒有資料），幾秒後再讀一次";
/**
 * Manifest-`custom` layers whose hook still draws plain Mapbox GeoJSON style layers
 * (no Three.js), so the rendered-feature path can read them by their self-built source id.
 */
const CUSTOM_RENDERED_SOURCES: Record<string, string[]> = { rainGauge: ["rain-gauge"] };

type SourcesFor = (layerKey: string) => LayerSource[] | null;
export type VisibleSummaryOptions = { labelFor?: (layerKey: string) => string; sourcesFor?: SourcesFor; dataProviderFor?: (layerKey: string) => LayerDataProvider | null; now?: () => number };

function manifestSources(layerKey: string): LayerSource[] | null {
  const entry = (LAYER_MANIFEST as Record<string, { source: LayerSource | LayerSource[] } | undefined>)[layerKey];
  if (!entry) return null;
  return Array.isArray(entry.source) ? entry.source : [entry.source];
}

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;
export function viewportBounds(map: Pick<VisibleSummaryMap, "getBounds">): [number, number, number, number] | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const out: [number, number, number, number] = [round5(bounds.getWest()), round5(bounds.getSouth()), round5(bounds.getEast()), round5(bounds.getNorth())];
  return out.every(Number.isFinite) ? out : null;
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function firstPosition(value: unknown, depth = 0): [number, number] | null {
  if (!Array.isArray(value) || depth > 4) return null;
  if (typeof value[0] === "number" && typeof value[1] === "number") return Number.isFinite(value[0]) && Number.isFinite(value[1]) ? [round5(value[0]), round5(value[1])] : null;
  return value.length ? firstPosition(value[0], depth + 1) : null;
}

/** Recursively finds the first `["get", field]` (data-driven) inside a paint expression. */
export function firstGetField(expression: unknown, depth = 0): string | null {
  if (!Array.isArray(expression) || depth > 16) return null;
  if (expression[0] === "get" && typeof expression[1] === "string" && expression.length === 2) return expression[1];
  for (const part of expression) {
    const found = firstGetField(part, depth + 1);
    if (found) return found;
  }
  return null;
}

function valueField(layers: readonly VisibleSummaryStyleLayer[]): string | null {
  for (const layer of layers) {
    for (const property of PAINT_ORDER) {
      const found = firstGetField(layer.paint?.[property]);
      if (found) return found;
    }
  }
  return null;
}

function dedupeKey(feature: VisibleSummaryFeature): string {
  const head = `${feature.source ?? ""}|${feature.sourceLayer ?? ""}|`;
  if (feature.id !== undefined && feature.id !== null) return `${head}${String(feature.id)}`;
  let properties = "";
  try { properties = JSON.stringify(feature.properties ?? {}); } catch { properties = ""; }
  return `${head}@${JSON.stringify(firstPosition(feature.geometry?.coordinates))}#${properties}`;
}

function areaSummary(features: readonly VisibleSummaryFeature[]): VisibleSummaryArea | null {
  const pick = (fields: readonly string[]) => fields.find(field => features.filter(feature => text(feature.properties?.[field]) !== null).length * 2 >= features.length);
  const town = pick(TOWN_FIELDS);
  const county = town ? undefined : pick(COUNTY_FIELDS);
  const field = town ?? county;
  if (!field) return null;
  const counts = new Map<string, number>();
  for (const feature of features) {
    const name = text(feature.properties?.[field]);
    if (name !== null) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const items = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
  return { level: town ? "town" : "county", field, items };
}

function maxSummary(features: readonly VisibleSummaryFeature[], field: string | null): VisibleSummaryMax | null {
  if (!field) return null;
  let best: VisibleSummaryFeature | null = null;
  let bestValue = -Infinity;
  for (const feature of features) {
    const value = feature.properties?.[field];
    if (typeof value === "number" && Number.isFinite(value) && value > bestValue) { bestValue = value; best = feature; }
  }
  if (!best) return null;
  const name = NAME_FIELDS.map(key => text(best!.properties?.[key])).find(value => value !== null) ?? null;
  return { field, value: bestValue, name, lngLat: firstPosition(best.geometry?.coordinates) };
}

function styleSourceId(layer: VisibleSummaryStyleLayer): string | null { return typeof layer.source === "string" ? layer.source : null; }

/** Pure per-layer digest of the rendered viewport; bounded in layers, features and time. */
export function summarizeVisibleLayers(map: VisibleSummaryMap, visibleLayerKeys: readonly string[], options: VisibleSummaryOptions = {}): VisibleSummary {
  const now = options.now ?? (() => performance.now());
  const sourcesFor = options.sourcesFor ?? manifestSources;
  const labelFor = options.labelFor ?? ((key: string) => key);
  const dataProviderFor = options.dataProviderFor ?? layerDataProviderFor;
  const started = now();
  let bounds: [number, number, number, number] | null = null;
  try { bounds = viewportBounds(map); } catch { bounds = null; }
  const keys = visibleLayerKeys.slice(0, VISIBLE_SUMMARY_MAX_LAYERS);
  let styleLayers: VisibleSummaryStyleLayer[] = [];
  try { styleLayers = map.getStyle()?.layers ?? []; } catch { styleLayers = []; }
  const layers: VisibleSummaryLayer[] = [];
  for (const layerKey of keys) {
    const label = labelFor(layerKey).slice(0, 120);
    if (now() - started > VISIBLE_SUMMARY_BUDGET_MS) { layers.push({ layerKey, label, status: "skipped_budget" }); continue; }
    const sources = sourcesFor(layerKey) ?? [];
    const sourceIds = new Set([...sources.flatMap(source => SUMMARIZABLE_KINDS.has(source.kind) && "sourceId" in source ? [source.sourceId] : []), ...(CUSTOM_RENDERED_SOURCES[layerKey] ?? [])]);
    if (!sourceIds.size) {
      // Custom renderers are invisible to queryRenderedFeatures; use the layer's own rows when it registered a provider.
      const provider = bounds ? dataProviderFor(layerKey) : null;
      let digest: ReturnType<LayerDataProvider> | null = null;
      try { digest = provider ? provider(bounds!) : null; } catch { digest = null; }
      if (!digest) layers.push({ layerKey, status: "not_applicable", reason: "custom_renderer" });
      else if (digest.status === "data_not_loaded") layers.push({ layerKey, label, basis: "layer_data", status: "data_not_loaded", note: DATA_NOT_LOADED_NOTE });
      else layers.push({ layerKey, label, basis: "layer_data", ...digest });
      continue;
    }
    const candidates = styleLayers.filter(layer => {
      const sourceId = styleSourceId(layer);
      return sourceId !== null && sourceIds.has(sourceId) && layer.layout?.visibility !== "none" && map.getLayer(layer.id) !== undefined;
    });
    if (!candidates.length) { layers.push({ layerKey, status: "not_applicable", reason: "no_style_layer" }); continue; }
    const vector = candidates.filter(layer => layer.type !== "raster" && layer.type !== "hillshade");
    if (!vector.length) { layers.push({ layerKey, status: "not_applicable", reason: "raster" }); continue; }
    let raw: VisibleSummaryFeature[] = [];
    try { raw = map.queryRenderedFeatures({ layers: vector.map(layer => layer.id) }); } catch { raw = []; }
    const capped = raw.length > VISIBLE_SUMMARY_MAX_FEATURES;
    const seen = new Set<string>();
    const features: VisibleSummaryFeature[] = [];
    for (const feature of capped ? raw.slice(0, VISIBLE_SUMMARY_MAX_FEATURES) : raw) {
      const key = dedupeKey(feature);
      if (seen.has(key)) continue;
      seen.add(key); features.push(feature);
    }
    if (!features.length) { layers.push({ layerKey, label, status: "no_rendered_features" }); continue; }
    layers.push({ layerKey, label, status: "ok", featureCount: features.length, capped, topAreas: areaSummary(features), max: maxSummary(features, valueField(vector)) });
  }
  return { basis: "rendered_viewport", note: NOTE, truncated: visibleLayerKeys.length > VISIBLE_SUMMARY_MAX_LAYERS, layers };
}

export const SUMMARY_LOADED_WAIT_MS = 6_000;
export const SUMMARY_LOADED_POLL_MS = 250;

/**
 * Agents have no sleep tool, so two back-to-back map_context reads land in the same instant.
 * Recompute until no layer reports data_not_loaded, or the budget runs out (then the last summary is returned as-is).
 */
export async function summarizeWhenLoaded(
  compute: () => VisibleSummary,
  budgetMs: number = SUMMARY_LOADED_WAIT_MS,
  pollMs: number = SUMMARY_LOADED_POLL_MS,
  isCurrent: () => boolean = () => true,
): Promise<VisibleSummary> {
  const pending = (v: VisibleSummary) => v.layers.some(layer => layer.status === "data_not_loaded");
  let summary = compute();
  const deadline = Date.now() + budgetMs;
  while (pending(summary) && isCurrent()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(pollMs, remaining)));
    summary = compute();
  }
  return summary;
}
