import { useEffect, useRef } from "react";
import type { ImageSource, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { LINE_WIDTH, POINT_STROKE, RASTER, pointRadius, pointStrokeColor } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  MAPCHALLENGE_DAY19_DUMPING_URL, MAPCHALLENGE_DAY19_FACILITIES_URL, MAPCHALLENGE_DAY19_IMAGE_CORNERS, MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION,
  MAPCHALLENGE_DAY19_WIND_URL, mapchallengeDay19Wind,
} from "../data/mapchallengeDay19Types";
import { mapchallengeDay19DumpingColor, mapchallengeDay19FacilityColorExpr, mapchallengeDay19WindColor } from "../data/mapchallengeDay19Style";

/**
 * 30 天地圖挑戰 Day 19「設施氣味潛勢＋風」：潛勢 PNG（不計風／冬季／夏季，Mapbox image source，切風向時 updateImage）
 * ＋ 設施點、盛行風箭頭、列管廢棄物棄置場址三份 geojson。
 * overlay 引擎不收 image source，所以比照 Day 17 真正的黑夜自己掛：raster 插在底圖第一個 symbol 下（不蓋地名），
 * 向量疊在最上（棄置場址 → 風箭頭 → 設施點）；style.load 後重掛。透明度滑桿同時乘在全部子圖層（四鐵則 1）。
 * gisClickRegistry 收 facilities-circle／dumping-circle／wind-line；raster 沒有 popup。
 */
const IMAGE_SOURCE_ID = "mapchallenge-day19-potential";
const RASTER_LAYER_ID = "mapchallenge-day19-potential-raster";
const FACILITIES_SOURCE_ID = "mapchallenge-day19-facilities";
const WIND_SOURCE_ID = "mapchallenge-day19-wind";
const DUMPING_SOURCE_ID = "mapchallenge-day19-dumping";
export const MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID = "mapchallenge-day19-facilities-circle";
export const MAPCHALLENGE_DAY19_WIND_LAYER_ID = "mapchallenge-day19-wind-line";
export const MAPCHALLENGE_DAY19_DUMPING_LAYER_ID = "mapchallenge-day19-dumping-circle";
const LAYER_IDS = [RASTER_LAYER_ID, MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, MAPCHALLENGE_DAY19_WIND_LAYER_ID, MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID];

