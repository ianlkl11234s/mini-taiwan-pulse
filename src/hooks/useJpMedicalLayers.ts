import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, FilterSpecification, Map as MapboxMap, SymbolLayer } from "mapbox-gl";
import {
  JP_MEDICAL_AREA_LEVELS,
  JP_MEDICAL_CARE_GROUPS,
  JP_MEDICAL_CATEGORIES,
  type JpMedicalAreaKey,
  type JpMedicalCareKey,
  type JpMedicalCategoryKey,
} from "../data/jpMedicalTypes";
import { fetchJpMedicalAggregate, getJpMedicalRuntime, jpMedicalLayerAsset, reportJpMedicalError, subscribeJpMedicalRuntime, type JpMedicalAggregate } from "../data/jpMedicalLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";

type JpMedicalLayerKey = JpMedicalCategoryKey | JpMedicalCareKey | JpMedicalAreaKey;

export type JpMedicalVisibility = Record<JpMedicalLayerKey, boolean>;
export type JpMedicalParams = Record<string, number>;

export const JP_MEDICAL_FACILITY_LAYER_IDS = [
  "jp-medical-facilities-hospital", "jp-medical-facilities-clinic", "jp-medical-facilities-dental",
  "jp-medical-facilities-maternity", "jp-medical-facilities-pharmacy",
] as const;
export const JP_MEDICAL_CARE_LAYER_IDS = [
  "jp-medical-care-jpCarePlanning", "jp-medical-care-jpCareHomeVisit", "jp-medical-care-jpCareDayServices",
  "jp-medical-care-jpCareResidential", "jp-medical-care-jpCareCombined", "jp-medical-care-jpCareEquipment",
] as const;
export const JP_MEDICAL_AREA_LAYER_IDS = [
  "jp-medical-areas-1-fill", "jp-medical-areas-2-fill", "jp-medical-areas-3-fill",
] as const;
const JP_MEDICAL_FACILITY_AGGREGATE_LAYER_IDS = ["jp-medical-facilities-aggregate-circle", "jp-medical-facilities-aggregate-count"] as const;
const JP_MEDICAL_CARE_AGGREGATE_LAYER_IDS = ["jp-medical-care-aggregate-circle", "jp-medical-care-aggregate-count"] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const pointRadius = (large: number): ExpressionSpecification => [
  "interpolate", ["linear"], ["zoom"], 0, 0.65, 6, 0.9, 10, 1.8, 14, large,
] as unknown as ExpressionSpecification;
const LOW_ZOOM_CUTOFF = 8;
const MAX_MAP_ZOOM = 24;

function useMapZoom(mapRef: React.RefObject<MapboxMap | null>, active: boolean) {
  const tick = useMapReadyTick(mapRef, active);
  const [zoom, setZoom] = useState(() => mapRef.current?.getZoom() ?? 0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend", update);
    return () => { map.off("zoomend", update); };
  }, [active, mapRef, tick]);
  return zoom;
}

