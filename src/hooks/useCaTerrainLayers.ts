import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { CA_HILLSHADE_SOURCE, CA_PLACE_GROUPS, CA_PLACE_NAMES_SOURCE } from "../data/caInfraTypes";
import { caCatColor, caCatFilter } from "./useCaTransportLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 加拿大第 2 波地名與地形（CGNDB 地名、MRDEM-30 山體陰影）。靜態 PMTiles、不訂閱時間。
 * 地名：圖磚已依官方 relevance_scale 逐級出現（z3 約 300 個、z12 全部），所以不另畫熱區；只畫依群組上色的點、名稱放 popup。
 * 不畫文字標籤：PMTiles／vector source 的 symbol placement 會讓 Mapbox 整張地圖 render 中止（overlayRegistry 既有規則，本機實測 updateLayerOpacities 崩潰）。
 * 山體陰影：raster PNG（z3–8），比照英國 gbTerrainHillshade 插在底圖第一個 symbol 下、地球儀走 pmtilesRasterCustomSource。
 */
export const CA_PLACE_NAMES_CIRCLE_ID = "ca-place-names-circle";
export const CA_HILLSHADE_RASTER_ID = "ca-terrain-hillshade-raster";

type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const sig = (v: unknown) => JSON.stringify(v);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};

const PLACE_SOURCE: SourceSpec = { id: "ca-place-names", file: "ca_place_names.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_PLACE_NAMES_SOURCE.short, loading: "加拿大地名載入中" };
export const caPlaceGroupFilter = (mask: number | undefined) => caCatFilter("group", CA_PLACE_GROUPS, mask);

export function useCaPlaceNamesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const key = "caPlaceNames";
  const def = Number(paramDefault(key, `${key}Opacity`) ?? 0.85);
  const s = scale / Number(paramDefault(key, `${key}Scale`) ?? 1);
  const filter = caPlaceGroupFilter(catMask);
  const op = clamp01(opacity);
  const circlePaint = () => ({
    "circle-radius": pointRadius("S", s * 0.8), "circle-color": caCatColor("group", CA_PLACE_GROUPS), "circle-opacity": op,
    ...pointStrokePaint(isDark, op / def),
  });
  useGbPmtilesLayers(mapRef, PLACE_SOURCE, visible, () => [
    {
      id: CA_PLACE_NAMES_CIRCLE_ID,
      layer: () => ({
        id: CA_PLACE_NAMES_CIRCLE_ID, type: "circle", source: PLACE_SOURCE.id, "source-layer": "ca_place_names", minzoom: 2,
        ...(filter ? { filter } : {}), layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "relevance_scale"], 0] }, paint: circlePaint(),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(CA_PLACE_NAMES_CIRCLE_ID, (filter ?? null) as any); setPaint(map, CA_PLACE_NAMES_CIRCLE_ID, circlePaint()); },
    },
  ], [opacity, scale, isDark, sig(filter)]);
}

// ─────────────────────────── 山體陰影（raster，z3–8） ───────────────────────────

const HILLSHADE_SOURCE: SourceSpec = {
  id: "ca-terrain-hillshade", file: "ca_terrain_hillshade.pmtiles", minzoom: 3, maxzoom: 8,
  attribution: CA_HILLSHADE_SOURCE.short, loading: "加拿大山體陰影載入中", raster: { tileSize: 256 },
};
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useCaHillshadeLayer(mapRef: MapRef, visible: boolean, opacity: number) {
  useGbPmtilesLayers(mapRef, HILLSHADE_SOURCE, visible, () => [{
    id: CA_HILLSHADE_RASTER_ID,
    layer: () => ({
      id: CA_HILLSHADE_RASTER_ID, type: "raster", source: HILLSHADE_SOURCE.id, minzoom: HILLSHADE_SOURCE.minzoom,
      layout: { visibility: "none" }, paint: { "raster-opacity": clamp01(opacity), "raster-fade-duration": 0 },
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(CA_HILLSHADE_RASTER_ID, "raster-opacity", clamp01(opacity)),
    before: firstSymbolLayerId,
  }], [opacity]);
}
