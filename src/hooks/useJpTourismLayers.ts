import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import {
  fetchJpTourismDataset, isJpTourismDatasetAvailable, JP_TOURISM_DATASETS,
  jpTourismAssetUrl, type JpTourismDataset,
} from "../data/jpTourismLoader";
import {
  JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION, JP_TOURISM_COLORS,
  JP_TOURISM_FILTER_LAYER_IDS, JP_TOURISM_LAYER_KEYS,
  type JpTourismLayerKey,
} from "../data/jpTourismTypes";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, heatmapOpacity, heatmapPaint, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { useMapReadyTick } from "./useMapReadyTick";

type GeometryKind = "point" | "polygon";

interface LayerConfig {
  key: JpTourismLayerKey;
  dataset: JpTourismDataset;
  kind: GeometryKind;
  layerBase: string;
  /** 密集點（R5 P-4／G-2）：出點縮放以下改畫熱區（`${layerBase}-heatmap`，不可點擊）。 */
  heatmap?: { pointsFromZoom: number; intensity: number };
}

// 2026-10-02 校正（本州 z6 視角 heatmap 離線模擬；準則見 overlayRegistry denseHeatmapLayer 說明）
const ACCOMMODATION_CANONICAL_HEATMAP_INTENSITY = 1;
// 2026-10-02 校正（本州 z6 視角 heatmap 離線模擬；準則見 overlayRegistry denseHeatmapLayer 說明）
const ACCOMMODATION_OSM_HEATMAP_INTENSITY = 1;

const CONFIGS: readonly LayerConfig[] = [
  // 25,459 點、20,502 點（10k–100k）：z < 10 熱區、z ≥ 10 畫點（PMTiles z0–14）。
  { key: "jpAccommodationCanonical", dataset: "accommodation-canonical", kind: "point", layerBase: "jp-tourism-jp-accommodation-canonical", heatmap: { pointsFromZoom: densePointsFromZoom(25_459), intensity: ACCOMMODATION_CANONICAL_HEATMAP_INTENSITY } },
  { key: "jpAccommodationJta", dataset: "accommodation-jta", kind: "point", layerBase: "jp-tourism-jp-accommodation-jta" },
  { key: "jpAccommodationLocal", dataset: "accommodation-local", kind: "point", layerBase: "jp-tourism-jp-accommodation-local" },
  { key: "jpAccommodationOsm", dataset: "accommodation-osm", kind: "point", layerBase: "jp-tourism-jp-accommodation-osm", heatmap: { pointsFromZoom: densePointsFromZoom(20_502), intensity: ACCOMMODATION_OSM_HEATMAP_INTENSITY } },
  { key: "jpNaturalParksNational", dataset: "natural-parks", kind: "polygon", layerBase: "jp-tourism-jp-natural-parks-national" },
  { key: "jpNaturalParksQuasiNational", dataset: "natural-parks", kind: "polygon", layerBase: "jp-tourism-jp-natural-parks-quasi-national" },
  { key: "jpNaturalParksPrefectural", dataset: "natural-parks", kind: "polygon", layerBase: "jp-tourism-jp-natural-parks-prefectural" },
  { key: "jpNatureConservationArea", dataset: "nature-conservation", kind: "polygon", layerBase: "jp-tourism-jp-nature-conservation-area" },
  { key: "jpPrimitiveNatureEnvironmentArea", dataset: "nature-conservation", kind: "polygon", layerBase: "jp-tourism-jp-primitive-nature-environment-area" },
  { key: "jpNatureConservationSpecialDistrict", dataset: "nature-conservation", kind: "polygon", layerBase: "jp-tourism-jp-nature-conservation-special-district" },
  { key: "jpWildlifeProtectionNational", dataset: "wildlife-protection", kind: "polygon", layerBase: "jp-tourism-jp-wildlife-protection-national" },
  { key: "jpWildlifeSpecialProtectionDistrict", dataset: "wildlife-protection", kind: "polygon", layerBase: "jp-tourism-jp-wildlife-special-protection-district" },
  { key: "jpWildlifeSpecialProtectionDesignatedArea", dataset: "wildlife-protection", kind: "polygon", layerBase: "jp-tourism-jp-wildlife-special-protection-designated-area" },
  { key: "jpWorldHeritageCultural", dataset: "world-heritage-unesco", kind: "point", layerBase: "jp-tourism-jp-world-heritage-cultural" },
  { key: "jpWorldHeritageNatural", dataset: "world-heritage-unesco", kind: "point", layerBase: "jp-tourism-jp-world-heritage-natural" },
  { key: "jpWorldNaturalHeritageHistorical", dataset: "world-natural-heritage-historical", kind: "polygon", layerBase: "jp-tourism-jp-world-natural-heritage-historical" },
  { key: "jpRamsarSites", dataset: "ramsar", kind: "point", layerBase: "jp-tourism-jp-ramsar-sites" },
  { key: "jpMarineEbsaCoastal", dataset: "marine-ebsa", kind: "polygon", layerBase: "jp-tourism-jp-marine-ebsa-coastal" },
] as const;

