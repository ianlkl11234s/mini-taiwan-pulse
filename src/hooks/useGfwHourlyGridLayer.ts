import { useEffect, useRef } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, LineLayer, Map as MapboxMap, SymbolLayer } from "mapbox-gl";
import {
  floorUtcHourIso,
  loadGfwHourlyGridHour,
  loadGfwHourlyGridManifest,
  type GfwHourlyGridManifest,
} from "../data/gfwHourlyGridLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { setGfwHourlyGridDetailContext, setGfwHourlyGridDominantHour } from "../data/gfwHourlyDetailLoader";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { GFW_PMTILES_SOURCE_TYPE, registerGfwPmtilesSourceTypeOnce } from "../map/gfwPmtilesSourceType";
import { showTransientNotice } from "../components/TransientNotice";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  GFW_HOURLY_GRID_V3_FILL_OPACITY,
  GFW_HOURLY_GRID_V4_FILL_COLOR_EXPRESSION,
  GFW_HOURLY_GRID_V4_FILL_COLOR_WITH_DENSITY_EXPRESSION,
  GFW_HOURLY_GRID_V4_OUTLINE_COLOR_WITH_DENSITY_EXPRESSION,
  GFW_HOURLY_GRID_V4_OUTLINE_OPACITY,
  planGfwHourlyGridPlayback,
  type GfwHourlyGridDataWindow,
  type GfwHourlyGridPlaybackPlan,
  type GfwHourlyGridSlotReadiness,
} from "../data/gfwHourlyGridTypes";

export const GFW_HOURLY_GRID_SOURCE_ID = "gfw-hourly-grid-source";
export const GFW_HOURLY_GRID_NEXT_SOURCE_ID = "gfw-hourly-grid-next-source";
export const GFW_HOURLY_GRID_CIRCLE_LAYER_ID = "gfw-hourly-grid-circle";
export const GFW_HOURLY_GRID_COUNT_LAYER_ID = "gfw-hourly-grid-count";
export const GFW_HOURLY_GRID_NEXT_CIRCLE_LAYER_ID = "gfw-hourly-grid-next-circle";
export const GFW_HOURLY_GRID_NEXT_COUNT_LAYER_ID = "gfw-hourly-grid-next-count";
export const GFW_HOURLY_GRID_FILL_LAYER_ID = "gfw-hourly-grid-fill";
export const GFW_HOURLY_GRID_OUTLINE_LAYER_ID = "gfw-hourly-grid-outline";
export const GFW_HOURLY_GRID_NEXT_FILL_LAYER_ID = "gfw-hourly-grid-next-fill";
export const GFW_HOURLY_GRID_NEXT_OUTLINE_LAYER_ID = "gfw-hourly-grid-next-outline";
export const GFW_HOURLY_GRID_HIT_SOURCE_ID = "gfw-hourly-grid-hit-source";
export const GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID = "gfw-hourly-grid-hit-circle";
export const GFW_HOURLY_GRID_HIT_FILL_LAYER_ID = "gfw-hourly-grid-hit-fill";
export const GFW_HOURLY_GRID_PMTILES_SOURCE_ID = "gfw-hourly-grid-pmtiles-source";
export const GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID = "gfw-hourly-grid-pmtiles-next-source";
export const GFW_HOURLY_GRID_PMTILES_PRELOAD_SOURCE_ID = "gfw-hourly-grid-pmtiles-preload-source";
export const GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID = "gfw-hourly-grid-pmtiles-hit-source";
export const GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-fill";
export const GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID = "gfw-hourly-grid-pmtiles-outline";
export const GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-next-fill";
export const GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID = "gfw-hourly-grid-pmtiles-next-outline";
export const GFW_HOURLY_GRID_PMTILES_PRELOAD_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-preload-fill";
export const GFW_HOURLY_GRID_PMTILES_PRELOAD_OUTLINE_LAYER_ID = "gfw-hourly-grid-pmtiles-preload-outline";
export const GFW_HOURLY_GRID_PMTILES_WARM_LAYER_ID = "gfw-hourly-grid-pmtiles-warm";
export const GFW_HOURLY_GRID_PMTILES_NEXT_WARM_LAYER_ID = "gfw-hourly-grid-pmtiles-next-warm";
export const GFW_HOURLY_GRID_PMTILES_PRELOAD_WARM_LAYER_ID = "gfw-hourly-grid-pmtiles-preload-warm";
export const GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-hit-fill";
export const GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-next-hit-fill";
export const GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-preload-hit-fill";
export const GFW_HOURLY_GRID_CLICK_LAYERS = [
  GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID,
  GFW_HOURLY_GRID_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID,
] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** The three retained v4 slots, in the order the rotation prefers to fill them. */
const V4_PMTILES_SLOTS = [
  {
    sourceId: GFW_HOURLY_GRID_PMTILES_SOURCE_ID,
    layerIds: [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID] as const,
    warmLayerId: GFW_HOURLY_GRID_PMTILES_WARM_LAYER_ID,
    hitLayerId: GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID,
  },
  {
    sourceId: GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID,
    layerIds: [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID] as const,
    warmLayerId: GFW_HOURLY_GRID_PMTILES_NEXT_WARM_LAYER_ID,
    hitLayerId: GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID,
  },
  {
    sourceId: GFW_HOURLY_GRID_PMTILES_PRELOAD_SOURCE_ID,
    layerIds: [GFW_HOURLY_GRID_PMTILES_PRELOAD_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_PRELOAD_OUTLINE_LAYER_ID] as const,
    warmLayerId: GFW_HOURLY_GRID_PMTILES_PRELOAD_WARM_LAYER_ID,
    hitLayerId: GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID,
  },
] as const;

