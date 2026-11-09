import { useEffect } from "react";
import type { LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_MUNICIPAL_ROAD,
  JP_MUNICIPAL_ROAD_COLOR,
  JP_MUNICIPAL_ROAD_MAXZOOM,
  JP_MUNICIPAL_ROAD_MINZOOM,
  JP_MUNICIPAL_ROAD_SHARDS,
  JP_ROAD_ATTRIBUTION,
} from "../data/jpRoadTypes";
import { lineWidthExpr } from "../map/mapStyleScale";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

type Shard = (typeof JP_MUNICIPAL_ROAD_SHARDS)[number];

const SOURCE_LAYER = "jp_municipal_roads";
/** 契約：每片 PMTiles z12–14（z15 起 overzoom），屬性 width_class／road_state（非通常部才有）／toll（有料才有）。 */
const FILE_VERSION: Record<Shard, string> = {
  hokkaido_tohoku: "3e25e8eae43e",
  kanto: "10367e9deeef",
  chubu: "54ac90f758cf",
  kinki: "9f8fa3dca46d",
  chugoku_shikoku: "807f1894b1c9",
  kyushu_okinawa: "db3393ad79bd",
};
const OPACITY_DEFAULT = Number(paramDefault("jpMunicipalRoads", "jpMunicipalRoadsOpacity"));
/** 插在主要道路之下，讓國道／縣道畫在市町村道上面。 */
const BEFORE_LAYER_IDS = ["jp-major-roads-z5-line", "jp-major-roads-line"];

/** layer id 寫成字面值：gisClickRegistry 的點擊登記由 mapInteractionLayers 測試逐字比對。 */
const LAYER_ID: Record<Shard, string> = {
  hokkaido_tohoku: "jp-municipal-roads-hokkaido_tohoku-line",
  kanto: "jp-municipal-roads-kanto-line",
  chubu: "jp-municipal-roads-chubu-line",
  kinki: "jp-municipal-roads-kinki-line",
  chugoku_shikoku: "jp-municipal-roads-chugoku_shikoku-line",
  kyushu_okinawa: "jp-municipal-roads-kyushu_okinawa-line",
};
export const jpMunicipalRoadsSourceId = (shard: Shard) => `jp-municipal-roads-${shard}`;
export const jpMunicipalRoadsLayerId = (shard: Shard) => LAYER_ID[shard];
export const JP_MUNICIPAL_ROADS_LAYER_IDS = JP_MUNICIPAL_ROAD_SHARDS.map(jpMunicipalRoadsLayerId);

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(shard: Shard): string {
  const v = FILE_VERSION[shard];
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/jp_municipal_roads_${shard}.pmtiles?v=${v}`;
  return new URL(relative, window.location.href).href;
}

function lineLayer(shard: Shard, opacity: number): LineLayer {
  const id = jpMunicipalRoadsLayerId(shard);
  const width = lineWidthExpr(JP_MUNICIPAL_ROAD.tier);
  return {
    id,
    type: "line",
    source: jpMunicipalRoadsSourceId(shard),
    "source-layer": SOURCE_LAYER,
    minzoom: JP_MUNICIPAL_ROAD_MINZOOM,
    layout: { visibility: "none", ...hookLineLayout("jpMunicipalRoads", id) },
    paint: hookLinePaint(
      "jpMunicipalRoads", id,
      { "line-color": JP_MUNICIPAL_ROAD_COLOR, "line-width": width, "line-opacity": clampOpacity(opacity) },
      { "line-color": JP_MUNICIPAL_ROAD_COLOR, "line-width": width, "line-opacity": OPACITY_DEFAULT },
    ),
  } as LineLayer;
}

/**
 * 日本市町村道（N13_003=3 市区町村道等）：全國 6 片靜態 PMTiles，同一樣式；z12 起才畫，拉遠由視野提示卡說明「放大到 z12」（map-layers §3.8 V-3）。
 * 與主要道路（jpMajorRoads）分層，只畫最細一階、淡色，插在主要道路之下。N13 沒有路名欄。
 */
export function useJpMunicipalRoadsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of JP_MUNICIPAL_ROADS_LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      const before = BEFORE_LAYER_IDS.find((id) => map.getLayer(id));
      for (const shard of JP_MUNICIPAL_ROAD_SHARDS) {
        const sourceId = jpMunicipalRoadsSourceId(shard);
        if (!map.getSource(sourceId)) {
          sourceAdded = true;
          map.addSource(sourceId, {
            type: PMTILES_SOURCE_TYPE,
            url: absoluteUrl(shard),
            attribution: JP_ROAD_ATTRIBUTION,
            minzoom: JP_MUNICIPAL_ROAD_MINZOOM,
            maxzoom: JP_MUNICIPAL_ROAD_MAXZOOM,
          } as any);
        }
        const id = jpMunicipalRoadsLayerId(shard);
        if (!map.getLayer(id)) map.addLayer(lineLayer(shard, opacity), before);
        map.setLayoutProperty(id, "visibility", "visible");
        map.setPaintProperty(id, "line-opacity", hookLineOpacity("jpMunicipalRoads", id, clampOpacity(opacity), OPACITY_DEFAULT));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-municipal-roads:render", "市町村道 載入中", jpMunicipalRoadsSourceId("kanto"));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick]);
}
