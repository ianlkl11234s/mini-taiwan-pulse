import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { IE_BATHYMETRY } from "../data/ieDataLayers";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 愛爾蘭海床地形（INFOMAR，第 1 波）：預先著色＋陰影的 raster PNG PMTiles（z4–10）。
 * 比照 `useCaHillshadeLayer`：插在底圖第一個 symbol 下、地球儀走 pmtilesRasterCustomSource；靜態、不訂閱時間、沒有 popup。
 */
export const IE_BATHYMETRY_RASTER_ID = "ie-bathymetry-raster";

const SOURCE: SourceSpec = {
  id: "ie-bathymetry", file: IE_BATHYMETRY.file, minzoom: 4, maxzoom: 10,
  attribution: `${IE_BATHYMETRY.sourceOrg}（${IE_BATHYMETRY.license}）`, loading: "愛爾蘭海床地形載入中", raster: { tileSize: 256 },
};
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useIeBathymetryLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number) {
  useGbPmtilesLayers(mapRef, SOURCE, visible, () => [{
    id: IE_BATHYMETRY_RASTER_ID,
    layer: () => ({
      id: IE_BATHYMETRY_RASTER_ID, type: "raster", source: SOURCE.id, minzoom: SOURCE.minzoom,
      layout: { visibility: "none" }, paint: { "raster-opacity": clamp01(opacity), "raster-fade-duration": 0 },
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(IE_BATHYMETRY_RASTER_ID, "raster-opacity", clamp01(opacity)),
    before: firstSymbolLayerId,
  }], [opacity]);
}
