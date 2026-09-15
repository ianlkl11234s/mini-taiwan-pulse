import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, FilterSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { jpMedicalAreaLevelFromIndex, jpMedicalCareTypeFromIndex, JP_MEDICAL_AREA_COLOR, JP_MEDICAL_CARE_COLOR, JP_MEDICAL_CARE_TYPES, JP_MEDICAL_CATEGORY_COLOR_EXPRESSION, type JpMedicalRecordKind } from "../data/jpMedicalTypes";
import { fetchJpMedicalJsonAsset, jpMedicalLayerAsset, getJpMedicalRuntime, subscribeJpMedicalRuntime, reportJpMedicalError } from "../data/jpMedicalLoader";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
export const JP_MEDICAL_CLICK_LAYER_IDS = ["jp-medical-facilities-points", "jp-medical-facilities-clusters", "jp-medical-care-points", "jp-medical-care-clusters", "jp-medical-areas-fill"] as const;
const ids = { facilitySource: "jp-medical-facilities", facilityPoints: "jp-medical-facilities-points", careSource: "jp-medical-care", carePoints: "jp-medical-care-points", areaSource: "jp-medical-areas", areaFill: "jp-medical-areas-fill" };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const radius = (a: number, b: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 10, a, 14, b] as unknown as ExpressionSpecification;
const allKinds: JpMedicalRecordKind[] = ["hospital", "clinic", "dental", "maternity", "pharmacy"];
export interface JpMedicalVisibility {
    jpMedicalFacilities: boolean;
    jpMedicalCare: boolean;
    jpMedicalAreas: boolean;
}
export type JpMedicalParams = Record<string, number>;
export function facilitiesFilter(params: JpMedicalParams): FilterSpecification { const names: Record<JpMedicalRecordKind, string> = { hospital: "jpMedicalHospital", clinic: "jpMedicalClinic", dental: "jpMedicalDental", maternity: "jpMedicalMidwife", pharmacy: "jpMedicalPharmacy" }; const selected = allKinds.filter((kind) => params[names[kind]] === 1); return selected.length ? ["in", ["get", "record_kind"], ["literal", selected]] as unknown as FilterSpecification : ["literal", false] as unknown as FilterSpecification; }
export function jpMedicalCareFilter(typeIndex: number): FilterSpecification | null { const type = jpMedicalCareTypeFromIndex(typeIndex); return typeIndex === 0 ? null : type ? ["==", ["get", "service_type"], type] as unknown as FilterSpecification : ["literal", false] as unknown as FilterSpecification; }
type AggregateFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
function gridCenter(geometry: GeoJSON.Geometry): GeoJSON.Point {
    const coords: [
        number,
        number
    ][] = [];
    const collect = (value: unknown): void => { if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number")
        coords.push([value[0], value[1]]);
    else if (Array.isArray(value))
        value.forEach(collect); };
    const collectGeometry = (item: GeoJSON.Geometry): void => { if (item.type === "GeometryCollection")
        item.geometries.forEach(collectGeometry);
    else
        collect(item.coordinates); };
    collectGeometry(geometry);
    if (!coords.length)
        throw new Error("聚合格網缺少座標");
    const xs = coords.map((coord) => coord[0]);
    const ys = coords.map((coord) => coord[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { type: "Point", coordinates: [(minX + maxX) / 2, (minY + maxY) / 2] };
}
export function mergedAggregate(data: unknown, categoryField: "record_kind" | "service_type", selected: readonly string[]): GeoJSON.FeatureCollection {
    const features = (data as GeoJSON.FeatureCollection)?.features;
    if (!Array.isArray(features))
        throw new Error("全國聚合 GeoJSON 格式不正確");
    const rows = new Map<string, AggregateFeature>();
    for (const feature of features as AggregateFeature[]) {
        const props = feature.properties ?? {};
        if (!selected.includes(String(props[categoryField])))
            continue;
        const gridKey = String(props.grid_id ?? "");
        const previous = rows.get(gridKey);
        const mappedField = categoryField === "record_kind" ? "mapped_point_count" : "mapped_service_registration_count";
        const value = props[mappedField];
        if (!gridKey || typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("聚合資料缺少有效計數");
        if (!previous) {
            rows.set(gridKey, { type: "Feature", geometry: gridCenter(feature.geometry), properties: { grid_id: gridKey, [mappedField]: value } });
            continue;
        }
        previous.properties[mappedField] = Number(previous.properties[mappedField] ?? 0) + value;
    }
    return { type: "FeatureCollection", features: [...rows.values()] };
}
function useAggregateLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, datasetKey: "navii_facilities" | "h17_services", sourceId: string, layerId: string, opacity: number, color: string | ExpressionSpecification, selected: readonly string[]) {
  const tick = useMapReadyTick(mapRef, visible);
  const revision = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime).revision ?? 0;
  const [raw, setRaw] = useState<unknown>(null);
  const selectionKey = selected.join("\u0000");
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRaw(null);
    withLoading(`${sourceId}:fetch`, "日本醫療聚合載入中", (async () => {
      const { asset } = await jpMedicalLayerAsset(datasetKey);
      if (!asset.aggregate_path) throw new Error(`catalog 缺少 ${datasetKey} aggregate_path`);
      const data = await fetchJpMedicalJsonAsset(asset.aggregate_path);
      if (!cancelled) setRaw(data);
    })()).catch(error => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [visible, datasetKey, sourceId, revision]);
  const aggregate = useMemo(() => {
    try {
      return { data: raw ? mergedAggregate(raw, datasetKey === "navii_facilities" ? "record_kind" : "service_type", selected) : null, error: undefined };
    } catch (error) {
      return { data: null, error };
    }
  }, [raw, datasetKey, selectionKey]);
  useEffect(() => {
    if (visible && aggregate.error) reportJpMedicalError(aggregate.error);
  }, [visible, aggregate.error]);
  const data = aggregate.data;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible || !data) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      if (map.getLayer(`${layerId}-labels`)) map.setLayoutProperty(`${layerId}-labels`, "visibility", "none");
      return;
    }
    const mount = () => {
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(sourceId, { type: "geojson", data });
      if (!map.getLayer(layerId)) map.addLayer({
        id: layerId, type: "circle", source: sourceId, maxzoom: 10,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", datasetKey === "navii_facilities" ? "mapped_point_count" : "mapped_service_registration_count"], 1, 4, 1000, 14, 10000, 24],
          "circle-color": color, "circle-opacity": opacity,
          "circle-stroke-color": "#e2e8f0", "circle-stroke-width": 1,
        },
      } as CircleLayer);
      map.setLayoutProperty(layerId, "visibility", "visible");
      map.setPaintProperty(layerId, "circle-opacity", opacity);
      if (!map.getLayer(`${layerId}-labels`)) map.addLayer({
        id: `${layerId}-labels`, type: "symbol", source: sourceId, maxzoom: 10,
        layout: {
          "text-field": ["to-string", ["get", datasetKey === "navii_facilities" ? "mapped_point_count" : "mapped_service_registration_count"]],
          "text-size": 11, "text-font": ["Open Sans Regular"],
        },
        paint: { "text-color": "#fff", "text-halo-color": "#0f172a", "text-halo-width": 1 },
      });
      map.setLayoutProperty(`${layerId}-labels`, "visibility", "visible");
      map.setPaintProperty(`${layerId}-labels`, "text-opacity", opacity);
      keepLoadingUntilMapIdle(map, `${sourceId}:render`, "日本醫療聚合繪製中", sourceId);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, data, sourceId, layerId, opacity, color, datasetKey, tick]);
}

function usePmtilesLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, sourceId: string, layerId: string, assetId: "navii_facilities" | "h17_services" | "a38_1" | "a38_2" | "a38_3", create: (sourceLayer: string) => CircleLayer | FillLayer, update: (map: MapboxMap) => void) {
  const tick = useMapReadyTick(mapRef, visible);
  const revision = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime).revision ?? 0;
  const [asset, setAsset] = useState<{ id: string; url: string; source_layer: string; revision: number } | null>(null);
  const mountedAssetId = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || (asset?.id === assetId && asset.revision === revision)) return;
    let cancelled = false;
    jpMedicalLayerAsset(assetId).then(({ url, asset: item }) => {
      if (!cancelled) setAsset({ id: assetId, url, source_layer: item.source_layer, revision });
    }).catch(error => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [visible, asset?.id, asset?.revision, assetId, revision]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible || !asset || asset.id !== assetId || asset.revision !== revision) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      if (map.getLayer(`${layerId}-outline`)) map.setLayoutProperty(`${layerId}-outline`, "visibility", "none");
      return;
    }
    const mount = () => {
      registerPmtilesSourceTypeOnce();
      const identity = `${asset.id}:${asset.revision}`;
      if (mountedAssetId.current && mountedAssetId.current !== identity) {
        if (map.getLayer(`${layerId}-outline`)) map.removeLayer(`${layerId}-outline`);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
      const added = !map.getSource(sourceId);
      if (added) map.addSource(sourceId, {
        type: PMTILES_SOURCE_TYPE, url: asset.url,
        minzoom: assetId.startsWith("a38_") ? 0 : 10,
        maxzoom: assetId.startsWith("a38_") ? 10 : 14,
      } as any);
      if (!map.getLayer(layerId)) map.addLayer(create(asset.source_layer));
      if (assetId.startsWith("a38_") && !map.getLayer(`${layerId}-outline`)) map.addLayer({
        id: `${layerId}-outline`, type: "line", source: sourceId, "source-layer": asset.source_layer,
        paint: { "line-color": "#fde68a", "line-width": 1, "line-opacity": .6 },
      });
      mountedAssetId.current = identity;
      map.setLayoutProperty(layerId, "visibility", "visible");
      if (map.getLayer(`${layerId}-outline`)) map.setLayoutProperty(`${layerId}-outline`, "visibility", "visible");
      update(map);
      if (added) keepLoadingUntilMapIdle(map, `${sourceId}:render`, "日本醫療圖層載入中", sourceId);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId === sourceId) reportJpMedicalError(event.error ?? new Error("醫療瓦片載入失敗"));
    };
    mount();
    map.on("style.load", mount);
    map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [mapRef, visible, asset, assetId, sourceId, layerId, create, update, tick, revision]);
}
/** 三個主題各自維持 source/layer；主 agent 僅需傳 visibility 與 layerParams 的 number record。 */
export function useJpMedicalLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: JpMedicalVisibility, params: JpMedicalParams) {
    const facilityOpacity = clamp(params.jpMedicalFacilitiesOpacity ?? .75);
    const careOpacity = clamp(params.jpMedicalCareOpacity ?? .7);
    const areasOpacity = clamp(params.jpMedicalAreasOpacity ?? .3);
    const selectedKinds = allKinds.filter((kind) => ({ hospital: params.jpMedicalHospital, clinic: params.jpMedicalClinic, dental: params.jpMedicalDental, maternity: params.jpMedicalMidwife, pharmacy: params.jpMedicalPharmacy })[kind] === 1);
    const selectedCare = jpMedicalCareTypeFromIndex(params.jpMedicalCareTypeIdx ?? 0);
    usePmtilesLayer(mapRef, visibility.jpMedicalFacilities, ids.facilitySource, ids.facilityPoints, "navii_facilities", (sourceLayer) => ({ id: ids.facilityPoints, type: "circle", source: ids.facilitySource, "source-layer": sourceLayer, minzoom: 10, layout: { visibility: "none" }, paint: { "circle-radius": radius(2, 5), "circle-color": JP_MEDICAL_CATEGORY_COLOR_EXPRESSION, "circle-opacity": facilityOpacity, "circle-stroke-color": "rgba(15,23,42,.55)", "circle-stroke-width": .35 } } as CircleLayer), (map) => { map.setPaintProperty(ids.facilityPoints, "circle-opacity", facilityOpacity); map.setFilter(ids.facilityPoints, facilitiesFilter(params)); });
    useAggregateLayer(mapRef, visibility.jpMedicalFacilities, "navii_facilities", "jp-medical-facilities-aggregates", "jp-medical-facilities-clusters", facilityOpacity, "#64748b", selectedKinds);
    usePmtilesLayer(mapRef, visibility.jpMedicalCare, ids.careSource, ids.carePoints, "h17_services", (sourceLayer) => ({ id: ids.carePoints, type: "circle", source: ids.careSource, "source-layer": sourceLayer, minzoom: 10, layout: { visibility: "none" }, paint: { "circle-radius": radius(1.5, 4), "circle-color": JP_MEDICAL_CARE_COLOR, "circle-opacity": careOpacity, "circle-stroke-color": "rgba(15,23,42,.45)", "circle-stroke-width": .25 } } as CircleLayer), (map) => { map.setPaintProperty(ids.carePoints, "circle-opacity", careOpacity); map.setFilter(ids.carePoints, jpMedicalCareFilter(params.jpMedicalCareTypeIdx ?? 0)); });
    useAggregateLayer(mapRef, visibility.jpMedicalCare, "h17_services", "jp-medical-care-aggregates", "jp-medical-care-clusters", careOpacity, JP_MEDICAL_CARE_COLOR, selectedCare ? [selectedCare] : JP_MEDICAL_CARE_TYPES.map((item) => item.value));
    const level = jpMedicalAreaLevelFromIndex(params.jpMedicalAreaLevelIdx ?? 1) ?? "1";
    usePmtilesLayer(mapRef, visibility.jpMedicalAreas, ids.areaSource, ids.areaFill, `a38_${level}` as "a38_1" | "a38_2" | "a38_3", (sourceLayer) => ({ id: ids.areaFill, type: "fill", source: ids.areaSource, "source-layer": sourceLayer, layout: { visibility: "none" }, paint: { "fill-color": JP_MEDICAL_AREA_COLOR, "fill-opacity": areasOpacity } } as FillLayer), (map) => {
      map.setPaintProperty(ids.areaFill, "fill-opacity", areasOpacity);
      map.setPaintProperty(`${ids.areaFill}-outline`, "line-opacity", clamp(areasOpacity * 3));
    });
}