/**
 * Which hit layer is allowed to answer a grid click, or null when nothing is on screen.
 *
 * The three v4 hit layers stay permanently `visibility: "visible"`: `visibility` is a
 * tile-parse-time gate (WorkerTile skips hidden layers entirely), so mapbox-gl 3.18.1 must
 * reload the whole source cache on every flip — and these layers share their source with the
 * visual fill layers, so flipping them re-parsed the grid the user is looking at, 1–2× per
 * second at 1800x/3600x. A constant `fill-opacity: 0` never hides a layer from
 * `queryRenderedFeatures`, so selection moves to query time instead: the click handler keeps
 * only features whose layer id matches this, *before* taking `features[0]`.
 *
 * That filter is mandatory, not cosmetic. v4 tiles carry no `observed_at`, so the popup
 * hydrates whatever cell it hits against the dominant hour; letting a feature from another
 * slot through yields a `vessel_count` mismatch and a "驗證失敗" panel where the old
 * visibility gate simply produced no popup.
 */
let dominantHitLayerId: string | null = null;
/**
 * Only v4 routes clicks by dominant hour. v2/v3 keep a dedicated single hit layer that reuses
 * `GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID`, so the filter must stay off for them or the
 * legacy popup would lose every click.
 */
let v4HitSelectionActive = false;

const V4_HIT_LAYER_IDS: ReadonlySet<string> = new Set([
  GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID,
]);

export function getGfwHourlyGridDominantHitLayerId(): string | null {
  return v4HitSelectionActive ? dominantHitLayerId : null;
}

/**
 * Query-time click gate. Keep a queried feature only if its layer may answer for the hour the
 * popup will hydrate against. Applied BEFORE `features[0]` is taken.
 */
export function isGfwHourlyGridDominantHitLayer(layerId: string | undefined): boolean {
  if (!v4HitSelectionActive || layerId === undefined) return !v4HitSelectionActive;
  if (!V4_HIT_LAYER_IDS.has(layerId)) return true;
  return layerId === dominantHitLayerId;
}

export interface GfwHourlyGridDataWindowState {
  readonly status: "in-window" | "out-of-window";
  /** First UTC hour covered by the release. */
  readonly startIso: string;
  /** Exclusive end of the release window. */
  readonly endIsoExclusive: string;
  /** UTC date(s) the release covers, e.g. `2026-08-21` or `2026-08-21 ~ 2026-08-22`. */
  readonly utcDateLabel: string;
}

export interface GfwHourlyGridRuntimeSnapshot {
  readonly visible: boolean;
  readonly desiredHour: string | null;
  readonly renderedHour: string | null;
  readonly holding: boolean;
  readonly holdingDurationMs: number;
  readonly maxHoldingDurationMs: number;
  readonly dataWindowStatus: "in-window" | "out-of-window" | null;
  readonly samples: number;
}

let gridRuntimeSnapshot: GfwHourlyGridRuntimeSnapshot | null = null;

/** Read-only acceptance telemetry; it never drives source rotation or paint. */
export function getGfwHourlyGridRuntimeSnapshot(): GfwHourlyGridRuntimeSnapshot | null {
  return gridRuntimeSnapshot;
}

// Layer-local playback state published for read-only UI (legend). Module scope because the
// grid layer is a singleton; the snapshot object is cached so `useSyncExternalStore` consumers
// do not spin on a fresh object per read.
let dataWindowSnapshot: GfwHourlyGridDataWindowState | null = null;
const dataWindowListeners = new Set<() => void>();

function setGfwHourlyGridDataWindowState(next: GfwHourlyGridDataWindowState | null): void {
  const previous = dataWindowSnapshot;
  if (previous === next) return;
  if (previous && next && previous.status === next.status && previous.startIso === next.startIso
    && previous.endIsoExclusive === next.endIsoExclusive && previous.utcDateLabel === next.utcDateLabel) return;
  dataWindowSnapshot = next;
  for (const listener of dataWindowListeners) listener();
}

export function subscribeGfwHourlyGridDataWindow(listener: () => void): () => void {
  dataWindowListeners.add(listener);
  return () => { dataWindowListeners.delete(listener); };
}

export function getGfwHourlyGridDataWindowSnapshot(): GfwHourlyGridDataWindowState | null {
  return dataWindowSnapshot;
}

function isV4GridManifest(manifest: GfwHourlyGridManifest | null): boolean {
  // schema v4 is the formal immutable PMTiles release contract.
  return manifest?.schemaVersion === 4;
}

function gridDataWindow(manifest: GfwHourlyGridManifest | null): GfwHourlyGridDataWindow | null {
  if (!manifest || manifest.hours.length === 0) return null;
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const hour of manifest.hours) {
    if (!Number.isFinite(hour.observedAtMs)) continue;
    startMs = Math.min(startMs, hour.observedAtMs);
    endMs = Math.max(endMs, hour.observedAtMs);
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMsExclusive: endMs + 3_600_000 };
}

function utcHourIso(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

function applyGridPaint(map: MapboxMap, v4: boolean): void {
  const color: ExpressionSpecification | string = v4
    ? GFW_HOURLY_GRID_V4_FILL_COLOR_EXPRESSION as unknown as ExpressionSpecification
    : "#fb923c";
  // PMTiles slots are deliberately absent: `mountPmtilesSlot` writes their colour once at
  // addLayer time (for v4 that colour also carries the density alpha, which this plain scale
  // would silently drop), and every `fill-color` write on a data-driven property forces a
  // full source-cache relayout.
  for (const id of [
    GFW_HOURLY_GRID_FILL_LAYER_ID,
    GFW_HOURLY_GRID_NEXT_FILL_LAYER_ID,
  ]) {
    if (map.getLayer(id)) map.setPaintProperty(id, "fill-color", color);
  }
}

function dominantHitData(data: GeoJSON.FeatureCollection | null, hour: string | null): GeoJSON.FeatureCollection {
  if (!data || !hour) return EMPTY;
  return {
    type: "FeatureCollection",
    features: data.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, dominant_observed_at: hour },
    })),
  };
}

