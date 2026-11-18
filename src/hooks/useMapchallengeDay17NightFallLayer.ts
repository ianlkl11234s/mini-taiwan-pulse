import { useEffect, useRef } from "react";
import type { CanvasSource, Map as MapboxMap, SourceSpecification } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import { nightLightIntensity, solarElevationDeg, solarFrame } from "../utils/solarElevation";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  MAPCHALLENGE_DAY17_GROUND_URL, MAPCHALLENGE_DAY17_IMAGE_BOUNDS, MAPCHALLENGE_DAY17_IMAGE_CORNERS,
  MAPCHALLENGE_DAY17_MASK_GRID, MAPCHALLENGE_DAY17_NIGHT_FALL_THROTTLE_MS, MAPCHALLENGE_DAY17_NIGHT_LIGHTS_ATTRIBUTION,
} from "../data/mapchallengeDay17Types";

/**
 * 30 天地圖挑戰 Day 17「入夜變亮」：2025 地面亮度 PNG 依時間軸的太陽高度逐地亮起。
 *
 * Mapbox 的 raster-opacity 只能整層一個值，所以改用 canvas source：
 * 每次時間變動（節流 0.5 秒）在 48×48 經緯格上算格中心的太陽高度 → 亮度（太陽 ≥ 0° 為 0，降到 −8° 全亮，
 * smoothstep；與船舶「漁火模擬」同一支 nightLightIntensity），把這張小遮罩平滑放大後用 destination-in
 * 疊到影像上，等於逐像素依經緯度不同時亮起。canvas source 設 animate:false，只在遮罩變了才 play→pause 上傳一次貼圖。
 * 全暗（白天）時直接隱藏圖層、不畫。時間一律走 timeStore 訂閱，不進 React deps。
 */
const SOURCE_ID = "mapchallenge-day17-night-fall";
const LAYER_ID = "mapchallenge-day17-night-fall-raster";

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/** 遮罩格每一格中心的經緯度（影像是 3857：x 對經度線性、y 對麥卡托 y 線性） */
function gridCenters(): { lng: number; lat: number }[] {
  const { cols, rows } = MAPCHALLENGE_DAY17_MASK_GRID;
  const { west, east, north, south } = MAPCHALLENGE_DAY17_IMAGE_BOUNDS;
  const yN = mercY(north);
  const yS = mercY(south);
  const out: { lng: number; lat: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = latOfMercY(yN + ((r + 0.5) / rows) * (yS - yN));
    for (let c = 0; c < cols; c++) out.push({ lng: west + ((c + 0.5) / cols) * (east - west), lat });
  }
  return out;
}

/** 各格亮度量化成 0–255（遮罩 alpha） */
export function mapchallengeDay17MaskAlpha(unixSec: number, centers: readonly { lng: number; lat: number }[]): Uint8ClampedArray {
  const frame = solarFrame(unixSec);
  const out = new Uint8ClampedArray(centers.length);
  centers.forEach((p, i) => { out[i] = Math.round(nightLightIntensity(solarElevationDeg(frame, p.lat, p.lng)) * 255); });
  return out;
}

export function useMapchallengeDay17NightFallLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      return;
    }
    let disposed = false;
    const { cols, rows } = MAPCHALLENGE_DAY17_MASK_GRID;
    const centers = gridCenters();
    const canvas = document.createElement("canvas");
    const mask = document.createElement("canvas");
    mask.width = cols;
    mask.height = rows;
    const maskCtx = mask.getContext("2d");
    const ctx = canvas.getContext("2d");
    const maskData = maskCtx?.createImageData(cols, rows);
    let image: HTMLImageElement | null = null;
    let lastKey = "";

    const ensureLayer = () => {
      if (!image) return false;
      if (!map.getSource(SOURCE_ID)) {
        // canvas source 是 runtime 專用（不在 style spec 裡），mapbox-gl 型別的 addSource 聯集沒有收，只能轉型
        map.addSource(SOURCE_ID, { type: "canvas", canvas, coordinates: MAPCHALLENGE_DAY17_IMAGE_CORNERS, animate: false } as unknown as SourceSpecification);
        const src = map.getSource(SOURCE_ID) as { attribution?: string } | undefined;
        if (src) src.attribution = MAPCHALLENGE_DAY17_NIGHT_LIGHTS_ATTRIBUTION;
        lastKey = "";
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID, type: "raster", source: SOURCE_ID, layout: { visibility: "none" },
          paint: { "raster-opacity": opacityRef.current, "raster-resampling": "nearest", "raster-fade-duration": 0 },
        }, firstSymbolLayerId(map));
      }
      return true;
    };

    const render = (unixSec: number) => {
      if (disposed || !image || !ctx || !maskCtx || !maskData) return;
      try {
        if (!ensureLayer()) return;
        const alpha = mapchallengeDay17MaskAlpha(unixSec, centers);
        let max = 0;
        for (const a of alpha) if (a > max) max = a;
        map.setLayoutProperty(LAYER_ID, "visibility", max === 0 ? "none" : "visible");
        if (max === 0) return;
        const key = alpha.join(",");
        if (key === lastKey) return;
        lastKey = key;
        alpha.forEach((a, i) => {
          maskData.data[i * 4] = 255; maskData.data[i * 4 + 1] = 255; maskData.data[i * 4 + 2] = 255; maskData.data[i * 4 + 3] = a;
        });
        maskCtx.putImageData(maskData, 0, 0);
        ctx.globalCompositeOperation = "copy";
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = "destination-in";
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
        const src = map.getSource(SOURCE_ID) as CanvasSource | undefined;
        // animate:false 的 canvas source：play→pause 會在 pause 內重新上傳一次貼圖
        src?.play();
        src?.pause();
        map.triggerRepaint();
      } catch { /* style 轉換中，下一次時間變動再畫 */ }
    };

    const img = new Image();
    img.onload = () => {
      if (disposed) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      image = img;
      render(timeStore.getTime());
    };
    img.src = MAPCHALLENGE_DAY17_GROUND_URL;
    keepLoadingUntilMapIdle(map, `${SOURCE_ID}:render`, "入夜變亮 載入中", SOURCE_ID, 8000);

    const onStyleLoad = () => { lastKey = ""; render(timeStore.getTime()); };
    map.on("style.load", onStyleLoad);
    const unsubscribe = timeStore.subscribeThrottled(MAPCHALLENGE_DAY17_NIGHT_FALL_THROTTLE_MS, render);
    return () => {
      disposed = true;
      unsubscribe();
      map.off("style.load", onStyleLoad);
      img.onload = null;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* map 可能已銷毀 */ }
    };
  }, [mapRef, visible, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !map) return;
    try { if (map.getLayer(LAYER_ID)) map.setPaintProperty(LAYER_ID, "raster-opacity", Math.max(0, Math.min(1, opacity))); } catch { /* style 轉換中 */ }
  }, [mapRef, opacity, visible, mapTick]);
}
