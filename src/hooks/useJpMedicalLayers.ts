import { gridRampFor, useGridPaletteSignature } from "../state/layerPalette";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, FilterSpecification, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_MEDICAL_AREA_LEVELS,
  JP_MEDICAL_CARE_GROUPS,
  JP_MEDICAL_CATEGORIES,
  JP_MEDICAL_GRID_BANDS, jpMedicalGridColorExpression,
  type JpMedicalAreaKey,
  type JpMedicalCareKey,
  type JpMedicalCategoryKey,
} from "../data/jpMedicalTypes";
import { fetchJpMedicalAggregate, getJpMedicalRuntime, jpMedicalLayerAsset, reportJpMedicalError, subscribeJpMedicalRuntime, type JpMedicalAggregate } from "../data/jpMedicalLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
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
const JP_MEDICAL_FACILITY_AGGREGATE_LAYER_IDS = ["jp-medical-facilities-aggregate-fill", "jp-medical-facilities-aggregate-outline"] as const;
const JP_MEDICAL_CARE_AGGREGATE_LAYER_IDS = ["jp-medical-care-aggregate-fill", "jp-medical-care-aggregate-outline"] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const LOW_ZOOM_CUTOFF = 8;
const MAX_MAP_ZOOM = 24;
const pointOpacityDefault = (key: keyof JpMedicalVisibility) => Number(paramDefault(key, `${key}Opacity`) ?? 1);
const pointStroke = (key: JpMedicalCategoryKey | JpMedicalCareKey, opacity: number, isDark: boolean) =>
  pointStrokePaint(isDark, clamp(opacity) / pointOpacityDefault(key));

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
  // cleanup 可能在 map.remove() 之後才跑（見 LayerHost.tsx 的 unmount 順序說明），
  // 此時 map.style 已不存在，getLayer 會拋 "reading 'getOwnLayer'" 並整頁崩潰。
  try {
    layerIds.forEach((layerId) => { if (map.getLayer(layerId)) map.removeLayer(layerId); });
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch { /* map 可能已銷毀 */ }
}

function aggregateOpacity(definitions: readonly PointLayerDefinition[], visibility: JpMedicalVisibility, params: JpMedicalParams) {
  return Math.max(0, ...definitions.filter(({ key }) => visibility[key]).map(({ key }) => clamp(params[`${key}Opacity`] ?? pointOpacityDefault(key))));
}

/** Aggregate layer 的實際 opacity 是可見子類別的 max；選同一個 winner key 供 R3b ratio 計算。 */
function aggregateStyleKey(definitions: readonly PointLayerDefinition[], visibility: JpMedicalVisibility, params: JpMedicalParams) {
  return definitions.filter(({ key }) => visibility[key]).reduce((best, definition) => {
    const value = clamp(params[`${definition.key}Opacity`] ?? pointOpacityDefault(definition.key));
    const bestValue = clamp(params[`${best.key}Opacity`] ?? pointOpacityDefault(best.key));
    return value > bestValue ? definition : best;
  }, definitions[0]!);
}

interface PointLayerDefinition {
  key: JpMedicalCategoryKey | JpMedicalCareKey;
  layerId: string;
  color: string;
  aggregateField: string;
  filter: FilterSpecification;
  aggregateMatches: (properties: Record<string, unknown>) => boolean;
}

/** 將同一格內目前可見分類相加，保留來源 polygon 作真正密度格網。 */
export function jpMedicalAggregateGrid(
  aggregate: JpMedicalAggregate,
  definitions: readonly PointLayerDefinition[],
  visibility: JpMedicalVisibility,
  countField: "mapped_point_count" | "mapped_service_registration_count",
): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  const cells = new Map<string, { geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; count: number }>();
  for (const feature of aggregate.features) {
    const properties = feature.properties as Record<string, unknown>;
    if (!properties || typeof properties.grid_id !== "string" || typeof properties[countField] !== "number") continue;
    if (properties.aggregate_schema === "category_columns_v1") {
      const count = definitions
        .filter(({ key }) => visibility[key])
        .reduce((sum, definition) => sum + (typeof properties[definition.aggregateField] === "number" ? Number(properties[definition.aggregateField]) : 0), 0);
      if (count > 0) cells.set(properties.grid_id, { geometry: feature.geometry, count });
      continue;
    }
    const definition = definitions.find((item) => visibility[item.key] && item.aggregateMatches(properties));
    if (!definition) continue;
    const cell = cells.get(properties.grid_id);
    if (cell) cell.count += properties[countField];
    else cells.set(properties.grid_id, { geometry: feature.geometry, count: properties[countField] });
  }
  return { type: "FeatureCollection", features: [...cells.entries()].map(([gridId, cell]) => ({
    type: "Feature", geometry: cell.geometry,
    properties: { grid_id: gridId, aggregate_count: cell.count, geometry_role: "EQUAL_AREA_GRID_CELL" },
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
  isDarkTheme: boolean,
) {
  const active = definitions.some(({ key }) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime);
  const revision = runtime.revision ?? 0;
  const zoom = useMapZoom(mapRef, active);
  const pointsEnabled = active && zoom >= LOW_ZOOM_CUTOFF;
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
      const isDark = isDarkTheme;
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
          minzoom: LOW_ZOOM_CUTOFF,
          layout: { visibility: "none" },
          paint: {
            "circle-radius": pointRadius("M"),
            "circle-color": color,
            "circle-opacity": clamp(params[`${key}Opacity`] ?? pointOpacityDefault(key)),
            ...pointStroke(key, params[`${key}Opacity`] ?? pointOpacityDefault(key), isDark),
          },
          filter,
        } as CircleLayer);
        map.setLayerZoomRange(layerId, LOW_ZOOM_CUTOFF, MAX_MAP_ZOOM);
        map.setLayoutProperty(layerId, "visibility", visibility[key] ? "visible" : "none");
        map.setPaintProperty(layerId, "circle-opacity", clamp(params[`${key}Opacity`] ?? pointOpacityDefault(key)));
        const stroke = pointStroke(key, params[`${key}Opacity`] ?? pointOpacityDefault(key), isDark);
        for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(layerId, prop, stroke[prop]);
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
  }, [mapRef, asset, definitions, isDarkTheme, layerIds, params, pointsEnabled, revision, sourceId, tick, visibility]);
}