function ensureLayer(
  map: MapboxMap,
  sourceId: string,
  circleId: string,
  countId: string,
  fillId: string,
  outlineId: string,
): void {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: EMPTY,
      attribution: "Global Fishing Watch",
    });
  }
  // v3 的 inferred footprint 是 Polygon；v2 Point 在這兩層自然不會繪製。
  if (!map.getLayer(fillId)) {
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": "#fb923c", "fill-opacity": GFW_HOURLY_GRID_V3_FILL_OPACITY },
      layout: { visibility: "none" },
    } as FillLayer);
  }
  if (!map.getLayer(outlineId)) {
    map.addLayer({
      id: outlineId,
      type: "line",
      source: sourceId,
      paint: { "line-color": "#7c2d12", "line-width": 1, "line-opacity": 0.85 },
      layout: { visibility: "none" },
    } as LineLayer);
  }
  if (!map.getLayer(circleId)) {
    map.addLayer({
      id: circleId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"],
          ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]],
          1, 5,
          2, 7,
          3, 10,
          5, 14,
          10, 22,
        ],
        "circle-color": "#fb923c",
        "circle-opacity": 0.8,
        "circle-stroke-color": "#7c2d12",
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.9,
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
  if (!map.getLayer(countId)) {
    map.addLayer({
      id: countId,
      type: "symbol",
      source: sourceId,
      layout: {
        visibility: "none",
        "text-field": ["case", [">", ["get", "vessel_count"], 1], ["to-string", ["get", "vessel_count"]], ""],
        "text-size": ["step", ["get", "vessel_count"], 10, 10, 11, 50, 12],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#fff7ed",
        "text-halo-color": "#431407",
        "text-halo-width": 0.8,
        "text-opacity": 0.9,
      },
    } as SymbolLayer);
  }
}

function ensureLayers(map: MapboxMap): void {
  ensureLayer(map, GFW_HOURLY_GRID_SOURCE_ID, GFW_HOURLY_GRID_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_COUNT_LAYER_ID, GFW_HOURLY_GRID_FILL_LAYER_ID, GFW_HOURLY_GRID_OUTLINE_LAYER_ID);
  ensureLayer(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID, GFW_HOURLY_GRID_NEXT_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_NEXT_COUNT_LAYER_ID, GFW_HOURLY_GRID_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_NEXT_OUTLINE_LAYER_ID);
  if (!map.getSource(GFW_HOURLY_GRID_HIT_SOURCE_ID)) {
    map.addSource(GFW_HOURLY_GRID_HIT_SOURCE_ID, { type: "geojson", data: EMPTY });
  }
  // hit source 只有 alpha dominant 那一小時的資料；透明 visual layer 不會讓 H+1 搶 popup。
  if (!map.getLayer(GFW_HOURLY_GRID_HIT_FILL_LAYER_ID)) {
    map.addLayer({ id: GFW_HOURLY_GRID_HIT_FILL_LAYER_ID, type: "fill", source: GFW_HOURLY_GRID_HIT_SOURCE_ID,
      paint: { "fill-opacity": 0 }, layout: { visibility: "none" } } as FillLayer);
  }
  if (!map.getLayer(GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID)) {
    map.addLayer({ id: GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID, type: "circle", source: GFW_HOURLY_GRID_HIT_SOURCE_ID,
      paint: { "circle-radius": 24, "circle-opacity": 0 }, layout: { visibility: "none" } } as CircleLayer);
  }
}