function removeMapLayers(map: MapboxMap, layerIds: readonly string[], sourceId: string) {
  layerIds.forEach((layerId) => { if (map.getLayer(layerId)) map.removeLayer(layerId); });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function aggregateOpacity(definitions: readonly PointLayerDefinition[], visibility: JpMedicalVisibility, params: JpMedicalParams) {
  return Math.max(0, ...definitions.filter(({ key }) => visibility[key]).map(({ key }) => clamp(params[`${key}Opacity`] ?? 0.78)));
}

interface PointLayerDefinition {
  key: JpMedicalCategoryKey | JpMedicalCareKey;
  layerId: string;
  color: string;
  filter: FilterSpecification;
  aggregateMatches: (properties: Record<string, unknown>) => boolean;
}

function geometryCenter(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] | null {
  const flat = geometry.coordinates.flat(Infinity) as unknown[];
  const numbers = flat.filter((value): value is number => typeof value === "number");
  if (numbers.length < 4 || numbers.length % 2) return null;
  let west = Infinity; let east = -Infinity; let south = Infinity; let north = -Infinity;
  for (let i = 0; i < numbers.length; i += 2) { west = Math.min(west, numbers[i]!); east = Math.max(east, numbers[i]!); south = Math.min(south, numbers[i + 1]!); north = Math.max(north, numbers[i + 1]!); }
  return Number.isFinite(west + east + south + north) ? [(west + east) / 2, (south + north) / 2] : null;
}

/** 將相同 z6 格網的可見分類相加，點位是 polygon bbox center，從不宣稱為設施座標。 */
export function jpMedicalAggregateCenters(
  aggregate: JpMedicalAggregate,
  definitions: readonly PointLayerDefinition[],
  visibility: JpMedicalVisibility,
  countField: "mapped_point_count" | "mapped_service_registration_count",
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const cells = new Map<string, { center: [number, number]; count: number }>();
  for (const feature of aggregate.features) {
    const properties = feature.properties as Record<string, unknown>;
    if (!properties || typeof properties.grid_id !== "string" || typeof properties[countField] !== "number") continue;
    const definition = definitions.find((item) => visibility[item.key] && item.aggregateMatches(properties));
    const center = geometryCenter(feature.geometry);
    if (!definition || !center) continue;
    const cell = cells.get(properties.grid_id);
    if (cell) cell.count += properties[countField];
    else cells.set(properties.grid_id, { center, count: properties[countField] });
  }
  return { type: "FeatureCollection", features: [...cells.entries()].map(([gridId, cell]) => ({
    type: "Feature", geometry: { type: "Point", coordinates: cell.center },
    properties: { grid_id: gridId, grid_zoom: 6, aggregate_count: cell.count, geometry_role: "GRID_BBOX_CENTER" },
  })) };
}

function usePointFamily(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  assetId: "navii_facilities" | "h17_services",
  sourceId: string,
  layerIds: readonly string[],
  definitions: readonly PointLayerDefinition[],
  radius: number,
) {
  const active = definitions.some(({ key }) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime);
  const revision = runtime.revision ?? 0;
  const zoom = useMapZoom(mapRef, active);
  const pointsEnabled = active && (runtime.displayMode === "points" || zoom >= LOW_ZOOM_CUTOFF);
  const [asset, setAsset] = useState<{ url: string; sourceLayer: string; minzoom: number; revision: number } | null>(null);
  const mountedIdentity = useRef<string | null>(null);

  useEffect(() => () => {
    const map = mapRef.current;
    if (map) removeMapLayers(map, layerIds, sourceId);
  }, [layerIds, mapRef, sourceId]);

  useEffect(() => {
    if (!pointsEnabled || asset?.revision === revision) return;
    let cancelled = false;
    jpMedicalLayerAsset(assetId).then(({ url, asset: item }) => {
      if (!cancelled) setAsset({ url, sourceLayer: item.source_layer, minzoom: item.minimum_point_zoom ?? 10, revision });
    }).catch((error) => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [asset?.revision, assetId, pointsEnabled, revision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pointsEnabled || !asset || asset.revision !== revision) {
      removeMapLayers(map, layerIds, sourceId);
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      const identity = `${asset.url}:${asset.revision}`;
      if (mountedIdentity.current && mountedIdentity.current !== identity) {
        removeMapLayers(map, layerIds, sourceId);
      }
      const added = !map.getSource(sourceId);
      if (added) map.addSource(sourceId, {
        type: PMTILES_SOURCE_TYPE,
        url: asset.url,
        maxzoom: 14,
      } as any);
      definitions.forEach(({ key, layerId, color, filter }) => {
        if (!map.getLayer(layerId)) map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          "source-layer": asset.sourceLayer,
          minzoom: runtime.displayMode === "points" ? asset.minzoom : LOW_ZOOM_CUTOFF,
          layout: { visibility: "none" },
          paint: {
            "circle-radius": pointRadius(radius),
            "circle-color": color,
            "circle-opacity": clamp(params[`${key}Opacity`] ?? 0.78),
            "circle-stroke-color": "rgba(15,23,42,.5)",
            "circle-stroke-width": 0.3,
          },
          filter,
        } as CircleLayer);
        map.setLayerZoomRange(layerId, runtime.displayMode === "points" ? asset.minzoom : LOW_ZOOM_CUTOFF, MAX_MAP_ZOOM);
        map.setLayoutProperty(layerId, "visibility", visibility[key] ? "visible" : "none");
        map.setPaintProperty(layerId, "circle-opacity", clamp(params[`${key}Opacity`] ?? 0.78));
      });
      mountedIdentity.current = identity;
      if (added) keepLoadingUntilMapIdle(map, `${sourceId}:render`, "醫療點位載入中", sourceId);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId === sourceId) reportJpMedicalError(event.error ?? new Error("醫療瓦片載入失敗"));
    };
    mount();
    map.on("style.load", mount);
    map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [mapRef, asset, definitions, layerIds, params, pointsEnabled, radius, revision, runtime.displayMode, sourceId, tick, visibility]);
}

