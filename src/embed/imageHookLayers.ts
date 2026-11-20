/**
 * 嵌入用「影像疊圖」圖層（30 天地圖挑戰 Day 8／17／19）
 *
 * 這些圖層在主站是專屬 hook 用 Mapbox image source 自己掛的（overlay 引擎不收 image source），
 * 不在 `overlayRegistry`，所以 embed 照 `snapshotLayers.ts` 的作法重述一份**靜態版**規格：
 * - 網址、四角、類別色、線寬點徑等全部 import 主站同一份 Types／Style 常數，只重述 paint 結構；
 * - 參數名稱與預設值對齊 `layers/hosts/mapchallengeHosts.tsx`（網址 `p.*` 帶入，沒帶就用預設）；
 * - 只讀 CDN 靜態檔（png／jpg／geojson），不碰 Supabase。
 *
 * 不收：Day 17「入夜變亮」（mapchallengeDay17NightFall）—— 它依時間軸的太陽高度逐格亮起，
 * embed 沒有時間軸，畫不出同樣的意思。
 *
 * 刻意不 import `hooks/use*Layer.ts`：會把 loadingRegistry 與 mapbox 專屬程式拖進 embed bundle。
 * 圖層 id 與主站 hook 相同，方便對照與除錯。
 */
import type { LayerVisibility } from "../types";
import { LINE_OPACITY, LINE_WIDTH, POINT_STROKE, RASTER, pointRadius, pointStrokeColor } from "../map/mapStyleScale";
import {
  MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION, MAPCHALLENGE_DAY08_PLAN_CORNERS, MAPCHALLENGE_DAY08_PLAN_URL,
} from "../data/mapchallengeDay08Types";
import {
  MAPCHALLENGE_DAY17_ATTRIBUTION, MAPCHALLENGE_DAY17_IMAGE_CORNERS, MAPCHALLENGE_DAY17_PROTECTED_FILL_OPACITY,
  MAPCHALLENGE_DAY17_PROTECTED_URL, mapchallengeDay17Product, mapchallengeDay17ProtectedLineColor,
} from "../data/mapchallengeDay17Types";
import {
  MAPCHALLENGE_DAY19_DUMPING_URL, MAPCHALLENGE_DAY19_FACILITIES_URL, MAPCHALLENGE_DAY19_IMAGE_CORNERS,
  MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION, MAPCHALLENGE_DAY19_WIND_URL, mapchallengeDay19Wind,
} from "../data/mapchallengeDay19Types";
import {
  mapchallengeDay19DumpingColor, mapchallengeDay19FacilityColorExpr, mapchallengeDay19WindColor,
} from "../data/mapchallengeDay19Style";

type Corners = [[number, number], [number, number], [number, number], [number, number]];
type Params = Record<string, number>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type LayerSpec = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ImageHookLayerSpec {
  /** 影像（png／jpg，Web Mercator）—— 插在底圖第一個 symbol 下，不蓋地名 */
  image: { sourceId: string; url: string; corners: Corners; layer: LayerSpec };
  /** 向量 geojson source（url 為主站同一份相對路徑） */
  geojson: { sourceId: string; url: string }[];
  /** 疊在最上的向量圖層（順序即繪製順序）；可點的會進 popup */
  vectorLayers: LayerSpec[];
  attribution: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function rasterLayer(id: string, source: string, opacity: number, nearest: boolean): LayerSpec {
  return {
    id, type: "raster", source,
    paint: { "raster-opacity": opacity, "raster-fade-duration": 0, ...(nearest ? { "raster-resampling": "nearest" } : {}) },
  };
}

/** Day 8：1955 中和鄉都市計畫圖（同 useMapchallengeDay08PlanLayer，預設透明度 0.5） */
function day08Plan(_isDark: boolean, p: Params): ImageHookLayerSpec {
  const sourceId = "mapchallenge-day08-plan1955";
  return {
    image: {
      sourceId, url: MAPCHALLENGE_DAY08_PLAN_URL, corners: MAPCHALLENGE_DAY08_PLAN_CORNERS,
      layer: rasterLayer("mapchallenge-day08-plan1955-raster", sourceId, clamp01(p.mapchallengeDay08Plan1955Opacity ?? 0.5), false),
    },
    geojson: [],
    vectorLayers: [],
    attribution: MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION,
  };
}

/** Day 17：真正的黑夜（同 useMapchallengeDay17DarkSkyLayer；ProductIdx 0＝天空光害推估、1＝2025 地面亮度） */
function day17DarkSky(isDark: boolean, p: Params): ImageHookLayerSpec {
  const sourceId = "mapchallenge-day17-dark-sky";
  const protectedId = "mapchallenge-day17-protected";
  const lineColor = mapchallengeDay17ProtectedLineColor(isDark);
  return {
    image: {
      sourceId, url: mapchallengeDay17Product(p.mapchallengeDay17DarkSkyProductIdx ?? 0).url, corners: MAPCHALLENGE_DAY17_IMAGE_CORNERS,
      layer: rasterLayer("mapchallenge-day17-dark-sky-raster", sourceId, clamp01(p.mapchallengeDay17DarkSkyOpacity ?? RASTER.opacity), true),
    },
    geojson: [{ sourceId: protectedId, url: MAPCHALLENGE_DAY17_PROTECTED_URL }],
    vectorLayers: [
      { id: "mapchallenge-day17-protected-fill", type: "fill", source: protectedId,
        paint: { "fill-color": lineColor, "fill-opacity": MAPCHALLENGE_DAY17_PROTECTED_FILL_OPACITY } },
      { id: "mapchallenge-day17-protected-line", type: "line", source: protectedId, layout: { "line-join": "round" },
        paint: {
          "line-color": lineColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, LINE_WIDTH.standard[0], 14, LINE_WIDTH.standard[1]],
          "line-opacity": LINE_OPACITY.standard,
        } },
    ],
    attribution: MAPCHALLENGE_DAY17_ATTRIBUTION,
  };
}