/** 字面值同時供 runtime 與 mapInteractionLayers ratchet 驗證。 */
const CLICK_LAYER_IDS: Record<JpTourismLayerKey, string> = {
  jpAccommodationCanonical: "jp-tourism-jp-accommodation-canonical-circle",
  jpAccommodationJta: "jp-tourism-jp-accommodation-jta-circle",
  jpAccommodationLocal: "jp-tourism-jp-accommodation-local-circle",
  jpAccommodationOsm: "jp-tourism-jp-accommodation-osm-circle",
  jpNaturalParksNational: "jp-tourism-jp-natural-parks-national-fill",
  jpNaturalParksQuasiNational: "jp-tourism-jp-natural-parks-quasi-national-fill",
  jpNaturalParksPrefectural: "jp-tourism-jp-natural-parks-prefectural-fill",
  jpNatureConservationArea: "jp-tourism-jp-nature-conservation-area-fill",
  jpPrimitiveNatureEnvironmentArea: "jp-tourism-jp-primitive-nature-environment-area-fill",
  jpNatureConservationSpecialDistrict: "jp-tourism-jp-nature-conservation-special-district-fill",
  jpWildlifeProtectionNational: "jp-tourism-jp-wildlife-protection-national-fill",
  jpWildlifeSpecialProtectionDistrict: "jp-tourism-jp-wildlife-special-protection-district-fill",
  jpWildlifeSpecialProtectionDesignatedArea: "jp-tourism-jp-wildlife-special-protection-designated-area-fill",
  jpWorldHeritageCultural: "jp-tourism-jp-world-heritage-cultural-circle",
  jpWorldHeritageNatural: "jp-tourism-jp-world-heritage-natural-circle",
  jpWorldNaturalHeritageHistorical: "jp-tourism-jp-world-natural-heritage-historical-fill",
  jpRamsarSites: "jp-tourism-jp-ramsar-sites-circle",
  jpMarineEbsaCoastal: "jp-tourism-jp-marine-ebsa-coastal-fill",
};

export type JpTourismVisibility = Record<JpTourismLayerKey, boolean>;
export type JpTourismOpacity = Record<JpTourismLayerKey, number>;
export type JpTourismScale = Partial<Record<JpTourismLayerKey, number>>;
export type RamsarGeometryMode = "name_match" | "degraded" | "all";

const sourceId = (dataset: JpTourismDataset) => `jp-tourism-${dataset}`;