function useAggregateFamily(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  assetId: "navii_facilities" | "h17_services",
  sourceId: string,
  layerIds: readonly string[],
  definitions: readonly PointLayerDefinition[],
  isDarkTheme: boolean,
) {
  const active = definitions.some(({ key }) => visibility[key]);
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime);
  const revision = runtime.revision ?? 0;
  const zoom = useMapZoom(mapRef, active);
  const enabled = active && zoom < LOW_ZOOM_CUTOFF;
  const tick = useMapReadyTick(mapRef, enabled);
  // R7：醫療 5 層／照護 6 層各共用一個網格色盤選單（sharedGroup），讀任一成員即可
  const paletteKey = definitions[0]!.key;
  const palette = useGridPaletteSignature(paletteKey);
  const [data, setData] = useState<{ value: JpMedicalAggregate; revision: number } | null>(null);
  const mountedGridRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null>(null);
  const countField = assetId === "navii_facilities" ? "mapped_point_count" : "mapped_service_registration_count";
  // 只把真正影響格網計數的資料放進 memo key。theme／opacity 改動只重跑下方 paint。
  const activeDefinitionsKey = definitions.filter(({ key }) => visibility[key]).map(({ key }) => key).join("|");
  const grid = useMemo(
    () => data && active ? jpMedicalAggregateGrid(data.value, definitions, visibility, countField) : null,
    [active, activeDefinitionsKey, countField, data?.value, definitions],
  );

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
    if (!enabled || !data || data.revision !== revision || !grid) {
      removeMapLayers(map, layerIds, sourceId);
      return;
    }
    const mount = () => {
      const opacity = aggregateOpacity(definitions, visibility, params);
      const styleDefinition = aggregateStyleKey(definitions, visibility, params);
      const styleKey = styleDefinition.key;
      const defaultOpacity = pointOpacityDefault(styleKey);
      const gridColor = jpMedicalGridColorExpression(gridRampFor(paletteKey, isDarkTheme, JP_MEDICAL_GRID_BANDS.length)) as ExpressionSpecification;
      const source = map.getSource(sourceId) as { setData?: (value: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => void } | undefined;
      if (!source) {
        map.addSource(sourceId, { type: "geojson", data: grid });
        mountedGridRef.current = grid;
      } else if (mountedGridRef.current !== grid) {
        source.setData?.(grid);
        mountedGridRef.current = grid;
      }
      if (!map.getLayer(layerIds[0]!)) map.addLayer({
        id: layerIds[0]!, type: "fill", source: sourceId, maxzoom: LOW_ZOOM_CUTOFF,
        paint: hookFillPaint(styleKey, layerIds[0]!, { "fill-color": gridColor, "fill-opacity": opacity }, { "fill-color": gridColor, "fill-opacity": defaultOpacity }),
      } as FillLayer);
      if (!map.getLayer(layerIds[1]!)) map.addLayer({
        id: layerIds[1]!, type: "line", source: sourceId, maxzoom: LOW_ZOOM_CUTOFF,
        layout: { ...hookLineLayout(styleKey, layerIds[1]!) },
        paint: hookLinePaint(styleKey, layerIds[1]!, {
          "line-color": "rgba(15,23,42,.72)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.2, 8, 0.75],
          "line-opacity": clamp(opacity * 0.7),
        }, {
          "line-color": "rgba(15,23,42,.72)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.2, 8, 0.75],
          "line-opacity": clamp(defaultOpacity * 0.7),
        }, isDarkTheme),
      } as LineLayer);
      map.setPaintProperty(layerIds[0]!, "fill-color", gridColor);
      map.setPaintProperty(layerIds[0]!, "fill-opacity", hookFillOpacity(styleKey, layerIds[0]!, opacity, defaultOpacity));
      map.setPaintProperty(layerIds[1]!, "line-opacity", hookLineOpacity(styleKey, layerIds[1]!, clamp(opacity * 0.7), clamp(defaultOpacity * 0.7), isDarkTheme));
      map.setPaintProperty(layerIds[1]!, "line-color", hookLinePaint(styleKey, layerIds[1]!, { "line-color": "rgba(15,23,42,.72)" }, { "line-color": "rgba(15,23,42,.72)" }, isDarkTheme)["line-color"] as string);
      keepLoadingUntilMapIdle(map, `${sourceId}:render`, "醫療密度網格載入中", sourceId);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [data, definitions, enabled, grid, layerIds, mapRef, params, revision, sourceId, tick, visibility, isDarkTheme, palette, paletteKey]);
}

function useAreaLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  definition: typeof JP_MEDICAL_AREA_LEVELS[number],
  isDarkTheme: boolean,
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
        paint: hookFillPaint(definition.key, layerId, { "fill-color": definition.color, "fill-opacity": clamp(params[`${definition.key}Opacity`] ?? 0.22) }, { "fill-color": definition.color, "fill-opacity": pointOpacityDefault(definition.key) }),
      } as FillLayer);
      if (!map.getLayer(outlineId)) map.addLayer({
        id: outlineId, type: "line", source: sourceId, "source-layer": asset.sourceLayer,
        layout: { ...hookLineLayout(definition.key, outlineId) },
        paint: hookLinePaint(definition.key, outlineId, { "line-color": definition.color, "line-width": 1, "line-opacity": 0.75 }, { "line-color": definition.color, "line-width": 1, "line-opacity": 0.75 }, isDarkTheme),
      });
      const opacity = clamp(params[`${definition.key}Opacity`] ?? 0.22);
      map.setLayoutProperty(layerId, "visibility", "visible");
      map.setLayoutProperty(outlineId, "visibility", "visible");
      map.setPaintProperty(layerId, "fill-opacity", hookFillOpacity(definition.key, layerId, opacity, pointOpacityDefault(definition.key)));
      map.setPaintProperty(outlineId, "line-opacity", hookLineOpacity(definition.key, outlineId, clamp(opacity * 3), clamp(pointOpacityDefault(definition.key) * 3), isDarkTheme));
      map.setPaintProperty(outlineId, "line-color", hookLinePaint(definition.key, outlineId, { "line-color": definition.color }, { "line-color": definition.color }, isDarkTheme)["line-color"] as string);
      mountedIdentity.current = identity;
      if (added) keepLoadingUntilMapIdle(map, `${sourceId}:render`, "醫療圈載入中", sourceId);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [asset, definition, layerId, mapRef, outlineId, params, revision, sourceId, tick, visible, isDarkTheme]);
}

const FACILITY_DEFINITIONS: readonly PointLayerDefinition[] = JP_MEDICAL_CATEGORIES.map(({ key, value, color, aggregateField }, index) => ({
  key, layerId: JP_MEDICAL_FACILITY_LAYER_IDS[index]!, color, aggregateField,
  filter: ["==", ["get", "record_kind"], value] as unknown as FilterSpecification,
  aggregateMatches: (properties) => properties.record_kind === value,
}));

const CARE_DEFINITIONS: readonly PointLayerDefinition[] = JP_MEDICAL_CARE_GROUPS.map(({ key, color, serviceTypes, aggregateField }, index) => ({
  key, layerId: JP_MEDICAL_CARE_LAYER_IDS[index]!, color, aggregateField,
  filter: ["in", ["get", "service_type"], ["literal", serviceTypes]] as unknown as FilterSpecification,
  aggregateMatches: (properties) => typeof properties.service_type === "string" && serviceTypes.some((serviceType) => serviceType === properties.service_type),
}));

/** 5 類設施、6 類長照與 3 級醫療圈各自獨立；point minzoom 由 hash-pinned catalog 控制。 */
export function useJpMedicalLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: JpMedicalVisibility, params: JpMedicalParams, isDarkTheme = true) {
  usePointFamily(mapRef, visibility, params, "navii_facilities", "jp-medical-facilities", JP_MEDICAL_FACILITY_LAYER_IDS, FACILITY_DEFINITIONS, isDarkTheme);
  usePointFamily(mapRef, visibility, params, "h17_services", "jp-medical-care", JP_MEDICAL_CARE_LAYER_IDS, CARE_DEFINITIONS, isDarkTheme);
  useAggregateFamily(mapRef, visibility, params, "navii_facilities", "jp-medical-facilities-aggregate", JP_MEDICAL_FACILITY_AGGREGATE_LAYER_IDS, FACILITY_DEFINITIONS, isDarkTheme);
  useAggregateFamily(mapRef, visibility, params, "h17_services", "jp-medical-care-aggregate", JP_MEDICAL_CARE_AGGREGATE_LAYER_IDS, CARE_DEFINITIONS, isDarkTheme);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[0], isDarkTheme);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[1], isDarkTheme);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[2], isDarkTheme);
}