/** Day 19：設施氣味潛勢＋風（同 useMapchallengeDay19PotentialLayer；設施、風箭頭預設開，棄置場址預設關） */
function day19Potential(isDark: boolean, p: Params): ImageHookLayerSpec {
  const sourceId = "mapchallenge-day19-potential";
  const fac = "mapchallenge-day19-facilities";
  const wind = "mapchallenge-day19-wind";
  const dump = "mapchallenge-day19-dumping";
  const VECTOR_OPACITY = { point: 0.9, wind: 0.85 };
  const value = clamp01(p.mapchallengeDay19PotentialOpacity ?? RASTER.opacity);
  const factor = Math.min(1 / VECTOR_OPACITY.point, value / RASTER.opacity);
  const w = mapchallengeDay19Wind(p.mapchallengeDay19PotentialWindIdx ?? 0);
  const on = (v: number | undefined, dflt: 0 | 1) => (v ?? dflt) !== 0;
  const vis = (show: boolean) => ({ visibility: show ? "visible" : "none" });
  return {
    image: {
      sourceId, url: w.url, corners: MAPCHALLENGE_DAY19_IMAGE_CORNERS,
      layer: rasterLayer("mapchallenge-day19-potential-raster", sourceId, value, true),
    },
    geojson: [
      { sourceId: fac, url: MAPCHALLENGE_DAY19_FACILITIES_URL },
      { sourceId: wind, url: MAPCHALLENGE_DAY19_WIND_URL },
      { sourceId: dump, url: MAPCHALLENGE_DAY19_DUMPING_URL },
    ],
    vectorLayers: [
      { id: "mapchallenge-day19-dumping-circle", type: "circle", source: dump, layout: vis(on(p.mapchallengeDay19PotentialDumping, 0)),
        paint: {
          "circle-color": mapchallengeDay19DumpingColor(isDark),
          "circle-radius": pointRadius("S", 0.75),
          "circle-opacity": VECTOR_OPACITY.point * factor,
          "circle-stroke-width": POINT_STROKE.width,
          "circle-stroke-color": isDark ? "#0a0a14" : "#ffffff",
          "circle-stroke-opacity": Math.min(1, 0.8 * factor),
        } },
      { id: "mapchallenge-day19-wind-line", type: "line", source: wind,
        layout: { ...vis(on(p.mapchallengeDay19PotentialArrows, 1) && w.season !== null), "line-cap": "round", "line-join": "round" },
        filter: ["==", ["get", "season"], w.season ?? "__none__"],
        paint: {
          "line-color": mapchallengeDay19WindColor(isDark),
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, LINE_WIDTH.standard[0] * 1.5, 10, LINE_WIDTH.emphasis[0], 14, LINE_WIDTH.emphasis[1]],
          "line-opacity": Math.min(1, VECTOR_OPACITY.wind * factor),
        } },
      { id: "mapchallenge-day19-facilities-circle", type: "circle", source: fac, layout: vis(on(p.mapchallengeDay19PotentialFacilities, 1)),
        paint: {
          "circle-color": mapchallengeDay19FacilityColorExpr(isDark),
          "circle-radius": pointRadius("S"),
          "circle-opacity": VECTOR_OPACITY.point * factor,
          "circle-stroke-width": POINT_STROKE.width,
          "circle-stroke-color": pointStrokeColor(isDark),
          "circle-stroke-opacity": Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * factor),
        } },
    ],
    attribution: MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION,
  };
}

const BUILDERS: Readonly<Partial<Record<keyof LayerVisibility, (isDark: boolean, p: Params) => ImageHookLayerSpec>>> = {
  mapchallengeDay08Plan1955: day08Plan,
  mapchallengeDay17DarkSky: day17DarkSky,
  mapchallengeDay19Potential: day19Potential,
};

export const IMAGE_HOOK_KEYS = Object.keys(BUILDERS) as (keyof LayerVisibility)[];

export function isImageHookLayer(key: string): boolean {
  return key in BUILDERS;
}

export function imageHookLayerSpec(key: keyof LayerVisibility, isDark: boolean, params: Params = {}): ImageHookLayerSpec | null {
  return BUILDERS[key]?.(isDark, params) ?? null;
}
