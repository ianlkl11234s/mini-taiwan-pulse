import { useEffect, useRef } from "react";
import type { CircleLayer, FillLayer, LineLayer, Map as MapboxMap, SymbolLayer } from "mapbox-gl";
import {
  floorUtcHourIso,
  loadGfwHourlyGridHour,
  loadGfwHourlyGridManifest,
  type GfwHourlyGridManifest,
} from "../data/gfwHourlyGridLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { setGfwHourlyGridDetailContext } from "../data/gfwHourlyDetailLoader";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { showTransientNotice } from "../components/TransientNotice";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

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
export const GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID = "gfw-hourly-grid-pmtiles-hit-source";
export const GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-fill";
export const GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID = "gfw-hourly-grid-pmtiles-outline";
export const GFW_HOURLY_GRID_PMTILES_COUNT_LAYER_ID = "gfw-hourly-grid-pmtiles-count";
export const GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-next-fill";
export const GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID = "gfw-hourly-grid-pmtiles-next-outline";
export const GFW_HOURLY_GRID_PMTILES_NEXT_COUNT_LAYER_ID = "gfw-hourly-grid-pmtiles-next-count";
export const GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID = "gfw-hourly-grid-pmtiles-hit-fill";
export const GFW_HOURLY_GRID_CLICK_LAYERS = [
  GFW_HOURLY_GRID_HIT_CIRCLE_LAYER_ID,
  GFW_HOURLY_GRID_HIT_FILL_LAYER_ID,
  GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID,
] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

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
      paint: { "fill-color": "#fb923c", "fill-opacity": 0.24 },
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
  layerIds: readonly [string, string, string],
  url: string,
  sourceLayer: string,
  hitOnly = false,
): void {
  // A PMTiles source URL is immutable after addSource. Replacing the slot atomically keeps
  // H/H+1 independent and never asks the browser to download a day GeoJSON fallback.
  removePmtilesSlot(map, sourceId, layerIds);
  map.addSource(sourceId, { type: PMTILES_SOURCE_TYPE, url, attribution: "Global Fishing Watch" } as never);
  const [fillId, outlineId, countId] = layerIds;
  map.addLayer({ id: fillId, type: "fill", source: sourceId, "source-layer": sourceLayer,
    paint: hitOnly ? { "fill-opacity": 0 } : { "fill-color": "#fb923c", "fill-opacity": 0.24 },
    layout: { visibility: "visible" },
  } as FillLayer);
  if (hitOnly) return;
  map.addLayer({ id: outlineId, type: "line", source: sourceId, "source-layer": sourceLayer,
    paint: { "line-color": "#7c2d12", "line-width": 1, "line-opacity": 0.85 }, layout: { visibility: "visible" },
  } as LineLayer);
  map.addLayer({ id: countId, type: "symbol", source: sourceId, "source-layer": sourceLayer,
    layout: { visibility: "visible", "text-field": ["case", [">", ["get", "vessel_count"], 1], ["to-string", ["get", "vessel_count"]], ""],
      "text-size": 11, "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": "#fff7ed", "text-halo-color": "#431407", "text-halo-width": 0.8, "text-opacity": 0.9 },
  } as SymbolLayer);
}

function setPmtilesVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [
    GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_COUNT_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_COUNT_LAYER_ID,
    GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID,
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
    }

    const clearData = () => {
      currentDataRef.current = null;
      nextDataRef.current = null;
      currentHourRef.current = null;
      nextHourRef.current = null;
      dominantHourRef.current = null;
      source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(EMPTY);
      source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(EMPTY);
      source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(EMPTY);
      pmtilesModeRef.current = false;
      pmtilesSlotUrlsRef.current.clear();
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_COUNT_LAYER_ID]);
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_COUNT_LAYER_ID]);
      removePmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID, "", ""]);
    };

    const mountPmtilesPair = (manifest: GfwHourlyGridManifest, currentHour: string, nextHour: string) => {
      if (!manifest.sourceLayer) return false;
      const current = manifest.hours.find((hour) => hour.observedAt === currentHour && hour.format === "pmtiles");
      const next = manifest.hours.find((hour) => hour.observedAt === nextHour && hour.format === "pmtiles");
      if (!current && !next) return false;
      registerPmtilesSourceTypeOnce();
      pmtilesModeRef.current = true;
      const slots: Array<[string, readonly [string, string, string], typeof current]> = [
        [GFW_HOURLY_GRID_PMTILES_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_COUNT_LAYER_ID], current],
        [GFW_HOURLY_GRID_PMTILES_NEXT_SOURCE_ID, [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_COUNT_LAYER_ID], next],
      ];
      for (const [sourceId, layerIds, entry] of slots) {
        const url = entry ? pmtilesUrl(manifest, entry.path) : "";
        if (!entry) {
          removePmtilesSlot(map, sourceId, layerIds);
          pmtilesSlotUrlsRef.current.delete(sourceId);
        } else if (pmtilesSlotUrlsRef.current.get(sourceId) !== url || !map.getSource(sourceId)) {
          mountPmtilesSlot(map, sourceId, layerIds, url, manifest.sourceLayer);
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
      const clampedOpacity = Math.max(0, Math.min(1, opacity));
      // H+1 失敗時 H 必須全亮；H 缺失時才允許 H+1 單獨呈現。
      const currentWeight = currentDataRef.current ? (nextDataRef.current ? 1 - progress : 1) : 0;
      const nextWeight = nextDataRef.current ? (currentDataRef.current ? progress : 1) : 0;
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
        map.setPaintProperty(fillId, "fill-opacity", 0.24 * clampedOpacity * weight);
        map.setPaintProperty(outlineId, "line-opacity", 0.85 * clampedOpacity * weight);
      }
      for (const [fillId, outlineId, countId, weight] of [
        [GFW_HOURLY_GRID_PMTILES_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_COUNT_LAYER_ID, currentWeight],
        [GFW_HOURLY_GRID_PMTILES_NEXT_FILL_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_OUTLINE_LAYER_ID, GFW_HOURLY_GRID_PMTILES_NEXT_COUNT_LAYER_ID, nextWeight],
      ] as const) {
        if (!map.getLayer(fillId)) continue;
        map.setPaintProperty(fillId, "fill-opacity", 0.24 * clampedOpacity * weight);
        map.setPaintProperty(outlineId, "line-opacity", 0.85 * clampedOpacity * weight);
        map.setPaintProperty(countId, "text-opacity", clampedOpacity * weight);
      }
      const useNext = Boolean(nextDataRef.current && (!currentDataRef.current || progress >= 0.5));
      const dominantHour = useNext ? nextHourRef.current : currentHourRef.current;
      if (dominantHour !== dominantHourRef.current) {
        dominantHourRef.current = dominantHour;
        if (pmtilesModeRef.current) {
          const manifest = manifestRef.current;
          const entry = manifest?.hours.find((hour) => hour.observedAt === dominantHour && hour.format === "pmtiles");
          if (manifest?.sourceLayer && entry) {
            mountPmtilesSlot(map, GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID,
              [GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID, "", ""], pmtilesUrl(manifest, entry.path), manifest.sourceLayer, true);
            pmtilesSlotUrlsRef.current.set(GFW_HOURLY_GRID_PMTILES_HIT_SOURCE_ID, entry.path);
          }
        } else source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(
          dominantHitData(useNext ? nextDataRef.current : currentDataRef.current, dominantHour),
        );
      }
    };

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
      if (mountPmtilesPair(manifest, currentHour, nextHour)) {
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
      if (!next && !disposed) {
        // 失敗不負向 cache；小幅退避後以當前時間重新嘗試 H+1，H 仍維持 100%。
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
      setGfwHourlyGridDetailContext(manifest);
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
          return;
        }
        if (!map.isStyleLoaded()) {
          scheduleRetry();
          return;
        }
        ensureLayers(map);
        setVisibility(map, true);
        setPmtilesVisibility(map, true);
        source(map, GFW_HOURLY_GRID_SOURCE_ID)?.setData?.(currentDataRef.current ?? EMPTY);
        source(map, GFW_HOURLY_GRID_NEXT_SOURCE_ID)?.setData?.(nextDataRef.current ?? EMPTY);
        source(map, GFW_HOURLY_GRID_HIT_SOURCE_ID)?.setData?.(
          dominantHitData(
            dominantHourRef.current === nextHourRef.current ? nextDataRef.current : currentDataRef.current,
            dominantHourRef.current,
          ),
        );
        if (pmtilesModeRef.current) {
          pmtilesSlotUrlsRef.current.clear(); // style reload loses custom sources; re-mount below.
          requestedPairRef.current = null;
        }
        applyOpacity(timeStore.getTime());
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) void loadHourPair(timeStore.getTime());
      } catch {
        scheduleRetry();
      }
    };

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
      if (retryPending) map.off("idle", retry);
      setGfwHourlyGridDetailContext(null);
    };
  }, [mapRef, visible, opacity, mapTick]);
}
