import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, ExpressionSpecification, FillLayer, FilterSpecification, Map as MapboxMap } from "mapbox-gl";
import {
  JP_MEDICAL_AREA_LEVELS,
  JP_MEDICAL_CARE_GROUPS,
  JP_MEDICAL_CATEGORIES,
  type JpMedicalAreaKey,
  type JpMedicalCareKey,
  type JpMedicalCategoryKey,
} from "../data/jpMedicalTypes";
import { getJpMedicalRuntime, jpMedicalLayerAsset, reportJpMedicalError, subscribeJpMedicalRuntime } from "../data/jpMedicalLoader";
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

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const pointRadius = (large: number): ExpressionSpecification => [
  "interpolate", ["linear"], ["zoom"], 0, 0.65, 6, 0.9, 10, 1.8, 14, large,
] as unknown as ExpressionSpecification;

interface PointLayerDefinition {
  key: JpMedicalCategoryKey | JpMedicalCareKey;
  layerId: string;
  color: string;
  filter: FilterSpecification;
}

function usePointFamily(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpMedicalVisibility,
  params: JpMedicalParams,
  assetId: "navii_facilities" | "h17_services",
  sourceId: string,
  definitions: readonly PointLayerDefinition[],
  radius: number,
) {
  const active = definitions.some(({ key }) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const revision = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime).revision ?? 0;
  const [asset, setAsset] = useState<{ url: string; sourceLayer: string; revision: number } | null>(null);
  const mountedIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (!active || asset?.revision === revision) return;
    let cancelled = false;
    jpMedicalLayerAsset(assetId).then(({ url, asset: item }) => {
      if (!cancelled) setAsset({ url, sourceLayer: item.source_layer, revision });
    }).catch((error) => { if (!cancelled) reportJpMedicalError(error); });
    return () => { cancelled = true; };
  }, [active, asset?.revision, assetId, revision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerIds = definitions.map(({ layerId }) => layerId);
    if (!active || !asset || asset.revision !== revision) {
      layerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      });
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      const identity = `${asset.url}:${asset.revision}`;
      if (mountedIdentity.current && mountedIdentity.current !== identity) {
        layerIds.forEach((layerId) => { if (map.getLayer(layerId)) map.removeLayer(layerId); });
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
      const added = !map.getSource(sourceId);
      if (added) map.addSource(sourceId, {
        type: PMTILES_SOURCE_TYPE,
        url: asset.url,
        // Point archives are complete z0-14; the former z10 gate only hid valid features.
        minzoom: 0,
        maxzoom: 14,
      } as any);
      definitions.forEach(({ key, layerId, color, filter }) => {
        if (!map.getLayer(layerId)) map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          "source-layer": asset.sourceLayer,
          minzoom: 0,
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
  }, [mapRef, active, asset, definitions, params, radius, revision, sourceId, tick, visibility]);
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
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      if (map.getLayer(outlineId)) map.setLayoutProperty(outlineId, "visibility", "none");
      return;
    }
    const mount = () => {
      registerPmtilesSourceTypeOnce();
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
}));

const CARE_DEFINITIONS: readonly PointLayerDefinition[] = JP_MEDICAL_CARE_GROUPS.map(({ key, color, serviceTypes }, index) => ({
  key, layerId: JP_MEDICAL_CARE_LAYER_IDS[index]!, color,
  filter: ["in", ["get", "service_type"], ["literal", serviceTypes]] as unknown as FilterSpecification,
}));

/** 5 類設施、6 類長照與 3 級醫療圈各自獨立；點位在 z0-14 均直接顯示來源 feature。 */
export function useJpMedicalLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: JpMedicalVisibility, params: JpMedicalParams) {
  usePointFamily(mapRef, visibility, params, "navii_facilities", "jp-medical-facilities", FACILITY_DEFINITIONS, 5);
  usePointFamily(mapRef, visibility, params, "h17_services", "jp-medical-care", CARE_DEFINITIONS, 4);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[0]);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[1]);
  useAreaLayer(mapRef, visibility, params, JP_MEDICAL_AREA_LEVELS[2]);
}
