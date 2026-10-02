import { useEffect, useRef, useState } from "react";
import type { CircleLayer, ExpressionSpecification, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import { fetchJpReligionWikidata } from "../data/jpReligionLoader";
import { JP_RELIGION_COLOR_EXPRESSION } from "../data/jpReligionTypes";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, heatmapOpacity, heatmapPaint, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const GSI_SOURCE_ID = "jp-religion-gsi";
const GSI_SOURCE_LAYER = "jp_religion_gsi";
const GSI_LAYER_ID = "jp-religion-gsi-circle";
const GSI_HEATMAP_LAYER_ID = "jp-religion-gsi-heatmap";
const OSM_SOURCE_ID = "jp-religion-osm";
const OSM_SOURCE_LAYER = "jp_religion_osm";
const OSM_LAYER_ID = "jp-religion-osm-circle";
const WIKIDATA_SOURCE_ID = "jp-religion-wikidata";
const WIKIDATA_LAYER_ID = "jp-religion-wikidata-circle";

const GSI_OPACITY_DEFAULT = Number(paramDefault("jpReligionGsi", "jpReligionGsiOpacity"));
const OSM_OPACITY_DEFAULT = Number(paramDefault("jpReligionOsm", "jpReligionOsmOpacity"));
const WIKIDATA_OPACITY_DEFAULT = Number(paramDefault("jpReligionWikidata", "jpReligionWikidataOpacity"));

// GSI 的 PMTiles 從 z4 起就是全量 167,037 點，拉遠糊成一片。R5（P-4／G-2）：> 100k 點
// z < 12 畫 magma 熱區、z ≥ 12 才畫點（原本 z8 以下不畫描邊的例外因此不再需要）。
const GSI_POINTS_FROM_ZOOM = densePointsFromZoom(167_037);

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function circleLayer(
  id: string,
  source: string,
  radius: number | ExpressionSpecification,
  opacity: number,
  strokeOpacityFactor: number,
  isDark: boolean,
  sourceLayer?: string,
  minzoom?: number,
): CircleLayer {
  return {
    id,
    type: "circle",
    source,
    ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
    ...(minzoom !== undefined ? { minzoom } : {}),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": radius,
      "circle-color": JP_RELIGION_COLOR_EXPRESSION as unknown as ExpressionSpecification,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, strokeOpacityFactor),
    },
  } as CircleLayer;
}

/** G-2 熱區：畫在出點縮放以下（maxzoom 見 heatmapMaxzoom），不可點擊。 */
function heatmapLayer(id: string, source: string, sourceLayer: string, pointsFromZoom: number, opacityScale: number): HeatmapLayer {
  return {
    id,
    type: "heatmap",
    source,
    "source-layer": sourceLayer,
    maxzoom: heatmapMaxzoom(pointsFromZoom),
    layout: { visibility: "none" },
    paint: heatmapPaint(opacityScale),
  } as HeatmapLayer;
}

const strokeFactor = (opacity: number, defaultOpacity: number) => clampOpacity(opacity) / defaultOpacity;

