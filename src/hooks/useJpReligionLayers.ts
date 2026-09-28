import { useEffect, useRef, useState } from "react";
import type { CircleLayer, ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import {
  fetchJpReligionOsm,
  fetchJpReligionWikidata,
} from "../data/jpReligionLoader";
import { JP_RELIGION_COLOR_EXPRESSION } from "../data/jpReligionTypes";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { mapSeamColor, POINT_STROKE, pointRadius } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";

const GSI_SOURCE_ID = "jp-religion-gsi";
const GSI_SOURCE_LAYER = "jp_religion_gsi";
const GSI_LAYER_ID = "jp-religion-gsi-circle";
const OSM_SOURCE_ID = "jp-religion-osm";
const OSM_LAYER_ID = "jp-religion-osm-circle";
const WIKIDATA_SOURCE_ID = "jp-religion-wikidata";
const WIKIDATA_LAYER_ID = "jp-religion-wikidata-circle";

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function circleLayer(
  id: string,
  source: string,
  radius: number | ExpressionSpecification,
  opacity: number,
  strokeOpacity: number,
  isDark: boolean,
  sourceLayer?: string,
): CircleLayer {
  return {
    id,
    type: "circle",
    source,
    ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": radius,
      "circle-color": JP_RELIGION_COLOR_EXPRESSION as unknown as ExpressionSpecification,
      "circle-opacity": clampOpacity(opacity),
      "circle-stroke-color": mapSeamColor(isDark),
      "circle-stroke-width": POINT_STROKE.width,
      "circle-stroke-opacity": strokeOpacity,
    },
  } as CircleLayer;
}

const pointStrokeOpacity = (opacity: number, defaultOpacity: number, isDark: boolean) =>
  Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * clampOpacity(opacity) / defaultOpacity);

function gsiAbsoluteUrl(): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/jp_religion_gsi.pmtiles`;
  return new URL(relative, window.location.href).href;
}

function useGsiLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDarkTheme: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(GSI_LAYER_ID)) map.setLayoutProperty(GSI_LAYER_ID, "visibility", "none");
      return;
    }

    const mount = () => {
      const isDark = isDarkTheme;
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(GSI_SOURCE_ID)) {
        map.addSource(GSI_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: gsiAbsoluteUrl(),
          minzoom: 4,
          maxzoom: 14,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(GSI_LAYER_ID)) {
        // 圖層不設 maxzoom；z15+ 必須 overzoom z14 tiles，不能變空白。
        map.addLayer(circleLayer(
          GSI_LAYER_ID,
          GSI_SOURCE_ID,
          pointRadius("M", scale),
          opacity,
          pointStrokeOpacity(opacity, 0.6, isDark),
          isDark,
          GSI_SOURCE_LAYER,
        ));
      }
      if (map.getLayer(GSI_LAYER_ID)) {
        map.setLayoutProperty(GSI_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(GSI_LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(GSI_LAYER_ID, "circle-radius", pointRadius("M", scale));
        map.setPaintProperty(GSI_LAYER_ID, "circle-stroke-color", mapSeamColor(isDark));
        map.setPaintProperty(GSI_LAYER_ID, "circle-stroke-width", POINT_STROKE.width);
        map.setPaintProperty(GSI_LAYER_ID, "circle-stroke-opacity", pointStrokeOpacity(opacity, 0.6, isDark));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick]);
}

interface GeoJsonLayerConfig {
  sourceId: string;
  layerId: string;
  fetcher: () => Promise<GeoJSON.FeatureCollection>;
  logName: string;
}

function useGeoJsonLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  config: GeoJsonLayerConfig,
  isDarkTheme: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    config.fetcher()
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        setDataTick((tick) => tick + 1);
      })
      .catch((error) => console.warn(`[JpReligion:${config.logName}] load failed:`, error));
    return () => { cancelled = true; };
  }, [visible, config.fetcher, config.logName]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(config.layerId)) {
        map.setLayoutProperty(config.layerId, "visibility", "none");
      }
      return;
    }
    if (!dataRef.current) return;

    const mount = () => {
      const isDark = isDarkTheme;
      if (!dataRef.current) return;
      if (!map.getSource(config.sourceId)) {
        map.addSource(config.sourceId, { type: "geojson", data: dataRef.current });
      }
      if (!map.getLayer(config.layerId)) {
        map.addLayer(circleLayer(
          config.layerId,
          config.sourceId,
          pointRadius("M", scale),
          opacity,
          pointStrokeOpacity(opacity, 0.75, isDark),
          isDark,
          undefined,
        ));
      }
      if (map.getLayer(config.layerId)) {
        map.setLayoutProperty(config.layerId, "visibility", "visible");
        map.setPaintProperty(config.layerId, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(config.layerId, "circle-radius", pointRadius("M", scale));
        map.setPaintProperty(config.layerId, "circle-stroke-color", mapSeamColor(isDark));
        map.setPaintProperty(config.layerId, "circle-stroke-width", POINT_STROKE.width);
        map.setPaintProperty(config.layerId, "circle-stroke-opacity", pointStrokeOpacity(opacity, 0.75, isDark));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [
    mapRef,
    visible,
    opacity,
    scale,
    mapTick,
    dataTick,
    config.sourceId,
    config.layerId,
    isDarkTheme,
  ]);
}

const OSM_CONFIG: GeoJsonLayerConfig = {
  sourceId: OSM_SOURCE_ID,
  layerId: OSM_LAYER_ID,
  fetcher: fetchJpReligionOsm,
  logName: "OSM",
};

const WIKIDATA_CONFIG: GeoJsonLayerConfig = {
  sourceId: WIKIDATA_SOURCE_ID,
  layerId: WIKIDATA_LAYER_ID,
  fetcher: fetchJpReligionWikidata,
  logName: "Wikidata",
};

export interface JpReligionLayerVisibility {
  jpReligionGsi: boolean;
  jpReligionOsm: boolean;
  jpReligionWikidata: boolean;
}

export interface JpReligionLayerOpacity {
  jpReligionGsi: number;
  jpReligionOsm: number;
  jpReligionWikidata: number;
}

export interface JpReligionLayerScale {
  jpReligionGsi: number;
  jpReligionOsm: number;
  jpReligionWikidata: number;
}

/** 三個 raw source/layer 保持獨立，不做前端融合。 */
export function useJpReligionLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpReligionLayerVisibility,
  opacity: JpReligionLayerOpacity,
  scale: JpReligionLayerScale,
  isDarkTheme = true,
) {
  useGsiLayer(mapRef, visibility.jpReligionGsi, opacity.jpReligionGsi, scale.jpReligionGsi, isDarkTheme);
  useGeoJsonLayer(
    mapRef,
    visibility.jpReligionOsm,
    opacity.jpReligionOsm,
    scale.jpReligionOsm,
    OSM_CONFIG,
    isDarkTheme,
  );
  useGeoJsonLayer(
    mapRef,
    visibility.jpReligionWikidata,
    opacity.jpReligionWikidata,
    scale.jpReligionWikidata,
    WIKIDATA_CONFIG,
    isDarkTheme,
  );
}
