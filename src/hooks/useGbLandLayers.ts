import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_OS_TERRAIN_ATTRIBUTION, GB_SURPLUS_ATTRIBUTION, GB_SURPLUS_COLOR, GB_SURPLUS_MINZOOM, GB_SURPLUS_STATUSES, GB_SURPLUS_STROKE_WIDTH,
  GB_SURPLUS_TILE_ZOOM, GB_TERRAIN_TILE_ZOOM,
} from "../data/gbLandTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國 C003 地形兩層（OS Terrain 50 raster PNG PMTiles，已上色成品、沒有 feature 可點）與 C028 公有地標售（點）。
 * 地形插在底圖第一個 symbol 下（不蓋地名與向量 overlay），山體陰影疊在色別標高之上。靜態資料、不訂閱時間。
 */
export type GbTerrainKey = "gbTerrainHillshade" | "gbTerrainRelief";
export const GB_TERRAIN_RASTER_IDS: Readonly<Record<GbTerrainKey, string>> = {
  gbTerrainHillshade: "gb-terrain-hillshade-raster",
  gbTerrainRelief: "gb-terrain-relief-raster",
};
export const GB_SURPLUS_LAND_CIRCLE_ID = "gb-surplus-land-circle";

type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);

const TERRAIN_SOURCES: Readonly<Record<GbTerrainKey, SourceSpec>> = {
  gbTerrainHillshade: {
    id: "gb-terrain-hillshade", file: "gb_terrain_hillshade.pmtiles", ...GB_TERRAIN_TILE_ZOOM,
    attribution: GB_OS_TERRAIN_ATTRIBUTION, loading: "英國山體陰影載入中",
  },
  gbTerrainRelief: {
    id: "gb-terrain-relief", file: "gb_terrain_relief.pmtiles", ...GB_TERRAIN_TILE_ZOOM,
    attribution: GB_OS_TERRAIN_ATTRIBUTION, loading: "英國色別標高載入中",
  },
};

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}
/** 色別標高插在山體陰影下（若已掛）；山體陰影插在第一個 symbol 下。 */
function terrainBefore(key: GbTerrainKey, map: MapboxMap): string | undefined {
  if (key === "gbTerrainRelief" && map.getLayer(GB_TERRAIN_RASTER_IDS.gbTerrainHillshade)) return GB_TERRAIN_RASTER_IDS.gbTerrainHillshade;
  return firstSymbolLayerId(map);
}

/** 單一地形 raster：只有透明度。 */
export function useGbTerrainLayer(mapRef: MapRef, key: GbTerrainKey, visible: boolean, opacity: number) {
  const source = TERRAIN_SOURCES[key];
  const id = GB_TERRAIN_RASTER_IDS[key];
  useGbPmtilesLayers(mapRef, source, visible, () => [{
    id,
    layer: () => ({
      id, type: "raster", source: source.id, minzoom: GB_TERRAIN_TILE_ZOOM.minzoom,
      layout: { visibility: "none" }, paint: { "raster-opacity": clamp01(opacity), "raster-fade-duration": 0 },
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(id, "raster-opacity", clamp01(opacity)),
    before: (map) => terrainBefore(key, map),
  }], [key, opacity]);
}

// ─────────────────────────── 公有地標售 ───────────────────────────

const SURPLUS_SOURCE: SourceSpec = {
  id: "gb-surplus-land", file: "gb_surplus_land.pmtiles", ...GB_SURPLUS_TILE_ZOOM,
  attribution: GB_SURPLUS_ATTRIBUTION, loading: "英國公有地標售載入中",
};

/**
 * 標售進度：同一色相，填色強度由淡到強（尚未上市空心 → 洽談中 → 上市中實心）。
 * 尚未上市＝同色空心框（資料編碼描邊，比照第 8 波文化設施 OSM 補缺）；其餘用底圖色細縫（P-2）。
 */
const IS_NOT_ON_MARKET = ["==", ["get", "sale_status"], "not_on_market"];
function surplusFill(op: number): unknown[] {
  const expr: unknown[] = ["match", ["coalesce", ["get", "sale_status"], ""]];
  for (const s of GB_SURPLUS_STATUSES) expr.push(s.value, op * s.fill);
  expr.push(op * GB_SURPLUS_STATUSES[0]!.fill);
  return expr;
}
function surplusPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbSurplusLand", 0.9));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbSurplusLand")),
    "circle-color": GB_SURPLUS_COLOR,
    "circle-opacity": surplusFill(op),
    "circle-stroke-color": ["case", IS_NOT_ON_MARKET, GB_SURPLUS_COLOR, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_NOT_ON_MARKET, GB_SURPLUS_STROKE_WIDTH, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_NOT_ON_MARKET, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbSurplusLandLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, SURPLUS_SOURCE, visible, () => [{
    id: GB_SURPLUS_LAND_CIRCLE_ID,
    layer: () => ({
      id: GB_SURPLUS_LAND_CIRCLE_ID, type: "circle", source: SURPLUS_SOURCE.id, "source-layer": "gb_surplus_land",
      minzoom: GB_SURPLUS_MINZOOM, layout: { visibility: "none" }, paint: surplusPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      for (const [k, v] of Object.entries(surplusPaint(isDark, opacity, scale))) map.setPaintProperty(GB_SURPLUS_LAND_CIRCLE_ID, k as any, v as any);
    },
  }], [opacity, scale, isDark]);
}