/** 點與箭頭在滑桿預設（RASTER.opacity）時的透明度 */
const VECTOR_OPACITY = { point: 0.9, wind: 0.85 } as const;
/** 棄置場址比設施小一號（S 階 × 0.75）：只是疊看的參考點 */
const DUMPING_SIZE = 0.75;

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useMapchallengeDay19PotentialLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  windIdx: number,
  showFacilities: boolean,
  showArrows: boolean,
  showDumping: boolean,
  isDark: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const value = Math.max(0, Math.min(1, opacity));
    const factor = Math.min(1 / VECTOR_OPACITY.point, value / RASTER.opacity);
    const wind = mapchallengeDay19Wind(windIdx);
    const mount = () => {
      let loading = false;
      const img = map.getSource(IMAGE_SOURCE_ID) as ImageSource | undefined;
      if (!img) {
        map.addSource(IMAGE_SOURCE_ID, { type: "image", url: wind.url, coordinates: MAPCHALLENGE_DAY19_IMAGE_CORNERS });
        // image source 型別沒有 attribution 欄位：補在 instance 上，右下 AttributionBar 才收得到
        const src = map.getSource(IMAGE_SOURCE_ID) as { attribution?: string } | undefined;
        if (src) src.attribution = MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION;
        urlRef.current = wind.url;
        loading = true;
      } else if (urlRef.current !== wind.url) {
        img.updateImage({ url: wind.url, coordinates: MAPCHALLENGE_DAY19_IMAGE_CORNERS });
        urlRef.current = wind.url;
        loading = true;
      }
      for (const [id, url] of [[FACILITIES_SOURCE_ID, MAPCHALLENGE_DAY19_FACILITIES_URL], [WIND_SOURCE_ID, MAPCHALLENGE_DAY19_WIND_URL], [DUMPING_SOURCE_ID, MAPCHALLENGE_DAY19_DUMPING_URL]] as const) {
        if (!map.getSource(id)) {
          map.addSource(id, { type: "geojson", data: url, attribution: MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION });
          loading = true;
        }
      }
      const wasVisible = map.getLayer(RASTER_LAYER_ID) && map.getLayoutProperty(RASTER_LAYER_ID, "visibility") === "visible";
      if (!map.getLayer(RASTER_LAYER_ID)) {
        map.addLayer({
          id: RASTER_LAYER_ID, type: "raster", source: IMAGE_SOURCE_ID, layout: { visibility: "none" },
          // 推估值影像：nearest（map-layers G-4 量測值影像）
          paint: { "raster-opacity": value, "raster-resampling": "nearest", "raster-fade-duration": 0 },
        }, firstSymbolLayerId(map));
      }
      if (!map.getLayer(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID)) {
        map.addLayer({ id: MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, type: "circle", source: DUMPING_SOURCE_ID, layout: { visibility: "none" }, paint: {} });
      }
      if (!map.getLayer(MAPCHALLENGE_DAY19_WIND_LAYER_ID)) {
        map.addLayer({
          id: MAPCHALLENGE_DAY19_WIND_LAYER_ID, type: "line", source: WIND_SOURCE_ID, layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: {},
        });
      }
      if (!map.getLayer(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID)) {
        map.addLayer({ id: MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, type: "circle", source: FACILITIES_SOURCE_ID, layout: { visibility: "none" }, paint: {} });
      }
      const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      show(RASTER_LAYER_ID, true);
      show(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, showFacilities);
      show(MAPCHALLENGE_DAY19_WIND_LAYER_ID, showArrows && wind.season !== null);
      show(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, showDumping);
      map.setPaintProperty(RASTER_LAYER_ID, "raster-opacity", value);
      // 點：P-1 S 階（661 個設施在全台視角用 M 階會蓋掉潛勢底色），P-2 描邊
      const stroke = { color: pointStrokeColor(isDark), opacity: POINT_STROKE.opacity[isDark ? "dark" : "light"] * factor };
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-color", mapchallengeDay19FacilityColorExpr(isDark) as never);
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-radius", pointRadius("S"));
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-opacity", VECTOR_OPACITY.point * factor);
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-stroke-width", POINT_STROKE.width);
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-stroke-color", stroke.color);
      map.setPaintProperty(MAPCHALLENGE_DAY19_FACILITIES_LAYER_ID, "circle-stroke-opacity", Math.min(1, stroke.opacity));
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-color", mapchallengeDay19DumpingColor(isDark));
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-radius", pointRadius("S", DUMPING_SIZE));
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-opacity", VECTOR_OPACITY.point * factor);
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-stroke-width", POINT_STROKE.width);
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-stroke-color", isDark ? "#0a0a14" : "#ffffff");
      map.setPaintProperty(MAPCHALLENGE_DAY19_DUMPING_LAYER_ID, "circle-stroke-opacity", Math.min(1, 0.8 * factor));
      // 風箭頭：只畫所選季節；L-1 強調階（全台視角也要看得到方向）
      map.setFilter(MAPCHALLENGE_DAY19_WIND_LAYER_ID, ["==", ["get", "season"], wind.season ?? "__none__"]);
      map.setPaintProperty(MAPCHALLENGE_DAY19_WIND_LAYER_ID, "line-color", mapchallengeDay19WindColor(isDark));
      map.setPaintProperty(MAPCHALLENGE_DAY19_WIND_LAYER_ID, "line-width", ["interpolate", ["linear"], ["zoom"], 7, LINE_WIDTH.standard[0] * 1.5, 10, LINE_WIDTH.emphasis[0], 14, LINE_WIDTH.emphasis[1]]);
      map.setPaintProperty(MAPCHALLENGE_DAY19_WIND_LAYER_ID, "line-opacity", Math.min(1, VECTOR_OPACITY.wind * factor));
      if (loading || !wasVisible) keepLoadingUntilMapIdle(map, `${IMAGE_SOURCE_ID}:render`, "設施氣味潛勢 載入中", IMAGE_SOURCE_ID, 8000);
    };
    const onStyleLoad = () => { urlRef.current = null; mount(); };

    mount();
    map.on("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, visible, opacity, windIdx, showFacilities, showArrows, showDumping, isDark, mapTick]);
}