function pmtilesUrl(manifest: GfwHourlyGridManifest, path: string): string {
  return new URL(path, new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost")).toString();
}

function removePmtilesSlot(map: MapboxMap, sourceId: string, layerIds: readonly string[]): void {
  for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function mountPmtilesSlot(
  map: MapboxMap,
  sourceId: string,
  layerIds: readonly [string, string],
  url: string,
  sourceLayer: string,
  v4: boolean,
  hitOnly = false,
  extraLayerIds: readonly string[] = [],
): void {
  // A PMTiles source URL is immutable after addSource. Replacing the slot atomically keeps
  // H/H+1 independent and never asks the browser to download a day GeoJSON fallback.
  removePmtilesSlot(map, sourceId, [...layerIds, ...extraLayerIds]);
  // 正式 v4 與既有 v3 同樣由已註冊的 mapbox-pmtiles SourceType 直接讀 immutable
  // archive；不得再透過 Vite serve-only MVT bridge，local/prod 皆走同一條資料路徑。
  if (v4) registerGfwPmtilesSourceTypeOnce();
  else registerPmtilesSourceTypeOnce();
  map.addSource(sourceId, {
    type: v4 ? GFW_PMTILES_SOURCE_TYPE : PMTILES_SOURCE_TYPE,
    url,
    attribution: "Global Fishing Watch",
  } as never);
  const [fillId, outlineId] = layerIds;
  // Opacity starts at 0 and every later write is a plain number: the density ramp lives in
  // the colour alpha, so mapbox-gl never sees a data-driven opacity and never relayouts on a
  // timeline tick. `applyOpacity` runs synchronously right after mounting, and the warm layer
  // keeps tiles loading regardless of opacity, so 0 costs no visible frame.
  map.addLayer({ id: fillId, type: "fill", source: sourceId, "source-layer": sourceLayer,
    paint: hitOnly ? { "fill-opacity": 0 } : {
      "fill-color": v4 ? GFW_HOURLY_GRID_V4_FILL_COLOR_WITH_DENSITY_EXPRESSION : "#fb923c",
      "fill-opacity": 0,
      // Default 300ms transitions would smear every per-tick opacity write across frames.
      "fill-opacity-transition": { duration: 0, delay: 0 },
    },
    layout: { visibility: "visible" },
  } as FillLayer);
  if (hitOnly) return;
  map.addLayer({ id: outlineId, type: "line", source: sourceId, "source-layer": sourceLayer,
    paint: {
      "line-color": v4 ? GFW_HOURLY_GRID_V4_OUTLINE_COLOR_WITH_DENSITY_EXPRESSION : "#7c2d12",
      "line-width": 1,
      "line-opacity": 0,
      "line-opacity-transition": { duration: 0, delay: 0 },
    },
    layout: { visibility: "visible" },
  } as LineLayer);
}

function addPmtilesWarmLayer(map: MapboxMap, sourceId: string, layerId: string, sourceLayer: string): void {
  map.addLayer({
    id: layerId,
    type: "fill",
    source: sourceId,
    "source-layer": sourceLayer,
    // Data-dependent impossible match: Mapbox must load/decode viewport tiles to evaluate it,
    // but no future-hour feature is painted before its timeline weight becomes non-zero.
    filter: ["==", ["get", "cell_id"], "__gfw_v4_preload_never__"],
    paint: { "fill-opacity": 1 },
    layout: { visibility: "visible" },
  } as FillLayer);
}

function addV4PmtilesHitLayer(map: MapboxMap, sourceId: string, layerId: string, sourceLayer: string): void {
  map.addLayer({
    id: layerId,
    type: "fill",
    source: sourceId,
    "source-layer": sourceLayer,
    // Stays visible for the whole life of the slot — `visibility` is a tile-parse-time gate
    // and flipping it would reload the source the visual fill layers share. A constant
    // `fill-opacity: 0` still answers `queryRenderedFeatures`, so which hour wins a click is
    // decided at query time via `getGfwHourlyGridDominantHitLayerId()`.
    paint: { "fill-opacity": 0 },
    layout: { visibility: "visible" },
  } as FillLayer);
}

function setPmtilesVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [
    GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_PRELOAD_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_PRELOAD_OUTLINE_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_WARM_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_WARM_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_PRELOAD_WARM_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID,
  ]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
}

function setVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [
    GFW_HOURLY_GRID_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_COUNT_LAYER_ID,
    GFW_HOURLY_GRID_NEXT_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_NEXT_COUNT_LAYER_ID,
    GFW_HOURLY_GRID_FILL_LAYER_ID, GFW_HOURLY_GRID_OUTLINE_LAYER_ID,
    GFW_HOURLY_GRID_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_NEXT_OUTLINE_LAYER_ID,
    GFW_HOURLY_GRID_HIT_FILL_LAYER_ID, GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID,
  ]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

function source(map: MapboxMap, id: string): { setData?: (value: GeoJSON.FeatureCollection) => void } | undefined {
  return map.getSource(id) as { setData?: (value: GeoJSON.FeatureCollection) => void } | undefined;
}

export function useGfwHourlyGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.8,
): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const requestedPairRef = useRef<string | null>(null);
  const manifestRef = useRef<GfwHourlyGridManifest | null>(null);
  const currentDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const nextDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const hourDataRef = useRef(new Map<string, GeoJSON.FeatureCollection>());
  const hourPromisesRef = useRef(new Map<string, Promise<GeoJSON.FeatureCollection | null>>());
  const currentHourRef = useRef<string | null>(null);
  const nextHourRef = useRef<string | null>(null);
  const dominantHourRef = useRef<string | null>(null);
  const pmtilesModeRef = useRef(false);
  const pmtilesSlotUrlsRef = useRef(new Map<string, string>());
  const pmtilesSlotHoursRef = useRef(new Map<string, string>());
  const pmtilesPaintKeysRef = useRef(new Map<string, string>());
  // Once a source has supplied its first viewport tile, retain that readiness across
  // pan/zoom. A later transient loading state must not make the current hour dim again.
  const pmtilesSlotReadyRef = useRef(new Map<string, boolean>());
  // Release coverage span, so leaving it can fade the layer out instead of blanking it.
  const dataWindowRef = useRef<GfwHourlyGridDataWindow | null>(null);
  // Timeline drives this hook at fractional-second cadence. Keep opacity outside the
  // lifecycle effect so a paint update cannot tear down/recreate immutable PMTiles sources.
  const opacityRef = useRef(opacity);
  const applyOpacityRef = useRef<(timeSeconds: number) => void>(() => {});
  opacityRef.current = opacity;
  const requestRef = useRef(0);
  const wasVisibleRef = useRef(false);
  const activationRef = useRef(0);
  const noticeActivationRef = useRef(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    let retryPending = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let manifestRefreshStarted = false;
    let holdingSinceMs: number | null = null;
    let maxHoldingDurationMs = 0;
    let runtimeSamples = 0;
    let lastRuntimeDomPublishMs = Number.NEGATIVE_INFINITY;
    const opening = visible && !wasVisibleRef.current;
    if (opening) activationRef.current += 1;
    wasVisibleRef.current = visible;
    const activation = activationRef.current;
    if (opening) {
      manifestRef.current = null;
      setGfwHourlyGridDetailContext(null);
      requestedPairRef.current = null;
      currentDataRef.current = null;
      nextDataRef.current = null;
      hourDataRef.current.clear();
      hourPromisesRef.current.clear();
      currentHourRef.current = null;
      nextHourRef.current = null;
      dominantHourRef.current = null;
      setGfwHourlyGridDominantHour(null);
      dominantHitLayerId = null;
      v4HitSelectionActive = false;
    } else if (manifestRef.current) {
      // Layer visibility/style readiness can re-enter this lifecycle effect. Restore the
      // release context so grid click hydration remains available without refetching it.
      setGfwHourlyGridDetailContext(manifestRef.current);
      setGfwHourlyGridDominantHour(dominantHourRef.current);
    }

    // Guard with getSource(): Mapbox fires an ErrorEvent for unknown source ids, and an
    // unmounted slot must read as NOT loaded (out-of-window ticks probe every slot).
    const isSourceLoaded = (sourceId: string): boolean => {
      const m = map as unknown as {
        getSource?: (id: string) => unknown;
        isSourceLoaded?: (id: string) => boolean;
      };
      if (!m.getSource?.(sourceId)) return false;
      return m.isSourceLoaded?.(sourceId) !== false;
    };

    const pmtilesSlotStates = (): GfwHourlyGridSlotReadiness[] => V4_PMTILES_SLOTS.map(({ sourceId }) => ({
      sourceId,
      hour: pmtilesSlotHoursRef.current.get(sourceId) ?? null,
      ready: pmtilesSlotReadyRef.current.get(sourceId) === true,
      loaded: isSourceLoaded(sourceId),
    }));

    // The window labels never change while a release is mounted; only `status` moves per tick,
    // so keep both published objects allocated once instead of rebuilding them 60×/s.
    let publishedWindow: GfwHourlyGridDataWindow | null = null;
    let windowStates: Record<"in-window" | "out-of-window", GfwHourlyGridDataWindowState> | null = null;

    const publishDataWindowState = (plan: GfwHourlyGridPlaybackPlan) => {
      const window = dataWindowRef.current;
      const manifest = manifestRef.current;
      if (!window || !manifest) {
        publishedWindow = null;
        windowStates = null;
        setGfwHourlyGridDataWindowState(null);
        return;
      }
      if (publishedWindow !== window || !windowStates) {
        const shared = {
          startIso: utcHourIso(window.startMs),
          endIsoExclusive: utcHourIso(window.endMsExclusive),
          utcDateLabel: manifest.dateStart === manifest.dateEndInclusive
            ? manifest.dateStart
            : `${manifest.dateStart} ~ ${manifest.dateEndInclusive}`,
        };
        windowStates = {
          "in-window": { status: "in-window", ...shared },
          "out-of-window": { status: "out-of-window", ...shared },
        };
        publishedWindow = window;
      }
      setGfwHourlyGridDataWindowState(windowStates[plan.dataWindowStatus]);
    };

    /**
     * Publish which hit layer owns the dominant hour. Pure bookkeeping — no map mutation, so
     * a dominant-hour flip during playback costs nothing and can never relayout the grid.
     * A null dominant hour (faded outside the data window) publishes null, which the click
     * handler treats as "no hit" so an invisible grid cannot answer a click.
     */
    const publishDominantHitLayer = (dominantHour: string | null) => {
      const dominant = dominantHour === null ? undefined : V4_PMTILES_SLOTS.find(
        ({ sourceId }) => pmtilesSlotHoursRef.current.get(sourceId) === dominantHour,
      );
      dominantHitLayerId = dominant && map.getLayer(dominant.hitLayerId) ? dominant.hitLayerId : null;
      v4HitSelectionActive = true;
    };

    const clearData = () => {
      currentDataRef.current = null;
      nextDataRef.current = null;
      currentHourRef.current = null;
      nextHourRef.current = null;
      dominantHourRef.current = null;
      dataWindowRef.current = null;
      setGfwHourlyGridDataWindowState(null);
      setGfwHourlyGridDominantHour(null);
      dominantHitLayerId = null;
      v4HitSelectionActive = false;
      source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(EMPTY);
      source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(EMPTY);
      source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(EMPTY);
      pmtilesModeRef.current = false;
      pmtilesSlotUrlsRef.current.clear();
      pmtilesSlotHoursRef.current.clear();
      pmtilesSlotReadyRef.current.clear();
      pmtilesPaintKeysRef.current.clear();
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_WARM_LAYER_ID, GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID]);
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_WARM_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_HIT_FILL_LAYER_ID]);
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_PRELOAD_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_PRELOAD_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_PRELOAD_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_PRELOAD_WARM_LAYER_ID, GFW_HOURLY_GRID_PMTILES_PRELOAD_HIT_FILL_LAYER_ID]);
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID, ""]);
    };

    const mountPmtilesPair = (manifest: GfwHourlyGridManifest, currentHour: string, nextHour: string, timeSeconds: number) => {
      if (!manifest.sourceLayer) return false;
      const current = manifest.hours.find((hour) => hour.observedAt === currentHour && hour.format === "pmtiles");
      const next = manifest.hours.find((hour) => hour.observedAt === nextHour && hour.format === "pmtiles");
      const v4 = isV4GridManifest(manifest);
      // v4 keeps ownership of the timeline even outside the release window: the slots stay
      // mounted so the planner can fade the last covered hour out instead of the layer
      // silently falling back to a day GeoJSON fetch that can never succeed.
      if (!current && !next && !v4) return false;
      pmtilesModeRef.current = true;
      if (v4) {
        const preloadHour = floorUtcHourIso(Date.parse(nextHour) / 1000 + 3600);
        const preload = manifest.hours.find((hour) => hour.observedAt === preloadHour && hour.format === "pmtiles");
        const desiredEntries = [current, next, preload].filter((entry) => entry !== undefined);
        const desired = new Map(desiredEntries.map((entry) => [entry.observedAt, entry]));
        // Same planner as `applyOpacity`, evaluated against the *incoming* hours: if playback
        // overtook loading, the hour it wants to hold on screen must not be recycled here.
        const retainHour = planGfwHourlyGridPlayback({
          timeSeconds,
          slots: pmtilesSlotStates(),
          currentHour: current ? currentHour : null,
          nextHour: next ? nextHour : null,
          dataWindow: dataWindowRef.current,
        }).retainHour;
        const retainedHours = new Set<string>();
        for (const { sourceId } of V4_PMTILES_SLOTS) {
          const hour = pmtilesSlotHoursRef.current.get(sourceId);
          if (hour && (desired.has(hour) || hour === retainHour)) retainedHours.add(hour);
        }
        for (const entry of desired.values()) {
          if (retainedHours.has(entry.observedAt)) continue;
          const vacant = V4_PMTILES_SLOTS.find(({ sourceId }) => {
            const hour = pmtilesSlotHoursRef.current.get(sourceId);
            return hour === undefined || !retainedHours.has(hour);
          });
          if (!vacant) continue;
          const { sourceId, layerIds, warmLayerId, hitLayerId } = vacant;
          const url = pmtilesUrl(manifest, entry.path);
          mountPmtilesSlot(map, sourceId, layerIds, url, manifest.sourceLayer, true, false, [warmLayerId, hitLayerId]);
          addPmtilesWarmLayer(map, sourceId, warmLayerId, manifest.sourceLayer);
          addV4PmtilesHitLayer(map, sourceId, hitLayerId, manifest.sourceLayer);
          pmtilesSlotUrlsRef.current.set(sourceId, url);
          pmtilesSlotHoursRef.current.set(sourceId, entry.observedAt);
          pmtilesSlotReadyRef.current.set(sourceId, false);
          retainedHours.add(entry.observedAt);
        }
        currentDataRef.current = current ? EMPTY : null;
        nextDataRef.current = next ? EMPTY : null;
        currentHourRef.current = current ? currentHour : null;
        nextHourRef.current = next ? nextHour : null;
        return true;
      }
      registerPmtilesSourceTypeOnce();
      const slots: Array<[string, readonly [string, string], typeof current]> = [
        [GFW_HOURLY_GRID_PMTILES_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID], current],
        [GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID], next],
      ];
      for (const [sourceId, layerIds, entry] of slots) {
        const url = entry ? pmtilesUrl(manifest, entry.path) : "";
        if (!entry) {
          removePmtilesSlot(map, sourceId, layerIds);
          pmtilesSlotUrlsRef.current.delete(sourceId);
        } else if (pmtilesSlotUrlsRef.current.get(sourceId) !== url || !map.getSource(sourceId)) {
          mountPmtilesSlot(map, sourceId, layerIds, url, manifest.sourceLayer, false);
          pmtilesSlotUrlsRef.current.set(sourceId, url);
        }
      }
      currentDataRef.current = current ? EMPTY : null;
      nextDataRef.current = next ? EMPTY : null;
      currentHourRef.current = current ? currentHour : null;
      nextHourRef.current = next ? nextHour : null;
      return true;
    };

    const applyOpacity = (timeSeconds: number) => {
      const hourSeconds = Math.floor(timeSeconds / 3600) * 3600;
      const progress = Math.max(0, Math.min(1, (timeSeconds - hourSeconds) / 3600));
      const clampedOpacity = Math.max(0, Math.min(1, opacityRef.current));
      const v4 = isV4GridManifest(manifestRef.current);
      let plan: GfwHourlyGridPlaybackPlan | null = null;
      if (v4) {
        plan = planGfwHourlyGridPlayback({
          timeSeconds,
          slots: pmtilesSlotStates(),
          currentHour: currentHourRef.current,
          nextHour: nextHourRef.current,
          dataWindow: dataWindowRef.current,
        });
        publishDataWindowState(plan);
        const desiredHour = progress >= 0.5 ? nextHourRef.current : currentHourRef.current;
        const renderedHour = plan.dominantHour;
        const holding = renderedHour !== desiredHour;
        const nowMs = performance.now();
        holdingSinceMs = holding ? (holdingSinceMs ?? nowMs) : null;
        const holdingDurationMs = holdingSinceMs === null ? 0 : Math.max(0, nowMs - holdingSinceMs);
        maxHoldingDurationMs = Math.max(maxHoldingDurationMs, holdingDurationMs);
        runtimeSamples += 1;
        gridRuntimeSnapshot = {
          visible,
          desiredHour,
          renderedHour,
          holding,
          holdingDurationMs,
          maxHoldingDurationMs,
          dataWindowStatus: plan.dataWindowStatus,
          samples: runtimeSamples,
        };
        if (import.meta.env.DEV && typeof document !== "undefined" && nowMs - lastRuntimeDomPublishMs >= 250) {
          lastRuntimeDomPublishMs = nowMs;
          document.documentElement.dataset.gfwHourlyGridRuntime = JSON.stringify(gridRuntimeSnapshot);
        }
      }
      // H+1 失敗時 H 必須全亮；H 缺失時才允許 H+1 單獨呈現。
      const currentAvailable = Boolean(currentDataRef.current);
      const nextAvailable = Boolean(nextDataRef.current);
      const currentWeight = currentAvailable ? (nextAvailable ? 1 - progress : 1) : 0;
      const nextWeight = nextAvailable ? (currentAvailable ? progress : 1) : 0;
      if (!v4) {
        for (const [circleId, countId, weight] of [
          [GFW_HOURLY_GRID_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_COUNT_LAYER_ID, currentWeight],
          [GFW_HOURLY_GRID_NEXT_CIRCLE_LAYER_ID, GFW_HOURLY_GRID_NEXT_COUNT_LAYER_ID, nextWeight],
        ] as const) {
          map.setPaintProperty(circleId, "circle-opacity", clampedOpacity * weight);
          map.setPaintProperty(circleId, "circle-stroke-opacity", clampedOpacity * weight);
          map.setPaintProperty(countId, "text-opacity", clampedOpacity * weight);
        }
        for (const [fillId, outlineId, weight] of [
          [GFW_HOURLY_GRID_FILL_LAYER_ID, GFW_HOURLY_GRID_OUTLINE_LAYER_ID, currentWeight],
          [GFW_HOURLY_GRID_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_NEXT_OUTLINE_LAYER_ID, nextWeight],
        ] as const) {
          map.setPaintProperty(fillId, "fill-opacity", GFW_HOURLY_GRID_V3_FILL_OPACITY * clampedOpacity * weight);
          map.setPaintProperty(outlineId, "line-opacity", 0.85 * clampedOpacity * weight);
        }
      }
      for (const { sourceId, layerIds } of V4_PMTILES_SLOTS) {
        const [fillId, outlineId] = layerIds;
        if (!map.getLayer(fillId)) continue;
        const weight = v4
          ? (plan?.weights.get(sourceId) ?? 0)
          : (sourceId === GFW_HOURLY_GRID_PMTILES_SOURCE_ID ? currentWeight : sourceId === GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID ? nextWeight : 0);
        // v4 ships a plain number: the density ramp already sits in the colour alpha, and
        // `colorAlpha * opacity` is exactly the old `opacity * density(vessel_count)`.
        const multiplier = clampedOpacity * weight;
        const fillOpacity = v4 ? multiplier : GFW_HOURLY_GRID_V3_FILL_OPACITY * multiplier;
        const outlineOpacity = (v4 ? GFW_HOURLY_GRID_V4_OUTLINE_OPACITY : 0.85) * multiplier;
        // Quantise the dedup key to 1/255 — the alpha channel it feeds is 8-bit anyway, so
        // finer steps only cost a redundant style write.
        const fillKey = `${v4 ? "v4" : "v3"}:${Math.round(fillOpacity * 255)}`;
        if (pmtilesPaintKeysRef.current.get(`${fillId}:fill`) !== fillKey) {
          map.setPaintProperty(fillId, "fill-opacity", fillOpacity);
          pmtilesPaintKeysRef.current.set(`${fillId}:fill`, fillKey);
        }
        const outlineKey = `${v4 ? "v4" : "v3"}:${Math.round(outlineOpacity * 255)}`;
        if (pmtilesPaintKeysRef.current.get(`${outlineId}:outline`) !== outlineKey) {
          map.setPaintProperty(outlineId, "line-opacity", outlineOpacity);
          pmtilesPaintKeysRef.current.set(`${outlineId}:outline`, outlineKey);
        }
      }
      const useNext = Boolean(nextAvailable && (!currentAvailable || progress >= 0.5));
      const dominantHour = v4 ? (plan?.dominantHour ?? null) : (useNext ? nextHourRef.current : currentHourRef.current);
      if (dominantHour !== dominantHourRef.current) {
        dominantHourRef.current = dominantHour;
        setGfwHourlyGridDominantHour(dominantHour);
        if (v4) {
          // Also covers `dominantHour === null` (faded out of the data window): every hit
          // layer hides, so an invisible grid never answers a click.
          publishDominantHitLayer(dominantHour);
        } else if (pmtilesModeRef.current) {
          const manifest = manifestRef.current;
          const entry = manifest?.hours.find((hour) => hour.observedAt === dominantHour && hour.format === "pmtiles");
          if (manifest?.sourceLayer && entry) {
            mountPmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID,
              [GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID, ""], pmtilesUrl(manifest, entry.path), manifest.sourceLayer, false, true);
            pmtilesSlotUrlsRef.current.set(GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID, entry.path);
          }
        } else source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(
          dominantHitData(useNext ? nextDataRef.current : currentDataRef.current, dominantHour),
        );
      }
    };

    const markPmtilesSlotReady = (event: { sourceId?: string; tile?: unknown }) => {
      if (!isV4GridManifest(manifestRef.current) || !event.sourceId || !pmtilesSlotHoursRef.current.has(event.sourceId)) return;
      // A real tile must have completed. `sourcedata` also fires for source-level metadata
      // /content right after addSource, and at that instant `SourceCache.loaded()` is true
      // purely because zero tiles have been requested yet — accepting it marked a slot ready
      // before it could paint anything, so the crossfade ramped it to full opacity over an
      // empty source (the measured 1182ms / 3558ms blank episodes). Only mapbox's tile-load
      // event carries `tile`; the synthetic metadata/content events never do.
      if (!event.tile) return;
      if (!(map as unknown as { isSourceLoaded?: (sourceId: string) => boolean }).isSourceLoaded?.(event.sourceId)) return;
      if (pmtilesSlotReadyRef.current.get(event.sourceId)) return;
      pmtilesSlotReadyRef.current.set(event.sourceId, true);
      const releasesHold = pmtilesSlotHoursRef.current.get(event.sourceId) === currentHourRef.current;
      applyOpacity(timeStore.getTime());
      if (releasesHold) {
        // The held hour was keeping its slot out of the rotation; now that the current hour
        // paints on its own, re-run the pair so the skipped preload finally mounts. The slot
        // that mounts next never carries the current hour, so this cannot recurse.
        requestedPairRef.current = null;
        void loadHourPair(timeStore.getTime());
      }
    };
    applyOpacityRef.current = applyOpacity;

    const loadHourPair = async (timeSeconds: number) => {
      if (!visible || disposed) return;
      const currentHour = floorUtcHourIso(timeSeconds);
      const nextHour = floorUtcHourIso(timeSeconds + 3600);
      const pairKey = `${currentHour}|${nextHour}`;
      if (requestedPairRef.current === pairKey) {
        applyOpacity(timeSeconds);
        return;
      }
      const manifest = manifestRef.current;
      if (!manifest) {
        clearData();
        return;
      }
      const requestId = ++requestRef.current;
      requestedPairRef.current = pairKey;
      if (mountPmtilesPair(manifest, currentHour, nextHour, timeSeconds)) {
        applyOpacity(timeSeconds);
        return;
      }
      // rollover 時保留已畫出的 H/H+1，避免網路尚未返回時閃白；requestId 阻擋舊 response。
      const cachedCurrent = hourDataRef.current.get(currentHour) ?? null;
      const cachedNext = hourDataRef.current.get(nextHour) ?? null;
      // 正常 rollover 的 H 就是上一組已預載的 H+1：立即升為 H，無須等待新的 H+2。
      if (cachedCurrent || cachedNext) {
        currentDataRef.current = cachedCurrent;
        nextDataRef.current = cachedNext;
        currentHourRef.current = cachedCurrent ? currentHour : null;
        nextHourRef.current = cachedNext ? nextHour : null;
        source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(cachedCurrent ?? EMPTY);
        source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(cachedNext ?? EMPTY);
        applyOpacity(timeSeconds);
      }
      const loadIfMissing = async (hour: string) => {
        const cached = hourDataRef.current.get(hour);
        if (cached) return cached;
        const pending = hourPromisesRef.current.get(hour);
        if (pending) return pending;
        let promise!: Promise<GeoJSON.FeatureCollection | null>;
        promise = loadGfwHourlyGridHour(manifest, hour).then((data) => {
          if (data) hourDataRef.current.set(hour, data);
          if (hourPromisesRef.current.get(hour) === promise) hourPromisesRef.current.delete(hour);
          return data;
        });
        hourPromisesRef.current.set(hour, promise);
        return promise;
      };
      const [current, next] = await Promise.all([loadIfMissing(currentHour), loadIfMissing(nextHour)]);
      if (disposed || requestId !== requestRef.current) return;
      currentDataRef.current = current;
      nextDataRef.current = next;
      currentHourRef.current = current ? currentHour : null;
      nextHourRef.current = next ? nextHour : null;
      source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(current ?? EMPTY);
      source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(next ?? EMPTY);
      applyOpacity(timeStore.getTime());
      if (current || next) {
        keepLoadingUntilMapIdle(map, "gfw-hourly-grid:render", "GFW 小時網格繪製", GFW_HOURLY_GRID_SOURCE_ID);
      }
      // 失敗不負向 cache；小幅退避後以當前時間重新嘗試 H+1，H 仍維持 100%。
      // 資料窗外的「缺 H+1」不是失敗而是預期，重試會永遠空轉 —— 回到窗內時 pairKey 變動自然恢復。
      const outOfWindow = getGfwHourlyGridDataWindowSnapshot()?.status === "out-of-window";
      if (!next && !disposed && !outOfWindow) {
        if (retryTimer !== null) globalThis.clearTimeout(retryTimer);
        retryTimer = globalThis.setTimeout(() => {
          requestedPairRef.current = null;
          void loadHourPair(timeStore.getTime());
        }, 1_000);
      }
    };

    const refreshManifest = async () => {
      manifestRefreshStarted = true;
      const requestId = ++requestRef.current;
      manifestRef.current = null;
      setGfwHourlyGridDetailContext(null);
      requestedPairRef.current = null;
      clearData();
      const manifest = await loadGfwHourlyGridManifest();
      if (disposed || requestId !== requestRef.current) return;
      manifestRef.current = manifest;
      dataWindowRef.current = isV4GridManifest(manifest) ? gridDataWindow(manifest) : null;
      setGfwHourlyGridDetailContext(manifest);
      applyGridPaint(map, isV4GridManifest(manifest));
      if (manifest && visible && activation === activationRef.current && noticeActivationRef.current !== activation) {
        noticeActivationRef.current = activation;
        showTransientNotice(`GFW 小時網格資料最新完整日：${manifest.dateEndInclusive}（UTC，非即時）`);
      }
      await loadHourPair(timeStore.getTime());
    };

    const retry = () => {
      retryPending = false;
      if (!disposed) applyStyle();
    };
    const scheduleRetry = () => {
      if (disposed || retryPending) return;
      retryPending = true;
      map.once("idle", retry);
    };
    const applyStyle = () => {
      try {
        if (!visible) {
          setVisibility(map, false);
          setPmtilesVisibility(map, false);
          return;
        }
        if (!map.isStyleLoaded()) {
          scheduleRetry();
          return;
        }
        ensureLayers(map);
        applyGridPaint(map, isV4GridManifest(manifestRef.current));
        setVisibility(map, true);
        setPmtilesVisibility(map, true);
        // Style restore is not a playback tick: apply immediately, bypassing the throttle.
        if (isV4GridManifest(manifestRef.current)) publishDominantHitLayer(dominantHourRef.current);
        source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(currentDataRef.current ?? EMPTY);
        source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(nextDataRef.current ?? EMPTY);
        source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(
          dominantHitData(
            dominantHourRef.current === nextHourRef.current ? nextDataRef.current : currentDataRef.current,
            dominantHourRef.current,
          ),
        );
        const pmtilesStyleLost = pmtilesModeRef.current
          && [...pmtilesSlotHoursRef.current.keys()].some((sourceId) => !map.getSource(sourceId));
        if (pmtilesStyleLost) {
          pmtilesSlotUrlsRef.current.clear(); // style reload loses custom sources; re-mount below.
          pmtilesSlotHoursRef.current.clear();
          pmtilesSlotReadyRef.current.clear();
          pmtilesPaintKeysRef.current.clear();
          dominantHourRef.current = null;
          setGfwHourlyGridDominantHour(null);
          dominantHitLayerId = null;
          v4HitSelectionActive = false;
          requestedPairRef.current = null;
        }
        applyOpacity(timeStore.getTime());
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) void loadHourPair(timeStore.getTime());
      } catch (error) {
        console.error("[GFW hourly grid] style/apply failed", error);
        scheduleRetry();
      }
    };

    map.on("sourcedata", markPmtilesSlotReady);
    applyStyle();
    map.on("style.load", applyStyle);
    // 網格交叉淡入需要逐 tick 的 fraction；仍走 external time store，不進 React deps。
    const unsubscribe = timeStore.subscribe(loadHourPair);
    return () => {
      disposed = true;
      requestRef.current += 1;
      requestedPairRef.current = null;
      if (retryTimer !== null) globalThis.clearTimeout(retryTimer);
      unsubscribe();
      map.off("style.load", applyStyle);
      map.off("sourcedata", markPmtilesSlotReady);
      if (retryPending) map.off("idle", retry);
      setGfwHourlyGridDetailContext(null);
      setGfwHourlyGridDominantHour(null);
      dominantHitLayerId = null;
      v4HitSelectionActive = false;
      gridRuntimeSnapshot = null;
      if (import.meta.env.DEV && typeof document !== "undefined") {
        delete document.documentElement.dataset.gfwHourlyGridRuntime;
      }
    };
  }, [mapRef, visible, mapTick]);

  // Slider changes only repaint the three retained slots. In particular it must not
  // participate in the source/layer lifecycle effect above.
  useEffect(() => {
    applyOpacityRef.current(timeStore.getTime());
  }, [opacity]);
}