function useAggregateFamily(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  assetId: "navii_facilities" | "h17_services",
  sourceId: string,
  layerIds: readonly string[],
  definitions: readonly PointLayerDefinition[],
) {
  const active = definitions.some(({ key }) => visibility[key]);
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime);
  const revision = runtime.revision ?? 0;
  const zoom = useMapZoom(mapRef, active);
  const enabled = active && runtime.displayMode !== "points" && zoom < LOW_ZOOM_CUTOFF;
  const tick = useMapReadyTick(mapRef, enabled);
  const [data, setData] = useState<{ value: JpMedicalAggregate; revision: number } | null>(null);

  useEffect(() => () => {
    const map = mapRef.current;
    if (map) removeMapLayers(map, layerIds, sourceId);
  }, [layerIds, mapRef, sourceId]);

  useEffect(() => {
    if (!enabled || data?.revision === revision) return;
    let cancelled = false;
    fetchJpMedicalAggregate(assetId).then((value) => {
      if (!cancelled) setData({ value, revision });
    }).catch((error) => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [assetId, data?.revision, enabled, revision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!enabled || !data || data.revision !== revision) {
      removeMapLayers(map, layerIds, sourceId);
      return;
    }
    const mount = () => {
      const countField = assetId === "navii_facilities" ? "mapped_point_count" : "mapped_service_registration_count";
      const centers = jpMedicalAggregateCenters(data.value, definitions, visibility, countField);
      const opacity = aggregateOpacity(definitions, visibility, params);
      const source = map.getSource(sourceId) as { setData?: (value: GeoJSON.FeatureCollection<GeoJSON.Point>) => void } | undefined;
      if (!source) map.addSource(sourceId, { type: "geojson", data: centers });
      else source.setData?.(centers);
      if (!map.getLayer(layerIds[0]!)) map.addLayer({ id: layerIds[0]!, type: "circle", source: sourceId, maxzoom: LOW_ZOOM_CUTOFF,
        paint: { "circle-color": assetId === "navii_facilities" ? "#fb7185" : "#38bdf8", "circle-opacity": opacity, "circle-stroke-color": "rgba(15,23,42,.75)", "circle-stroke-width": 1,
          "circle-radius": ["interpolate", ["linear"], ["get", "aggregate_count"], 0, 4, 100, 7, 1_000, 12, 10_000, 18, 100_000, 24] },
      } as CircleLayer);
      if (!map.getLayer(layerIds[1]!)) map.addLayer({ id: layerIds[1]!, type: "symbol", source: sourceId, maxzoom: LOW_ZOOM_CUTOFF,
        layout: { "text-field": ["to-string", ["get", "aggregate_count"]], "text-size": 10, "text-allow-overlap": false },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(15,23,42,.8)", "text-halo-width": 1 },
      } as SymbolLayer);
      map.setPaintProperty(layerIds[0]!, "circle-opacity", opacity);
      map.setPaintProperty(layerIds[1]!, "text-opacity", opacity);
      keepLoadingUntilMapIdle(map, `${sourceId}:render`, "醫療聚合格網載入中", sourceId);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [data, definitions, enabled, layerIds, mapRef, params, revision, sourceId, tick, visibility]);
}

function useAreaLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  definition: typeof JP_MEDICAL_AREA_LEVELS[number],
) {
  const visible = visibility[definition.key];
  const tick = useMapReadyTick(mapRef, visible);
  const revision = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime).revision ?? 0;
  const [asset, setAsset] = useState<{ url: string; sourceLayer: string; revision: number } | null>(null);
  const sourceId = `jp-medical-areas-${definition.value}`;
  const layerId = `${sourceId}-fill`;
  const outlineId = `${sourceId}-outline`;
  const mountedIdentity = useRef<string | null>(null);

  useEffect(() => () => {
    const map = mapRef.current;
    if (map) removeMapLayers(map, [layerId, outlineId], sourceId);
  }, [layerId, mapRef, outlineId, sourceId]);

  useEffect(() => {
    if (!visible || asset?.revision === revision) return;
    let cancelled = false;
    jpMedicalLayerAsset(`a38_${definition.value}`).then(({ url, asset: item }) => {
      if (!cancelled) setAsset({ url, sourceLayer: item.source_layer, revision });
    }).catch((error) => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [asset?.revision, definition.value, revision, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible || !asset || asset.revision !== revision) {
      removeMapLayers(map, [layerId, outlineId], sourceId);
      return;
    }
    const mount = () => {
      registerPmtilesSourceTypeOnce();
      const identity = `${asset.url}:${asset.revision}`;
      if (mountedIdentity.current && mountedIdentity.current !== identity) removeMapLayers(map, [layerId, outlineId], sourceId);
      const added = !map.getSource(sourceId);
      if (added) map.addSource(sourceId, { type: PMTILES_SOURCE_TYPE, url: asset.url, minzoom: 0, maxzoom: 10 } as any);
      if (!map.getLayer(layerId)) map.addLayer({
        id: layerId, type: "fill", source: sourceId, "source-layer": asset.sourceLayer,
        paint: { "fill-color": definition.color, "fill-opacity": clamp(params[`${definition.key}Opacity`] ?? 0.22) },
      } as FillLayer);
      if (!map.getLayer(outlineId)) map.addLayer({
        id: outlineId, type: "line", source: sourceId, "source-layer": asset.sourceLayer,
        paint: { "line-color": definition.color, "line-width": 1, "line-opacity": 0.75 },
      });
      const opacity = clamp(params[`${definition.key}Opacity`] ?? 0.22);
      map.setLayoutProperty(layerId, "visibility", "visible");
      map.setLayoutProperty(outlineId, "visibility", "visible");
      map.setPaintProperty(layerId, "fill-opacity", opacity);
      map.setPaintProperty(outlineId, "line-opacity", clamp(opacity * 3));
      mountedIdentity.current = identity;
      if (added) keepLoadingUntilMapIdle(map, `${sourceId}:render`, "醫療圈載入中", sourceId);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [asset, definition, layerId, mapRef, outlineId, params, revision, sourceId, tick, visible]);
}

const FACILITY_DEFINITIONS: readonly PointLayerDefinition[] = JP_MEDICAL_CATEGORIES.map(({ key, value, color }, index) => ({
  key, layerId: JP_MEDICAL_FACILITY_LAYER_IDS[index]!, color,
  filter: ["==", ["get", "record_kind"], value] as unknown as FilterSpecification,
  aggregateMatches: (properties) => properties.record_kind === value,
}));

const CARE_DEFINITIONS: readonly PointLayerDefinition[] = JP_MEDICAL_CARE_GROUPS.map(({ key, color, serviceTypes }, index) => ({
  key, layerId: JP_MEDICAL_CARE_LAYER_IDS[index]!, color,
  filter: ["in", ["get", "service_type"], ["literal", serviceTypes]] as unknown as FilterSpecification,
  aggregateMatches: (properties) => typeof properties.service_type === "string" && serviceTypes.some((serviceType) => serviceType === properties.service_type),
}));

/** 5 類設施、6 類長照與 3 級醫療圈各自獨立；point minzoom 由 hash-pinned catalog 控制。 */
export function useJpMedicalLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: JpMedicalVisibility, params: JpMedicalParams) {
  usePointFamily(mapRef, visibility, params, "navii_facilities", "jp-medical-facilities", JP_MEDICAL_FACILITY_LAYER_IDS, FACILITY_DEFINITIONS, 5);
  usePointFamily(mapRef, visibility, params, "h17_services", "jp-medical-care", JP_MEDICAL_CARE_LAYER_IDS, CARE_DEFINITIONS, 4);
  useAggregateFamily(mapRef, visibility, params, "navii_facilities", "jp-medical-facilities-aggregate", JP_MEDICAL_FACILITY_AGGREGATE_LAYER_IDS, FACILITY_DEFINITIONS);
  useAggregateFamily(mapRef, visibility, params, "h17_services", "jp-medical-care-aggregate", JP_MEDICAL_CARE_AGGREGATE_LAYER_IDS, CARE_DEFINITIONS);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[0]);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[1]);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[2]);
}