function worldAbsoluteUrl(file: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${file}`;
  return new URL(relative, window.location.href).href;
}

interface PmtilesLayerConfig {
  sourceId: string;
  sourceLayer: string;
  layerId: string;
  /** public/world/ 下的檔名 */
  file: string;
  opacityDefault: number;
  /** 密集點（P-4）：出點縮放以下改畫熱區；不指定則照舊全縮放畫點。 */
  heatmap?: { layerId: string; pointsFromZoom: number };
}

function usePmtilesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDarkTheme: boolean,
  config: PmtilesLayerConfig,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const { sourceId, sourceLayer, layerId, file, opacityDefault, heatmap } = config;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      if (heatmap && map.getLayer(heatmap.layerId)) map.setLayoutProperty(heatmap.layerId, "visibility", "none");
      return;
    }

    const mount = () => {
      const isDark = isDarkTheme;
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: PMTILES_SOURCE_TYPE,
          url: worldAbsoluteUrl(file),
          minzoom: 4,
          maxzoom: 14,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      // 透明度滑桿按比例同時控制熱區（0.8 × 滑桿 ÷ 預設）。
      const heatScale = clampOpacity(opacity) / opacityDefault;
      if (heatmap) {
        if (!map.getLayer(heatmap.layerId)) {
          map.addLayer(heatmapLayer(heatmap.layerId, sourceId, sourceLayer, heatmap.pointsFromZoom, heatScale));
        }
        if (map.getLayer(heatmap.layerId)) {
          map.setLayoutProperty(heatmap.layerId, "visibility", "visible");
          map.setPaintProperty(heatmap.layerId, "heatmap-opacity", heatmapOpacity(heatScale));
        }
      }
      if (!map.getLayer(layerId)) {
        // 圖層不設 maxzoom；z15+ 必須 overzoom z14 tiles，不能變空白。
        map.addLayer(circleLayer(
          layerId,
          sourceId,
          pointRadius("M", scale),
          opacity,
          strokeFactor(opacity, opacityDefault),
          isDark,
          sourceLayer,
          heatmap?.pointsFromZoom,
        ));
      }
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", "visible");
        map.setPaintProperty(layerId, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(layerId, "circle-radius", pointRadius("M", scale));
        {
          const stroke = pointStrokePaint(isDark, strokeFactor(opacity, opacityDefault));
          map.setPaintProperty(layerId, "circle-stroke-color", stroke["circle-stroke-color"]);
          map.setPaintProperty(layerId, "circle-stroke-width", stroke["circle-stroke-width"]);
          map.setPaintProperty(layerId, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
        }
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick, sourceId, sourceLayer, layerId, file, opacityDefault, heatmap]);
}

const GSI_CONFIG: PmtilesLayerConfig = {
  sourceId: GSI_SOURCE_ID,
  sourceLayer: GSI_SOURCE_LAYER,
  layerId: GSI_LAYER_ID,
  file: "jp_religion_gsi.pmtiles",
  opacityDefault: GSI_OPACITY_DEFAULT,
  heatmap: { layerId: GSI_HEATMAP_LAYER_ID, pointsFromZoom: GSI_POINTS_FROM_ZOOM },
};

// 2026-09-30 PF-4：原 10.9 MB 整包 GeoJSON → PMTiles（-r1 全量 71,040 點，Z4–z14 比照 GSI；
// scripts/preprocess/build-static-pmtiles-pf4.py）。屬性 id／religion／name 與 popup 契約不變。
const OSM_CONFIG: PmtilesLayerConfig = {
  sourceId: OSM_SOURCE_ID,
  sourceLayer: OSM_SOURCE_LAYER,
  layerId: OSM_LAYER_ID,
  file: "jp_religion_osm_20260930.pmtiles",
  opacityDefault: OSM_OPACITY_DEFAULT,
};

interface GeoJsonLayerConfig {
  sourceId: string;
  layerId: string;
  fetcher: () => Promise<GeoJSON.FeatureCollection>;
  logName: string;
  opacityDefault: number;
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
          strokeFactor(opacity, config.opacityDefault),
          isDark,
          undefined,
        ));
      }
      if (map.getLayer(config.layerId)) {
        map.setLayoutProperty(config.layerId, "visibility", "visible");
        map.setPaintProperty(config.layerId, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(config.layerId, "circle-radius", pointRadius("M", scale));
        {
          const stroke = pointStrokePaint(isDark, strokeFactor(opacity, config.opacityDefault));
          map.setPaintProperty(config.layerId, "circle-stroke-color", stroke["circle-stroke-color"]);
          map.setPaintProperty(config.layerId, "circle-stroke-width", stroke["circle-stroke-width"]);
          map.setPaintProperty(config.layerId, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
        }
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

const WIKIDATA_CONFIG: GeoJsonLayerConfig = {
  sourceId: WIKIDATA_SOURCE_ID,
  layerId: WIKIDATA_LAYER_ID,
  fetcher: fetchJpReligionWikidata,
  logName: "Wikidata",
  opacityDefault: WIKIDATA_OPACITY_DEFAULT,
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
  usePmtilesLayer(mapRef, visibility.jpReligionGsi, opacity.jpReligionGsi, scale.jpReligionGsi, isDarkTheme, GSI_CONFIG);
  usePmtilesLayer(mapRef, visibility.jpReligionOsm, opacity.jpReligionOsm, scale.jpReligionOsm, isDarkTheme, OSM_CONFIG);
  useGeoJsonLayer(
    mapRef,
    visibility.jpReligionWikidata,
    opacity.jpReligionWikidata,
    scale.jpReligionWikidata,
    WIKIDATA_CONFIG,
    isDarkTheme,
  );
}