function clampOpacity(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const pointStroke = (key: JpTourismLayerKey, opacity: number, isDark: boolean) =>
  pointStrokePaint(isDark, clampOpacity(opacity) / Number(paramDefault(key, `${key}Opacity`) ?? 1));

function pointColor(key: JpTourismLayerKey): string | ExpressionSpecification {
  return key === "jpAccommodationCanonical" || key === "jpAccommodationOsm"
    ? JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION
    : JP_TOURISM_COLORS[key];
}

function layerFilter(config: LayerConfig, ramsarMode: RamsarGeometryMode): ExpressionSpecification | undefined {
  const clauses: ExpressionSpecification[] = [];
  const filterLayerId = JP_TOURISM_FILTER_LAYER_IDS[config.key];
  if (filterLayerId) clauses.push(["==", ["get", "filter_layer_id"], filterLayerId] as ExpressionSpecification);
  if (config.key === "jpRamsarSites" && ramsarMode !== "all") {
    clauses.push([
      "==", ["get", "geocode_quality"],
      ramsarMode === "name_match" ? "NAME_MATCH" : "ADMIN_OR_OTHER_CENTROID",
    ] as ExpressionSpecification);
  }
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return ["all", ...clauses] as ExpressionSpecification;
}

export function useJpTourismLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpTourismVisibility,
  opacity: JpTourismOpacity,
  scale: JpTourismScale,
  ramsarMode: RamsarGeometryMode,
  isDarkTheme = true,
) {
  const anyVisible = JP_TOURISM_LAYER_KEYS.some((key) => visibility[key]);
  const mapTick = useMapReadyTick(mapRef, anyVisible);
  const dataRef = useRef<Partial<Record<JpTourismDataset, GeoJSON.FeatureCollection>>>({});
  const loadingRef = useRef(new Set<JpTourismDataset>());
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    const needed = new Set(
      CONFIGS
        .filter((config) => visibility[config.key]
          && isJpTourismDatasetAvailable(config.dataset)
          && JP_TOURISM_DATASETS[config.dataset].kind === "geojson")
        .map((config) => config.dataset),
    );
    for (const dataset of needed) {
      if (dataRef.current[dataset] || loadingRef.current.has(dataset)) continue;
      loadingRef.current.add(dataset);
      fetchJpTourismDataset(dataset)
        .then((data) => {
          dataRef.current[dataset] = data;
          setDataTick((tick) => tick + 1);
        })
        .catch((error) => console.warn(`[JpTourism:${dataset}] load failed:`, error))
        .finally(() => loadingRef.current.delete(dataset));
    }
  }, [visibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const mount = () => {
      const isDark = isDarkTheme;
      for (const config of CONFIGS) {
        const datasetConfig = JP_TOURISM_DATASETS[config.dataset];
        const visible = visibility[config.key] && isJpTourismDatasetAvailable(config.dataset);
        const sid = sourceId(config.dataset);
        const data = dataRef.current[config.dataset];
        const filter = layerFilter(config, ramsarMode);
        const sourceLayer = datasetConfig.kind === "pmtiles" ? datasetConfig.sourceLayer : undefined;
        const sourceLayerRef = sourceLayer ? { "source-layer": sourceLayer } : {};
        const circleId = config.kind === "point" ? CLICK_LAYER_IDS[config.key] : `${config.layerBase}-circle`;
        const fillId = config.kind === "polygon" ? CLICK_LAYER_IDS[config.key] : `${config.layerBase}-fill`;
        const lineId = `${config.layerBase}-line`;
        const heatmapId = `${config.layerBase}-heatmap`;
        const heatScale = clampOpacity(opacity[config.key]) / Number(paramDefault(config.key, `${config.key}Opacity`) ?? 1);

        if (visible && !map.getSource(sid)) {
          if (datasetConfig.kind === "pmtiles") {
            registerPmtilesSourceTypeOnce();
            map.addSource(sid, {
              type: PMTILES_SOURCE_TYPE,
              url: new URL(jpTourismAssetUrl(config.dataset), window.location.href).href,
              minzoom: datasetConfig.minzoom,
              maxzoom: datasetConfig.maxzoom,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          } else if (data) {
            map.addSource(sid, { type: "geojson", data });
          }
        }

        const sourceReady = Boolean(map.getSource(sid));
        if (visible && sourceReady && config.kind === "point" && config.heatmap && !map.getLayer(heatmapId)) {
          map.addLayer({
            id: heatmapId, type: "heatmap", source: sid,
            ...sourceLayerRef,
            maxzoom: heatmapMaxzoom(config.heatmap.pointsFromZoom),
            ...(filter ? { filter } : {}),
            layout: { visibility: "none" },
            paint: heatmapPaint(heatScale, config.heatmap.intensity),
          } as Parameters<MapboxMap["addLayer"]>[0], map.getLayer(circleId) ? circleId : undefined);
        }
        if (visible && sourceReady && config.kind === "point" && !map.getLayer(circleId)) {
          map.addLayer({
            id: circleId, type: "circle", source: sid,
            ...sourceLayerRef,
            ...(config.heatmap ? { minzoom: config.heatmap.pointsFromZoom } : {}),
            ...(filter ? { filter } : {}),
            layout: { visibility: "none" },
            paint: {
              "circle-radius": pointRadius("M", scale[config.key] ?? 1),
              "circle-color": pointColor(config.key),
              "circle-opacity": clampOpacity(opacity[config.key]),
              ...pointStroke(config.key, opacity[config.key], isDark),
            },
          });
        }

        if (visible && sourceReady && config.kind === "polygon") {
          const defaultOpacity = Number(paramDefault(config.key, `${config.key}Opacity`) ?? 1);
          if (!map.getLayer(fillId)) {
            map.addLayer({
              id: fillId, type: "fill", source: sid,
              ...sourceLayerRef,
              ...(filter ? { filter } : {}),
              layout: { visibility: "none" },
              paint: hookFillPaint(config.key, fillId, { "fill-color": JP_TOURISM_COLORS[config.key], "fill-opacity": clampOpacity(opacity[config.key]) }, { "fill-color": JP_TOURISM_COLORS[config.key], "fill-opacity": defaultOpacity }),
            });
          }
          if (!map.getLayer(lineId)) {
            map.addLayer({
              id: lineId, type: "line", source: sid,
              ...sourceLayerRef,
              ...(filter ? { filter } : {}),
              layout: { visibility: "none", ...hookLineLayout(config.key, lineId) },
              paint: hookLinePaint(config.key, lineId, { "line-color": JP_TOURISM_COLORS[config.key], "line-opacity": Math.min(1, clampOpacity(opacity[config.key]) + 0.25), "line-width": 0.8 }, { "line-color": JP_TOURISM_COLORS[config.key], "line-opacity": Math.min(1, defaultOpacity + 0.25), "line-width": 0.8 }, isDark),
            });
          }
        }

        if (config.heatmap && map.getLayer(heatmapId)) {
          map.setLayoutProperty(heatmapId, "visibility", visible ? "visible" : "none");
          map.setPaintProperty(heatmapId, "heatmap-opacity", heatmapOpacity(heatScale));
          if (filter) map.setFilter(heatmapId, filter);
        }

        const ids = config.kind === "point" ? [circleId] : [fillId, lineId];
        for (const id of ids) {
          if (!map.getLayer(id)) continue;
          map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
          if (config.kind === "point") {
            map.setPaintProperty(id, "circle-opacity", clampOpacity(opacity[config.key]));
            map.setPaintProperty(id, "circle-radius", pointRadius("M", scale[config.key] ?? 1));
            const stroke = pointStroke(config.key, opacity[config.key], isDark);
            for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(id, prop, stroke[prop]);
            if (filter) map.setFilter(id, filter);
          } else if (id === fillId) {
            const defaultOpacity = Number(paramDefault(config.key, `${config.key}Opacity`) ?? 1);
            map.setPaintProperty(id, "fill-opacity", hookFillOpacity(config.key, fillId, clampOpacity(opacity[config.key]), defaultOpacity));
          } else {
            const defaultOpacity = Number(paramDefault(config.key, `${config.key}Opacity`) ?? 1);
            map.setPaintProperty(id, "line-opacity", hookLineOpacity(config.key, lineId, Math.min(1, clampOpacity(opacity[config.key]) + 0.25), Math.min(1, defaultOpacity + 0.25), isDark));
          }
        }
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visibility, opacity, scale, ramsarMode, isDarkTheme, mapTick, dataTick]);
}
